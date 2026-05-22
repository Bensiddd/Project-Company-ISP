import { Router } from 'express';
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { callAI } from '../services/ai-providers.js';
import { decrypt } from '../utils/encryption.js';
import { syncChatToContactMessage } from '../services/sync-contact-message.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = resolve(__dirname, '../../uploads/identity');

const router = Router();
const pollingIntervals = {};

// Per-conversation lock to prevent duplicate AI processing
// Key: "botId:chatId", Value: true when processing
const processingLocks = new Set();

// Track last processed update_id per bot to skip duplicates
const lastUpdateId = {};


async function sendBotMessage(botToken, chatId, text) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const json = await resp.json();
    if (!json.ok) json.description = json.description || 'Unknown Telegram API error';
    return json;
  } catch (e) {
    return { ok: false, description: 'Network error: ' + e.message };
  }
}

async function sendBotMessageWithKeyboard(botToken, chatId, text, keyboard) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: keyboard } })
    });
    const json = await resp.json();
    if (!json.ok) json.description = json.description || 'Unknown Telegram API error';
    return json;
  } catch (e) {
    return { ok: false, description: 'Network error: ' + e.message };
  }
}

async function answerCallbackQuery(botToken, callbackQueryId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false })
    });
  } catch (e) { /* ignore */ }
}

async function saveMessage(botId, chatId, role, message, convoId) {
  await db.insert('INSERT INTO telegram_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)', [convoId, botId, chatId, role, message]);
  await db.run('UPDATE telegram_conversations SET last_message=?, unread=unread+1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [message, convoId]);
}

async function getOrCreateConversation(botId, chatId, userName) {
  let convo = await db.get('SELECT * FROM telegram_conversations WHERE bot_id=? AND chat_id=?', [botId, chatId]);
  if (!convo) {
    await db.run('INSERT IGNORE INTO telegram_conversations (bot_id, chat_id, user_name, status) VALUES (?, ?, ?, ?)', [botId, chatId, userName || '', 'ai']);
    convo = await db.get('SELECT * FROM telegram_conversations WHERE bot_id=? AND chat_id=?', [botId, chatId]);
  }
  return convo;
}

function isCooldownActive(convo) {
  if (!convo.cooldown_until) {
    console.log('[Cooldown] No cooldown for convo', convo.id, 'chat', convo.chat_id);
    return false;
  }
  const now = Date.now();
  const cooldown = new Date(convo.cooldown_until).getTime();
  const remaining = Math.round((cooldown - now) / 1000);
  console.log('[Cooldown] convo', convo.id, 'chat', convo.chat_id, 'remaining', remaining, 's');
  return cooldown > now;
}

function formatCooldownRemaining(convo) {
  if (!isCooldownActive(convo)) return null;
  const diff = new Date(convo.cooldown_until) - new Date();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
}

async function isCooldownBlocked(convo) {
  if (!isCooldownActive(convo)) return false;
  try {
    const pending = JSON.parse(convo.pending_data || '{}');
    let ticketId = pending.ticket_id;
    if (!ticketId) {
      const ticket = await db.get('SELECT id, status FROM tickets WHERE telegram_conversation_id = ? ORDER BY created_at DESC LIMIT 1', [convo.id]);
      if (ticket) ticketId = ticket.id;
    }
    if (ticketId) {
      const ticket = await db.get('SELECT status FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket || ticket.status === 'closed' || ticket.status === 'resolved') {
        await db.run('UPDATE telegram_conversations SET cooldown_until=NULL WHERE id=?', [convo.id]);
        return false;
      }
    } else {
      await db.run('UPDATE telegram_conversations SET cooldown_until=NULL WHERE id=?', [convo.id]);
      return false;
    }
  } catch (e) { /* ignore */ }
  return true;
}

const COOLDOWN_MS = 6 * 60 * 60 * 1000;

const MAIN_MENU = [
  [{ text: '🎫 Buat Ticket', callback_data: 'create_ticket' }],
  [{ text: '📶 Upgrade Bandwidth', callback_data: 'upgrade' }],
  [{ text: '🔧 Instalasi Baru', callback_data: 'install' }],
  [{ text: '💬 Bicara dengan CS', callback_data: 'talk_to_cs' }]
];

const PACKAGE_KEYBOARD = [
  [{ text: 'Starter — Rp160rb/10Mbps', callback_data: 'upgrade_pkg_starter' }],
  [{ text: 'Professional — Rp400rb/50Mbps', callback_data: 'upgrade_pkg_professional' }],
  [{ text: 'Enterprise — Hubungi Kami', callback_data: 'upgrade_pkg_enterprise' }],
  [{ text: '⬅️ Kembali ke Menu', callback_data: 'back_to_menu' }]
];

const CANCEL_KEYBOARD = [
  [{ text: '⬅️ Batal', callback_data: 'back_to_menu' }]
];

const END_SESSION_KEYBOARD = [
  [{ text: '✅ Akhiri Sesi CS', callback_data: 'end_session' }]
];

const IDENTITY_KEYBOARD = [
  [{ text: '⏭️ Lewati', callback_data: 'skip_identity' }],
  [{ text: '⬅️ Batal', callback_data: 'back_to_menu' }]
];

async function sendMainMenu(bot, chatId, userName) {
  await db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE bot_id=? AND chat_id=?', ['idle', '', bot.id, String(chatId)]);
  const welcome = `Halo ${userName || 'Sobat MAZNET'}! 👋\n\nSelamat datang di layanan CS MAZNET. Silakan pilih opsi di bawah:`;
  await sendBotMessageWithKeyboard(bot.bot_token, chatId, welcome, MAIN_MENU);
}

async function createTicketFromTelegram(type, title, description, conversationId) {
  return await db.insert('INSERT INTO tickets (type, status, priority, title, description, telegram_conversation_id) VALUES (?, ?, ?, ?, ?, ?)', [type, 'open', 'medium', title, description, conversationId || null]);
}

async function processAI(bot, chatId, userText, userName) {
  if (!bot || bot.role !== 'customer_service') return;
  const lockKey = `${bot.id}:${chatId}`;
  if (processingLocks.has(lockKey)) return;
  processingLocks.add(lockKey);

  try {
    const convo = await getOrCreateConversation(bot.id, String(chatId), userName);
    await saveMessage(bot.id, String(chatId), 'user', userText, convo.id);
    await syncChatToContactMessage('telegram', bot.id, String(chatId), userName, userText);

    if (await isCooldownBlocked(convo) && convo.status !== 'human' && !['/start', '/stop', 'menu', 'batal'].includes(userText.toLowerCase())) {
      const remaining = formatCooldownRemaining(convo);
      await sendBotMessage(bot.bot_token, String(chatId), '⏳ Mohon tunggu sebelum menggunakan fitur ini.');
      return;
    }

    if (convo.status === 'ended') {
      if (userText === '/start') {
        await db.run('UPDATE telegram_conversations SET status=?, state=?, pending_data=? WHERE id=?', ['ai', 'idle', '', convo.id]);
        await sendMainMenu(bot, String(chatId), userName);
      } else if (userText === '/stop') {
        await sendBotMessage(bot.bot_token, String(chatId), '🙏 Sesi sudah diakhiri. Ketik /start untuk memulai ulang.');
      }
      return;
    }

    if (userText.toLowerCase() === '/stop') {
      await db.run('UPDATE telegram_conversations SET status=?, state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['ended', 'idle', '', convo.id]);
      const reply = '🙏 Sesi diakhiri. Terima kasih telah menghubungi MAZNET. Jika ada yang bisa dibantu, ketik /start kapan saja.';
      await sendBotMessage(bot.bot_token, String(chatId), reply);
      await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      return;
    }

    if (userText.toLowerCase() === 'menu' || userText.toLowerCase() === 'batal') {
      await sendMainMenu(bot, String(chatId), userName);
      return;
    }

    if (convo.status === 'human') {
      return;
    }

    const state = convo.state || 'idle';

    if (state === 'awaiting_ticket_name') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), name: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_customer_id', JSON.stringify(pending), convo.id]);
      const reply = 'Terima kasih, ' + userText + '!\n\n📝 Silakan masukkan **ID Pelanggan** Anda:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_ticket_customer_id') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), customer_id: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_address', JSON.stringify(pending), convo.id]);
      const reply = '📝 Silakan masukkan **Alamat** lengkap Anda:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_ticket_address') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), address: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_phone', JSON.stringify(pending), convo.id]);
      const reply = '📝 Silakan masukkan **Nomor HP** Anda:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_ticket_phone') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), phone: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_identity', JSON.stringify(pending), convo.id]);
      const reply = '📝 Silakan masukkan **Nomor Identitas** (KTP/SIM) atau Lewati jika tidak ada:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, IDENTITY_KEYBOARD);
      return;
    }

    if (state === 'awaiting_ticket_identity') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), identity: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_location', JSON.stringify(pending), convo.id]);
      const reply = '📍 Silakan **share lokasi** Anda (kirim location via attachment) atau ketik alamat lokasi:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_ticket_location') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), location: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_description', JSON.stringify(pending), convo.id]);
      const reply = '🎫 Silakan tulis **keluhan** Anda dengan detail:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_ticket_description') {
      const pending = JSON.parse(convo.pending_data || '{}');
      const fullDescription = [
        'Nama: ' + (pending.name || '-'),
        'ID Pelanggan: ' + (pending.customer_id || '-'),
        'Alamat: ' + (pending.address || '-'),
        'No HP: ' + (pending.phone || '-'),
        'Identitas: ' + (pending.identity || '-'),
        'Lokasi: ' + (pending.location || '-'),
        '',
        'Keluhan: ' + userText
      ].join('\n');
      const ticketId = await createTicketFromTelegram('maintenance', '[Telegram] ' + (pending.name || userName) + ' - Laporan Gangguan', fullDescription, convo.id);
      const cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, cooldown_until=? WHERE id=?', ['idle', JSON.stringify({ ticket_id: ticketId }), cooldownUntil, convo.id]);
      const reply = '✅ Laporan gangguan Anda telah diterima. Tim kami akan segera menangani.';
      const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
      if (msg.ok) await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      await sendMainMenu(bot, String(chatId), userName);
      return;
    }

    if (state === 'awaiting_upgrade_customer_id') {
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_upgrade_package', JSON.stringify({ customer_id: userText }), convo.id]);
      const reply = 'Terima kasih! ID Pelanggan: ' + userText + '\n\nSilakan pilih paket upgrade yang diinginkan:';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, PACKAGE_KEYBOARD);
      return;
    }

    if (state === 'awaiting_install_name') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), name: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_install_customer_id', JSON.stringify(pending), convo.id]);
      const reply = 'Terima kasih, ' + userText + '!\n\n🔧 Silakan masukkan **ID Pelanggan** (jika sudah berlangganan) atau ketik *baru* untuk pelanggan baru:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_install_customer_id') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), customer_id: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_install_address', JSON.stringify(pending), convo.id]);
      const reply = '🔧 Silakan masukkan **Alamat** lengkap instalasi:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_install_address') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), address: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_install_phone', JSON.stringify(pending), convo.id]);
      const reply = '🔧 Silakan masukkan **Nomor HP** Anda:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_install_phone') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), phone: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_install_identity', JSON.stringify(pending), convo.id]);
      const reply = '🔧 Silakan kirim **Foto KTP/SIM** atau ketik **Nomor Identitas** Anda:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_install_identity') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), identity: userText };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_install_location', JSON.stringify(pending), convo.id]);
      const reply = '📍 Silakan **share lokasi** instalasi (kirim location via attachment) atau ketik alamat lokasi:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_install_location') {
      const pending = JSON.parse(convo.pending_data || '{}');
      const fullDescription = [
        'Nama: ' + (pending.name || '-'),
        'ID Pelanggan: ' + (pending.customer_id || '-'),
        'Alamat: ' + (pending.address || '-'),
        'No HP: ' + (pending.phone || '-'),
        'Identitas: ' + (pending.identity || '-'),
        'Lokasi: ' + userText,
        '',
        'Permintaan Instalasi Baru'
      ].join('\n');
      const ticketId = await createTicketFromTelegram('installation', '[Telegram] ' + (pending.name || userName) + ' - Permintaan Instalasi', fullDescription, convo.id);
      const cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, cooldown_until=? WHERE id=?', ['idle', JSON.stringify({ ticket_id: ticketId }), cooldownUntil, convo.id]);
      const reply = '✅ Terima kasih, data permintaan instalasi Anda sudah kami terima.\n\nTim kami akan segera menghubungi Anda untuk konfirmasi melalui **WhatsApp** atau **Telegram**. Mohon tunggu.';
      const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
      if (msg.ok) await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      await sendMainMenu(bot, String(chatId), userName);
      return;
    }

    if (bot.ai_enabled && bot.ai_api_key) {
      const history = await db.all('SELECT role, message FROM telegram_messages WHERE conversation_id=? ORDER BY id DESC LIMIT 10', [convo.id]);
      const defaultModels = { openai: 'gpt-4o-mini', openrouter: 'openai/gpt-4o-mini', gemini: 'gemini-2.0-flash', claude: 'claude-3-haiku-20240307', custom: '' };
      const resolvedModel = bot.ai_model || defaultModels[bot.ai_provider] || '';
      const apiKey = decrypt(bot.ai_api_key);
      const result = await callAI(bot.ai_provider || 'openai', resolvedModel, apiKey, userText, bot.ai_url, history.reverse(), bot.system_prompt);

      if (result.ok) {
        const reply = result.text;
        const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
        if (msg.ok) await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
        if (msg.ok && convo.status === 'ai') {
          await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), 'Ada lagi yang bisa kami bantu? Pilih menu di bawah:', MAIN_MENU);
        }
      } else {
        const errMsg = '⚠️ Maaf, terjadi kesalahan: ' + (result.error || 'Unknown error');
        await sendBotMessage(bot.bot_token, String(chatId), errMsg);
      }
    } else {
      const isThankYou = /terima kasih|makasih|thanks|thx|thank/i.test(userText);
      const reply = isThankYou
        ? 'Sama-sama! Ada lagi yang bisa saya bantu? 😊'
        : 'Ada yang bisa saya bantu? Silakan pilih menu di bawah:';
      const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
      if (msg.ok) await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      await sendMainMenu(bot, String(chatId), userName);
    }
  } catch (error) {
    console.error('AI Processing Error:', error);
  } finally {
    processingLocks.delete(lockKey);
  }
}

async function processLocation(bot, chatId, location, userName) {
  const convo = await getOrCreateConversation(bot.id, String(chatId), userName);

  if (await isCooldownBlocked(convo) && convo.status !== 'human') {
    const remaining = formatCooldownRemaining(convo);
    await sendBotMessage(bot.bot_token, String(chatId), '⏳ Mohon tunggu sebelum menggunakan fitur ini.');
    return;
  }

  const lat = location.latitude;
  const lon = location.longitude;
  const locText = 'https://maps.google.com/?q=' + lat + ',' + lon;
  await saveMessage(bot.id, String(chatId), 'user', '📍 Lokasi: ' + locText, convo.id);

  const state = convo.state || 'idle';

  if (state === 'awaiting_ticket_location') {
    const pending = { ...JSON.parse(convo.pending_data || '{}'), location: locText };
    await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_description', JSON.stringify(pending), convo.id]);
    const reply = '📍 Lokasi diterima!\n\n🎫 Silakan tulis **keluhan** Anda dengan detail:\n\n(Ketik *batal* untuk membatalkan)';
    await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
    return;
  }

  if (state === 'awaiting_install_location') {
    const pending = JSON.parse(convo.pending_data || '{}');
    const fullDescription = [
      'Nama: ' + (pending.name || '-'),
      'ID Pelanggan: ' + (pending.customer_id || '-'),
      'Alamat: ' + (pending.address || '-'),
      'No HP: ' + (pending.phone || '-'),
      'Identitas: ' + (pending.identity || '-'),
      'Lokasi: ' + locText,
      '',
      'Permintaan Instalasi Baru'
    ].join('\n');
    const ticketId = await createTicketFromTelegram('installation', '[Telegram] ' + (pending.name || userName) + ' - Permintaan Instalasi', fullDescription, convo.id);
    const cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, cooldown_until=? WHERE id=?', ['idle', JSON.stringify({ ticket_id: ticketId }), cooldownUntil, convo.id]);
    const reply = '✅ Terima kasih, data permintaan instalasi Anda sudah kami terima.\n\nTim kami akan segera menghubungi Anda untuk konfirmasi melalui **WhatsApp** atau **Telegram**. Mohon tunggu.';
    const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
    if (msg.ok) await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
    await sendMainMenu(bot, String(chatId), userName);
    return;
  }

  const reply = '📍 Lokasi diterima! Silakan pilih menu:';
  await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, MAIN_MENU);
}

async function processPhoto(bot, chatId, photoArray, userName) {
  const convo = await getOrCreateConversation(bot.id, String(chatId), userName);

  if (await isCooldownBlocked(convo) && convo.status !== 'human') {
    await sendBotMessage(bot.bot_token, String(chatId), '⏳ Mohon tunggu sebelum menggunakan fitur ini.');
    return;
  }

  const fileId = photoArray.at(-1).file_id;

  try {
    const fileResp = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getFile?file_id=${fileId}`);
    const fileData = await fileResp.json();
    if (!fileData.ok) throw new Error(fileData.description);

    const filePath = fileData.result.file_path;
    const ext = filePath.split('.').pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const downloadResp = await fetch(`https://api.telegram.org/file/bot${bot.bot_token}/${filePath}`);
    if (!downloadResp.ok) throw new Error('Failed to download photo');
    const buffer = Buffer.from(await downloadResp.arrayBuffer());
    fs.writeFileSync(resolve(UPLOADS_DIR, filename), buffer);

    const photoUrl = `/uploads/identity/${filename}`;
    await saveMessage(bot.id, String(chatId), 'user', '📷 Foto identitas: ' + photoUrl, convo.id);

    const state = convo.state || 'idle';

    if (state === 'awaiting_install_identity') {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), identity: photoUrl };
      await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_install_location', JSON.stringify(pending), convo.id]);
      const reply = '✅ Foto identitas diterima!\n\n📍 Silakan **share lokasi** instalasi (kirim location via attachment) atau ketik alamat lokasi:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
    } else {
      await sendBotMessage(bot.bot_token, String(chatId), '📷 Foto diterima!');
    }
  } catch (error) {
    console.error('Photo Processing Error:', error);
    await sendBotMessage(bot.bot_token, String(chatId), '⚠️ Gagal memproses foto. Silakan coba kirim ulang atau ketik nomor identitas.');
  }
}

async function processCallbackQuery(bot, callbackQuery) {
  if (!bot || bot.role !== 'customer_service') return;
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userName = callbackQuery.from.first_name || 'User';
  const callbackId = callbackQuery.id;

  await answerCallbackQuery(bot.bot_token, callbackId, '⏳ Memproses...');

  try {
    const convo = await getOrCreateConversation(bot.id, String(chatId), userName);

    if (await isCooldownBlocked(convo) && data !== 'talk_to_cs' && data !== 'end_session' && data !== 'back_to_menu' && data !== 'skip_identity') {
      await sendBotMessage(bot.bot_token, String(chatId), '⏳ Mohon tunggu sebelum menggunakan fitur ini.');
      return;
    }

    switch (data) {
      case 'create_ticket': {
        await answerCallbackQuery(bot.bot_token, callbackId, 'Masukkan nama');
        await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_name', '{}', convo.id]);
        const reply = '📝 Silakan masukkan **Nama** Anda:\n\n(Ketik *batal* untuk membatalkan)';
        await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
        break;
      }
      case 'upgrade': {
        await answerCallbackQuery(bot.bot_token, callbackId, 'Masukkan ID pelanggan');
        await db.run('UPDATE telegram_conversations SET state=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_upgrade_customer_id', convo.id]);
        const reply = '📶 Silakan masukkan ID pelanggan Anda:\n\n(Ketik *batal* untuk membatalkan)';
        await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
        break;
      }
      case 'install': {
        await answerCallbackQuery(bot.bot_token, callbackId, 'Masukkan nama');
        await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_install_name', '{}', convo.id]);
        const reply = '🔧 Silakan masukkan **Nama** Anda:\n\n(Ketik *batal* untuk membatalkan)';
        await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
        break;
      }
      case 'talk_to_cs': {
        await answerCallbackQuery(bot.bot_token, callbackId, '🔄 Dialihkan ke CS human!');
        await db.run('UPDATE telegram_conversations SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['human', convo.id]);
        const reply = '💬 Anda sekarang terhubung dengan CS MAZNET. Silakan tulis pesan Anda, dan tim kami akan merespon segera.\n\nKetik *menu* untuk kembali ke menu utama.';
        await sendBotMessage(bot.bot_token, String(chatId), reply);
        await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
        break;
      }
      case 'end_session': {
        await answerCallbackQuery(bot.bot_token, callbackId, '✅ Sesi diakhiri');
        await db.run('UPDATE telegram_conversations SET status=?, state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['ended', 'idle', '', convo.id]);
        const reply = '🙏 Terima kasih telah menghubungi CS MAZNET.';
        await sendBotMessage(bot.bot_token, String(chatId), reply);
        await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
        break;
      }
      case 'confirm_close_ticket': {
        await answerCallbackQuery(bot.bot_token, callbackId, '✅ Menutup ticket...');
        const pendingTicketId = parseInt(convo.pending_data || '0');
        if (pendingTicketId) {
          const existing = await db.get('SELECT * FROM tickets WHERE id = ?', [pendingTicketId]);
          if (existing && existing.status === 'resolved') {
            await db.run('UPDATE tickets SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['closed', pendingTicketId]);
            await db.logActivity('ticket', 'Ticket ditutup via Telegram', '#' + pendingTicketId + ' ' + existing.title, null);
            const reply = '✅ Ticket #' + pendingTicketId + ' berhasil ditutup. Terima kasih!';
            await sendBotMessage(bot.bot_token, String(chatId), reply);
            await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
          } else {
            await sendBotMessage(bot.bot_token, String(chatId), '⚠️ Ticket sudah tidak dalam status Resolved atau tidak ditemukan.');
          }
        }
        await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, cooldown_until=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['idle', '', convo.id]);
        await sendMainMenu(bot, String(chatId), userName);
        break;
      }
      case 'reject_close_ticket': {
        await answerCallbackQuery(bot.bot_token, callbackId, 'Baik, ticket tetap open');
        const rejectTicketId = parseInt(convo.pending_data || '0');
        if (rejectTicketId) {
          const reply = 'Baik, ticket #' + rejectTicketId + ' tetap dalam status Resolved. Tim kami akan menghubungi Anda jika perlu.';
          await sendBotMessage(bot.bot_token, String(chatId), reply);
          await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
        }
        await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, cooldown_until=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['idle', '', convo.id]);
        await sendMainMenu(bot, String(chatId), userName);
        break;
      }
      case 'skip_identity': {
        await answerCallbackQuery(bot.bot_token, callbackId, 'Silakan kirim lokasi');
        const targetState = convo.state === 'awaiting_install_identity' ? 'awaiting_install_location' : 'awaiting_ticket_location';
        await db.run('UPDATE telegram_conversations SET state=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [targetState, convo.id]);
        const reply = '📍 Silakan **share lokasi** Anda (kirim location via attachment) atau ketik alamat lokasi:\n\n(Ketik *batal* untuk membatalkan)';
        await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
        break;
      }
      case 'back_to_menu': {
        await answerCallbackQuery(bot.bot_token, callbackId, 'Kembali ke menu');
        await sendMainMenu(bot, String(chatId), userName);
        break;
      }
      default:
        if (data.startsWith('upgrade_pkg_')) {
          const pkgMap = { starter: 'Starter Rp160rb/10Mbps', professional: 'Professional Rp400rb/50Mbps', enterprise: 'Enterprise (Hubungi Kami)' };
          const pkg = data.replace('upgrade_pkg_', '');
          const pkgName = pkgMap[pkg] || data;
          const pending = JSON.parse(convo.pending_data || '{}');
          const customerId = pending.customer_id || '-';
          const ticketId = await createTicketFromTelegram('upgrade', '[Telegram] ' + userName + ' - Upgrade ke ' + pkgName, 'ID Pelanggan: ' + customerId + '\nPaket: ' + pkgName, convo.id);
          await answerCallbackQuery(bot.bot_token, callbackId, '✅ Upgrade diajukan!');
          const cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
          await db.run('UPDATE telegram_conversations SET state=?, pending_data=?, cooldown_until=? WHERE id=?', ['idle', JSON.stringify({ ticket_id: ticketId }), cooldownUntil, convo.id]);
          const reply = '📶 Permintaan upgrade ke paket ' + pkgName + ' telah diajukan. Tim kami akan menghubungi Anda.';
          const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
          if (msg.ok) await saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
          await sendMainMenu(bot, String(chatId), userName);
        } else {
          await answerCallbackQuery(bot.bot_token, callbackId, 'Pilihan tidak dikenal');
        }
    }
  } catch (error) {
    console.error('CallbackQuery Error bot ' + bot.id + ':', error.message, '\nStack:', error.stack);
    await sendBotMessage(bot.bot_token, String(chatId), '⚠️ Error: ' + error.message);
  }
}

function startPolling(bot) {
  if (pollingIntervals[bot.id]) return;
  // Restore offset from in-memory tracker so restarts don't re-process old updates
  let offset = lastUpdateId[bot.id] ? lastUpdateId[bot.id] + 1 : 0;

  const poll = async () => {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getUpdates?offset=${offset}&timeout=10`);
      if (!resp.ok) return; // transient HTTP error, skip this cycle
      const data = await resp.json();
      if (data.ok && data.result && data.result.length > 0) {
        // Acknowledge all updates immediately to prevent concurrent poll cycles re-fetching the same batch
        offset = data.result[data.result.length - 1].update_id + 1;
        for (const update of data.result) {
          // Deduplication guard — skip if already processed
          if (lastUpdateId[bot.id] !== undefined && update.update_id <= lastUpdateId[bot.id]) continue;
          lastUpdateId[bot.id] = update.update_id;

          if (update?.message?.text) {
            const userName = update.message.from?.first_name || 'User';
            await processAI(bot, update.message.chat.id, update.message.text, userName);
          } else if (update?.message?.location) {
            const userName = update.message.from?.first_name || 'User';
            await processLocation(bot, update.message.chat.id, update.message.location, userName);
          } else if (update?.callback_query) {
            await processCallbackQuery(bot, update.callback_query);
          }
        }
      }
    } catch (e) {
      console.error('Polling error bot ' + bot.id + ':', e.message, '\nStack:', e.stack);
    }
  };
  poll();
  pollingIntervals[bot.id] = setInterval(poll, 3000);
}

function stopPolling(botId) {
  if (pollingIntervals[botId]) {
    clearInterval(pollingIntervals[botId]);
    delete pollingIntervals[botId];
  }
}

async function initPolling() {
  const bots = await db.all('SELECT * FROM telegram_bots WHERE is_active = 1 AND role = ?', ['customer_service']);
  for (const bot of bots) startPolling(bot);
}

router.post('/send', authenticate, async (req, res) => {
  const { bot_id, chat_id, message } = req.body;
  if (!bot_id || !chat_id || !message) return res.status(400).json({ message: 'bot_id, chat_id, and message are required' });
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ? AND is_active = 1', [bot_id]);
  if (!bot) return res.status(404).json({ message: 'Bot not found or inactive' });
  const result = await sendBotMessage(bot.bot_token, chat_id, message);
  if (!result.ok) return res.status(502).json({ ok: false, description: result.description || 'Telegram API error', message: result.description || 'Telegram API error' });
  res.json({ ok: true, description: result.description });
});

router.post('/test', authenticate, async (req, res) => {
  const { bot_id } = req.body;
  if (!bot_id) return res.status(400).json({ message: 'bot_id is required' });
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [parseInt(bot_id)]);
  if (!bot) return res.status(404).json({ message: 'Bot not found' });
  try {
    const resp = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getMe`);
    const data = await resp.json();
    if (!data.ok) return res.status(502).json({ ok: false, description: data.description || 'Invalid token' });
    res.json({ ok: true, bot_name: data.result?.first_name, username: data.result?.username });
  } catch (e) {
    res.status(502).json({ ok: false, description: 'Network error: ' + e.message });
  }
});


router.get('/bots/:id/status', authenticate, async (req, res) => {
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [parseInt(req.params.id)]);
  if (!bot) return res.status(404).json({ message: 'Bot not found' });
  try {
    const resp = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getMe`);
    const data = await resp.json();
    res.json({ ok: data.ok, bot_name: data.result?.first_name, username: data.result?.username });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});


router.post('/webhook/:botId', async (req, res) => {
  res.status(200).end();
  const update = req.body;
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ? AND is_active = 1', [req.params.botId]);
  if (!bot) return;
  if (update?.message?.text) {
    const userName = update.message.from?.first_name || 'User';
    await processAI(bot, update.message.chat.id, update.message.text, userName);
  } else if (update?.message?.location) {
    const userName = update.message.from?.first_name || 'User';
    await processLocation(bot, update.message.chat.id, update.message.location, userName);
  } else if (update?.message?.photo) {
    const userName = update.message.from?.first_name || 'User';
    await processPhoto(bot, update.message.chat.id, update.message.photo, userName);
  } else if (update?.callback_query) {
    await processCallbackQuery(bot, update.callback_query);
  }
});

router.post('/start-polling', authenticate, async (req, res) => {
  const { bot_id } = req.body;
  if (!bot_id) return res.status(400).json({ message: 'bot_id is required' });
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [parseInt(bot_id)]);
  if (!bot) return res.status(404).json({ message: 'Bot not found' });
  stopPolling(parseInt(bot_id));
  startPolling(bot);
  res.json({ ok: true, message: 'Polling started' });
});

router.post('/stop-polling', authenticate, async (req, res) => {
  const { bot_id } = req.body;
  if (!bot_id) return res.status(400).json({ message: 'bot_id is required' });
  stopPolling(parseInt(bot_id));
  res.json({ ok: true, message: 'Polling stopped' });
});


router.post('/check-ai', authenticate, async (req, res) => {
  const { bot_id, ai_provider, ai_model, ai_api_key, ai_url } = req.body;
  if (!bot_id) return res.json({ ok: false, error: 'bot_id is required' });

  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [parseInt(bot_id)]);
  if (!bot) return res.json({ ok: false, error: 'Bot tidak ditemukan.' });

  // Allow testing live form values (not yet saved)
  const provider = ai_provider || bot.ai_provider || '';
  const model    = (ai_model != null) ? ai_model : (bot.ai_model || '');
  // If caller passes a raw key in body, use it as-is (testing new value);
  // otherwise decrypt the stored key.
  const apiKey   = ai_api_key ? ai_api_key : (bot.ai_api_key ? decrypt(bot.ai_api_key) : '');
  const baseUrl  = (ai_url != null) ? ai_url : (bot.ai_url || '');

  if (!provider) return res.json({ ok: false, error: 'AI Provider belum dipilih. Pilih provider terlebih dahulu.' });
  if (!apiKey)   return res.json({ ok: false, error: 'AI API Key belum diisi. Masukkan API key terlebih dahulu.' });

  const defaultModels = { openai: 'gpt-4o-mini', openrouter: 'openai/gpt-4o-mini', gemini: 'gemini-2.0-flash', claude: 'claude-3-haiku-20240307', custom: '' };
  const resolvedModel = model || defaultModels[provider] || '';

  console.log(`[AI Check] Provider: ${provider} | Model: ${resolvedModel || '(default)'} | URL: ${baseUrl || '(default)'}`);

  const result = await callAI(provider, resolvedModel, apiKey, 'Halo, balas dengan "OK" saja.', baseUrl, [], bot.system_prompt);
  console.log(`[AI Check] Result:`, result);

  const modelHints = {
    openai:     'Model OpenAI: gpt-4o-mini, gpt-4o, gpt-3.5-turbo',
    openrouter: 'Format OpenRouter: openai/gpt-4o-mini, google/gemini-2.0-flash, anthropic/claude-3-haiku',
    gemini:     'Model Gemini: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro',
    claude:     'Model Claude: claude-3-haiku-20240307, claude-3-5-sonnet-20241022',
    custom:     'Pastikan endpoint URL dan format body request sesuai.'
  };

  res.json({
    ...result,
    provider,
    model: resolvedModel,
    hint: !result.ok ? (modelHints[provider] || null) : undefined
  });
});


router.post('/set-webhook', authenticate, async (req, res) => {
  const { bot_id, base_url } = req.body;
  if (!bot_id || !base_url) return res.status(400).json({ message: 'bot_id and base_url are required' });
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [bot_id]);
  if (!bot) return res.status(404).json({ message: 'Bot not found' });
  const webhookUrl = `${base_url.replace(/\/+$/, '')}/api/telegram/webhook/${bot_id}`;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const data = await resp.json();
    if (!data.ok) return res.status(502).json({ ok: false, description: data.description || 'Failed to set webhook' });
    stopPolling(bot_id);
    res.json({ ok: true, description: data.description, webhook_url: webhookUrl });
  } catch (e) {
    res.status(502).json({ ok: false, description: 'Network error: ' + e.message });
  }
});

export { initPolling, startPolling, stopPolling };
export default router;

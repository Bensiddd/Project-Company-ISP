import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { callAI } from '../services/ai-providers.js';

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

function saveMessage(botId, chatId, role, message, convoId) {
  db.insert('INSERT INTO telegram_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)', [convoId, botId, chatId, role, message]);
  db.run('UPDATE telegram_conversations SET last_message=?, unread=unread+1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [message, convoId]);
}

function getOrCreateConversation(botId, chatId, userName) {
  let convo = db.get('SELECT * FROM telegram_conversations WHERE bot_id=? AND chat_id=?', [botId, chatId]);
  if (!convo) {
    db.run('INSERT OR IGNORE INTO telegram_conversations (bot_id, chat_id, user_name, status) VALUES (?, ?, ?, ?)', [botId, chatId, userName || '', 'ai']);
    convo = db.get('SELECT * FROM telegram_conversations WHERE bot_id=? AND chat_id=?', [botId, chatId]);
  }
  return convo;
}

const MAIN_MENU = [
  [{ text: '🎫 Buat Ticket', callback_data: 'create_ticket' }],
  [{ text: '📶 Upgrade Bandwidth', callback_data: 'upgrade' }],
  [{ text: '🔧 Instalasi Baru', callback_data: 'install' }],
  [{ text: '🔍 Cek Status Ticket', callback_data: 'check_ticket_status' }],
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

async function sendMainMenu(bot, chatId, userName) {
  db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE bot_id=? AND chat_id=?', ['idle', '', bot.id, String(chatId)]);
  const welcome = `Halo ${userName || 'Sobat MAZNET'}! 👋\n\nSelamat datang di layanan CS MAZNET. Silakan pilih opsi di bawah:`;
  await sendBotMessageWithKeyboard(bot.bot_token, chatId, welcome, MAIN_MENU);
}

function createTicketFromTelegram(type, title, description) {
  return db.insert('INSERT INTO tickets (type, status, priority, title, description) VALUES (?, ?, ?, ?, ?)', [type, 'open', 'medium', title, description]);
}

async function processAI(bot, chatId, userText, userName) {
  if (!bot || bot.role !== 'customer_service') return;
  const lockKey = `${bot.id}:${chatId}`;
  if (processingLocks.has(lockKey)) return;
  processingLocks.add(lockKey);

  try {
    const convo = getOrCreateConversation(bot.id, String(chatId), userName);
    saveMessage(bot.id, String(chatId), 'user', userText, convo.id);

    if (convo.status === 'ended') {
      if (userText === '/start') {
        db.run('UPDATE telegram_conversations SET status=?, state=?, pending_data=? WHERE id=?', ['ai', 'idle', '', convo.id]);
        await sendMainMenu(bot, String(chatId), userName);
      }
      return;
    }

    if (userText.toLowerCase() === 'menu' || userText.toLowerCase() === 'batal') {
      await sendMainMenu(bot, String(chatId), userName);
      return;
    }

    if (convo.status === 'human') {
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), '⏳ Pesan Anda sudah diteruskan ke CS. Kami akan segera merespon.', END_SESSION_KEYBOARD);
      return;
    }

    const state = convo.state || 'idle';

    if (state === 'checking_ticket_id') {
      const ticketId = parseInt(userText);
      const ticket = db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket) {
        const reply = '❌ Ticket #' + userText + ' tidak ditemukan. Periksa kembali nomor ID ticket.';
        const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
        if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
        await sendMainMenu(bot, String(chatId), userName);
        return;
      }
      const statusLabels = { open: '🔴 Open', in_progress: '🟡 In Progress', resolved: '🟢 Resolved', closed: '⚫ Closed' };
      const statusLine = statusLabels[ticket.status] || ticket.status;
      const reply = '📋 *Status Ticket #' + ticket.id + '*\n\n' +
        'Judul: ' + ticket.title + '\n' +
        'Status: ' + statusLine + '\n' +
        'Prioritas: ' + (ticket.priority || '-') + '\n' +
        'Tipe: ' + (ticket.type || '-') + '\n' +
        'Dibuat: ' + (ticket.created_at || '-') + '\n\n';

      if (ticket.status === 'resolved') {
        db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['confirming_close_ticket', String(ticket.id), convo.id]);
        const confirmKeyboard = [
          [{ text: '✅ Ya, Tutup Ticket', callback_data: 'confirm_close_ticket' }],
          [{ text: '❌ Tidak', callback_data: 'reject_close_ticket' }]
        ];
        const msg = await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply + 'Ticket ini sudah *Resolved*. Apakah Anda ingin menutup ticket ini?', confirmKeyboard);
        if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', reply + 'Ticket ini sudah Resolved. Apakah Anda ingin menutup ticket ini?', convo.id);
      } else {
        db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['idle', '', convo.id]);
        const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
        if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
        await sendMainMenu(bot, String(chatId), userName);
      }
      return;
    }

    if (state === 'awaiting_ticket_description') {
      const ticketId = createTicketFromTelegram('maintenance', '[Telegram] ' + userName + ' - Laporan Gangguan', userText);
      db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE id=?', ['idle', '', convo.id]);
      const reply = '✅ Ticket #' + ticketId + ' berhasil dibuat dengan keluhan:\n"' + userText + '"\n\nTim kami akan segera menangani.';
      const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
      if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      await sendMainMenu(bot, String(chatId), userName);
      return;
    }

    if (state === 'awaiting_upgrade_customer_id') {
      db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_upgrade_package', JSON.stringify({ customer_id: userText }), convo.id]);
      const reply = 'Terima kasih! ID Pelanggan: ' + userText + '\n\nSilakan pilih paket upgrade yang diinginkan:';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, PACKAGE_KEYBOARD);
      return;
    }

    if (state === 'awaiting_install_address') {
      db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_install_location', JSON.stringify({ address: userText }), convo.id]);
      const reply = 'Alamat: ' + userText + '\n\nSilakan share lokasi Anda (kirim location via attachment) atau ketik nama lokasi:';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      return;
    }

    if (state === 'awaiting_install_location') {
      const pending = JSON.parse(convo.pending_data || '{}');
      const address = pending.address || '';
      const ticketId = createTicketFromTelegram('installation', '[Telegram] ' + userName + ' - Permintaan Instalasi', 'Alamat: ' + address + '\nLokasi: ' + userText);
      db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE id=?', ['idle', '', convo.id]);
      const reply = '✅ Permintaan instalasi #' + ticketId + ' berhasil diajukan!\nAlamat: ' + address + '\nLokasi: ' + userText + '\n\nTim kami akan menghubungi Anda untuk jadwal.';
      const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
      if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      await sendMainMenu(bot, String(chatId), userName);
      return;
    }

    if (!bot.ai_api_key) {
      const msg = await sendBotMessage(bot.bot_token, String(chatId), '⚠️ Maaf, AI bot belum dikonfigurasi.');
      if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', '⚠️ Maaf, AI bot belum dikonfigurasi.', convo.id);
      return;
    }

    const history = db.all('SELECT role, message FROM telegram_messages WHERE conversation_id=? ORDER BY id DESC LIMIT 10', [convo.id]).reverse();
    const result = await callAI(bot.ai_provider || 'openai', bot.ai_model || '', bot.ai_api_key, userText, bot.ai_url, history);
    
    if (result.ok) {
      const reply = result.text;
      const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
      if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      if (msg.ok && convo.status === 'ai') {
        await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), 'Ada lagi yang bisa kami bantu? Pilih menu di bawah:', MAIN_MENU);
      }
    } else {
      const errMsg = '⚠️ Maaf, terjadi kesalahan: ' + (result.error || 'Unknown error');
      await sendBotMessage(bot.bot_token, String(chatId), errMsg);
    }
  } catch (error) {
    console.error('AI Processing Error:', error);
  } finally {
    processingLocks.delete(lockKey);
  }
}

async function processLocation(bot, chatId, location, userName) {
  const convo = getOrCreateConversation(bot.id, String(chatId), userName);
  const lat = location.latitude;
  const lon = location.longitude;
  const locText = 'https://maps.google.com/?q=' + lat + ',' + lon;
  saveMessage(bot.id, String(chatId), 'user', '📍 Lokasi: ' + locText, convo.id);

  const state = convo.state || 'idle';

  if (state === 'awaiting_install_location') {
    const pending = JSON.parse(convo.pending_data || '{}');
    const address = pending.address || '';
    const ticketId = createTicketFromTelegram('installation', '[Telegram] ' + userName + ' - Permintaan Instalasi', 'Alamat: ' + address + '\nLokasi (maps): ' + locText);
    db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE id=?', ['idle', '', convo.id]);
    const reply = '✅ Permintaan instalasi #' + ticketId + ' berhasil diajukan!\nAlamat: ' + address + '\nLokasi: ' + locText + '\n\nTim kami akan menghubungi Anda untuk jadwal.';
    const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
    if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
    await sendMainMenu(bot, String(chatId), userName);
    return;
  }

  const reply = '📍 Lokasi diterima! Silakan pilih menu:';
  await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, MAIN_MENU);
}

async function processCallbackQuery(bot, callbackQuery) {
  if (!bot || bot.role !== 'customer_service') return;
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const userName = callbackQuery.from.first_name || 'User';
  const callbackId = callbackQuery.id;

  const convo = getOrCreateConversation(bot.id, String(chatId), userName);

  switch (data) {
    case 'check_ticket_status': {
      db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['checking_ticket_id', '', convo.id]);
      await answerCallbackQuery(bot.bot_token, callbackId, 'Masukkan ID ticket');
      const reply = '🔍 Silakan masukkan nomor ID ticket yang ingin dicek:\n\nContoh: "123"\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      break;
    }
    case 'create_ticket': {
      db.run('UPDATE telegram_conversations SET state=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_ticket_description', convo.id]);
      await answerCallbackQuery(bot.bot_token, callbackId, 'Silakan tulis keluhan');
      const reply = '🎫 Silakan tulis keluhan Anda dengan detail:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      break;
    }
    case 'upgrade': {
      db.run('UPDATE telegram_conversations SET state=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_upgrade_customer_id', convo.id]);
      await answerCallbackQuery(bot.bot_token, callbackId, 'Masukkan ID pelanggan');
      const reply = '📶 Silakan masukkan ID pelanggan Anda:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      break;
    }
    case 'install': {
      db.run('UPDATE telegram_conversations SET state=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['awaiting_install_address', convo.id]);
      await answerCallbackQuery(bot.bot_token, callbackId, 'Masukkan alamat');
      const reply = '🔧 Silakan masukkan alamat lengkap untuk instalasi:\n\n(Ketik *batal* untuk membatalkan)';
      await sendBotMessageWithKeyboard(bot.bot_token, String(chatId), reply, CANCEL_KEYBOARD);
      break;
    }
    case 'talk_to_cs': {
      db.run('UPDATE telegram_conversations SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['human', convo.id]);
      await answerCallbackQuery(bot.bot_token, callbackId, '🔄 Dialihkan ke CS human!');
      const reply = '💬 Anda sekarang terhubung dengan CS MAZNET. Silakan tulis pesan Anda, dan tim kami akan merespon segera.\n\nKetik *menu* untuk kembali ke menu utama.';
      await sendBotMessage(bot.bot_token, String(chatId), reply);
      saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      break;
    }
    case 'end_session': {
      db.run('UPDATE telegram_conversations SET status=?, state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['ended', 'idle', '', convo.id]);
      await answerCallbackQuery(bot.bot_token, callbackId, '✅ Sesi diakhiri');
      const reply = '🙏 Terima kasih telah menghubungi CS MAZNET.';
      await sendBotMessage(bot.bot_token, String(chatId), reply);
      saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      break;
    }
    case 'confirm_close_ticket': {
      const pendingTicketId = parseInt(convo.pending_data || '0');
      if (pendingTicketId) {
        const existing = db.get('SELECT * FROM tickets WHERE id = ?', [pendingTicketId]);
        if (existing && existing.status === 'resolved') {
          db.run('UPDATE tickets SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['closed', pendingTicketId]);
          db.logActivity('ticket', 'Ticket ditutup via Telegram', '#' + pendingTicketId + ' ' + existing.title, null);
          const reply = '✅ Ticket #' + pendingTicketId + ' berhasil ditutup. Terima kasih!';
          await sendBotMessage(bot.bot_token, String(chatId), reply);
          saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
        } else {
          await sendBotMessage(bot.bot_token, String(chatId), '⚠️ Ticket sudah tidak dalam status Resolved atau tidak ditemukan.');
        }
      }
      await answerCallbackQuery(bot.bot_token, callbackId, '✅ Ticket ditutup');
      db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['idle', '', convo.id]);
      await sendMainMenu(bot, String(chatId), userName);
      break;
    }
    case 'reject_close_ticket': {
      const rejectTicketId = parseInt(convo.pending_data || '0');
      await answerCallbackQuery(bot.bot_token, callbackId, 'Baik, ticket tetap open');
      if (rejectTicketId) {
        const reply = 'Baik, ticket #' + rejectTicketId + ' tetap dalam status Resolved. Tim kami akan menghubungi Anda jika perlu.';
        await sendBotMessage(bot.bot_token, String(chatId), reply);
        saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
      }
      db.run('UPDATE telegram_conversations SET state=?, pending_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', ['idle', '', convo.id]);
      await sendMainMenu(bot, String(chatId), userName);
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
        const ticketId = createTicketFromTelegram('upgrade', '[Telegram] ' + userName + ' - Upgrade ke ' + pkgName, 'ID Pelanggan: ' + customerId + '\nPaket: ' + pkgName);
        db.run('UPDATE telegram_conversations SET state=?, pending_data=? WHERE id=?', ['idle', '', convo.id]);
        await answerCallbackQuery(bot.bot_token, callbackId, '✅ Upgrade diajukan!');
        const reply = '📶 Permintaan upgrade #' + ticketId + ' berhasil diajukan!\nID Pelanggan: ' + customerId + '\nPaket: ' + pkgName + '\n\nTim kami akan menghubungi Anda.';
        const msg = await sendBotMessage(bot.bot_token, String(chatId), reply);
        if (msg.ok) saveMessage(bot.id, String(chatId), 'bot', reply, convo.id);
        await sendMainMenu(bot, String(chatId), userName);
      } else {
        await answerCallbackQuery(bot.bot_token, callbackId, 'Pilihan tidak dikenal');
      }
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
      console.error('Polling error bot ' + bot.id + ':', e.message);
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

function initPolling() {
  const bots = db.all('SELECT * FROM telegram_bots WHERE is_active = 1 AND role = ?', ['customer_service']);
  for (const bot of bots) startPolling(bot);
}

router.post('/send', authenticate, async (req, res) => {
  const { bot_id, chat_id, message } = req.body;
  if (!bot_id || !chat_id || !message) return res.status(400).json({ message: 'bot_id, chat_id, and message are required' });
  const bot = db.get('SELECT * FROM telegram_bots WHERE id = ? AND is_active = 1', [bot_id]);
  if (!bot) return res.status(404).json({ message: 'Bot not found or inactive' });
  const result = await sendBotMessage(bot.bot_token, chat_id, message);
  if (!result.ok) return res.status(502).json({ ok: false, description: result.description || 'Telegram API error', message: result.description || 'Telegram API error' });
  res.json({ ok: true, description: result.description });
});

router.post('/test', authenticate, async (req, res) => {
  const { bot_id } = req.body;
  if (!bot_id) return res.status(400).json({ message: 'bot_id is required' });
  const bot = db.get('SELECT * FROM telegram_bots WHERE id = ?', [parseInt(bot_id)]);
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
  const bot = db.get('SELECT * FROM telegram_bots WHERE id = ?', [parseInt(req.params.id)]);
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
  const bot = db.get('SELECT * FROM telegram_bots WHERE id = ? AND is_active = 1', [req.params.botId]);
  if (!bot) return;
  if (update?.message?.text) {
    const userName = update.message.from?.first_name || 'User';
    await processAI(bot, update.message.chat.id, update.message.text, userName);
  } else if (update?.message?.location) {
    const userName = update.message.from?.first_name || 'User';
    await processLocation(bot, update.message.chat.id, update.message.location, userName);
  } else if (update?.callback_query) {
    await processCallbackQuery(bot, update.callback_query);
  }
});

router.post('/start-polling', authenticate, (req, res) => {
  const { bot_id } = req.body;
  if (!bot_id) return res.status(400).json({ message: 'bot_id is required' });
  const bot = db.get('SELECT * FROM telegram_bots WHERE id = ?', [parseInt(bot_id)]);
  if (!bot) return res.status(404).json({ message: 'Bot not found' });
  stopPolling(parseInt(bot_id));
  startPolling(bot);
  res.json({ ok: true, message: 'Polling started' });
});


router.post('/check-ai', authenticate, async (req, res) => {
  const { bot_id, ai_provider, ai_model, ai_api_key, ai_url } = req.body;
  if (!bot_id) return res.json({ ok: false, error: 'bot_id is required' });

  const bot = db.get('SELECT * FROM telegram_bots WHERE id = ?', [parseInt(bot_id)]);
  if (!bot) return res.json({ ok: false, error: 'Bot tidak ditemukan.' });

  // Allow testing live form values (not yet saved)
  const provider = ai_provider || bot.ai_provider || '';
  const model    = (ai_model != null) ? ai_model : (bot.ai_model || '');
  const apiKey   = ai_api_key || bot.ai_api_key || '';
  const baseUrl  = (ai_url != null) ? ai_url : (bot.ai_url || '');

  if (!provider) return res.json({ ok: false, error: 'AI Provider belum dipilih. Pilih provider terlebih dahulu.' });
  if (!apiKey)   return res.json({ ok: false, error: 'AI API Key belum diisi. Masukkan API key terlebih dahulu.' });

  const defaultModels = { openai: 'gpt-4o-mini', openrouter: 'openai/gpt-4o-mini', gemini: 'gemini-2.0-flash', claude: 'claude-3-haiku-20240307', custom: '' };
  const resolvedModel = model || defaultModels[provider] || '';

  console.log(`[AI Check] Provider: ${provider} | Model: ${resolvedModel || '(default)'} | URL: ${baseUrl || '(default)'}`);

  const result = await callAI(provider, model, apiKey, 'Halo, balas dengan "OK" saja.', baseUrl);
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
  const bot = db.get('SELECT * FROM telegram_bots WHERE id = ?', [bot_id]);
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

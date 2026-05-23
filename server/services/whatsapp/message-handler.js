import db from '../../db.js';
import { callAI } from '../ai-providers.js';
import { decrypt } from '../../utils/encryption.js';
import { syncChatToContactMessage } from '../sync-contact-message.js';

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const processingLocks = new Set();

/**
 * Handle incoming WhatsApp message
 * Same state machine as Telegram
 */
export async function handleIncomingMessage(botId, chatId, messageText, userName, platform = 'whatsapp') {
  const lockKey = `${botId}:${chatId}`;
  if (processingLocks.has(lockKey)) return;
  processingLocks.add(lockKey);
  let lockAcquired = true;

  try {
    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [botId]);
    if (!bot || !bot.is_active) return;

    const convo = await getOrCreateConversation(botId, chatId, userName);
    await saveMessage(botId, chatId, 'user', messageText, convo.id);
    await syncChatToContactMessage('whatsapp', botId, chatId, userName, messageText, chatId);

    // Handle /stop
    if (messageText.toLowerCase() === '/stop') {
      await db.run('UPDATE whatsapp_conversations SET status=?, state=?, pending_data=? WHERE id=?', ['ended', 'idle', '', convo.id]);
      const reply = '🙏 Sesi diakhiri. Terima kasih telah menghubungi MAZNET. Ketik /start untuk memulai ulang.';
      await sendMessage(bot, chatId, reply);
      await saveMessage(botId, chatId, 'bot', reply, convo.id);
      return;
    }

    // Handle menu/batal
    if (messageText.toLowerCase() === 'menu' || messageText.toLowerCase() === 'batal' || messageText.toLowerCase() === '/start') {
      await sendMainMenu(bot, chatId, userName, convo.id);
      return;
    }

    // Human mode - check if CS has not replied for 5 minutes, if so auto-switch to AI!
    if (convo.status === 'human') {
      const lastBotMessage = await db.get(
        'SELECT created_at FROM whatsapp_messages WHERE conversation_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1',
        [convo.id, 'bot']
      );
      
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastBotMessage && new Date(lastBotMessage.created_at) < fiveMinutesAgo) {
        await db.run("UPDATE whatsapp_conversations SET status = 'ai', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [convo.id]);
        
        const autoSwitchNotice = '🤖 Layanan dialihkan kembali ke AI karena CS kami sedang sibuk/belum merespon selama 5 menit. Ada yang bisa saya bantu?';
        await sendMessage(bot, chatId, autoSwitchNotice);
        await saveMessage(botId, chatId, 'bot', autoSwitchNotice, convo.id);
        
        convo.status = 'ai';
      } else {
        return;
      }
    }

    // State machine
    const state = convo.state || 'idle';
    const handled = await handleState(bot, chatId, messageText, userName, convo, state);
    if (handled) return;

    // Check menu selection in idle state (1/2/3/4)
    if (state === 'idle' && /^[1-4]$/.test(messageText.trim())) {
      await handleMenuSelection(botId, chatId, messageText.trim(), userName);
      return;
    }

    // AI or template response
    const aiApiKey = bot.ai_api_key ? decrypt(bot.ai_api_key) : null;
    if (bot.ai_enabled && aiApiKey) {
      await handleAIResponse(bot, chatId, messageText, convo, aiApiKey);
    } else {
      await handleTemplateResponse(bot, chatId, messageText, convo, userName);
    }
  } catch (error) {
    console.error('[WhatsApp] Message handling error:', error);
  } finally {
    if (lockAcquired) {
      processingLocks.delete(lockKey);
    }
  }
}

async function handleState(bot, chatId, messageText, userName, convo, state) {
  switch (state) {
    case 'awaiting_ticket_name': {
      const pending = { name: messageText };
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_ticket_customer_id', JSON.stringify(pending), convo.id]);
      await sendMessage(bot, chatId, `Terima kasih, ${messageText}!\n\n📝 Silakan masukkan *ID Pelanggan* Anda:\n\n(Ketik *batal* untuk membatalkan)`);
      return true;
    }
    case 'awaiting_ticket_customer_id': {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), customer_id: messageText };
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_ticket_address', JSON.stringify(pending), convo.id]);
      await sendMessage(bot, chatId, '📝 Silakan masukkan *Alamat* lengkap Anda:\n\n(Ketik *batal* untuk membatalkan)');
      return true;
    }
    case 'awaiting_ticket_address': {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), address: messageText };
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_ticket_phone', JSON.stringify(pending), convo.id]);
      await sendMessage(bot, chatId, '📝 Silakan masukkan *Nomor HP* Anda:\n\n(Ketik *batal* untuk membatalkan)');
      return true;
    }
    case 'awaiting_ticket_phone': {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), phone: messageText };
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_ticket_location', JSON.stringify(pending), convo.id]);
      await sendMessage(bot, chatId, '📍 Silakan share *lokasi* Anda (kirim lokasi via WhatsApp atau ketik alamat):\n\n(Ketik *batal* untuk membatalkan)');
      return true;
    }
    case 'awaiting_ticket_location': {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), location: messageText };
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_ticket_description', JSON.stringify(pending), convo.id]);
      await sendMessage(bot, chatId, '🎫 Silakan tulis *keluhan* Anda dengan detail:\n\n(Ketik *batal* untuk membatalkan)');
      return true;
    }
    case 'awaiting_ticket_description': {
      const pending = JSON.parse(convo.pending_data || '{}');
      const fullDescription = [
        'Nama: ' + (pending.name || '-'),
        'ID Pelanggan: ' + (pending.customer_id || '-'),
        'Alamat: ' + (pending.address || '-'),
        'No HP: ' + (pending.phone || '-'),
        'Lokasi: ' + (pending.location || '-'),
        '',
        'Keluhan: ' + messageText
      ].join('\n');
      const ticketId = await createTicket('maintenance', '[WhatsApp] ' + (pending.name || userName) + ' - Laporan Gangguan', fullDescription, convo.id);
      const cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=?, cooldown_until=? WHERE id=?', ['idle', JSON.stringify({ ticket_id: ticketId }), cooldownUntil, convo.id]);
      await sendMessage(bot, chatId, '✅ Laporan gangguan Anda telah diterima. Tim kami akan segera menangani.');
      await sendMainMenu(bot, chatId, userName, convo.id);
      return true;
    }
    case 'awaiting_upgrade_customer_id': {
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_upgrade_package', JSON.stringify({ customer_id: messageText }), convo.id]);
      await sendMessage(bot, chatId, `Terima kasih! ID Pelanggan: ${messageText}\n\nSilakan pilih paket upgrade:\n\n1️⃣ Starter — Rp160rb/10Mbps\n2️⃣ Professional — Rp400rb/50Mbps\n3️⃣ Enterprise — Hubungi Kami\n\nBalas dengan nomor (1/2/3) atau ketik *batal*`);
      return true;
    }
    case 'awaiting_upgrade_package': {
      const pending = JSON.parse(convo.pending_data || '{}');
      const packages = { '1': 'Starter', '2': 'Professional', '3': 'Enterprise' };
      const packageName = packages[messageText] || messageText;
      const fullDescription = `ID Pelanggan: ${pending.customer_id}\nPaket: ${packageName}\n\nPermintaan Upgrade Bandwidth`;
      const ticketId = await createTicket('upgrade', '[WhatsApp] Upgrade ke ' + packageName, fullDescription, convo.id);
      const cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=?, cooldown_until=? WHERE id=?', ['idle', JSON.stringify({ ticket_id: ticketId }), cooldownUntil, convo.id]);
      await sendMessage(bot, chatId, '✅ Permintaan upgrade Anda telah diterima. Tim kami akan segera menghubungi Anda.');
      await sendMainMenu(bot, chatId, userName, convo.id);
      return true;
    }
    case 'awaiting_install_name': {
      const pending = { name: messageText };
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_install_address', JSON.stringify(pending), convo.id]);
      await sendMessage(bot, chatId, `Terima kasih, ${messageText}!\n\n🔧 Silakan masukkan *Alamat* lengkap instalasi:\n\n(Ketik *batal* untuk membatalkan)`);
      return true;
    }
    case 'awaiting_install_address': {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), address: messageText };
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_install_phone', JSON.stringify(pending), convo.id]);
      await sendMessage(bot, chatId, '🔧 Silakan masukkan *Nomor HP* Anda:\n\n(Ketik *batal* untuk membatalkan)');
      return true;
    }
    case 'awaiting_install_phone': {
      const pending = { ...JSON.parse(convo.pending_data || '{}'), phone: messageText };
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_install_location', JSON.stringify(pending), convo.id]);
      await sendMessage(bot, chatId, '📍 Silakan share *lokasi* instalasi (kirim lokasi via WhatsApp atau ketik alamat):\n\n(Ketik *batal* untuk membatalkan)');
      return true;
    }
    case 'awaiting_install_location': {
      const pending = JSON.parse(convo.pending_data || '{}');
      const fullDescription = [
        'Nama: ' + (pending.name || '-'),
        'Alamat: ' + (pending.address || '-'),
        'No HP: ' + (pending.phone || '-'),
        'Lokasi: ' + messageText,
        '',
        'Permintaan Instalasi Baru'
      ].join('\n');
      const ticketId = await createTicket('installation', '[WhatsApp] ' + (pending.name || userName) + ' - Permintaan Instalasi', fullDescription, convo.id);
      const cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=?, cooldown_until=? WHERE id=?', ['idle', JSON.stringify({ ticket_id: ticketId }), cooldownUntil, convo.id]);
      await sendMessage(bot, chatId, '✅ Terima kasih, data permintaan instalasi Anda sudah kami terima.\n\nTim kami akan segera menghubungi Anda untuk konfirmasi. Mohon tunggu.');
      await sendMainMenu(bot, chatId, userName, convo.id);
      return true;
    }
  }
  return false;
}

export async function handleAIResponse(bot, chatId, messageText, convo, aiApiKey) {
  try {
    const history = await db.all('SELECT role, message FROM whatsapp_messages WHERE conversation_id=? ORDER BY id DESC LIMIT 10', [convo.id]);
    const defaultModels = { openai: 'gpt-4o-mini', openrouter: 'openai/gpt-4o-mini', gemini: 'gemini-2.0-flash', claude: 'claude-3-haiku-20240307', custom: '' };
    const resolvedModel = bot.ai_model || defaultModels[bot.ai_provider] || '';
    const result = await callAI(bot.ai_provider || 'openai', resolvedModel, aiApiKey, messageText, bot.ai_url, history.reverse(), bot.system_prompt);

    if (result.ok) {
      await sendMessage(bot, chatId, result.text);
      await saveMessage(bot.id, chatId, 'bot', result.text, convo.id);
    } else {
      await sendMessage(bot, chatId, '⚠️ Maaf, terjadi kesalahan: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('[WhatsApp] AI error:', error);
    await sendMessage(bot, chatId, '⚠️ Maaf, terjadi kesalahan sistem.');
  }
}

export async function handleTemplateResponse(bot, chatId, messageText, convo, userName) {
  const isThankYou = /terima kasih|makasih|thanks|thx|thank/i.test(messageText);
  const reply = isThankYou
    ? 'Sama-sama! Ada lagi yang bisa saya bantu? 😊'
    : 'Ada yang bisa saya bantu?';
  await sendMessage(bot, chatId, reply);
  await saveMessage(bot.id, chatId, 'bot', reply, convo.id);
  await sendMainMenu(bot, chatId, userName, convo.id);
}

async function sendMainMenu(bot, chatId, userName, convoId) {
  await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['idle', '', convoId]);
  const welcome = `Halo ${userName || 'Sobat MAZNET'}! 👋\n\nSelamat datang di layanan CS MAZNET. Silakan pilih opsi:\n\n1️⃣ Buat Ticket\n2️⃣ Upgrade Bandwidth\n3️⃣ Instalasi Baru\n4️⃣ Bicara dengan CS\n\nBalas dengan nomor (1/2/3/4)`;
  await sendMessage(bot, chatId, welcome);
  await saveMessage(bot.id, chatId, 'bot', welcome, convoId);
}

async function sendMessage(bot, chatId, message) {
  // This will be called by the provider
  const { getProvider } = await import('./provider-factory.js');
  const provider = getProvider(bot.provider);
  await provider.sendMessage(bot.id, chatId, message);
}

async function getOrCreateConversation(botId, chatId, userName) {
  let convo = await db.get('SELECT * FROM whatsapp_conversations WHERE bot_id=? AND chat_id=?', [botId, chatId]);
  if (!convo) {
    await db.run('INSERT IGNORE INTO whatsapp_conversations (bot_id, chat_id, user_name, status) VALUES (?, ?, ?, ?)', [botId, chatId, userName || '', 'ai']);
    convo = await db.get('SELECT * FROM whatsapp_conversations WHERE bot_id=? AND chat_id=?', [botId, chatId]);
  }
  return convo;
}

async function saveMessage(botId, chatId, role, message, convoId) {
  await db.insert('INSERT INTO whatsapp_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)', [convoId, botId, chatId, role, message]);
  await db.run('UPDATE whatsapp_conversations SET last_message=?, unread=unread+1, updated_at=CURRENT_TIMESTAMP WHERE id=?', [message, convoId]);
}

async function createTicket(type, title, description, conversationId) {
  return await db.insert('INSERT INTO tickets (type, status, priority, title, description, whatsapp_conversation_id, source) VALUES (?, ?, ?, ?, ?, ?, ?)', [type, 'open', 'medium', title, description, conversationId || null, 'whatsapp']);
}

function isCooldownActive(convo) {
  if (!convo.cooldown_until) return false;
  return new Date(convo.cooldown_until) > new Date();
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
      const ticket = await db.get('SELECT id, status FROM tickets WHERE whatsapp_conversation_id = ? ORDER BY created_at DESC LIMIT 1', [convo.id]);
      if (ticket) ticketId = ticket.id;
    }
    if (ticketId) {
      const ticket = await db.get('SELECT status FROM tickets WHERE id = ?', [ticketId]);
      if (!ticket || ticket.status === 'closed' || ticket.status === 'resolved') {
        await db.run('UPDATE whatsapp_conversations SET cooldown_until=NULL WHERE id=?', [convo.id]);
        return false;
      }
    } else {
      await db.run('UPDATE whatsapp_conversations SET cooldown_until=NULL WHERE id=?', [convo.id]);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[WhatsApp] Cooldown check error:', e);
    return false;
  }
}

// Handle menu selection (1/2/3/4)
export async function handleMenuSelection(botId, chatId, selection, userName) {
  const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [botId]);
  if (!bot) return;

  const convo = await getOrCreateConversation(botId, chatId, userName);
  const isBlocked = await isCooldownBlocked(convo);

  switch (selection) {
    case '1': // Buat Ticket
      if (isBlocked) {
        await sendMessage(bot, chatId, '⏳ Anda memiliki laporan aktif yang sedang diproses. Silakan hubungi CS (opsi 4) jika memerlukan bantuan mendesak.');
        break;
      }
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_ticket_name', '{}', convo.id]);
      await sendMessage(bot, chatId, '📝 Silakan masukkan *Nama* Anda:\n\n(Ketik *batal* untuk membatalkan)');
      break;
    case '2': // Upgrade
      if (isBlocked) {
        await sendMessage(bot, chatId, '⏳ Anda memiliki laporan aktif yang sedang diproses. Silakan hubungi CS (opsi 4) jika memerlukan bantuan mendesak.');
        break;
      }
      await db.run('UPDATE whatsapp_conversations SET state=? WHERE id=?', ['awaiting_upgrade_customer_id', convo.id]);
      await sendMessage(bot, chatId, '📶 Silakan masukkan ID pelanggan Anda:\n\n(Ketik *batal* untuk membatalkan)');
      break;
    case '3': // Instalasi
      if (isBlocked) {
        await sendMessage(bot, chatId, '⏳ Anda memiliki laporan aktif yang sedang diproses. Silakan hubungi CS (opsi 4) jika memerlukan bantuan mendesak.');
        break;
      }
      await db.run('UPDATE whatsapp_conversations SET state=?, pending_data=? WHERE id=?', ['awaiting_install_name', '{}', convo.id]);
      await sendMessage(bot, chatId, '🔧 Silakan masukkan *Nama* Anda:\n\n(Ketik *batal* untuk membatalkan)');
      break;
    case '4': // Bicara dengan CS
      await db.run('UPDATE whatsapp_conversations SET status=? WHERE id=?', ['human', convo.id]);
      const reply = '💬 Anda sekarang terhubung dengan CS MAZNET. Silakan tulis pesan Anda, dan tim kami akan merespon segera.\n\nKetik *menu* untuk kembali ke menu utama.';
      await sendMessage(bot, chatId, reply);
      await saveMessage(botId, chatId, 'bot', reply, convo.id);
      break;
    default:
      await sendMessage(bot, chatId, '⚠️ Pilihan tidak valid. Silakan pilih menu 1-4.');
  }
}

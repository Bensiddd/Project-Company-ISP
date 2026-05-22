import db from '../db.js';

export async function syncChatToContactMessage(platform, botId, chatId, userName, messageText, phone) {
  const column = platform === 'whatsapp' ? 'whatsapp' : 'telegram_chat_id';
  const existing = await db.get(`SELECT id FROM contact_messages WHERE ${column}=?`, [String(chatId)]);
  if (existing) return;

  const subject = platform === 'whatsapp' ? 'Percakapan WhatsApp' : 'Percakapan Telegram';
  const cleanChatId = String(chatId).replace(/[^a-zA-Z0-9]/g, '-');
  const email = `${platform}-${cleanChatId}@chat.local`.toLowerCase();

  await db.insert(
    `INSERT INTO contact_messages (name, email, phone, whatsapp, telegram_chat_id, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userName || 'Unknown',
      email,
      phone || null,
      platform === 'whatsapp' ? String(chatId) : null,
      platform === 'telegram' ? String(chatId) : null,
      subject,
      messageText || '',
      'unread'
    ]
  );
}

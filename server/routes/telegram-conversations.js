import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const convos = await db.all(`SELECT tc.*, tb.name as bot_name FROM telegram_conversations tc LEFT JOIN telegram_bots tb ON tc.bot_id = tb.id ORDER BY tc.updated_at DESC`);
  res.json(convos);
});

router.get('/:id/messages', authenticate, async (req, res) => {
  const msgs = await db.all('SELECT * FROM telegram_messages WHERE conversation_id = ? ORDER BY created_at ASC', [parseInt(req.params.id)]);
  // Reset unread count when messages are fetched (conversation opened)
  await db.run('UPDATE telegram_conversations SET unread = 0 WHERE id = ?', [parseInt(req.params.id)]);
  res.json(msgs);
});

router.post('/:id/reply', authenticate, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message is required' });
  const convo = await db.get('SELECT * FROM telegram_conversations WHERE id = ?', [req.params.id]);
  if (!convo) return res.status(404).json({ message: 'Conversation not found' });
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ? AND is_active = 1', [convo.bot_id]);
  if (!bot) return res.status(404).json({ message: 'Bot not found or inactive' });

  await db.insert('INSERT INTO telegram_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)', [convo.id, convo.bot_id, convo.chat_id, 'agent', message]);
  await db.run('UPDATE telegram_conversations SET last_message=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [message, convo.id]);

  try {
    const resp = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: convo.chat_id, text: message })
    });
    const json = await resp.json();
    if (!json.ok) return res.status(502).json({ ok: false, description: json.description || 'Telegram API error' });
    const msgs = await db.all('SELECT * FROM telegram_messages WHERE conversation_id = ? ORDER BY created_at ASC', [convo.id]);
    res.json(msgs);
  } catch (e) {
    res.status(502).json({ ok: false, description: 'Network error: ' + e.message });
  }
});

router.post('/:id/toggle', authenticate, async (req, res) => {
  const convo = await db.get('SELECT * FROM telegram_conversations WHERE id = ?', [parseInt(req.params.id)]);
  if (!convo) return res.status(404).json({ message: 'Conversation not found' });

  const newStatus = convo.status === 'ai' ? 'human' : 'ai';
  await db.run('UPDATE telegram_conversations SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [newStatus, parseInt(req.params.id)]);
  const updated = await db.get('SELECT * FROM telegram_conversations WHERE id = ?', [parseInt(req.params.id)]);
  await db.logActivity('telegram', 'Percakapan: ' + (newStatus === 'ai' ? 'kembali ke AI' : 'dialihkan ke Human'), convo.user_name || 'User', req.user?.id);

  // When switching human → AI: send a thank-you message to the customer
  if (newStatus === 'ai') {
    const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ? AND is_active = 1', [convo.bot_id]);
    if (bot) {
      const thankYouMsg =
        `✅ Terima kasih telah menggunakan layanan CS MAZNET!\n\n` +
        `Permintaan Anda telah kami tangani. Jika ada pertanyaan lain, jangan ragu untuk menghubungi kami kembali. 😊\n\n` +
        `Ketik /start atau "menu" untuk kembali ke menu utama.`;

      try {
        // Send thank-you message via Telegram
        await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: convo.chat_id,
            text: thankYouMsg
          })
        });

        // Also send the main menu keyboard
        const MAIN_MENU = [
          [{ text: '🎫 Buat Ticket', callback_data: 'create_ticket' }],
          [{ text: '📶 Upgrade Bandwidth', callback_data: 'upgrade' }],
          [{ text: '🔧 Instalasi Baru', callback_data: 'install' }],
          [{ text: '💬 Bicara dengan CS', callback_data: 'talk_to_cs' }]
        ];
        await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: convo.chat_id,
            text: 'Ada lagi yang bisa kami bantu?',
            reply_markup: { inline_keyboard: MAIN_MENU }
          })
        });

        // Save thank-you message to conversation history
        await db.insert(
          'INSERT INTO telegram_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)',
          [convo.id, convo.bot_id, convo.chat_id, 'bot', thankYouMsg]
        );
        await db.run('UPDATE telegram_conversations SET last_message=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [thankYouMsg, convo.id]);
      } catch (e) {
        console.error('Failed to send thank-you message:', e.message);
      }
    }
  }

  res.json(updated);
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM telegram_conversations WHERE id = ?', [parseInt(req.params.id)]);
  if (!existing) return res.status(404).json({ message: 'Conversation not found' });
  await db.run('DELETE FROM telegram_messages WHERE conversation_id = ?', [parseInt(req.params.id)]);
  await db.run('DELETE FROM telegram_conversations WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ message: 'Conversation deleted' });
});

export default router;

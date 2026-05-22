import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { getProvider } from '../services/whatsapp/provider-factory.js';

const router = Router();

// Get all conversations
router.get('/', authenticate, async (req, res) => {
  try {
    const conversations = await db.all(`
      SELECT wc.*, wb.name as bot_name, wb.provider, wb.status as bot_status
      FROM whatsapp_conversations wc
      LEFT JOIN whatsapp_bots wb ON wc.bot_id = wb.id
      ORDER BY wc.updated_at DESC
    `);
    res.json(conversations);
  } catch (error) {
    console.error('Get WhatsApp conversations error:', error);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const messages = await db.all(
      'SELECT * FROM whatsapp_messages WHERE conversation_id=? ORDER BY created_at ASC',
      [req.params.id]
    );

    // Mark as read
    await db.run('UPDATE whatsapp_conversations SET unread=0 WHERE id=?', [req.params.id]);

    res.json(messages);
  } catch (error) {
    console.error('Get WhatsApp messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// Reply to conversation
router.post('/:id/reply', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const convo = await db.get('SELECT * FROM whatsapp_conversations WHERE id=?', [req.params.id]);
    if (!convo) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [convo.bot_id]);
    if (!bot) {
      return res.status(404).json({ message: 'Bot not found' });
    }

    // Send via provider
    const provider = getProvider(bot.provider);
    await provider.sendMessage(bot.id, convo.chat_id, message);

    // Save to database
    await db.insert(
      'INSERT INTO whatsapp_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)',
      [convo.id, bot.id, convo.chat_id, 'bot', message]
    );

    await db.run(
      'UPDATE whatsapp_conversations SET last_message=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [message, convo.id]
    );

    await db.logActivity('whatsapp', 'Balas pesan WhatsApp', `Conversation #${convo.id}`, req.user.id);

    res.json({ message: 'Reply sent successfully' });
  } catch (error) {
    console.error('Reply WhatsApp error:', error);
    res.status(500).json({ message: 'Failed to send reply' });
  }
});

// Toggle AI/Human mode
router.post('/:id/toggle', authenticate, async (req, res) => {
  try {
    const convo = await db.get('SELECT * FROM whatsapp_conversations WHERE id=?', [req.params.id]);
    if (!convo) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const newStatus = convo.status === 'ai' ? 'human' : 'ai';
    await db.run('UPDATE whatsapp_conversations SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [newStatus, req.params.id]);

    // When switching human → AI: send thank-you message to customer
    if (newStatus === 'ai') {
      const bot = await db.get('SELECT * FROM whatsapp_bots WHERE id=? AND is_active=1', [convo.bot_id]);
      if (bot) {
        const thankYouMsg =
          `✅ Terima kasih telah menggunakan layanan CS MAZNET!\n\n` +
          `Permintaan Anda telah kami tangani. Jika ada pertanyaan lain, jangan ragu untuk menghubungi kami kembali. 😊\n\n` +
          `Ketik *menu* untuk kembali ke menu utama.`;

        try {
          const provider = getProvider(bot.provider);
          await provider.sendMessage(bot.id, convo.chat_id, thankYouMsg);
          await db.insert(
            'INSERT INTO whatsapp_messages (conversation_id, bot_id, chat_id, role, message) VALUES (?, ?, ?, ?, ?)',
            [convo.id, bot.id, convo.chat_id, 'bot', thankYouMsg]
          );
          await db.run('UPDATE whatsapp_conversations SET last_message=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [thankYouMsg, convo.id]);
        } catch (e) {
          console.error('Failed to send thank-you message:', e.message);
        }
      }
    }

    const updated = await db.get('SELECT * FROM whatsapp_conversations WHERE id=?', [req.params.id]);
    await db.logActivity('whatsapp', `Mode diubah ke ${newStatus}`, `Conversation #${convo.id}`, req.user.id);

    res.json(updated);
  } catch (error) {
    console.error('Toggle WhatsApp mode error:', error);
    res.status(500).json({ message: 'Failed to toggle mode' });
  }
});

// Delete conversation
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const convo = await db.get('SELECT * FROM whatsapp_conversations WHERE id=?', [req.params.id]);
    if (!convo) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await db.run('DELETE FROM whatsapp_messages WHERE conversation_id=?', [req.params.id]);
    await db.run('DELETE FROM whatsapp_conversations WHERE id=?', [req.params.id]);

    await db.logActivity('whatsapp', 'Conversation dihapus', `#${req.params.id}`, req.user.id);

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete WhatsApp conversation error:', error);
    res.status(500).json({ message: 'Failed to delete conversation' });
  }
});

export default router;

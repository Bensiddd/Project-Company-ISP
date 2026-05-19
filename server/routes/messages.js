import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

async function notifyTelegramBots(name, email, subject, message, ticketId) {
  try {
    const bots = db.all('SELECT * FROM telegram_bots WHERE is_active = 1');
    const text = `<b>📬 Pesan Baru dari Website</b>\n\n👤 <b>Nama:</b> ${name}\n📧 <b>Email:</b> ${email}\n📝 <b>Subjek:</b> ${subject || '-'}\n🎫 <b>Ticket:</b> #${ticketId || '-'}\n💬 <b>Pesan:</b> ${message?.substring(0, 200)}`;
    for (const bot of bots) {
      if (bot.admin_chat_id) {
        try {
          await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: bot.admin_chat_id, text })
          });
        } catch (e) { console.error('Telegram notify error:', e.message); }
      }
    }
  } catch (e) { console.error('Telegram notify error:', e.message); }
}

router.get('/', authenticate, (_req, res) => {
  const messages = db.all(`SELECT cm.*, au.full_name as assigned_name FROM contact_messages cm LEFT JOIN admin_users au ON cm.assigned_to = au.id ORDER BY cm.created_at DESC`);
  res.json(messages);
});

router.get('/:id', authenticate, (req, res) => {
  const msg = db.get(`SELECT cm.*, au.full_name as assigned_name FROM contact_messages cm LEFT JOIN admin_users au ON cm.assigned_to = au.id WHERE cm.id = ?`, [req.params.id]);
  if (!msg) return res.status(404).json({ message: 'Message not found' });
  res.json(msg);
});

router.post('/', optionalAuth, (req, res) => {
  const { name, email, phone, whatsapp, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ message: 'Name, email, and message are required' });
  const id = db.insert('INSERT INTO contact_messages (name, email, phone, whatsapp, subject, message) VALUES (?, ?, ?, ?, ?, ?)', [name, email, phone || '', whatsapp || '', subject || '', message]);
  const msg = db.get('SELECT * FROM contact_messages WHERE id = ?', [id]);

  // Auto-create ticket as request
  const ticketId = db.insert('INSERT INTO tickets (contact_message_id, type, status, priority, title, description) VALUES (?, ?, ?, ?, ?, ?)', [id, 'request', 'open', 'checking', subject || `Pesan dari ${name}`, `Dari: ${name} (${email})\nWhatsApp: ${whatsapp || '-'}\n\nPesan:\n${message}`]);

  notifyTelegramBots(name, email, subject, message, ticketId);
  db.logActivity('message', 'Pesan masuk dari website', name + ' - ' + (subject || message.substring(0, 50)), req.user?.id);
  res.status(201).json({ ...msg, ticket_id: ticketId });
});

router.put('/:id', authenticate, (req, res) => {
  const existing = db.get('SELECT id, name FROM contact_messages WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Message not found' });
  const { status, assigned_to } = req.body;
  db.run('UPDATE contact_messages SET status=?, assigned_to=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status || 'read', assigned_to || null, req.params.id]);
  if (status) db.logActivity('message', 'Status pesan: ' + status, existing.name, req.user?.id);
  if (assigned_to) db.logActivity('message', 'Pesan ditugaskan', existing.name, req.user?.id);
  res.json(db.get('SELECT * FROM contact_messages WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authenticate, (req, res) => {
  const existing = db.get('SELECT id, name FROM contact_messages WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Message not found' });
  db.logActivity('message', 'Pesan dihapus', existing.name, req.user?.id);
  db.run('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
  res.json({ message: 'Message deleted successfully' });
});

export default router;

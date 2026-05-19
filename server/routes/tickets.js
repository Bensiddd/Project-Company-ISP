import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  let where = '';
  if (req.user.role === 'teknisi') where = " WHERE t.status IN ('open', 'in_progress')";
  const tickets = await db.all(`SELECT t.*, cm.name as customer_name, cm.whatsapp, au.full_name as assigned_name FROM tickets t LEFT JOIN contact_messages cm ON t.contact_message_id = cm.id LEFT JOIN admin_users au ON t.assigned_to = au.id${where} ORDER BY t.created_at DESC`);
  res.json(tickets);
});

router.get('/:id', authenticate, async (req, res) => {
  const ticket = await db.get(`SELECT t.*, cm.name as customer_name, cm.whatsapp, au.full_name as assigned_name FROM tickets t LEFT JOIN contact_messages cm ON t.contact_message_id = cm.id LEFT JOIN admin_users au ON t.assigned_to = au.id WHERE t.id = ?`, [req.params.id]);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
  const replies = await db.all('SELECT tr.*, au.full_name as admin_name FROM ticket_replies tr LEFT JOIN admin_users au ON tr.admin_id = au.id WHERE tr.ticket_id = ? ORDER BY tr.created_at ASC', [req.params.id]);
  res.json({ ...ticket, replies });
});

router.post('/', authenticate, async (req, res) => {
  const { contact_message_id, type, priority, title, description, assigned_to } = req.body;
  if (!title || !type) return res.status(400).json({ message: 'Title and type are required' });
  const id = await db.insert('INSERT INTO tickets (contact_message_id, type, priority, title, description, assigned_to) VALUES (?, ?, ?, ?, ?, ?)', [contact_message_id || null, type, priority || 'medium', title, description || '', assigned_to || null]);
  const ticket = await db.get(`SELECT t.*, cm.name as customer_name, cm.whatsapp FROM tickets t LEFT JOIN contact_messages cm ON t.contact_message_id = cm.id WHERE t.id = ?`, [id]);
  await db.logActivity('ticket', 'Ticket dibuat', '#' + id + ' ' + title, req.user?.id);
  if (assigned_to) await db.logActivity('ticket', 'Ticket ditugaskan', '#' + id + ' ' + title, req.user?.id);
  res.status(201).json(ticket);
});

router.put('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Ticket not found' });
  const { status, priority, assigned_to, type } = req.body;
  const sets = [], vals = [];
  if (status !== undefined) { sets.push('status=?'); vals.push(status); }
  if (priority !== undefined) { sets.push('priority=?'); vals.push(priority); }
  if (assigned_to !== undefined) { sets.push('assigned_to=?'); vals.push(assigned_to); }
  if (type !== undefined) { sets.push('type=?'); vals.push(type); }
  if (sets.length > 0) {
    sets.push('updated_at=CURRENT_TIMESTAMP');
    vals.push(req.params.id);
    await db.run(`UPDATE tickets SET ${sets.join(',')} WHERE id=?`, vals);
  }
  const ticket = await db.get(`SELECT t.*, cm.name as customer_name, cm.whatsapp FROM tickets t LEFT JOIN contact_messages cm ON t.contact_message_id = cm.id WHERE t.id = ?`, [req.params.id]);
  if (status !== undefined && status !== existing.status) await db.logActivity('ticket', 'Status ticket: ' + existing.status + ' → ' + status, '#' + ticket.id + ' ' + ticket.title, req.user?.id);
  if (assigned_to !== undefined && Number(assigned_to) !== existing.assigned_to) await db.logActivity('ticket', 'Ticket ditugaskan', '#' + ticket.id + ' ' + ticket.title, req.user?.id);
  if (priority !== undefined && priority !== existing.priority) await db.logActivity('ticket', 'Prioritas ticket: ' + existing.priority + ' → ' + priority, '#' + ticket.id + ' ' + ticket.title, req.user?.id);
  res.json(ticket);
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id, title FROM tickets WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Ticket not found' });
  await db.logActivity('ticket', 'Ticket dihapus', '#' + existing.id + ' ' + existing.title, req.user?.id);
  await db.run('DELETE FROM tickets WHERE id = ?', [req.params.id]);
  res.json({ message: 'Ticket deleted successfully' });
});

router.post('/:id/reply', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id, title FROM tickets WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Ticket not found' });
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message is required' });
  await db.insert('INSERT INTO ticket_replies (ticket_id, admin_id, message) VALUES (?, ?, ?)', [req.params.id, req.user?.id || null, message]);
  await db.run('UPDATE tickets SET status = CASE WHEN status = ? THEN ? ELSE status END, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['closed', 'in_progress', req.params.id]);
  await db.logActivity('ticket', 'Balasan ticket', '#' + existing.id + ' ' + existing.title, req.user?.id);
  const reply = await db.all('SELECT tr.*, au.full_name as admin_name FROM ticket_replies tr LEFT JOIN admin_users au ON tr.admin_id = au.id WHERE tr.ticket_id = ? ORDER BY tr.created_at ASC', [req.params.id]);
  res.json(reply);
});

export default router;

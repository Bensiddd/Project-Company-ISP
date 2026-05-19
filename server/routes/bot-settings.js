import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (_req, res) => {
  const bots = await db.all('SELECT * FROM telegram_bots ORDER BY created_at DESC');
  res.json(bots);
});

router.get('/:id', authenticate, async (req, res) => {
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [req.params.id]);
  if (!bot) return res.status(404).json({ message: 'Bot not found' });
  res.json(bot);
});

router.post('/', authenticate, async (req, res) => {
  const { name, bot_token, admin_chat_id, is_active, role, ai_provider, ai_model, ai_api_key, ai_url } = req.body;
  if (!name || !bot_token) return res.status(400).json({ message: 'Name and bot token are required' });
  const id = await db.insert('INSERT INTO telegram_bots (name, bot_token, admin_chat_id, is_active, role, ai_provider, ai_model, ai_api_key, ai_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, bot_token, admin_chat_id || '', is_active !== false ? 1 : 0, role || 'admin', ai_provider || '', ai_model || '', ai_api_key || '', ai_url || '']);
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [id]);
  res.status(201).json(bot);
});

router.put('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM telegram_bots WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Bot not found' });
  const { name, bot_token, admin_chat_id, is_active, role, ai_provider, ai_model, ai_api_key, ai_url } = req.body;
  await db.run('UPDATE telegram_bots SET name=?, bot_token=?, admin_chat_id=?, is_active=?, role=?, ai_provider=?, ai_model=?, ai_api_key=?, ai_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [name, bot_token, admin_chat_id || '', is_active !== false ? 1 : 0, role || 'admin', ai_provider || '', ai_model || '', ai_api_key || '', ai_url || '', req.params.id]);
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [req.params.id]);
  res.json(bot);
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM telegram_bots WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Bot not found' });
  await db.run('DELETE FROM telegram_bots WHERE id = ?', [req.params.id]);
  res.json({ message: 'Bot deleted successfully' });
});

export default router;

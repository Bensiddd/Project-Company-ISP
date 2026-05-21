import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { encrypt, decrypt, maskSecret } from '../utils/encryption.js';

const router = Router();

function maskBot(bot) {
  if (!bot) return bot;
  let masked = '';
  try {
    masked = bot.ai_api_key ? maskSecret(decrypt(bot.ai_api_key)) : '';
  } catch {
    masked = bot.ai_api_key ? '••••(invalid)' : '';
  }
  return { ...bot, ai_api_key: masked };
}

router.get('/', authenticate, async (_req, res) => {
  const bots = await db.all('SELECT * FROM telegram_bots ORDER BY created_at DESC');
  res.json(bots.map(maskBot));
});

router.get('/:id', authenticate, async (req, res) => {
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [req.params.id]);
  if (!bot) return res.status(404).json({ message: 'Bot not found' });
  res.json(maskBot(bot));
});

router.post('/', authenticate, async (req, res) => {
  const { name, bot_token, admin_chat_id, is_active, role, ai_provider, ai_model, ai_api_key, ai_url, system_prompt } = req.body;
  if (!name || !bot_token) return res.status(400).json({ message: 'Name and bot token are required' });
  const storedKey = ai_api_key ? encrypt(ai_api_key) : '';
  const id = await db.insert('INSERT INTO telegram_bots (name, bot_token, admin_chat_id, is_active, role, ai_provider, ai_model, ai_api_key, ai_url, system_prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, bot_token, admin_chat_id || '', is_active !== false ? 1 : 0, role || 'admin', ai_provider || '', ai_model || '', storedKey, ai_url || '', system_prompt || '']);
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [id]);
  res.status(201).json(maskBot(bot));
});

router.put('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Bot not found' });
  const { name, bot_token, admin_chat_id, is_active, role, ai_provider, ai_model, ai_api_key, ai_url, system_prompt } = req.body;

  // Preserve existing encrypted key unless caller sent a non-empty new value
  let storedKey;
  if (ai_api_key && ai_api_key.length > 0) {
    storedKey = encrypt(ai_api_key);
  } else {
    storedKey = existing.ai_api_key || '';
  }
  // Clear AI fields if role moves away from customer_service
  let storedPrompt = system_prompt !== undefined ? (system_prompt || '') : (existing.system_prompt || '');
  if (role !== undefined && role !== 'customer_service') {
    storedKey = '';
    storedPrompt = '';
  }

  await db.run(
    'UPDATE telegram_bots SET name=?, bot_token=?, admin_chat_id=?, is_active=?, role=?, ai_provider=?, ai_model=?, ai_api_key=?, ai_url=?, system_prompt=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [
      name !== undefined ? name : existing.name,
      bot_token !== undefined ? bot_token : existing.bot_token,
      admin_chat_id !== undefined ? (admin_chat_id || '') : (existing.admin_chat_id || ''),
      is_active !== undefined ? (is_active !== false ? 1 : 0) : existing.is_active,
      role !== undefined ? (role || 'admin') : existing.role,
      ai_provider !== undefined ? (ai_provider || '') : (existing.ai_provider || ''),
      ai_model !== undefined ? (ai_model || '') : (existing.ai_model || ''),
      storedKey,
      ai_url !== undefined ? (ai_url || '') : (existing.ai_url || ''),
      storedPrompt,
      req.params.id
    ]
  );
  const bot = await db.get('SELECT * FROM telegram_bots WHERE id = ?', [req.params.id]);
  res.json(maskBot(bot));
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM telegram_bots WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Bot not found' });
  await db.run('DELETE FROM telegram_bots WHERE id = ?', [req.params.id]);
  res.json({ message: 'Bot deleted successfully' });
});

export default router;

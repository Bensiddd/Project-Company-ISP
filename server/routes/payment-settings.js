import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all payment settings (admin)
router.get('/', authenticate, async (_req, res) => {
  const settings = await db.get('SELECT * FROM payment_settings LIMIT 1');
  res.json(settings || {});
});

// Update payment settings (admin)
router.put('/', authenticate, async (req, res) => {
  const { gateway, is_active, merchant_id, client_key, server_key, environment, sandbox_url, production_url } = req.body;
  // Upsert logic – delete existing then insert
  await db.run('DELETE FROM payment_settings');
  const id = await db.insert(
    `INSERT INTO payment_settings (gateway, is_active, merchant_id, client_key, server_key, environment, sandbox_url, production_url) VALUES (?,?,?,?,?,?,?,?)`,
    [gateway, is_active ? 1 : 0, merchant_id, client_key, server_key, environment, sandbox_url, production_url]
  );
  const newSettings = await db.get('SELECT * FROM payment_settings WHERE id = ?', [id]);
  res.json(newSettings);
});

export default router;

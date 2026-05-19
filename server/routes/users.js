import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const users = await db.all('SELECT id, username, email, full_name, role, is_active, last_login, created_at, updated_at FROM admin_users ORDER BY created_at DESC');
  res.json(users);
});

router.get('/:id', async (req, res) => {
  const user = await db.get('SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM admin_users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

router.post('/', async (req, res) => {
  const { username, email, full_name, password, role, is_active } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'Username, email, and password are required' });
  const hash = bcrypt.hashSync(password, 10);
  const id = await db.insert('INSERT INTO admin_users (username, password_hash, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)', [username, hash, email, full_name || '', role || 'admin', is_active ? 1 : 0]);
  const user = await db.get('SELECT id, username, email, full_name, role, is_active, created_at FROM admin_users WHERE id = ?', [id]);
  res.status(201).json(user);
});

router.put('/:id', async (req, res) => {
  const existing = await db.get('SELECT id FROM admin_users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'User not found' });
  const { username, email, full_name, role, is_active, password } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await db.run('UPDATE admin_users SET username=?, email=?, full_name=?, role=?, is_active=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [username, email || '', full_name || '', role || 'admin', is_active ? 1 : 0, hash, req.params.id]);
  } else {
    await db.run('UPDATE admin_users SET username=?, email=?, full_name=?, role=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [username, email || '', full_name || '', role || 'admin', is_active ? 1 : 0, req.params.id]);
  }
  const user = await db.get('SELECT id, username, email, full_name, role, is_active, created_at FROM admin_users WHERE id = ?', [req.params.id]);
  res.json(user);
});

router.delete('/:id', async (req, res) => {
  const existing = await db.get('SELECT id FROM admin_users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'User not found' });
  await db.run('DELETE FROM admin_users WHERE id = ?', [req.params.id]);
  res.json({ message: 'User deleted successfully' });
});

export default router;

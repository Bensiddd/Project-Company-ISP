import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (_req, res) => {
  const users = db.all('SELECT id, username, email, full_name, role, is_active, last_login, created_at, updated_at FROM admin_users ORDER BY created_at DESC');
  res.json(users);
});

router.get('/:id', (req, res) => {
  const user = db.get('SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM admin_users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

router.post('/', (req, res) => {
  const { username, email, full_name, password, role, is_active } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'Username, email, and password are required' });
  const hash = bcrypt.hashSync(password, 10);
  const id = db.insert('INSERT INTO admin_users (username, password_hash, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)', [username, hash, email, full_name || '', role || 'admin', is_active ? 1 : 0]);
  const user = db.get('SELECT id, username, email, full_name, role, is_active, created_at FROM admin_users WHERE id = ?', [id]);
  res.status(201).json(user);
});

router.put('/:id', (req, res) => {
  const existing = db.get('SELECT id FROM admin_users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'User not found' });
  const { username, email, full_name, role, is_active, password } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.run('UPDATE admin_users SET username=?, email=?, full_name=?, role=?, is_active=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [username, email || '', full_name || '', role || 'admin', is_active ? 1 : 0, hash, req.params.id]);
  } else {
    db.run('UPDATE admin_users SET username=?, email=?, full_name=?, role=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [username, email || '', full_name || '', role || 'admin', is_active ? 1 : 0, req.params.id]);
  }
  const user = db.get('SELECT id, username, email, full_name, role, is_active, created_at FROM admin_users WHERE id = ?', [req.params.id]);
  res.json(user);
});

router.delete('/:id', (req, res) => {
  const existing = db.get('SELECT id FROM admin_users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'User not found' });
  db.run('DELETE FROM admin_users WHERE id = ?', [req.params.id]);
  res.json({ message: 'User deleted successfully' });
});

export default router;

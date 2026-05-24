import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = Router();


router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  // Allow login with email or username (case-insensitive)
  const user = await db.get('SELECT * FROM admin_users WHERE (LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)) AND is_active = 1', [email, email]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  await db.run('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  await db.logActivity('login', 'Admin login', user.full_name || user.username, user.id);
  const token = generateToken(user);
  const { password_hash, ...userData } = user;
  res.json({ token, user: userData });
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required' });
  const existing = await db.get('SELECT id FROM admin_users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ message: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const username = email.split('@')[0] + Date.now();
  const id = await db.insert('INSERT INTO admin_users (username, password_hash, email, full_name, role) VALUES (?, ?, ?, ?, ?)', [username, hash, email, name, 'admin']);
  const user = await db.get('SELECT * FROM admin_users WHERE id = ?', [id]);
  const token = generateToken(user);
  const { password_hash, ...userData } = user;
  res.status(201).json({ token, user: userData });
});

router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await db.get('SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM admin_users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

export default router;

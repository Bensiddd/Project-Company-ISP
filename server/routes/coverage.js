import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, async (_req, res) => {
  res.json(await db.all('SELECT * FROM coverage_areas ORDER BY id ASC'));
});

router.get('/:id', optionalAuth, async (req, res) => {
  const area = await db.get('SELECT * FROM coverage_areas WHERE id = ?', [req.params.id]);
  if (!area) return res.status(404).json({ message: 'Area not found' });
  res.json(area);
});

router.post('/', authenticate, async (req, res) => {
  const { name, description, is_active } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const id = await db.insert('INSERT INTO coverage_areas (name, description, is_active) VALUES (?, ?, ?)', [name, description || '', is_active ? 1 : 0]);
  res.status(201).json(await db.get('SELECT * FROM coverage_areas WHERE id = ?', [id]));
});

router.put('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM coverage_areas WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Area not found' });
  const { name, description, is_active } = req.body;
  await db.run('UPDATE coverage_areas SET name=?, description=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [name, description, is_active ? 1 : 0, req.params.id]);
  res.json(await db.get('SELECT * FROM coverage_areas WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM coverage_areas WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Area not found' });
  await db.run('DELETE FROM coverage_areas WHERE id = ?', [req.params.id]);
  res.json({ message: 'Area deleted successfully' });
});

export default router;

import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, (_req, res) => {
  res.json(db.all('SELECT * FROM coverage_areas ORDER BY id ASC'));
});

router.get('/:id', optionalAuth, (req, res) => {
  const area = db.get('SELECT * FROM coverage_areas WHERE id = ?', [req.params.id]);
  if (!area) return res.status(404).json({ message: 'Area not found' });
  res.json(area);
});

router.post('/', authenticate, (req, res) => {
  const { name, description, is_active } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const id = db.insert('INSERT INTO coverage_areas (name, description, is_active) VALUES (?, ?, ?)', [name, description || '', is_active ? 1 : 0]);
  res.status(201).json(db.get('SELECT * FROM coverage_areas WHERE id = ?', [id]));
});

router.put('/:id', authenticate, (req, res) => {
  const existing = db.get('SELECT id FROM coverage_areas WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Area not found' });
  const { name, description, is_active } = req.body;
  db.run('UPDATE coverage_areas SET name=?, description=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [name, description, is_active ? 1 : 0, req.params.id]);
  res.json(db.get('SELECT * FROM coverage_areas WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authenticate, (req, res) => {
  const existing = db.get('SELECT id FROM coverage_areas WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Area not found' });
  db.run('DELETE FROM coverage_areas WHERE id = ?', [req.params.id]);
  res.json({ message: 'Area deleted successfully' });
});

export default router;

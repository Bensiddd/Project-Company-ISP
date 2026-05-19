import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, (_req, res) => {
  const testimonials = db.all(`SELECT t.*, c.company_name as client_name FROM testimonials t LEFT JOIN clients c ON t.client_id = c.id ORDER BY t.created_at DESC`);
  res.json(testimonials);
});

router.get('/:id', optionalAuth, (req, res) => {
  const testimonial = db.get(`SELECT t.*, c.company_name as client_name FROM testimonials t LEFT JOIN clients c ON t.client_id = c.id WHERE t.id = ?`, [req.params.id]);
  if (!testimonial) return res.status(404).json({ message: 'Testimonial not found' });
  res.json(testimonial);
});

router.post('/', authenticate, (req, res) => {
  const { client_id, author_name, author_position, content, rating, is_approved } = req.body;
  if (!author_name || !content) return res.status(400).json({ message: 'Author name and content are required' });
  const published_at = is_approved ? new Date().toISOString() : null;
  const id = db.insert(
    'INSERT INTO testimonials (client_id, author_name, author_position, content, rating, is_approved, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [client_id || null, author_name, author_position || '', content, Math.min(5, Math.max(1, rating || 5)), is_approved ? 1 : 0, published_at]
  );
  const testimonial = db.get(`SELECT t.*, c.company_name as client_name FROM testimonials t LEFT JOIN clients c ON t.client_id = c.id WHERE t.id = ?`, [id]);
  res.status(201).json(testimonial);
});

router.put('/:id', authenticate, (req, res) => {
  const existing = db.get('SELECT id FROM testimonials WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Testimonial not found' });
  const { client_id, author_name, author_position, content, rating, is_approved } = req.body;
  const current = db.get('SELECT published_at FROM testimonials WHERE id = ?', [req.params.id]);
  const published_at = is_approved ? (current?.published_at || new Date().toISOString()) : null;
  db.run(
    'UPDATE testimonials SET client_id=?, author_name=?, author_position=?, content=?, rating=?, is_approved=?, published_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [client_id || null, author_name, author_position || '', content, rating, is_approved ? 1 : 0, published_at, req.params.id]
  );
  const testimonial = db.get(`SELECT t.*, c.company_name as client_name FROM testimonials t LEFT JOIN clients c ON t.client_id = c.id WHERE t.id = ?`, [req.params.id]);
  res.json(testimonial);
});

router.delete('/:id', authenticate, (req, res) => {
  const existing = db.get('SELECT id FROM testimonials WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Testimonial not found' });
  db.run('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
  res.json({ message: 'Testimonial deleted successfully' });
});

export default router;

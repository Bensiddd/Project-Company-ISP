import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

const mysqlDatetime = (date) => {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
};

router.get('/', optionalAuth, async (_req, res) => {
  const testimonials = await db.all(`SELECT t.*, c.company_name as client_name FROM testimonials t LEFT JOIN clients c ON t.client_id = c.id ORDER BY t.created_at DESC`);
  res.json(testimonials);
});

router.get('/:id', optionalAuth, async (req, res) => {
  const testimonial = await db.get(`SELECT t.*, c.company_name as client_name FROM testimonials t LEFT JOIN clients c ON t.client_id = c.id WHERE t.id = ?`, [req.params.id]);
  if (!testimonial) return res.status(404).json({ message: 'Testimonial not found' });
  res.json(testimonial);
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { client_id, author_name, author_position, content, rating, is_approved } = req.body;
    if (!author_name || !content) return res.status(400).json({ message: 'Author name and content are required' });
    const published_at = is_approved ? mysqlDatetime(new Date()) : null;
    const id = await db.insert(
      'INSERT INTO testimonials (client_id, author_name, author_position, content, rating, is_approved, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [client_id || null, author_name, author_position || '', content, Math.min(5, Math.max(1, rating || 5)), is_approved ? 1 : 0, published_at]
    );
    const testimonial = await db.get(`SELECT t.*, c.company_name as client_name FROM testimonials t LEFT JOIN clients c ON t.client_id = c.id WHERE t.id = ?`, [id]);
    res.status(201).json(testimonial);
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const existing = await db.get('SELECT id FROM testimonials WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ message: 'Testimonial not found' });
    const { client_id, author_name, author_position, content, rating, is_approved } = req.body;
    const current = await db.get('SELECT published_at FROM testimonials WHERE id = ?', [req.params.id]);
    const published_at = is_approved ? (current?.published_at || mysqlDatetime(new Date())) : null;
    await db.run(
      'UPDATE testimonials SET client_id=?, author_name=?, author_position=?, content=?, rating=?, is_approved=?, published_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [client_id || null, author_name, author_position || '', content, rating, is_approved ? 1 : 0, published_at, req.params.id]
    );
    const testimonial = await db.get(`SELECT t.*, c.company_name as client_name FROM testimonials t LEFT JOIN clients c ON t.client_id = c.id WHERE t.id = ?`, [req.params.id]);
    res.json(testimonial);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM testimonials WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Testimonial not found' });
  await db.run('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
  res.json({ message: 'Testimonial deleted successfully' });
});

export default router;

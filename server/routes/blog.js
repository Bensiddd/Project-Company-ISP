import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, async (_req, res) => {
  const posts = await db.all(`SELECT bp.*, au.full_name as author_name FROM blog_posts bp LEFT JOIN admin_users au ON bp.author_id = au.id ORDER BY bp.created_at DESC`);
  res.json(posts);
});

router.get('/:id', optionalAuth, async (req, res) => {
  const post = await db.get(`SELECT bp.*, au.full_name as author_name FROM blog_posts bp LEFT JOIN admin_users au ON bp.author_id = au.id WHERE bp.id = ?`, [req.params.id]);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

router.post('/', authenticate, async (req, res) => {
  const { title, slug, excerpt, content, category, status, featured_image_url, meta_description, read_time } = req.body;
  if (!title || !slug) return res.status(400).json({ message: 'Title and slug are required' });
  const published_at = status === 'published' ? new Date().toISOString() : null;
  const id = await db.insert(
    'INSERT INTO blog_posts (title, slug, excerpt, content, category, author_id, status, published_at, featured_image_url, meta_description, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, slug, excerpt || '', content || '', category || 'General', req.user.id, status || 'draft', published_at, featured_image_url || null, meta_description || null, read_time || null]
  );
  const post = await db.get(`SELECT bp.*, au.full_name as author_name FROM blog_posts bp LEFT JOIN admin_users au ON bp.author_id = au.id WHERE bp.id = ?`, [id]);
  res.status(201).json(post);
});

router.put('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Post not found' });
  const { title, slug, excerpt, content, category, status, featured_image_url, meta_description, read_time } = req.body;
  const current = await db.get('SELECT published_at FROM blog_posts WHERE id = ?', [req.params.id]);
  const published_at = status === 'published' ? (current.published_at || new Date().toISOString()) : null;
  await db.run(
    'UPDATE blog_posts SET title=?, slug=?, excerpt=?, content=?, category=?, status=?, published_at=?, featured_image_url=?, meta_description=?, read_time=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [title, slug, excerpt, content, category, status, published_at, featured_image_url, meta_description, read_time, req.params.id]
  );
  const post = await db.get(`SELECT bp.*, au.full_name as author_name FROM blog_posts bp LEFT JOIN admin_users au ON bp.author_id = au.id WHERE bp.id = ?`, [req.params.id]);
  res.json(post);
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Post not found' });
  await db.run('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
  res.json({ message: 'Post deleted successfully' });
});

export default router;

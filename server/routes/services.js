import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, async (_req, res) => {
  const services = await db.all('SELECT * FROM service_packages ORDER BY price ASC');
  res.json(services.map(s => ({ ...s, features: JSON.parse(s.features || '[]') })));
});

router.get('/:id', optionalAuth, async (req, res) => {
  const svc = await db.get('SELECT * FROM service_packages WHERE id = ?', [req.params.id]);
  if (!svc) return res.status(404).json({ message: 'Service not found' });
  res.json({ ...svc, features: JSON.parse(svc.features || '[]') });
});

router.post('/', authenticate, async (req, res) => {
  const { name, description, type, price, bandwidth, features, is_active, popular } = req.body;
  if (!name || price === undefined) return res.status(400).json({ message: 'Name and price are required' });
  const id = await db.insert(
    'INSERT INTO service_packages (name, description, type, price, bandwidth, features, is_active, popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, description || '', type || 'monthly', price, bandwidth || '', JSON.stringify(features || []), is_active ? 1 : 0, popular ? 1 : 0]
  );
  const svc = await db.get('SELECT * FROM service_packages WHERE id = ?', [id]);
  res.status(201).json({ ...svc, features: JSON.parse(svc.features || '[]') });
});

router.put('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM service_packages WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Service not found' });
  const { name, description, type, price, bandwidth, features, is_active, popular } = req.body;
  await db.run(
    'UPDATE service_packages SET name=?, description=?, type=?, price=?, bandwidth=?, features=?, is_active=?, popular=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [name, description, type, price, bandwidth, JSON.stringify(features || []), is_active ? 1 : 0, popular ? 1 : 0, req.params.id]
  );
  const svc = await db.get('SELECT * FROM service_packages WHERE id = ?', [req.params.id]);
  res.json({ ...svc, features: JSON.parse(svc.features || '[]') });
});

router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM service_packages WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Service not found' });
  await db.run('DELETE FROM service_packages WHERE id = ?', [req.params.id]);
  res.json({ message: 'Service deleted successfully' });
});

export default router;

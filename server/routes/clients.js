import { Router } from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, (_req, res) => {
  res.json(db.all('SELECT * FROM clients ORDER BY created_at DESC'));
});

router.get('/:id', optionalAuth, (req, res) => {
  const client = db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!client) return res.status(404).json({ message: 'Client not found' });
  const testimonials = db.all('SELECT * FROM testimonials WHERE client_id = ?', [req.params.id]);
  res.json({ ...client, testimonials });
});

router.post('/', authenticate, (req, res) => {
  const { company_name, contact_person, email, phone, address, website, logo_url, industry, is_active } = req.body;
  if (!company_name) return res.status(400).json({ message: 'Company name is required' });
  const id = db.insert(
    'INSERT INTO clients (company_name, contact_person, email, phone, address, website, logo_url, industry, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [company_name, contact_person || '', email || '', phone || '', address || '', website || '', logo_url || '', industry || '', is_active ? 1 : 0]
  );
  res.status(201).json(db.get('SELECT * FROM clients WHERE id = ?', [id]));
});

router.put('/:id', authenticate, (req, res) => {
  const existing = db.get('SELECT id FROM clients WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Client not found' });
  const { company_name, contact_person, email, phone, address, website, logo_url, industry, is_active } = req.body;
  db.run(
    'UPDATE clients SET company_name=?, contact_person=?, email=?, phone=?, address=?, website=?, logo_url=?, industry=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [company_name, contact_person || '', email || '', phone || '', address || '', website || '', logo_url || '', industry || '', is_active ? 1 : 0, req.params.id]
  );
  res.json(db.get('SELECT * FROM clients WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authenticate, (req, res) => {
  const existing = db.get('SELECT id FROM clients WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Client not found' });
  db.run('DELETE FROM clients WHERE id = ?', [req.params.id]);
  res.json({ message: 'Client deleted successfully' });
});

export default router;

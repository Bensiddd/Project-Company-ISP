import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all subscriptions (admin)
router.get('/', authenticate, async (_req, res) => {
  const subs = await db.all('SELECT * FROM subscriptions ORDER BY created_at DESC');
  res.json(subs);
});

// Get subscription by id
router.get('/:id', authenticate, async (req, res) => {
  const sub = await db.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
  if (!sub) return res.status(404).json({ message: 'Subscription not found' });
  res.json(sub);
});

// Create subscription (admin)
router.post('/', authenticate, async (req, res) => {
  const {
    client_id,
    package_id,
    status = 'active',
    billing_cycle = 'monthly',
    activation_date,
    next_billing_date,
    notes
  } = req.body;
  if (!client_id || !package_id) {
    return res.status(400).json({ message: 'client_id and package_id required' });
  }
  const id = await db.insert(
    `INSERT INTO subscriptions (client_id, package_id, status, billing_cycle, activation_date, next_billing_date, notes) VALUES (?,?,?,?,?,?,?)`,
    [client_id, package_id, status, billing_cycle, activation_date || null, next_billing_date || null, notes || null]
  );
  const newSub = await db.get('SELECT * FROM subscriptions WHERE id = ?', [id]);
  res.status(201).json(newSub);
});

// Update subscription (admin)
router.put('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM subscriptions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Subscription not found' });
  const {
    status,
    billing_cycle,
    activation_date,
    next_billing_date,
    notes
  } = req.body;
  await db.run(
    `UPDATE subscriptions SET status = ?, billing_cycle = ?, activation_date = ?, next_billing_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, billing_cycle, activation_date, next_billing_date, notes, req.params.id]
  );
  const updated = await db.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
  res.json(updated);
});

// Suspend, activate, terminate actions
router.put('/:id/suspend', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM subscriptions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Subscription not found' });
  await db.run('UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['suspended', req.params.id]);
  const sub = await db.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
  res.json(sub);
});

router.put('/:id/activate', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM subscriptions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Subscription not found' });
  await db.run('UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['active', req.params.id]);
  const sub = await db.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
  res.json(sub);
});

router.put('/:id/terminate', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM subscriptions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Subscription not found' });
  const { termination_reason } = req.body;
  await db.run('UPDATE subscriptions SET status = ?, termination_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['terminated', termination_reason || null, req.params.id]);
  const sub = await db.get('SELECT * FROM subscriptions WHERE id = ?', [req.params.id]);
  res.json(sub);
});

// Delete all subscriptions
router.delete('/', authenticate, async (_req, res) => {
  const count = await db.get('SELECT COUNT(*) as cnt FROM subscriptions');
  await db.run('DELETE FROM subscriptions');
  res.json({ message: `${count.cnt} subscription(s) deleted` });
});

// Delete subscription by id
router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM subscriptions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Subscription not found' });
  await db.run('DELETE FROM subscriptions WHERE id = ?', [req.params.id]);
  res.json({ message: 'Subscription deleted' });
});

export default router;

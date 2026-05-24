import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all payments (admin)
router.get('/', authenticate, async (_req, res) => {
  const payments = await db.all('SELECT * FROM payments ORDER BY created_at DESC');
  res.json(payments);
});

// Get payment by id (admin)
router.get('/:id', authenticate, async (req, res) => {
  const payment = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  res.json(payment);
});

// Create payment (admin) – placeholder implementation
router.post('/', authenticate, async (req, res) => {
  const { invoice_id, client_id, amount, payment_method, payment_channel, transaction_id, payment_details, notes } = req.body;
  if (!invoice_id || !client_id || !amount || !payment_method) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const id = await db.insert(
    `INSERT INTO payments (invoice_id, client_id, amount, payment_method, payment_channel, transaction_id, status, payment_details, notes) VALUES (?,?,?,?,?,?,?, ?, ?)`,
    [
      invoice_id,
      client_id,
      amount,
      payment_method,
      payment_channel || null,
      transaction_id || null,
      'pending',
      payment_details ? JSON.stringify(payment_details) : null,
      notes || null
    ]
  );
  const newPay = await db.get('SELECT * FROM payments WHERE id = ?', [id]);
  res.status(201).json(newPay);
});

// Verify payment (admin) – placeholder updates status
router.put('/:id/verify', authenticate, async (req, res) => {
  const payment = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  await db.run('UPDATE payments SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?', ['success', req.params.id]);
  const updated = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  res.json(updated);
});

export default router;

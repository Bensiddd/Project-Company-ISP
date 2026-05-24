import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all invoices (admin only)
router.get('/', authenticate, async (_req, res) => {
  const invoices = await db.all('SELECT * FROM invoices ORDER BY created_at DESC');
  res.json(invoices);
});

// Get invoice by id (admin or client owner)
router.get('/:id', authenticate, async (req, res) => {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  res.json(invoice);
});

// Create invoice (admin)
router.post('/', authenticate, async (req, res) => {
  const {
    invoice_number,
    subscription_id,
    client_id,
    package_id,
    amount,
    tax_amount,
    total_amount,
    status = 'unpaid',
    issue_date,
    due_date,
    payment_method,
    notes,
    billing_period_start,
    billing_period_end
  } = req.body;
  if (!invoice_number || !client_id || !issue_date || !due_date) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const id = await db.insert(
    `INSERT INTO invoices (invoice_number, subscription_id, client_id, package_id, amount, tax_amount, total_amount, status, issue_date, due_date, payment_method, notes, billing_period_start, billing_period_end) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      invoice_number,
      subscription_id || null,
      client_id,
      package_id || null,
      amount || 0,
      tax_amount || 0,
      total_amount || 0,
      status,
      issue_date,
      due_date,
      payment_method || null,
      notes || null,
      billing_period_start || null,
      billing_period_end || null
    ]
  );
  const newInv = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
  res.status(201).json(newInv);
});

// Cancel invoice (admin)
router.put('/:id/cancel', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM invoices WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Invoice not found' });
  await db.run('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['cancelled', req.params.id]);
  const updated = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  res.json(updated);
});

// Placeholder PDF generation endpoint
router.get('/:id/pdf', authenticate, async (req, res) => {
  // In a real implementation, generate PDF with pdfkit and stream back.
  res.status(501).json({ message: 'PDF generation not implemented yet' });
});

export default router;

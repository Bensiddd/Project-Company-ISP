import { Router } from 'express';
import crypto from 'crypto';
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
  try {
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
      billing_period_end,
      items = []
    } = req.body;

    if (!client_id || !due_date) {
      return res.status(400).json({ message: 'Client dan due date wajib diisi.' });
    }

    const cleanItems = Array.isArray(items)
      ? items.filter(i => (i.description || '').trim())
      : [];
    const computedAmount = cleanItems.reduce((sum, item) => {
      const qty = Number(item.quantity || 1);
      const price = Number(item.unit_price || 0);
      return sum + (qty * price);
    }, 0);
    const finalAmount = Number(amount || computedAmount || 0);
    const finalTax = Number(tax_amount || 0);
    const finalTotal = Number(total_amount || finalAmount + finalTax);
    const finalIssueDate = issue_date || new Date().toISOString().slice(0, 10);
    const finalInvoiceNumber = invoice_number || `INV-${Date.now()}`;
    // Generate public payment token (30-day expiry)
    const paymentToken = crypto.randomBytes(24).toString('hex');
    const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const id = await db.insert(
      `INSERT INTO invoices (invoice_number, subscription_id, client_id, package_id, amount, tax_amount, total_amount, status, issue_date, due_date, payment_method, notes, billing_period_start, billing_period_end, payment_token, payment_token_expires) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        finalInvoiceNumber,
        subscription_id || null,
        client_id,
        package_id || null,
        finalAmount,
        finalTax,
        finalTotal,
        status,
        finalIssueDate,
        due_date,
        payment_method || null,
        notes || null,
        billing_period_start || null,
        billing_period_end || null,
        paymentToken,
        tokenExpires
      ]
    );

    for (const item of cleanItems) {
      const qty = Number(item.quantity || 1);
      const price = Number(item.unit_price || 0);
      await db.insert(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, subtotal, type) VALUES (?,?,?,?,?,?)`,
        [id, item.description.trim(), qty, price, qty * price, item.type || 'other']
      );
    }

    const newInv = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
    res.status(201).json(newInv);
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ message: 'Gagal membuat invoice.', error: err.message });
  }
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

// Generate monthly invoices for all active subscriptions
router.post('/generate-monthly', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Find subscriptions nearing billing
    const subs = await db.all(`
      SELECT s.*, c.payment_terms, p.price, p.name AS package_name
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      JOIN service_packages p ON s.package_id = p.id
      WHERE (s.next_billing_date IS NULL OR s.next_billing_date <= ?)
      AND s.status = 'active'
      AND c.is_active = 1
    `, [lastOfMonth]);

    const generated = [];
    let skipped = 0;

    for (const sub of subs) {
      // Check duplicate — already invoiced this period
      const existing = await db.get(
        'SELECT id FROM invoices WHERE subscription_id = ? AND billing_period_start = ?',
        [sub.id, firstOfMonth]
      );
      if (existing) { skipped++; continue; }

      const invoiceNumber = `INV-${Date.now()}-${sub.client_id}`;
      const dueDays = sub.payment_terms || 15;
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + dueDays);
      const dueDateStr = dueDate.toISOString().split('T')[0];

      await db.insert(
        `INSERT INTO invoices (invoice_number, subscription_id, client_id, amount, total_amount, status, issue_date, due_date, billing_period_start, billing_period_end)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [invoiceNumber, sub.id, sub.client_id, sub.price || 0, sub.price || 0, 'unpaid', now.toISOString().split('T')[0], dueDateStr, firstOfMonth, lastOfMonth]
      );

      // Update next billing date
      const nextBilling = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await db.run('UPDATE subscriptions SET next_billing_date = ?, last_billing_date = NOW() WHERE id = ?',
        [nextBilling.toISOString().split('T')[0], sub.id]);

      generated.push({ invoice_number: invoiceNumber, client_id: sub.client_id, amount: sub.price });
    }

    res.json({ generated: generated.length, skipped, invoices: generated, message: `${generated.length} invoice dibuat, ${skipped} diskip (sudah ada).` });
  } catch (err) {
    console.error('Generate monthly error:', err);
    res.status(500).json({ message: 'Gagal generate invoice.', error: err.message });
  }
});

// Delete all invoices
router.delete('/', authenticate, async (_req, res) => {
  const count = await db.get('SELECT COUNT(*) as cnt FROM invoices');
  await db.run('DELETE FROM invoices');
  res.json({ message: `${count.cnt} invoice(s) deleted` });
});

// Delete invoice by id
router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM invoices WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Invoice not found' });
  await db.run('DELETE FROM invoices WHERE id = ?', [req.params.id]);
  res.json({ message: 'Invoice deleted' });
});

export default router;

import { Router } from 'express';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
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

// ─── Colour palette ───
const BRAND = '#1e3a5f';        // dark navy — headers, accents
const BRAND_LIGHT = '#3b5998';  // mid blue — secondary accents
const ACCENT = '#d97706';       // warm amber — status unpaid/overdue accent
const SUCCESS = '#16a34a';      // green — paid
const DANGER = '#dc2626';       // red — overdue
const BORDER = '#e2e8f0';       // light grey — table lines
const BG_STRIPE = '#f8fafc';    // off-white — alternating rows
const TEXT_MUTED = '#64748b';   // grey — secondary text
const TEXT_DARK = '#0f172a';    // near-black — primary text
const WHITE = '#ffffff';

// Helper: format currency
const rp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

// Helper: format date
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

// Generate PDF invoice — compact professional design
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const invoice = await db.get(
      `SELECT i.*, c.company_name AS client_name, c.address AS client_address,
              c.phone AS client_phone, c.email AS client_email
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       WHERE i.id = ?`, [req.params.id]
    );
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const items = await db.all(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [invoice.id]
    );
    const lineItems = items.length > 0 ? items : [{
      description: `Layanan Internet — ${invoice.invoice_number}`,
      quantity: 1, unit_price: invoice.total_amount, subtotal: invoice.total_amount
    }];

    const pageW = 595.28;  // A4 width
    const doc = new PDFDocument({ margin: 24, size: [pageW, 420], bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoice_number}.pdf"`);
    doc.pipe(res);

    const M = 24;                  // margin
    const W = pageW - M * 2;      // usable width = 547
    const R = M + W;              // right edge = 571
    const statusColor = invoice.status === 'paid' ? SUCCESS : invoice.status === 'overdue' ? DANGER : ACCENT;
    const statusLabel = invoice.status === 'unpaid' ? 'BELUM DIBAYAR' : invoice.status.toUpperCase();

    // ─── TOP STRIP ───
    doc.rect(0, 0, pageW, 4).fill(BRAND);

    // ─── HEADER: brand left, invoice# + status right ───
    doc.fontSize(16).font('Helvetica-Bold').fillColor(BRAND).text('MAZNET', M, 16);
    doc.fontSize(6).font('Helvetica').fillColor(TEXT_MUTED)
      .text('RT RW NET  •  Kabupaten Bekasi  •  admin@maznet.id', M, 33);

    doc.fontSize(14).font('Helvetica-Bold').fillColor(BRAND)
      .text('INVOICE', R - 170, 14, { width: 170, align: 'right' });
    doc.fontSize(7).font('Helvetica').fillColor(TEXT_DARK)
      .text(invoice.invoice_number, R - 170, 30, { width: 170, align: 'right' });

    // Status badge
    const badgeW = 82, badgeH = 12;
    doc.roundedRect(R - badgeW, 42, badgeW, badgeH, 2).fill(statusColor);
    doc.fontSize(6).font('Helvetica-Bold').fillColor(WHITE)
      .text(statusLabel, R - badgeW, 44, { width: badgeW, align: 'center' });

    // Dates inline
    doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_MUTED);
    doc.text(`Tgl: ${fmtDate(invoice.issue_date)}`, R - 170, 58, { width: 170, align: 'right' });
    doc.text(`Jatuh Tempo: ${fmtDate(invoice.due_date)}`, R - 170, 67, { width: 170, align: 'right' });
    if (invoice.billing_period_start) {
      doc.text(`Periode: ${fmtDate(invoice.billing_period_start)} — ${fmtDate(invoice.billing_period_end)}`, R - 170, 76, { width: 170, align: 'right' });
    }

    // ─── FROM / TO ───
    const hdrY = 84;
    doc.moveTo(M, hdrY).lineTo(R, hdrY).lineWidth(0.4).stroke(BORDER); doc.lineWidth(1);

    const secY = hdrY + 8;
    doc.fontSize(6).font('Helvetica-Bold').fillColor(TEXT_MUTED).text('DARI', M, secY);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_DARK).text('MAZNET', M, secY + 10);
    doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_MUTED)
      .text('Penyedia Layanan Internet  •  Kabupaten Bekasi, Jawa Barat  •  admin@maznet.id', M, secY + 21);

    const toX = M + W / 2;
    doc.fontSize(6).font('Helvetica-Bold').fillColor(TEXT_MUTED).text('DITUJUKAN KEPADA', toX, secY);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(TEXT_DARK)
      .text(invoice.client_name || 'Client', toX, secY + 10);
    doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_MUTED);
    let clY = secY + 21;
    if (invoice.client_address) { doc.text(invoice.client_address, toX, clY); clY += 9; }
    if (invoice.client_phone)    { doc.text(invoice.client_phone, toX, clY); clY += 9; }
    if (invoice.client_email)    { doc.text(invoice.client_email, toX, clY); }

    // ─── TABLE ───
    const tableTop = Math.max(secY + 46, clY + 8);
    const colX = [M, 220, 295, 370];  // 4 cols within W
    const colW = [colX[1] - colX[0] - 4, colX[2] - colX[1] - 2, colX[3] - colX[2] - 2, R - colX[3] - 2];

    // Table header
    doc.rect(M, tableTop, W, 14).fill(BRAND);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(WHITE);
    doc.text('DESKRIPSI', colX[0] + 2, tableTop + 3);
    doc.text('QTY', colX[1], tableTop + 3, { width: colW[1], align: 'center' });
    doc.text('HARGA', colX[2], tableTop + 3, { width: colW[2], align: 'right' });
    doc.text('SUBTOTAL', colX[3], tableTop + 3, { width: colW[3], align: 'right' });

    // Rows
    let ry = tableTop + 16;
    lineItems.forEach((item, idx) => {
      if (idx % 2 === 0) doc.rect(M, ry, W, 14).fill(BG_STRIPE);
      doc.moveTo(M, ry + 14).lineTo(R, ry + 14).lineWidth(0.2).stroke(BORDER); doc.lineWidth(1);
      doc.fontSize(7).font('Helvetica').fillColor(TEXT_DARK);
      doc.text(item.description || 'Item', colX[0] + 2, ry + 3, { width: colW[0] - 4 });
      doc.text(String(item.quantity || 1), colX[1], ry + 3, { width: colW[1], align: 'center' });
      doc.text(rp(item.unit_price), colX[2], ry + 3, { width: colW[2], align: 'right' });
      doc.text(rp(item.subtotal), colX[3], ry + 3, { width: colW[3], align: 'right' });
      ry += 14;
    });

    // Table bottom
    doc.moveTo(M, ry).lineTo(R, ry).lineWidth(0.6).stroke(BORDER); doc.lineWidth(1);
    ry += 6;

    // ─── TOTALS (right-aligned block) ───
    const totW = 200;
    const totX = R - totW;
    let ty = ry;

    doc.fontSize(8).font('Helvetica').fillColor(TEXT_DARK);
    doc.text('Subtotal', totX, ty, { width: 70 });
    doc.text(rp(invoice.amount), totX, ty, { width: totW, align: 'right' });
    ty += 14;

    if (Number(invoice.tax_amount || 0) > 0) {
      doc.text('Pajak (PPN 11%)', totX, ty, { width: 70 });
      doc.text(rp(invoice.tax_amount), totX, ty, { width: totW, align: 'right' });
      ty += 14;
    }

    doc.moveTo(totX, ty).lineTo(R, ty).lineWidth(1).stroke(BRAND); doc.lineWidth(1);
    ty += 4;

    // TOTAL box
    doc.rect(totX, ty, totW, 18).fill(BRAND);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(WHITE);
    doc.text('TOTAL', totX + 4, ty + 3, { width: 50 });
    doc.text(rp(invoice.total_amount), totX, ty + 3, { width: totW - 4, align: 'right' });
    doc.fillColor(TEXT_DARK);
    ty += 22;

    // ─── PAYMENT INFO ───
    ty += 4;
    doc.rect(M, ty, W, 36).fill(BG_STRIPE);
    doc.rect(M, ty, W, 36).lineWidth(0.3).stroke(BORDER); doc.lineWidth(1);
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(BRAND)
      .text('INFORMASI PEMBAYARAN', M + 4, ty + 4);
    doc.fontSize(6).font('Helvetica').fillColor(TEXT_DARK)
      .text('Transfer ke: BCA 123-456-7890 a/n MAZNET INDONESIA', M + 4, ty + 15);
    if (invoice.payment_token) {
      doc.fontSize(5.5).font('Helvetica').fillColor(TEXT_MUTED)
        .text(`Link: maznet.id/pay/${invoice.payment_token}`, M + 4, ty + 25);
    }
    ty += 40;

    // ─── NOTES + FOOTER (merged) ───
    const footerParts = [];
    footerParts.push('MAZNET — Invoice elektronik sah tanpa tanda tangan.');
    footerParts.push(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    if (invoice.notes) footerParts.push(`Catatan: ${invoice.notes}`);

    // Place footer anchored to bottom
    const footerY = doc.page.height - 38;  // 382 — within 24px bottom margin
    doc.moveTo(M, footerY).lineTo(R, footerY).lineWidth(0.3).stroke(BORDER); doc.lineWidth(1);
    doc.fontSize(5.5).font('Helvetica').fillColor(TEXT_MUTED);
    doc.text(footerParts.join('  |  '), M, footerY + 3, { width: W, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ message: 'Gagal generate PDF.', error: err.message });
  }
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

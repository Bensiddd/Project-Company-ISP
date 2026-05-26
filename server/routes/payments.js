import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import midtransClient from 'midtrans-client';

const router = Router();

// Get all payments (admin)
router.get('/', authenticate, async (req, res) => {
  const { status, method, search } = req.query;
  const clauses = [];
  const params = [];

  if (status) {
    clauses.push('p.status = ?');
    params.push(status);
  }
  if (method) {
    if (method === 'midtrans') {
      clauses.push("p.payment_method IN ('midtrans', 'midtrans_snap')");
    } else {
      clauses.push('p.payment_method = ?');
      params.push(method);
    }
  }
  if (search) {
    clauses.push('(p.transaction_id LIKE ? OR i.invoice_number LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const payments = await db.all(
    `SELECT p.*, i.invoice_number FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id ${where} ORDER BY p.created_at DESC`,
    params
  );
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

// Verify payment (admin) – update payment + invoice status
router.put('/:id/verify', authenticate, async (req, res) => {
  const payment = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  await db.run('UPDATE payments SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?', ['success', req.params.id]);
  if (payment.invoice_id) {
    await db.run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', payment.invoice_id]);
  }
  const updated = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
  res.json(updated);
});

// Manual payment recording (admin) – no midtrans integration needed
router.post('/manual', authenticate, async (req, res) => {
  const { invoice_id, amount, payment_method, bank_name, account_name, account_number, notes } = req.body;
  // Look up the invoice to get client_id
  const invoice = await db.get('SELECT client_id, total_amount FROM invoices WHERE id = ?', [invoice_id]);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  const id = await db.insert(
    `INSERT INTO payments (invoice_id, client_id, amount, payment_method, payment_channel, status, payment_details, notes) VALUES (?,?,?,?,?,?,?,?)`,
    [
      invoice_id,
      invoice.client_id,
      amount || invoice.total_amount,
      payment_method || 'manual_transfer',
      bank_name ? `${bank_name}${account_number ? ' - ' + account_number : ''}` : null,
      'success',
      JSON.stringify({ bank_name, account_name, account_number }) || null,
      notes || null
    ]
  );
  const newPay = await db.get('SELECT * FROM payments WHERE id = ?', [id]);
  await db.run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', invoice_id]);
  res.status(201).json(newPay);
});

// Midtrans charge - real Snap API integration
router.post('/midtrans-charge', authenticate, async (req, res) => {
  try {
    const { invoice_id } = req.body;
    
    // 1. Fetch invoice
    const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    // 2. Fetch client
    const client = await db.get('SELECT * FROM clients WHERE id = ?', [invoice.client_id]);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    
    // 3. Fetch payment settings
    const settings = await db.get("SELECT * FROM payment_settings WHERE gateway = 'midtrans' LIMIT 1");
    if (!settings || !settings.server_key) {
      return res.status(400).json({ message: 'Midtrans not configured. Please setup payment settings first.' });
    }
    
    // 4. Initialize Snap client
    const snap = new midtransClient.Snap({
      isProduction: !settings.is_sandbox,
      serverKey: settings.server_key,
      clientKey: settings.client_key
    });
    
    // 5. Parse enabled channels
    const enabledChannels = settings.payment_channels 
      ? (typeof settings.payment_channels === 'string' ? JSON.parse(settings.payment_channels) : settings.payment_channels)
      : ['gopay', 'bank_transfer', 'credit_card'];
    
    // 6. Build transaction parameter
    const orderId = `${settings.invoice_prefix || 'INV'}-${invoice.id}-${Date.now()}`;
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(invoice.total_amount)
      },
      customer_details: {
        first_name: client.name,
        email: client.email || `client${client.id}@maznet.local`,
        phone: client.phone || '08123456789'
      },
      enabled_payments: enabledChannels,
      callbacks: {
        finish: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-result?order_id=${orderId}&status=success`,
        error: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-result?order_id=${orderId}&status=error`,
        unfinish: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-result?order_id=${orderId}&status=pending`,
      }
    };
    
    // 7. Create Snap transaction
    const transaction = await snap.createTransaction(parameter);
    
    // 8. Create payment record (pending)
    const paymentId = await db.insert(
      `INSERT INTO payments (invoice_id, client_id, amount, payment_method, transaction_id, status, payment_details) VALUES (?,?,?,?,?,?,?)`,
      [
        invoice.id,
        client.id,
        invoice.total_amount,
        'midtrans_snap',
        orderId,
        'pending',
        JSON.stringify({ snap_token: transaction.token })
      ]
    );
    
    res.json({
      payment_id: paymentId,
      snap_token: transaction.token,
      redirect_url: transaction.redirect_url
    });
    
  } catch (error) {
    console.error('Midtrans charge error:', error);
    const httpStatus = error.httpStatusCode || error.statusCode || (
      /HTTP status code: (\d+)/.exec(error.message)?.[1]
    );

    let message = 'Gagal membuat pembayaran.';
    if (String(httpStatus) === '401') {
      message = 'Midtrans authentication gagal — server key tidak valid. Cek Payment Settings.';
    } else if (String(httpStatus) === '404') {
      message = 'Midtrans merchant tidak ditemukan. Cek Merchant ID & server key di Payment Settings.';
    }

    res.status(500).json({ message, error: error.message });
  }
});

// Midtrans webhook notification handler
router.post('/webhook', async (req, res) => {
  try {
    const notification = req.body;
    
    // 1. Fetch payment settings for verification
    const settings = await db.get("SELECT * FROM payment_settings WHERE gateway = 'midtrans' LIMIT 1");
    if (!settings) return res.status(400).json({ message: 'Payment settings not found' });
    
    // 2. Initialize Core API client for verification
    const core = new midtransClient.CoreApi({
      isProduction: !settings.is_sandbox,
      serverKey: settings.server_key,
      clientKey: settings.client_key
    });
    
    // 3. Verify notification signature
    const statusResponse = await core.transaction.notification(notification);
    
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;
    
    console.log(`Webhook received: ${orderId} - ${transactionStatus} - ${fraudStatus}`);
    
    // 4. Map Midtrans status to internal status
    let paymentStatus = 'pending';
    
    if (transactionStatus === 'capture') {
      paymentStatus = (fraudStatus === 'accept') ? 'success' : 'pending';
    } else if (transactionStatus === 'settlement') {
      paymentStatus = 'success';
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      paymentStatus = 'failed';
    } else if (transactionStatus === 'pending') {
      paymentStatus = 'pending';
    }
    
    // 5. Update payment record
    const payment = await db.get('SELECT * FROM payments WHERE transaction_id = ?', [orderId]);
    
    if (payment) {
      await db.run(
        'UPDATE payments SET status = ?, paid_at = ?, payment_details = ? WHERE id = ?',
        [
          paymentStatus,
          paymentStatus === 'success' ? new Date().toISOString() : null,
          JSON.stringify(statusResponse),
          payment.id
        ]
      );
      
      // 6. Update invoice status if payment success
      if (paymentStatus === 'success') {
        await db.run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', payment.invoice_id]);
      }
    }
    
    res.status(200).json({ message: 'Webhook processed' });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed', error: error.message });
  }
});

// ── PUBLIC: Get invoice by payment token (no auth) ─────
router.get('/public/:token', async (req, res) => {
  try {
    const invoice = await db.get(
      `SELECT i.id, i.invoice_number, i.total_amount, i.status, i.issue_date, i.due_date,
              i.payment_token, i.payment_token_expires, c.company_name AS client_name, c.phone AS client_phone
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       WHERE i.payment_token = ? AND (i.payment_token_expires IS NULL OR i.payment_token_expires > NOW())`,
      [req.params.token]
    );
    if (!invoice) {
      return res.status(404).json({ message: 'Link tidak valid atau sudah kadaluarsa.' });
    }
    if (invoice.status === 'paid') {
      return res.json({ ...invoice, already_paid: true });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Public invoice fetch error:', error);
    res.status(500).json({ message: 'Gagal memuat invoice.' });
  }
});

// ── PUBLIC: Create Midtrans Snap transaction (no auth) ──
router.post('/public-charge/:token', async (req, res) => {
  try {
    // 1. Lookup invoice by token
    const invoice = await db.get(
      `SELECT i.*, c.company_name AS client_name, c.email AS client_email, c.phone AS client_phone
       FROM invoices i
       LEFT JOIN clients c ON i.client_id = c.id
       WHERE i.payment_token = ? AND (i.payment_token_expires IS NULL OR i.payment_token_expires > NOW())`,
      [req.params.token]
    );
    if (!invoice) return res.status(404).json({ message: 'Link tidak valid atau sudah kadaluarsa.' });
    if (invoice.status === 'paid') return res.status(400).json({ message: 'Invoice sudah dibayar.' });

    // 2. Fetch payment settings
    const settings = await db.get("SELECT * FROM payment_settings WHERE gateway = 'midtrans' LIMIT 1");
    if (!settings || !settings.server_key) {
      return res.status(400).json({ message: 'Pembayaran Midtrans belum dikonfigurasi.' });
    }

    // 3. Initialize Snap client
    const snap = new midtransClient.Snap({
      isProduction: !settings.is_sandbox,
      serverKey: settings.server_key,
      clientKey: settings.client_key
    });

    // 4. Parse enabled channels
    const enabledChannels = settings.payment_channels 
      ? (typeof settings.payment_channels === 'string' ? JSON.parse(settings.payment_channels) : settings.payment_channels)
      : ['gopay', 'bank_transfer', 'credit_card'];

    // 5. Build transaction parameter
    const orderId = `${settings.invoice_prefix || 'INV'}-${invoice.id}-${Date.now()}`;
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(invoice.total_amount)
      },
      customer_details: {
        first_name: invoice.client_name || `Client #${invoice.client_id}`,
        email: invoice.client_email || `client${invoice.client_id}@maznet.local`,
        phone: invoice.client_phone || '08123456789'
      },
      callbacks: {
        finish: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-result?order_id=${orderId}&status=success`,
        error: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-result?order_id=${orderId}&status=error`,
        unfinish: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-result?order_id=${orderId}&status=pending`,
      }
    };

    // 6. Create Snap transaction
    const transaction = await snap.createTransaction(parameter);

    // 7. Create payment record (pending)
    await db.insert(
      `INSERT INTO payments (invoice_id, client_id, amount, payment_method, transaction_id, status, payment_details) VALUES (?,?,?,?,?,?,?)`,
      [
        invoice.id, invoice.client_id, invoice.total_amount,
        'midtrans_snap', orderId, 'pending',
        JSON.stringify({ snap_token: transaction.token })
      ]
    );

    res.json({
      snap_token: transaction.token,
      redirect_url: transaction.redirect_url
    });

  } catch (error) {
    console.error('Public Midtrans charge error:', error);
    const httpStatus = error.httpStatusCode || error.statusCode || (
      /HTTP status code: (\d+)/.exec(error.message)?.[1]
    );
    let message = 'Pembayaran belum bisa diproses.';
    if (String(httpStatus) === '401') message = 'Konfigurasi pembayaran Midtrans belum valid — server key tidak dikenali. Hubungi admin MAZNET.';
    else if (String(httpStatus) === '404') message = 'Konfigurasi Midtrans tidak ditemukan. Hubungi admin MAZNET.';
    else if (error.ApiResponse) message = 'Pembayaran gagal diproses oleh Midtrans. Silakan coba lagi nanti.';
    res.status(httpStatus === '401' || httpStatus === '404' ? 400 : 500).json({ message });
  }
});

// PUBLIC: Check Midtrans transaction status directly (fallback when webhook unreachable on localhost)
router.post('/public/check-status/:token', async (req, res) => {
  try {
    // 1. Find invoice by token
    const invoice = await db.get(
      `SELECT i.*, p.id AS payment_id, p.transaction_id, p.payment_method
       FROM invoices i
       LEFT JOIN payments p ON p.invoice_id = i.id AND p.payment_method IN ('midtrans', 'midtrans_snap') AND p.transaction_id IS NOT NULL
       WHERE i.payment_token = ? AND (i.payment_token_expires IS NULL OR i.payment_token_expires > NOW())
       ORDER BY p.created_at DESC LIMIT 1`,
      [req.params.token]
    );
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'paid') {
      console.log(`check-status token=${req.params.token.substring(0,8)}: already paid in DB`);
      return res.json({ status: 'paid', already_paid: true });
    }
    if (!invoice.transaction_id) {
      console.log(`check-status token=${req.params.token.substring(0,8)}: no transaction_id found`);
      return res.json({ status: invoice.status });
    }

    // 2. Fetch payment settings
    const settings = await db.get("SELECT * FROM payment_settings WHERE gateway = 'midtrans' LIMIT 1");
    if (!settings || !settings.server_key) {
      return res.json({ status: invoice.status, message: 'Midtrans not configured' });
    }

    // 3. Query Midtrans Core API for transaction status
    const core = new midtransClient.CoreApi({
      isProduction: !settings.is_sandbox,
      serverKey: settings.server_key,
      clientKey: settings.client_key
    });

    const statusResponse = await core.transaction.status(invoice.transaction_id);
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    console.log(`check-status token=${req.params.token.substring(0,8)} order=${invoice.transaction_id} → Midtrans: ${transactionStatus}/${fraudStatus || '-'}`);

    // 4. Map to internal status
    let paymentStatus = 'pending';
    if (transactionStatus === 'capture') {
      paymentStatus = (fraudStatus === 'accept') ? 'success' : 'pending';
    } else if (transactionStatus === 'settlement') {
      paymentStatus = 'success';
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      paymentStatus = 'failed';
    }

    // 5. Update payment + invoice if status changed
    if (paymentStatus === 'success') {
      console.log(`check-status token=${req.params.token.substring(0,8)}: payment #${invoice.payment_id} → SUCCESS, invoice #${invoice.id} → paid`);
      await db.run(
        'UPDATE payments SET status = ?, paid_at = NOW(), payment_details = ? WHERE id = ?',
        [paymentStatus, JSON.stringify(statusResponse), invoice.payment_id]
      );
      await db.run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', invoice.id]);
      return res.json({ status: 'paid', already_paid: true });
    }

    if (paymentStatus === 'failed') {
      console.log(`check-status token=${req.params.token.substring(0,8)}: payment #${invoice.payment_id} → FAILED`);
      await db.run(
        'UPDATE payments SET status = ?, payment_details = ? WHERE id = ?',
        [paymentStatus, JSON.stringify(statusResponse), invoice.payment_id]
      );
    }

    console.log(`check-status token=${req.params.token.substring(0,8)}: still ${paymentStatus}`);
    res.json({ status: paymentStatus });
  } catch (error) {
    console.error('Check Midtrans status error:', error);
    res.status(500).json({ message: 'Failed to check payment status' });
  }
});

// PUBLIC: Check Midtrans status by order_id (for PaymentResult callback page)
router.post('/public/check-by-order', async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ message: 'order_id required' });

    const payment = await db.get(
      `SELECT p.*, i.payment_token, i.status AS invoice_status
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       WHERE p.transaction_id = ? AND p.payment_method IN ('midtrans', 'midtrans_snap')
       ORDER BY p.created_at DESC LIMIT 1`,
      [order_id]
    );
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.invoice_status === 'paid') return res.json({ status: 'paid', already_paid: true });

    const settings = await db.get("SELECT * FROM payment_settings WHERE gateway = 'midtrans' LIMIT 1");
    if (!settings || !settings.server_key) {
      return res.json({ status: payment.invoice_status, message: 'Midtrans not configured' });
    }

    const core = new midtransClient.CoreApi({
      isProduction: !settings.is_sandbox,
      serverKey: settings.server_key,
      clientKey: settings.client_key
    });

    const statusResponse = await core.transaction.status(order_id);
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    let paymentStatus = 'pending';
    if (transactionStatus === 'capture') {
      paymentStatus = (fraudStatus === 'accept') ? 'success' : 'pending';
    } else if (transactionStatus === 'settlement') {
      paymentStatus = 'success';
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      paymentStatus = 'failed';
    }

    if (paymentStatus === 'success') {
      console.log(`check-by-order: ${order_id} → SUCCESS — updating payment #${payment.id} + invoice #${payment.invoice_id}`);
      await db.run(
        'UPDATE payments SET status = ?, paid_at = NOW(), payment_details = ? WHERE id = ?',
        [paymentStatus, JSON.stringify(statusResponse), payment.id]
      );
      await db.run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', payment.invoice_id]);
      return res.json({ status: 'paid', already_paid: true });
    }

    if (paymentStatus === 'failed') {
      console.log(`check-by-order: ${order_id} → FAILED`);
      await db.run(
        'UPDATE payments SET status = ?, payment_details = ? WHERE id = ?',
        [paymentStatus, JSON.stringify(statusResponse), payment.id]
      );
    }

    console.log(`check-by-order: ${order_id} → ${paymentStatus}`);
    res.json({ status: paymentStatus });
  } catch (error) {
    console.error('Check Midtrans by order error:', error);
    res.status(500).json({ message: 'Failed to check payment status' });
  }
});

// Admin: Check Midtrans status for a single payment + update DB
router.post('/:id/check-midtrans', authenticate, async (req, res) => {
  try {
    const payment = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (!payment.transaction_id) return res.status(400).json({ message: 'No transaction_id' });

    if (payment.status !== 'pending') {
      return res.json(payment);
    }

    const settings = await db.get("SELECT * FROM payment_settings WHERE gateway = 'midtrans' LIMIT 1");
    if (!settings || !settings.server_key) {
      return res.json(payment);
    }

    const core = new midtransClient.CoreApi({
      isProduction: !settings.is_sandbox,
      serverKey: settings.server_key,
      clientKey: settings.client_key
    });

    const statusResponse = await core.transaction.status(payment.transaction_id);
    const txnStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    let newStatus;
    if (txnStatus === 'capture') {
      newStatus = (fraudStatus === 'accept') ? 'success' : null;
    } else if (txnStatus === 'settlement') {
      newStatus = 'success';
    } else if (['cancel', 'deny', 'expire'].includes(txnStatus)) {
      newStatus = 'failed';
    }

    console.log(`check-midtrans ${req.params.id}: ${payment.transaction_id} → ${txnStatus}/${fraudStatus || '-'} → ${newStatus}`);

    const updates = { payment_details: JSON.stringify(statusResponse) };
    if (newStatus === 'success') {
      updates.status = newStatus;
      await db.run(
        'UPDATE payments SET status = ?, paid_at = NOW(), payment_details = ? WHERE id = ?',
        [newStatus, updates.payment_details, payment.id]
      );
      await db.run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', payment.invoice_id]);
      updates.invoice_updated = true;
    } else if (newStatus === 'failed') {
      updates.status = newStatus;
      await db.run(
        'UPDATE payments SET status = ?, payment_details = ? WHERE id = ?',
        [newStatus, updates.payment_details, payment.id]
      );
    } else {
      updates.status = payment.status;
    }

    const updated = await db.get('SELECT * FROM payments WHERE id = ?', [payment.id]);
    res.json(updated);
  } catch (error) {
    console.error('Check Midtrans payment error:', error.message);
    res.status(500).json({ message: 'Gagal mengecek status Midtrans', error: error.message });
  }
});

// Delete all payments
router.delete('/', authenticate, async (_req, res) => {
  const count = await db.get('SELECT COUNT(*) as cnt FROM payments');
  await db.run('DELETE FROM payments');
  res.json({ message: `${count.cnt} payment(s) deleted` });
});

// Delete payment by id
router.delete('/:id', authenticate, async (req, res) => {
  const existing = await db.get('SELECT id FROM payments WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ message: 'Payment not found' });
  await db.run('DELETE FROM payments WHERE id = ?', [req.params.id]);
  res.json({ message: 'Payment deleted' });
});

export default router;
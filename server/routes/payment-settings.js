import { Router } from 'express';
import midtransClient from 'midtrans-client';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all payment settings (admin)
router.get('/', authenticate, async (_req, res) => {
  const settings = await db.get('SELECT * FROM payment_settings LIMIT 1');
  res.json(settings || {});
});

// Update payment settings (admin)
router.put('/', authenticate, async (req, res) => {
  const {
    gateway = 'midtrans',
    is_active = true,
    merchant_id,
    client_key,
    server_key,
    is_sandbox = true,
    environment,
    payment_channels = [],
    invoice_prefix = 'INV',
    payment_due_days = 14,
    bank_accounts = [],
    sandbox_url,
    production_url
  } = req.body;

  const env = environment || (is_sandbox ? 'sandbox' : 'production');
  await db.run('DELETE FROM payment_settings');
  const id = await db.insert(
    `INSERT INTO payment_settings (gateway, is_active, merchant_id, client_key, server_key, payment_channels, invoice_prefix, payment_due_days, bank_accounts, environment, is_sandbox, sandbox_url, production_url)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      gateway,
      is_active ? 1 : 0,
      merchant_id || null,
      client_key || null,
      server_key || null,
      JSON.stringify(payment_channels || []),
      invoice_prefix || 'INV',
      Number(payment_due_days || 14),
      JSON.stringify(bank_accounts || []),
      env,
      env === 'sandbox' ? 1 : 0,
      sandbox_url || null,
      production_url || null
    ]
  );
  const newSettings = await db.get('SELECT * FROM payment_settings WHERE id = ?', [id]);
  res.json(newSettings);
});

// Test Midtrans connection (admin)
router.post('/test', authenticate, async (req, res) => {
  const { server_key, is_sandbox = true } = req.body;
  if (!server_key) {
    return res.status(400).json({ message: 'Server key wajib diisi.' });
  }

  try {
    const core = new midtransClient.CoreApi({
      isProduction: !is_sandbox,
      serverKey: server_key,
      clientKey: 'dummy-client-key'
    });

    // Midtrans has no ping endpoint. A dummy transaction.status must return 404 with valid auth.
    await core.transaction.status(`MAZNET_TEST_${Date.now()}`);
    return res.json({ success: true, message: 'Koneksi Midtrans berhasil.' });
  } catch (err) {
    const rawMessage = err?.message || '';
    // midtrans-client v1.4.3 quirk: httpStatusCode/statusCode sometimes undefined
    // status code only in error.message text: "HTTP status code: 401"
    const match = /HTTP\s+status\s+code:\s*(\d+)/i.exec(rawMessage);
    const rawCode = err?.httpStatusCode || err?.statusCode || (match ? Number(match[1]) : null);
    const code = rawCode !== null ? Number(rawCode) : null;

    if (code === 404) {
      // Dummy order not found → auth is valid
      return res.json({ success: true, message: 'Koneksi Midtrans berhasil. Server key valid.' });
    }
    if (code === 401) {
      return res.json({ success: false, error_code: 'AUTH_FAILED', message: 'Server key tidak valid atau environment tidak cocok. Pastikan mode sandbox/production sesuai dengan key.' });
    }
    if (code === 403) {
      return res.json({ success: false, error_code: 'FORBIDDEN', message: 'Server key valid, tapi akses ditolak. Cek izin merchant di dashboard Midtrans.' });
    }

    console.error('Midtrans test error:', code, rawMessage);
    return res.json({ success: false, error_code: 'UNKNOWN', message: `Gagal test koneksi (code: ${code || 'unknown'}). ${rawMessage.slice(0, 200)}` });
  }
});

export default router;

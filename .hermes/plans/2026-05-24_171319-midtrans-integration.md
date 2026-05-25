# Plan: Midtrans Payment Gateway Integration & Sandbox Account Setup

**Tanggal:** 2026-05-24  
**Proyek:** MAZNET ISP Management System  
**Tujuan:** Setup akun Midtrans sandbox + integrasi Snap API ke backend Express.js

---

## 1. Ringkasan

Proyek MAZNET sudah memiliki:
- ✅ UI Payment Settings (`PaymentSettings.jsx`) — form untuk Merchant ID, Client Key, Server Key, sandbox/production toggle
- ✅ Backend API `/api/payment-settings` — CRUD settings ke tabel `payment_settings`
- ✅ Placeholder endpoint `/api/payments/midtrans-charge` — return dummy URL
- ❌ **Belum ada:** Akun Midtrans sandbox, integrasi Snap API real, webhook handler

**Target:**
1. Buat akun Midtrans sandbox (gratis, tanpa dokumen)
2. Dapatkan Server Key & Client Key sandbox
3. Install `midtrans-client` npm package
4. Implementasi Snap API di backend (create transaction token)
5. Implementasi webhook handler untuk notifikasi pembayaran
6. Update frontend untuk redirect ke Snap checkout page
7. Testing end-to-end dengan metode pembayaran sandbox

---

## 2. Research: Cara Membuat Akun Midtrans Sandbox

### 2.1 Registrasi Akun

**URL:** https://account.midtrans.com/register

**Langkah:**
1. Klik "Daftar Sekarang" di https://midtrans.com
2. Isi form registrasi:
   - Email bisnis
   - Password
   - Nama bisnis
   - Nomor telepon
3. Verifikasi email (klik link di inbox)
4. Login ke dashboard: https://dashboard.midtrans.com
5. **Mode Sandbox otomatis aktif** — tidak perlu aktivasi dokumen untuk testing

### 2.2 Mendapatkan API Keys (Sandbox)

**Lokasi:** Dashboard → Settings → Access Keys

**Keys yang dibutuhkan:**
- **Server Key** — untuk backend API calls (rahasia, jangan expose ke frontend)
- **Client Key** — untuk frontend Snap.js (public, aman di browser)
- **Merchant ID** — identifier akun

**Format:**
- Sandbox Server Key: `SB-Mid-server-xxxxxxxxxx`
- Sandbox Client Key: `SB-Mid-client-xxxxxxxxxx`

### 2.3 Dokumentasi Snap API

**Docs:** https://docs.midtrans.com/docs/snap-snap-integration-guide

**Flow:**
1. Backend: POST ke `https://app.sandbox.midtrans.com/snap/v1/transactions` dengan Server Key
2. Response: `{ token: "xxx", redirect_url: "https://app.sandbox.midtrans.com/snap/v2/vtweb/xxx" }`
3. Frontend: Redirect user ke `redirect_url` atau embed Snap.js popup
4. User bayar di Snap checkout page
5. Midtrans kirim webhook ke backend (POST `/api/payments/webhook`)
6. Backend update status payment di DB

---

## 3. Implementasi Plan

### 3.1 Setup Akun Midtrans (Manual — User Action)

**Action:** User harus register sendiri di https://account.midtrans.com/register

**Checklist:**
- [ ] Register akun dengan email valid
- [ ] Verifikasi email
- [ ] Login ke dashboard sandbox
- [ ] Copy Server Key dari Settings → Access Keys
- [ ] Copy Client Key dari Settings → Access Keys
- [ ] Paste keys ke UI Payment Settings di MAZNET admin dashboard

**Estimasi:** 5-10 menit

---

### 3.2 Install Midtrans SDK

**File:** `/mnt/c/Users/ben/Documents/Project/Project-Company-ISP/server/package.json`

**Command:**
```bash
cd /mnt/c/Users/ben/Documents/Project/Project-Company-ISP/server
npm install midtrans-client
```

**Dependency:**
```json
"midtrans-client": "^1.3.1"
```

---

### 3.3 Backend: Implementasi Snap API

**File:** `/mnt/c/Users/ben/Documents/Project/Project-Company-ISP/server/routes/payments.js`

**Changes:**

#### 3.3.1 Import Midtrans SDK
```javascript
import midtransClient from 'midtrans-client';
```

#### 3.3.2 Replace `/midtrans-charge` endpoint (line 79-85)

**Old (placeholder):**
```javascript
router.post('/midtrans-charge', authenticate, async (req, res) => {
  const { invoice_id, payment_method } = req.body;
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  res.json({ redirect_url: `https://simulate.midtrans.com/checkout?invoice=${invoice_id}`, invoice });
});
```

**New (real integration):**
```javascript
router.post('/midtrans-charge', authenticate, async (req, res) => {
  try {
    const { invoice_id, payment_channels } = req.body;
    
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
    const parameter = {
      transaction_details: {
        order_id: `${settings.invoice_prefix || 'INV'}-${invoice.id}-${Date.now()}`,
        gross_amount: Math.round(invoice.total_amount)
      },
      customer_details: {
        first_name: client.name,
        email: client.email || `client${client.id}@maznet.local`,
        phone: client.phone || '08123456789'
      },
      enabled_payments: enabledChannels,
      callbacks: {
        finish: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/billing?payment=success&invoice=${invoice.id}`
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
        parameter.transaction_details.order_id,
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
    res.status(500).json({ 
      message: 'Failed to create payment', 
      error: error.message 
    });
  }
});
```

---

### 3.4 Backend: Webhook Handler

**File:** `/mnt/c/Users/ben/Documents/Project/Project-Company-ISP/server/routes/payments.js`

**New endpoint:**
```javascript
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
```

**Webhook URL yang harus didaftarkan di Midtrans Dashboard:**
```
https://yourdomain.com/api/payments/webhook
```

**Untuk development (localhost):**
- Gunakan **ngrok** atau **localtunnel** untuk expose localhost
- Atau skip webhook testing, manual verify via dashboard

---

### 3.5 Frontend: Redirect ke Snap Checkout

**File:** `/mnt/c/Users/ben/Documents/Project/Project-Company-ISP/src/pages/admin/Billing.jsx` (atau komponen invoice detail)

**Scenario:** User klik "Pay with Midtrans" button di invoice detail

**Implementation:**
```javascript
const handleMidtransPayment = async (invoiceId) => {
  try {
    setLoading(true);
    const { data } = await api.post('/payments/midtrans-charge', { 
      invoice_id: invoiceId 
    });
    
    // Redirect to Snap checkout page
    window.location.href = data.redirect_url;
    
  } catch (error) {
    console.error('Payment error:', error);
    showToast({ 
      type: 'error', 
      title: 'Payment Failed', 
      subtitle: error.response?.data?.message || 'Failed to initiate payment' 
    });
  } finally {
    setLoading(false);
  }
};
```

**Alternative (Snap.js popup):**
```html
<!-- Add Snap.js script in index.html -->
<script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key="YOUR_CLIENT_KEY"></script>
```

```javascript
const handleMidtransPayment = async (invoiceId) => {
  try {
    const { data } = await api.post('/payments/midtrans-charge', { invoice_id: invoiceId });
    
    // Open Snap popup
    window.snap.pay(data.snap_token, {
      onSuccess: (result) => {
        showToast({ type: 'success', title: 'Payment Success' });
        // Refresh invoice list
      },
      onPending: (result) => {
        showToast({ type: 'info', title: 'Payment Pending' });
      },
      onError: (result) => {
        showToast({ type: 'error', title: 'Payment Error' });
      },
      onClose: () => {
        console.log('Snap popup closed');
      }
    });
    
  } catch (error) {
    showToast({ type: 'error', title: 'Payment Failed', subtitle: error.message });
  }
};
```

---

### 3.6 Testing Payment (Sandbox)

**Test Cards (Sandbox):**

| Card Number         | CVV | Exp Date | 3DS | Result  |
|---------------------|-----|----------|-----|---------|
| 4811 1111 1111 1114 | 123 | 01/25    | No  | Success |
| 4911 1111 1111 1113 | 123 | 01/25    | No  | Denied  |
| 5211 1111 1111 1117 | 123 | 01/25    | Yes | Success |

**GoPay Sandbox:**
- Nomor HP: `08123456789`
- PIN: `123456`

**Bank Transfer Sandbox:**
- Otomatis success setelah generate VA number

**Docs:** https://docs.midtrans.com/docs/testing-payment-on-sandbox

---

## 4. Files Modified

| File | Action | Description |
|------|--------|-------------|
| `server/package.json` | Add dependency | `midtrans-client` |
| `server/routes/payments.js` | Replace endpoint | `/midtrans-charge` real implementation |
| `server/routes/payments.js` | Add endpoint | `/webhook` notification handler |
| `src/pages/admin/Billing.jsx` | Add handler | `handleMidtransPayment()` function |
| `public/index.html` | Add script | Snap.js CDN (optional, for popup mode) |

---

## 5. Environment Variables

**File:** `/mnt/c/Users/ben/Documents/Project/Project-Company-ISP/server/.env`

**Add (optional, for callback URL):**
```env
FRONTEND_URL=http://localhost:5173
```

---

## 6. Deployment Checklist

### 6.1 Production Setup

- [ ] Register production Midtrans account (butuh dokumen bisnis)
- [ ] Upload dokumen: KTP, NPWP, Akta (untuk badan usaha)
- [ ] Tunggu approval (7-10 hari kerja)
- [ ] Dapatkan Production Server Key & Client Key
- [ ] Update Payment Settings di admin dashboard (toggle Production mode)
- [ ] Setup webhook URL di Midtrans Dashboard → Settings → Configuration
- [ ] Test production payment dengan kartu real (minimal Rp 10.000)

### 6.2 Security

- [ ] **Jangan commit Server Key ke Git** — gunakan `.env` file
- [ ] Validate webhook signature (sudah implemented via `core.transaction.notification()`)
- [ ] Rate limit webhook endpoint (prevent spam)
- [ ] HTTPS required untuk production webhook URL

---

## 7. Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| Webhook tidak sampai (localhost) | Gunakan ngrok untuk dev, atau manual verify via dashboard |
| Double payment (user refresh) | Check `transaction_id` uniqueness sebelum create payment record |
| Fraud transaction | Midtrans sudah handle fraud detection, cek `fraud_status` di webhook |
| Production approval delay | Siapkan dokumen lengkap sebelum submit, follow up via email support |

---

## 8. Next Steps (Post-Implementation)

1. **Recurring Payment** — Midtrans Subscription API untuk tagihan bulanan otomatis
2. **Payment Link** — Generate payment link tanpa invoice (untuk top-up saldo)
3. **Refund API** — Implementasi refund via Midtrans API
4. **Multi-currency** — Support USD/SGD (butuh approval Midtrans)
5. **Analytics Dashboard** — Chart payment success rate, popular channels

---

## 9. References

- Midtrans Docs: https://docs.midtrans.com
- Snap Integration Guide: https://docs.midtrans.com/docs/snap-snap-integration-guide
- Node.js SDK: https://github.com/Midtrans/midtrans-nodejs-client
- Sandbox Testing: https://docs.midtrans.com/docs/testing-payment-on-sandbox
- Webhook Notification: https://docs.midtrans.com/docs/http-notification-webhooks

---

**Status:** ✅ Plan Ready  
**Estimasi Implementasi:** 2-3 jam (excluding account registration & approval)  
**Prioritas:** High — payment gateway adalah core feature untuk billing system

# Fix: Midtrans Popup Auto-Close + WhatsApp Bot Create Bug

**Date:** 2026-05-26  
**Status:** Planned  
**Branch:** billing-payment

---

## Goal

1. **Midtrans popup auto-close:** Setelah user scan QR di popup Midtrans, popup otomatis tutup → tab "Bayar Sekarang" detect popup closed → auto-refresh status → tampilkan "Pembayaran Berhasil"
2. **WhatsApp bot create:** Fix bug dimana klik create bot tidak menghasilkan apa-apa (tidak ada response, tidak ada error toast)

---

## Bug 1: Midtrans Popup Tidak Tutup Otomatis

### Root Cause Analysis

**Flow saat ini:**
1. User klik "Bayar Sekarang" di `/pay/:token` → `handlePay()` 
2. `POST /payments/public-charge/:token` → return `{ snap_token, redirect_url }`
3. `window.open(redirect_url, 'midtrans_pay', ...)` → popup terbuka
4. Polling `popup.closed` setiap 800ms → kalau closed, panggil `checkPaymentStatus()`

**Masalah:**
- Setelah user selesai bayar di Snap, Midtrans redirect popup ke `callbacks.finish` URL: `/payment-result?order_id=...&status=success`
- `PaymentResult.jsx` **tidak punya logic `window.close()`** → popup tetap terbuka menampilkan halaman result
- Parent tab terus polling `popup.closed` tapi popup tidak pernah closed
- User harus tutup popup manual baru status ter-refresh

**Masalah tambahan:**
- Meskipun popup ditutup, webhook Midtrans mungkin belum sampai ke backend saat `checkPaymentStatus()` dipanggil → invoice masih `pending`
- Perlu retry/polling mechanism di parent tab

### Fix Plan

#### Step 1: Auto-close popup di `PaymentResult.jsx`
**File:** `src/pages/PaymentResult.jsx`

```jsx
useEffect(() => {
  // If opened as popup (has opener), auto-close after brief delay
  if (window.opener && !window.opener.closed) {
    // Send postMessage to parent with payment status
    window.opener.postMessage({
      type: 'midtrans_payment_result',
      status: searchParams.get('status') || 'settlement',
      order_id: searchParams.get('order_id')
    }, window.location.origin);
    // Close popup after short delay (let postMessage deliver)
    setTimeout(() => window.close(), 500);
  }
}, []);
```

#### Step 2: Listen postMessage + add retry polling di `PayInvoice.jsx`
**File:** `src/pages/PayInvoice.jsx`

Tambahkan `useEffect` untuk listen `postMessage` dari popup:
```jsx
useEffect(() => {
  const handleMessage = (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'midtrans_payment_result') {
      // Popup reported success → poll backend for confirmation
      pollPaymentConfirmation();
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [token]);
```

Tambahkan `pollPaymentConfirmation()` — retry check status hingga 10x (interval 3s):
```jsx
const pollPaymentConfirmation = async () => {
  let attempts = 0;
  const maxAttempts = 10;
  const poll = setInterval(async () => {
    attempts++;
    try {
      const { data } = await API.get(`/payments/public/${token}`);
      if (data.already_paid || data.status === 'paid') {
        clearInterval(poll);
        setInvoice({ ...data, already_paid: true });
        setLoading(false);
        return;
      }
    } catch {}
    if (attempts >= maxAttempts) {
      clearInterval(poll);
      checkPaymentStatus(); // final check
    }
  }, 3000);
};
```

#### Step 3: Fallback — juga tutup popup via Midtrans callback URL
**File:** `server/routes/payments.js` (line ~303)

Ubah callbacks finish/error/unfinish agar redirect ke halaman yang auto-close:
```
callbacks: {
  finish: `${FRONTEND_URL}/payment-result?order_id=${orderId}&status=success&auto_close=1`,
  ...
}
```
Lalu di `PaymentResult.jsx`, check `auto_close` param sebagai fallback trigger.

---

## Bug 2: WhatsApp Bot Create Tidak Ada Hasil

### Root Cause Analysis

**Flow saat ini:**
1. FE `handleSubmit()` → `whatsappBotsAPI.create(payload)` → `POST /api/whatsapp-bots`
2. BE `whatsapp-bots.js` line 53-99:
   - Validasi input
   - Encrypt keys
   - Find gap ID
   - INSERT ke DB
   - **Auto-connect bot** (line 84-93) ← **INI MASALAHNYA**
   - `res.json({ id, message })` (line 95)

**Masalah:**
- `providerInstance.connect(freshBot)` di line 89 dipanggil **sebelum** `res.json()` di line 95
- Baileys `connect()` membuka WebSocket ke WhatsApp servers → bisa hang/block selama 10-30 detik
- Selama connect() belum resolve, HTTP response tidak pernah dikirim ke FE
- FE axios timeout (60s) → kalau connect() > 60s, FE timeout → catch error tapi user sudah bingung
- Atau connect() throw error yang tidak ter-catch → response tidak terkirim

**Konfirmasi dari DB:** Ada 2 bot di DB (id 1 & 2) → insert berhasil, tapi response tidak sampai ke FE karena auto-connect blocking.

### Fix Plan

#### Step 1: Move `res.json()` sebelum auto-connect
**File:** `server/routes/whatsapp-bots.js`

```js
// Send response FIRST
res.json({ id, message: 'Bot created successfully' });

// THEN auto-connect in background (fire-and-forget)
if (is_active) {
  setImmediate(async () => {
    try {
      const { getProvider } = await import('../services/whatsapp/provider-factory.js');
      const freshBot = await db.get('SELECT * FROM whatsapp_bots WHERE id=?', [id]);
      const providerInstance = getProvider(freshBot.provider);
      await providerInstance.connect(freshBot);
    } catch (err) {
      console.error('Auto-connect failed:', err);
    }
  });
}
```

#### Step 2: FE auto-refresh setelah create
**File:** `src/pages/admin/WhatsAppBots.jsx`

Setelah `create()` berhasil, tambahkan delay lalu `fetchBots()` + `checkStatus()`:
```js
await whatsappBotsAPI.create(payload);
showToast({ type: 'success', title: '✅ Bot Dibuat', subtitle: 'Bot WhatsApp baru berhasil ditambahkan.' });
// ...
fetchBots(); // already called, but add delayed re-check
setTimeout(() => {
  fetchBots();
}, 3000); // re-fetch after 3s to get updated status
```

---

## Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/PaymentResult.jsx` | Add `useEffect` + `window.opener.postMessage()` + `window.close()` |
| 2 | `src/pages/PayInvoice.jsx` | Add `message` event listener + `pollPaymentConfirmation()` retry |
| 3 | `server/routes/payments.js` | Add `auto_close=1` param ke callback URLs |
| 4 | `server/routes/whatsapp-bots.js` | Move `res.json()` before auto-connect, use `setImmediate` |
| 5 | `src/pages/admin/WhatsAppBots.jsx` | Add delayed re-fetch setelah create |

---

## Verification Steps

### Test Payment Flow
1. Buka `/pay/{valid-token}` di browser
2. Klik "Bayar Sekarang" → popup Midtrans terbuka
3. Selesaikan pembayaran (sandbox: GoPay simulate)
4. **Expected:** Popup redirect ke `/payment-result` → auto-close → parent tab detect → polling → tampilkan "Invoice Sudah Dibayar" ✓

### Test WhatsApp Bot Create
1. Login admin → buka `/admin/whatsapp-bots`
2. Klik "Tambah Bot" → isi form → submit
3. **Expected:** Toast success muncul < 2 detik, bot masuk list, status connecting/QR
4. Cek DB: `SELECT * FROM whatsapp_bots ORDER BY id DESC LIMIT 1` → row baru ada

### Test Edge Cases
- Popup blocked browser → fallback redirect → masih bisa bayar
- Webhook delay → retry polling sampai 10x → tetap detect payment
- Baileys connect timeout → tidak block HTTP response

---

## Risks & Tradeoffs

| Risk | Mitigation |
|------|------------|
| `window.close()` blocked oleh browser (non-popup) | Check `window.opener` — hanya close kalau dibuka sebagai popup |
| `setImmediate` tidak ada di semua environment | Node.js native — available. Fallback: `process.nextTick()` |
| PostMessage cross-origin | Validate `event.origin === window.location.origin` |
| Webhook Midtrans lambat (>30s) | 10 retries × 3s = 30s total polling, cukup untuk sandbox |

---

## Estimated Effort

- **Bug 1 (Payment popup):** ~30 min implementation
- **Bug 2 (WA bot create):** ~15 min implementation  
- **Testing:** ~30 min
- **Total:** ~1.5 hours

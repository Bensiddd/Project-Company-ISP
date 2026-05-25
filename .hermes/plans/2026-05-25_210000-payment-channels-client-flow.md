# Plan: Active Payment Channels & Client Payment Flow

## Goal
Jelaskan apa itu "Active Payment Channels" dan implementasikan fitur payment yang memungkinkan **klien (end customer)** membayar invoice dengan memilih opsi pembayaran.

---

## 1. Penjelasan: Apa itu "Active Payment Channels"?

**Active Payment Channels** adalah daftar **metode pembayaran** yang ditampilkan di halaman checkout Midtrans Snap ketika klien membayar invoice.

Midtrans menyediakan banyak channel pembayaran. Admin bisa memilih mana saja yang mau diaktifkan:

| Channel | Kode API | Contoh |
|---------|----------|--------|
| 🟢 **GoPay** | `gopay` | E-Wallet |
| 🏦 **Bank Transfer** | `bank_transfer` | BCA/BNI/Mandiri/BRI Virtual Account |
| 💳 **Credit Card** | `credit_card` | Visa/Mastercard |
| 🏪 **Convenience Store** | `cstore` | Indomaret/Alfamart |
| 🟠 **ShopeePay** | `shopeepay` | E-Wallet |
| 🔵 **Akulaku** | `akulaku` | PayLater |

**Cara kerja:**
1. Admin pilih channel di Payment Settings → **tersimpan di DB** sebagai JSON
2. Klien klik bayar → backend panggil Midtrans Snap API dengan `enabled_payments: [channel yang dipilih]`
3. Midtrans tampilkan halaman checkout **hanya dengan channel yang dipilih**
4. Klien pilih channel → bayar → Midtrans kirim webhook → status update

---

## 2. Current State Analysis

### ✅ Sudah Ada
| Layer | Status | Detail |
|-------|--------|--------|
| Payment Settings UI | ✅ | Checkbox channel + save ke DB |
| Backend save channels | ✅ | `PUT /payment-settings` simpan `payment_channels` JSON |
| Midtrans Snap charge | ✅ | `POST /payments/midtrans-charge` kirim `enabled_payments` ke Snap API |
| Webhook handler | ✅ | `POST /payments/webhook` update status dari Midtrans |
| Test Connection | ✅ | `POST /payment-settings/test` verifikasi key |

### ❌ Belum Ada / Kurang
| No | Kekurangan | Dampak |
|----|-----------|--------|
| 1 | **Tidak ada halaman pembayaran untuk klien** — hanya admin yang bisa trigger bayar | Klien gak bisa bayar sendiri |
| 2 | **Snap popup redirect ke admin billing** — `callbacks.finish` arah ke `/admin/billing` | After payment, user dikirim ke halaman admin (login required) |
| 3 | **Tidak ada public payment link** — invoice cuma bisa dilihat admin | Klien perlu link langsung ke Snap tanpa login |
| 4 | **Tidak ada status page** — sukses/gagal bayar tidak tampil | Klien bingung setelah bayar |
| 5 | **Invoice data tidak accessible publik** — endpoint invoice butuh auth | Klien tidak bisa lihat invoice mereka |

---

## 3. Proposed Approach

### Phase A: Public Invoice Payment Page (Client-Facing)

Buat halaman publik **`/pay/:invoice_id/:token`** di mana:
- `token` = one-time payment token (generate saat admin buat invoice)
- Halaman tampilkan: nominal, invoice number, client name
- Tombol "Bayar Sekarang" → buka Snap checkout
- Setelah bayar → redirect ke halaman sukses/gagal

### Phase B: Payment Success/Failure Page

Buat halaman publik:
- **`/payment/success?invoice_id=X`** — "Pembayaran berhasil!"
- **`/payment/failed?invoice_id=X`** — "Pembayaran gagal, coba lagi"
- **`/payment/pending?invoice_id=X`** — "Menunggu konfirmasi pembayaran"

### Phase C: Email/Payment Link Notification

Saat invoice dibuat:
- Generate payment token → simpan di DB (kolom `payment_token` di tabel `invoices`)
- Kirim link `https://maznet.id/pay/{id}/{token}` via WhatsApp/Telegram ke klien

---

## 4. Step-by-Step Plan

### Step 1: DB Migration — Tambah kolom `payment_token` ke `invoices`

**File:** `server/migrate.js`
```sql
ALTER TABLE invoices ADD COLUMN payment_token VARCHAR(64) AFTER status;
ALTER TABLE invoices ADD COLUMN payment_token_expires DATETIME AFTER payment_token;
```

### Step 2: Backend — Generate payment token saat create invoice

**File:** `server/routes/invoices.js`

Di `POST /` (create invoice):
```javascript
const crypto = require('crypto');
const token = crypto.randomBytes(32).toString('hex');
// Simpan token ke invoice
```

### Step 3: Backend — Public endpoint untuk lihat invoice + bayar

**File:** `server/routes/payments.js` (tambah route baru)

```javascript
// Public: get invoice by payment token (no auth)
router.get('/public/:token', async (req, res) => {
  const invoice = await db.get(
    'SELECT id, invoice_number, total_amount, status, client_id FROM invoices WHERE payment_token = ? AND payment_token_expires > NOW()',
    [req.params.token]
  );
  if (!invoice) return res.status(404).json({ message: 'Link tidak valid atau sudah kadaluarsa' });
  const client = await db.get('SELECT name FROM clients WHERE id = ?', [invoice.client_id]);
  res.json({ ...invoice, client_name: client?.name });
});

// Public: initiate payment (no auth)
router.post('/public-charge/:token', async (req, res) => {
  // Sama seperti midtrans-charge tapi pakai token instead of auth
});
```

### Step 4: Frontend — Halaman publik `/pay/:token`

**File:** `src/pages/PayInvoice.jsx` (baru)

```jsx
const PayInvoice = () => {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    api.get(`/payments/public/${token}`).then(res => setInvoice(res.data));
  }, [token]);

  const handlePay = async () => {
    const { data } = await api.post(`/payments/public-charge/${token}`);
    window.location.href = data.redirect_url; // Redirect ke Snap
  };

  if (!invoice) return <Loading />;
  return (
    <div>
      <h1>Pembayaran Invoice #{invoice.invoice_number}</h1>
      <p>Total: Rp{invoice.total_amount}</p>
      <p>Atas nama: {invoice.client_name}</p>
      <button onClick={handlePay}>Bayar Sekarang</button>
    </div>
  );
};
```

### Step 5: Frontend — Halaman sukses/gagal

**File:** `src/pages/PaymentResult.jsx` (baru)

Handle callback dari Midtrans Snap:
```javascript
// Baca query params: ?transaction_status=settlement&order_id=INV-123
```

### Step 6: Update routing

**File:** `src/App.jsx`
```jsx
<Route path="/pay/:token" element={<PayInvoice />} />
<Route path="/payment/:status" element={<PaymentResult />} />
```

### Step 7: Update callback URL di midtrans-charge

**File:** `server/routes/payments.js`
```javascript
callbacks: {
  finish: `${FRONTEND_URL}/payment/settlement?order_id=${orderId}`,
  error: `${FRONTEND_URL}/payment/error?order_id=${orderId}`,
  pending: `${FRONTEND_URL}/payment/pending?order_id=${orderId}`,
}
```

### Step 8: Notifikasi ke klien via WhatsApp/Telegram

Di webhook handler atau saat create invoice:
- Cari client phone number
- Kirim pesan: "Tagihan #{inv_number} sebesar Rp{total} sudah tersedia. Bayar di: https://maznet.id/pay/{token}"

---

## 5. Files Changed

| File | Change Type | Est. Lines |
|------|------------|-----------|
| `server/migrate.js` | Add columns | +5 |
| `server/routes/invoices.js` | Generate token on create | +15 |
| `server/routes/payments.js` | Public charge endpoint + callback URL update | +80 |
| `src/pages/PayInvoice.jsx` | **NEW** - Public payment page | +120 |
| `src/pages/PaymentResult.jsx` | **NEW** - Success/failure page | +60 |
| `src/App.jsx` | Add routes | +4 |
| `server/services/notification.js` *(new)* | Send payment link via WA/TG | +50 |

**Total:** ~330 baris baru

---

## 6. Payment Flow (End to End)

```
Admin buat invoice
  → payment_token auto-generate
  → Klien terima link via WhatsApp: "https://maznet.id/pay/abc123..."
  → Klien buka link
  → Halaman tampil: Invoice #INV-001, Rp350.000
  → Klien klik "Bayar Sekarang"
  → Backend panggil Midtrans Snap API → return redirect_url
  → Browser redirect ke halaman Midtrans Snap
  → Snap tampilkan channel pembayaran yang aktif (GoPay, VA, CC, dll)
  → Klien pilih channel → bayar
  → Midtrans kirim notification ke webhook backend
  → Webhook update status payment & invoice
  → Browser redirect ke halaman sukses/gagal
```

---

## 7. Risks & Open Questions

### Risks
| Risk | Mitigasi |
|------|----------|
| Token bisa ditebak | Gunakan `crypto.randomBytes(32).toString('hex')` — 64 char hex, impractical to brute force |
| Invoice expired | Set `payment_token_expires = created_at + 30 days` |
| Webhook gak sampai (localhost) | Saat production, webhook harus URL publik HTTPS |
| Orang lain bayarin invoice | Token unik per invoice — hanya pemilik token yang bisa akses |

### Open Questions
1. **Notifikasi**: Kirim link via WhatsApp otomatis atau manual? (Manual dulu via admin)
2. **Expired token**: Apa yang terjadi kalau token expired? Invoice perlu regenerate token
3. **Multiple payment**: Boleh bayar invoice yang sudah lunas? (Cegah di backend)
4. **Callback Snap**: URL callback harus disesuaikan dengan domain production nanti

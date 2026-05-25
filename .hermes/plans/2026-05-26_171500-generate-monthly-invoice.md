# Plan: Implement "Generate Monthly" — Batch Invoice Generator

**Date:** 2026-05-26  
**Branch:** `billing-payment`  
**Workspace:** `/home/bensid/project/Project-Company-ISP`

---

## Goal

Bikin tombol "Generate Monthly" di dashboard Invoices berfungsi — auto-generate invoice untuk semua langganan aktif yang jatuh tempo bulan ini.

---

## Current State

- **Frontend:** Tombol sudah ada di `Invoices.jsx` (line 127-132), panggil `invoicesAPI.generateMonthly()` → `POST /invoices/generate-monthly`
- **API client:** `generateMonthly: () => api.post('/invoices/generate-monthly')` di `api.js:222`
- **Backend:** `server/routes/invoices.js` **tidak punya route `/generate-monthly`** — tombol error 404
- **DB tables:**
  - `subscriptions`: `id, client_id, package_id, status, billing_cycle, next_billing_date, ...`
  - `clients`: `id, company_name, contact_person, is_active, ...`
  - `service_packages`: `id, name, price, ...`
  - `invoices`: `id, invoice_number, client_id, subscription_id, amount, status, billing_period_start, billing_period_end, issue_date, due_date, ...`

---

## What "Generate Monthly" Should Do

1. Ambil semua subscription dengan `status='active'` DAN `next_billing_date` ≤ akhir bulan ini (atau null/belum ada)
2. Untuk tiap subscription:
   - Generate `invoice_number` unik: `INV-{timestamp}-{client_id}`
   - Hitung `amount` dari `service_packages.price` milik subscription
   - Set `billing_period_start` = bulan ini (1st), `billing_period_end` = akhir bulan ini
   - Set `due_date` = `billing_period_start + payment_terms` hari (dari `clients.payment_terms`, default 15)
   - Insert ke `invoices` dengan `status='unpaid'`
   - Update `subscriptions.next_billing_date` ke bulan depan
3. Return jumlah invoice yang berhasil dibuat + list invoice baru

---

## Proposed Approach

### Backend: `server/routes/invoices.js`

Tambahkan route baru:

```
POST /invoices/generate-monthly
```

**Logic:**

```
1. Query subscriptions: 
   SELECT s.*, c.payment_terms, p.price, p.name as package_name
   FROM subscriptions s
   JOIN clients c ON s.client_id = c.id
   JOIN service_packages p ON s.package_id = p.id
   WHERE (s.next_billing_date IS NULL OR s.next_billing_date <= LAST_DAY(CURDATE()))
   AND s.status = 'active'
   AND c.is_active = 1

2. Loop tiap result:
   - invoice_number = `INV-{Date.now()}-{s.client_id}`
   - amount = p.price
   - billing_period_start = CURDATE() (first of current month)
   - billing_period_end = LAST_DAY(CURDATE())
   - due_date = billing_period_start + (c.payment_terms || 15) days
   - INSERT into invoices
   - UPDATE subscriptions SET next_billing_date = DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY), last_billing_date = NOW()

3. Return { generated: N, invoices: [...] }
```

### Edge Cases

- **Sudah ada invoice bulan ini:** Skip — jangan duplicate
- **Client tanpa package price:** Skip + warning
- **Subscription tanpa client aktif:** Skip
- **Idempotent:** Running 2x ga bikin duplicate

### Frontend: `Invoices.jsx`

- Update `handleGenerateMonthly` untuk tangkap response + tampilkan toast/success message
- Reload invoice list setelah berhasil

---

## Files to Change

| File | Change |
|------|--------|
| `server/routes/invoices.js` | Tambah `POST /generate-monthly` route |
| `src/pages/admin/Invoices.jsx` | Update `handleGenerateMonthly` — response handling + toast |
| `src/pages/admin/Billing.css` | Optional: toast notification styling |

---

## Test Plan

1. DB: pastikan ada 1+ subscription active
2. Klik "Generate Monthly" di `/admin/invoices`
3. Verify invoice baru muncul di tabel (status unpaid)
4. Verify `subscriptions.next_billing_date` ke-update
5. Klik lagi → harus idempotent (ga duplicate)
6. Verify invoice number format `INV-...`

---

## Risks

- **Race condition:** 2 user generate bareng → bisa duplicate. Mitigate: pakai transaction + unique constraint on `(subscription_id, billing_period_start)`
- **No backup:** Sebelum generate, log subscriptions state ke console
- **Large batch:** Kalau 1000+ subscriptions, bisa timeout. Mitigate: batasi batch size atau panggil async

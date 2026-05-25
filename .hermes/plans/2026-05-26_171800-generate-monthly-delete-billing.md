# Plan: Generate Monthly + Delete Billing Data (Invoices, Subscriptions, Payments)

**Date:** 2026-05-26  
**Branch:** `billing-payment`  
**Workspace:** `/home/bensid/project/Project-Company-ISP`

---

## Bagian A: Generate Monthly Invoice

### Current
Tombol udah ada di `Invoices.jsx:163`, panggil `invoicesAPI.generateMonthly()` → `POST /invoices/generate-monthly`.  
Backend **belum ada** route → 404 diam-diam.

### Backend — `server/routes/invoices.js`

**Route: `POST /invoices/generate-monthly`** (authenticate)

```
1. Query subscriptions:
   SELECT s.*, c.payment_terms, p.price, p.name as package_name
   FROM subscriptions s
   JOIN clients c ON s.client_id = c.id
   JOIN service_packages p ON s.package_id = p.id
   WHERE (s.next_billing_date IS NULL OR s.next_billing_date <= LAST_DAY(CURDATE()))
   AND s.status = 'active'
   AND c.is_active = 1

2. Loop → untuk tiap sub:
   - Cek duplikat: SELECT id FROM invoices WHERE subscription_id = ? AND billing_period_start = ? (skip if exists)
   - invoice_number: INV-{Date.now()}-{sub.client_id}
   - total_amount: p.price
   - billing_period_start: tanggal 1 bulan ini
   - billing_period_end: LAST_DAY bulan ini
   - issue_date: NOW()
   - due_date: billing_period_start + (c.payment_terms || 15) days
   - status: 'unpaid'
   - INSERT ke invoices
   - UPDATE subscriptions SET next_billing_date = DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)

3. Return { generated: N, invoices: [...], skipped: M (already exists) }
```

### Frontend — `Invoices.jsx:handleGenerateMonthly`

- Wrap di try/catch yang udah ada
- Tangkap response → tampilkan success toast (`N invoice dibuat, M diskip`)
- Reload invoice list

### Edge Cases

| Case | Handling |
|------|----------|
| Subscription sudah ada invoice bulan ini | Skip (idempotent) |
| Package tanpa price | Skip + log warning |
| Client non-aktif | Tak masuk query (WHERE is_active=1) |
| Tak ada subscription aktif | Return `{generated:0, message:"Tidak ada langganan perlu invoice"}` |

---

## Bagian B: Delete Single + Delete All

### Current
- Invoices: `cancel` → set status='cancelled', **tidak ada hard delete**
- Subscriptions: `suspend/activate/terminate` → set status, **tidak ada delete**
- Payments: verify, **tidak ada delete**
- Tidak ada API client method delete untuk ketiganya
- Tidak ada tombol delete di UI

### Pattern (ikuti Ticket yang sudah ada)

| Feature | Backend Route | API Client | UI |
|---------|--------------|------------|-----|
| Delete invoice | `DELETE /invoices/:id` | `invoicesAPI.delete(id)` | ✕ icon tiap row |
| Delete all invoices | `DELETE /invoices` | `invoicesAPI.deleteAll()` | "Delete All" btn di header |
| Delete subscription | `DELETE /subscriptions/:id` | `subscriptionsAPI.delete(id)` | ✕ icon tiap row |
| Delete all subscriptions | `DELETE /subscriptions` | `subscriptionsAPI.deleteAll()` | "Delete All" btn di header |
| Delete payment | `DELETE /payments/:id` | `paymentsAPI.delete(id)` | ✕ icon tiap row |
| Delete all payments | `DELETE /payments` | `paymentsAPI.deleteAll()` | "Delete All" btn di header |

### Backend Implementation

Semua route `authenticate`, hanya admin role.

**DELETE /invoices/:id**
```sql
DELETE FROM invoices WHERE id = ?
```
Return `{ message: 'Invoice deleted' }`

**DELETE /invoices** (delete all)
```sql
DELETE FROM invoices
```
Return `{ message: 'N invoices deleted' }`

Sama persis untuk `/subscriptions/:id`, `/subscriptions`, `/payments/:id`, `/payments`.

### Frontend Implementation

**Invoices.jsx, Subscriptions.jsx, Payments.jsx** → tambah:
- `handleDelete(id)` → confirm dialog → call `API.delete(id)` → remove dari state
- `handleDeleteAll()` → confirm dialog ("Yakin hapus SEMUA?") → call `API.deleteAll()` → reload
- Tombol ✕ di kolom Actions tiap row (hanya untuk status non-critical — draft/unpaid untuk invoices, terminated untuk subs, failed/expired untuk payments)
- Tombol "Delete All" di header (warna merah/warning, setelah tombol existing)

---

## Files Changed

| File | Perubahan |
|------|-----------|
| `server/routes/invoices.js` | `+POST /generate-monthly`, `+DELETE /:id`, `+DELETE /` |
| `server/routes/subscriptions.js` | `+DELETE /:id`, `+DELETE /` |
| `server/routes/payments.js` | `+DELETE /:id`, `+DELETE /` |
| `src/services/api.js` | `+delete`, `+deleteAll` di invoicesAPI, subscriptionsAPI, paymentsAPI |
| `src/pages/admin/Invoices.jsx` | handleGenerateMonthly toast, delete buttons, deleteAll button |
| `src/pages/admin/Subscriptions.jsx` | delete buttons, deleteAll button |
| `src/pages/admin/Payments.jsx` | delete buttons, deleteAll button |
| `src/pages/admin/Billing.css` | Toast + delete button styling (optional) |

---

## Test Plan

1. **Generate Monthly:** Klik tombol → invoice baru muncul → klik lagi → idempotent
2. **Delete single:** Klik ✕ → confirm → row hilang
3. **Delete all:** Klik Delete All → confirm → tabel kosong
4. Verify DB setelah setiap operasi

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Delete all tidak bisa di-undo | Confirm dialog ganda: "Yakin? Data yang dihapus tidak bisa dikembalikan." |
| Delete invoice dengan payment terkait | Cascade manual: hapus payments dulu baru invoice (atau sebaliknya di route delete all) |
| FK constraint | MariaDB pakai InnoDB? Kalau iya, pastikan ON DELETE CASCADE atau hapus child dulu |

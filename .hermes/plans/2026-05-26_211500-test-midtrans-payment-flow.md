# Test & Debug Midtrans Payment Flow

**Goal:** Simulate user payment via `/pay/:token` → Midtrans sandbox → verify invoice auto-paid & payment auto-success. Find bugs.

**Link:** `http://localhost:5173/pay/54a0ef40309f65788546af4b3aa80788bf98a91ba84d3a42`

---

## Current State

| Check | Status |
|-------|--------|
| MariaDB | ✅ running |
| Invoice #20 | ✅ unpaid, Rp1, total=1.00 |
| Payment settings (midtrans) | ✅ sandbox, server key `Mid-server-REDACTED` |
| Server running? | ❓ need check |
| Vite running? | ❓ need check |

## Flow Analyzed

```
PayInvoice (/pay/:token)
  ├─ GET /payments/public/:token          → get invoice info
  ├─ POST /payments/public/check-status/  → check if already paid
  ├─ Auto-poll every 10s                  → check-status
  └─ [Bayar Sekarang]
       └─ POST /payments/public-charge/:token  → Snap createTransaction
            └─ window.open(redirect_url)       → Midtrans Snap popup
                 └─ User pays in sandbox
                      └─ Midtrans redirects to /payment-result?order_id=...&status=...
                           └─ PaymentResult postMessage → PayInvoice
                                └─ PayInvoice → check-status → mark paid
```

## Bugs Identified (code review)

### 🔴 Bug 1: Callback URL garbage text (lines 332-334)
```js
// server/routes/payments.js:332-334 — public-charge callback URLs
finish: `.../payment-result?order_id=${orderId}&status=success&token=*** || ''}`,
```
`&token=*** || ''` is LITERAL TEXT output in the URL. Someone meant `${token || ''}` but wrote it outside template expression. Result: `token=***` + garbage `|| ''` in query string.

**Fix:**
```js
finish: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-result?order_id=${orderId}&status=success`,
```
Remove `&token=*** || ''` entirely — not needed by PaymentResult.jsx.

### 🟡 Bug 2: PaymentResult closes too fast (500ms)
```js
// src/pages/PaymentResult.jsx:68
setTimeout(() => window.close(), 500);
```
500ms might be too tight. postMessage is sync but popup closing might interrupt.

**Mitigation:** Increase to 1000ms or use window.opener handshake.

### 🟡 Bug 3: No `order_id` fallback when URL param missing
```js
const orderId = searchParams.get('order_id');
```
If Midtrans doesn't pass order_id in callback (possible with sandbox redirect quirks), `orderId` is null → postMessage sends null.

---

## Test Plan

### Step 1: Ensure servers running
```bash
# Check if Express (3001) and Vite (5173) are running
lsof -i :3001 -i :5173
```

### Step 2: Start servers if needed
```bash
# On Windows (via cmd.exe)
cmd.exe /c "cd C:\Users\ben\Documents\Project\Project-Company-ISP\server && npm run dev"
cmd.exe /c "cd C:\Users\ben\Documents\Project\Project-Company-ISP && npm run dev"
```

### Step 3: Open payment link in browser
Navigate to `http://localhost:5173/pay/54a0ef40309f65788546af4b3aa80788bf98a91ba84d3a42`

### Step 4: Verify initial page load
- Check invoice details display
- No "Sudah Dibayar" shown
- "Bayar Sekarang" button enabled
- Network tab: GET /public/:token returns 200

### Step 5: Click "Bayar Sekarang"
- POST /public-charge/:token → Snap transaction created
- Popup opens with Midtrans sandbox UI

### Step 6: Complete sandbox payment
- In popup: select payment method → complete
- Midtrans should redirect to /payment-result
- PaymentResult should postMessage + close popup within 500ms-1s

### Step 7: Verify post-payment state
- PayInvoice page shows "Invoice Sudah Dibayar" ✓
- Check browser console for errors
- Check server logs for check-status calls

### Step 8: Verify DB state
```sql
SELECT id, status FROM invoices WHERE id = 20;
SELECT id, status, transaction_id FROM payments WHERE invoice_id = 20 ORDER BY created_at DESC LIMIT 1;
```

### Step 9: Fix bugs found
1. Fix callback URL in `server/routes/payments.js:332-334`
2. Adjust PaymentResult close timeout if needed
3. Restart server after fixes

### Step 10: Re-test
Repeat steps 3-8 after fixes

---

## Expected Outcome

After successful payment:
- ✅ Invoice #20 status → `paid`
- ✅ New payment record → `success`
- ✅ PayInvoice page shows "Invoice Sudah Dibayar"
- ✅ Dashboard Payments shows success record

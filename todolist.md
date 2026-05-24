# 📋 MAZNET ISP — PRD & Rekomendasi Fitur Lanjutan

> **Berdasarkan**: Analisis proyek MAZNET (existing) + Riset referensi industri (Splynx, Sonar, Powercode, UISP, Mikrotik)
> **Tanggal**: 2026-05-24
> **Status**: ✅ DRAFT — review by owner

---

## Ringkasan

MAZNET sudah memiliki fondasi kuat: website landing, admin panel, WhatsApp/Telegram bot, Mikrotik monitor, ticket system, blog CMS, dan manajemen klien/paket. Namun masih ada **gap besar** dibanding ISP management system kelas industri. PRD ini memetakan fitur-fitur yang **paling kritis** untuk transformasi MAZNET dari "website ISP + bot" menjadi **ISP management platform lengkap**.

Prioritas diurutkan dari **dampak bisnis tertinggi**.

---

## 🔴 PRIORITAS 1: Billing & Finance Engine (MUST HAVE)

**Mengapa**: Ini jantung revenue ISP. Tanpa billing system, semua operasional manual atau via spreadsheet. Fitur paling krusial yang membedakan MAZNET dari sekedar "website perusahaan".

### 1.1 Invoice & Tagihan Otomatis
- Generate invoice otomatis per siklus (bulanan/tahunan)
- Invoice numerik + prefix kustom
- Status: `unpaid`, `paid`, `overdue`, `cancelled`, `refunded`
- Invoice PDF yang bisa di-download (branded dengan logo ISP)
- Due date & penalty late fee otomatis
- `server/routes/invoices.js` + `src/pages/admin/Invoices.jsx`

### 1.2 Integrasi Payment Gateway (Indonesia)
- **Midtrans** (prioritas — paling populer di Indonesia)
- **Xendit** (alternatif — VA, QRIS, convenience store)
- Pembayaran: Virtual Account, QRIS, E-Wallet (GoPay, OVO, Dana), Convenience Store (Indomaret, Alfamart)
- Status pembayaran sync via webhook
- `server/services/payment/midtrans.js`, `server/services/payment/xendit.js`

### 1.3 Manajemen Langganan Pelanggan
- Hubungan: Client → Service Package → Status (active/suspended/terminated)
- Activation date, billing cycle, next billing date
- Auto-suspend jika overdue N hari (configurable)
- Auto-activate setelah bayar
- Prorate untuk activation mid-cycle
- Modifikasi: `server/routes/clients.js`

### 1.4 Data Cap & FUP Management
- Quota bulanan per paket (misal: 100GB, 300GB, unlimited)
- Tracking pemakaian bandwidth per customer
- Notifikasi saat quota 80%/100%/overage
- Top-up paket tambahan data
- Throttle speed setelah FUP tercapai (via Mikrotik API)

### 1.5 Finance Dashboard & Laporan
- MRR (Monthly Recurring Revenue)
- ARPU (Average Revenue Per User)
- Revenue per periode (harian/mingguan/bulanan/tahunan)
- Top payers / Top debtors
- Overdue invoice aging report
- Revenue by service package comparison

---

## 🟠 PRIORITAS 2: Customer Self-Service Portal (HIGH VALUE)

**Mengapa**: Mengurangi beban CS 40-60%. Pelanggan bisa cek tagihan, bayar, cek usage, buka tiket sendiri tanpa telepon/chat admin.

### 2.1 Portal Pelanggan (Client Area)
- Login khusus pelanggan (bukan admin)
- Halaman utama: status akun, tagihan terbaru, info paket
- Riwayat pembayaran & invoice
- Download invoice PDF
- Status internet (active/suspended/terminated)
- `src/pages/client/` — Dashboard, Invoices, Tickets, Profile

### 2.2 Cek Pemakaian Internet
- Grafik bandwidth yang dipakai (harian/mingguan/bulanan)
- Sisa quota bulanan (jika ada FUP)
- Data dari Mikrotik traffic monitoring

### 2.3 Self-Service Tiket
- Buka tiket support dari portal (tanpa WA/Telegram)
- Lihat status tiket: open, in_progress, resolved, closed
- Riwayat tiket & balasan CS
- Add attachment ke tiket (screenshot masalah)

### 2.4 Manajemen Profil
- Update nomor telepon, alamat
- Ganti password
- Notification preferences (WA/Telegram/Email)

---

## 🟡 PRIORITAS 3: Enhanced Network Management

**Mengapa**: MAZNET sudah punya Mikrotik Monitor dasar. Perlu diperdalam untuk troubleshooting & proactive ops.

### 3.1 CPE / Modem / ONT Inventory
- Daftar perangkat CPE yang terinstall per pelanggan
- Serial number, MAC address, tipe/merk perangkat
- Status perangkat (active/inactive/rusak)
- Riwayat penggantian perangkat
- `src/pages/admin/CpeInventory.jsx`

### 3.2 Bandwidth Monitoring Per Customer
- Traffic graph per IP/interface Mikrotik
- Real-time vs historical (1h, 24h, 7d, 30d)
- Top N consumers per hari
- Integrasi: `server/routes/mikrotik.js` (perlu diperluas)

### 3.3 Outage Detection & Broadcast
- Ping monitor untuk CPE/ONT pelanggan
- Deteksi otomatis jika >5 client di satu area down → suspected outage
- Broadcast notifikasi otomatis via WA/Telegram ke pelanggan terdampak
- `server/services/outage-monitor.js`

### 3.4 RADIUS / PPPoE Management
- Manajemen user PPPoE (jika pakai PPPoE)
- Aktivasi/suspensi user PPPoE via Mikrotik API
- Log PPPoE session history

### 3.5 OLT/ONU Management (FTTH)
- Scanning ONU via OLT (jika pakai OLT vendor tertentu — Huawei, ZTE, FiberHome)
- Status ONU: online/offline/loss
- Rx/Tx optical power monitoring
- **Opsional** — tergantung vendor OLT yang dipakai

---

## 🟢 PRIORITAS 4: Operations & Inventory

### 4.1 Work Order / Tiket Teknisi
- Work order untuk instalasi, trouble ticket, maintenance
- Assign teknisi ke work order
- Status: pending, on_progress, completed, cancelled
- Timeline aktivitas teknisi
- `src/pages/admin/WorkOrders.jsx`

### 4.2 Inventory Gudang
- Stok: modem/ONT, kabel FO, pigtail, splitter, router, dll
- In/out log barang
- Minimum stock alert
- Asset tracking per pelanggan (CPE out → pelanggan X)

### 4.3 Jadwal Instalasi & Teknisi
- Kalender instalasi
- Slot waktu teknisi
- Assign otomatis berdasarkan lokasi terdekat
- Integrasi notifikasi WA ke teknisi

### 4.4 Marketing & Promo Engine
- Kupon diskon (persentase/nominal)
- Periode promo (start - end date)
- Referral program (pelanggan ajak teman dapat diskon)
- Promo banner di landing page (via website settings)

---

## 🔵 PRIORITAS 5: Advanced Communications

### 5.1 Email Engine
- Kirim invoice via email (PDF attachment)
- Notifikasi: pembayaran sukses, overdue, suspensi, aktivasi
- Template email yang bisa diedit via admin
- `server/services/email.js` + `src/pages/admin/EmailTemplates.jsx`

### 5.2 Broadcast / Bulk Messaging
- Kirim broadcast ke semua pelanggan via WA/Telegram/Email
- Segmentasi: per paket, per area, per status
- Contoh: "Pemeliharaan jaringan daerah Meruya, 2 Juni 02:00-05:00"

### 5.3 SMS Gateway
- Integrasi SMS untuk notifikasi penting jika WA/Telegram offline
| Provider: `server/services/sms.js`

---

## 🟣 PRIORITAS 6: Analytics & Business Intelligence

### 6.1 Laporan Revenue
- Revenue per bulan dengan breakdown per paket
- Perbandingan MoM (Month-over-Month) dan YoY
- Grafik pie: distribusi pelanggan per paket

### 6.2 Churn Analytics
- Churn rate per bulan
- Pelanggan yang near-churn (expired, belum bayar >7 hari)
- Alasan berhenti (data collection)

### 6.3 Customer Growth Metrics
- New customer acquisition per periode
- Customer lifetime value (CLV)
- Average time to install
- Conversion rate: lead → install

### 6.4 Ticket Analytics
- Jumlah tiket per hari/minggu/bulan
- Rata-rata response time CS
- Rata-rata resolution time
- Kategori tiket terbanyak (billing?, jaringan?, lain-lain?)
- SLA compliance %

---

## ⚪ PRIORITAS 7: Infrastructure & Quality of Life

### 7.1 Multi-Bahasa (i18n)
- Bahasa Indonesia + Inggris (minimal)
- React i18next atau react-intl
- Switch bahasa di frontend

### 7.2 Audit Log Lengkap
- Log semua aksi admin: create, update, delete
- Siapa, kapan, apa yang diubah
- `server/middleware/auditLog.js` + tabel `audit_logs`

### 7.3 Role-Based Access Control (RBAC)
- Admin roles: superadmin, finance, support, teknisi, marketing
- Permission per halaman dan per aksi
- `server/middleware/rbac.js`

### 7.4 Export Data
- Export ke Excel (.xlsx) untuk semua tabel admin
- Export PDF invoice
- Export report revenue

### 7.5 REST API Documentation
- Swagger / OpenAPI spec
- Endpoint dokumentasi untuk integrasi pihak ketiga

### 7.6 Dark Mode
- Theme toggle di admin panel
- Persist preferensi di localStorage

---

## 📊 Perbandingan: MAZNET vs ISP Management Industry Standard

| Kategori | MAZNET (Sekarang) | Industry Standard (Splynx/Sonar) | Gap |
|---|---|---|---|
| Website Landing | ✅ Landing, Blog, Contact | ✅ Landing, Blog, Contact | ✅ Setara |
| Admin Panel | ✅ Basic CRUD | ✅ Advanced | ⚡ Perlu UI polish |
| Billing/Invoice | ❌ Tidak ada | ✅ Core feature | 🔴 **KRITIS** |
| Payment Gateway | ❌ Tidak ada | ✅ Midtrans, Xendit, etc | 🔴 **KRITIS** |
| Customer Portal | ❌ Tidak ada | ✅ Self-service | 🟠 **High** |
| WhatsApp Bot | ✅ Full | ✅ Bisa ada via API | ✅ Unggulan |
| Telegram Bot | ✅ Full | ❌ Jarang ada | ✅ Unggulan |
| Mikrotik Monitor | ✅ Dasar | ✅ Lebih dalam | 🟡 **Medium** |
| Ticket System | ✅ Dasar | ✅ SLA, assignment | 🟡 **Medium** |
| CPE Inventory | ❌ Tidak ada | ✅ Standard | 🟡 **Medium** |
| Work Order | ❌ Tidak ada | ✅ Standard | 🟡 **Medium** |
| Inventory Gudang | ❌ Tidak ada | ✅ Standard | 🟡 **Medium** |
| Email Engine | ❌ Tidak ada | ✅ Standard | 🟠 **High** |
| RADIUS/PPPoE | ❌ Tidak ada | ✅ Bervariasi | 🟢 **Low** |
| FUP/Quota | ❌ Tidak ada | ✅ Mikrotik integrated | 🟡 **Medium** |

---

## 🎯 Rekomendasi Jalur Implementasi

### **Phase 1 — Billing Core** (Estimasi: 4-6 minggu)
> Impact tertinggi, memonetisasi MAZNET

1. Tabel database: `invoices`, `payments`, `subscriptions`
2. Invoice engine + PDF generation (pdfmake atau puppeteer)
3. Integrasi Midtrans (prioritas) / Xendit
4. Auto-suspend berdasarkan overdue
5. Finance dashboard (MRR, ARPU, revenue)
6. Data cap & FUP tracking via Mikrotik

### **Phase 2 — Customer Portal** (Estimasi: 3-4 minggu)
> Mengurangi beban CS, improve customer experience

1. Route pelanggan (login terpisah dari admin)
2. Client dashboard: tagihan, pemakaian, tiket
3. Bayar invoice dari portal
4. Download invoice PDF
5. Cek status internet & sisa quota

### **Phase 3 — Operations & Enhanced Network** (Estimasi: 4-5 minggu)
> Efisiensi operasional teknisi & inventory

1. Work order management
2. CPE inventory
3. Stok gudang
4. Outage detection & broadcast
5. Enhanced bandwidth monitoring per customer

### **Phase 4 — Analytics & Advanced** (Estimasi: 3-4 minggu)
> Business intelligence & polish

1. Revenue & churn analytics
2. Export Excel/PDF
3. Email engine templates
4. RBAC & audit log
5. Dark mode, i18n, API docs

---

## 💡 Fitur Unik (MAZNET Advantage)

Fitur-fitur ini sudah ada dan membedakan MAZNET dari kompetitor — **jangan dihilangkan**:

- **WhatsApp Bot (Baileys + Business API)** — dual provider, seamless reconnect
- **Telegram Bot Integration** — dua platform sekaligus
- **CS ↔ AI Auto-Switch** — timeout 5 menit, proaktif
- **AI Provider Multi-Model** — OpenAI, Gemini, Claude, Custom
- **Hidden Cooldown** — anti-spam tanpa bocor informasi ke pelanggan

---

## 📝 Catatan Teknis

**Potential libs & tools yang bisa dipakai:**
- PDF: `pdfmake` (frontend) atau `puppeteer` (backend) untuk invoice
- Excel: `xlsx` (SheetJS) untuk export
- Payment: Midtrans `midtrans-client` npm package
- i18n: `react-i18next`
- Charts: sudah ada `recharts` — bisa dipakai untuk finance charts
- Queue: `bull` atau `bee-queue` untuk background jobs (broadcast, invoice generation)
- Scheduling: `node-cron` untuk recurring invoice generation

**Database:**
- Tabel baru: `invoices`, `payments`, `subscriptions`, `cpe_inventory`, `work_orders`, `inventory_items`, `coupons`, `audit_logs`
- Modifikasi tabel: `clients` (add subscription_id, billing_cycle, next_billing), `service_packages` (add fup_enabled, fup_speed, fup_quota)

---

## 🔗 Referensi Riset

- **Splynx** — splynx.com → ISP Billing, Ticketing, Network Management, Sales, CRM, Inventory, Field Services, Open API
- **Sonar Software** — sonar.software → Billing automation, payment processing, CRMD
- **Powercode** — powercode.com → Billing, provisioning, network monitoring, VoIP
- **UISP (Ubiquiti)** — uisp.ui.com → Network management, CRM, billing integration
- **Mikrotik API** — node-routeros library (sudah terinstall) → untuk FUP/quota enforcement

---

> **Dokumen ini adalah PRD / fitur recommendation.** 
> Setelah direview, bisa di-breakdown ke task plan per phase untuk implementasi.

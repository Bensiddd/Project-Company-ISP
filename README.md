# MAZNET — ISP Landing Page + Dashboard Admin + Telegram Bot

Sistem manajemen **ISP** full-stack dengan landing page publik, dashboard admin multi-role, integrasi multi-bot Telegram dengan AI webhook, monitoring jaringan Mikrotik, dan ticketing system.

## Tech Stack

- **Frontend**: React 18 + Vite 4 + Framer Motion + React Router 6 + Axios + Recharts
- **Backend**: Express.js + sql.js (SQLite murni JavaScript, tanpa native module)
- **Bot Telegram**: native `fetch` (Node 18+), long polling (3s) + webhook
- **AI**: Multi-provider (OpenAI, Gemini, Claude, OpenRouter, Custom API)
- **Mikrotik**: node-routeros (RouterOS API)
- **Database**: SQLite (file-based, auto-create)

## Struktur Frontend

```
src/
├── components/          # Komponen UI reusable (Header, Footer, FormModal, PricingSection, DataTable, dll)
├── pages/
│   ├── Home.jsx         # Single-scroll: hero, about, coverage, services, blog, contact
│   ├── About.jsx
│   ├── Services.jsx
│   ├── Blog.jsx
│   ├── Contact.jsx
│   ├── Login.jsx / Register.jsx
│   └── admin/
│       ├── Dashboard.jsx           # Layout utama dengan sidebar role-based (6 role)
│       ├── AdminOverview.jsx       # Statistik dashboard + activity log feed
│       ├── AdminUsers.jsx          # CRUD admin, support 6 role
│       ├── TelegramBots.jsx        # Multi-bot: CRUD, role, AI config, Set Webhook, Check AI, Polling
│       ├── ContactMessages.jsx     # Telegram chat bubble UI, reply, AI/human toggle, countdown modal
│       ├── TicketManagement.jsx    # Card grid, assign admin, inline reply, role filter, confirm dialog
│       ├── IncomingRequests.jsx    # Request dari form contact → proses jadi ticket
│       ├── MikrotikMonitor.jsx     # Network monitor: traffic chart (Recharts), logs, PPPoE
│       ├── ServicePackages.jsx     # 3 paket ISP: Starter Rp160rb, Professional Rp400rb, Enterprise
│       ├── CoverageAreas.jsx       # Wilayah cakupan
│       ├── BlogPosts.jsx
│       ├── ClientsTestimonials.jsx
│       └── WebsiteSettings.jsx
├── services/api.js      # Axios instance + 15 module API (termasuk mikrotikAPI)
├── styles/globals.css   # Dark theme (#0a0a0f), glassmorphism, Plus Jakarta Sans
├── data/mockData.js     # 7 mock dataset (fallback)
└── App.jsx / main.jsx
```

## Struktur Backend

```
server/
├── index.js              # Express entry point, route mounting (15 route), init polling
├── db.js                 # sql.js wrapper: init/run/get/all/insert/exec + logActivity
├── migrate.js            # Schema 15 tabel + ALTER TABLE + unique index + migration
├── seed.js               # Data awal MAZNET (5 admin users, 4 coverage, 3 paket, dll.)
├── middleware/auth.js     # JWT generate/authenticate/optionalAuth
├── routes/
│   ├── auth.js           # Login / register / logout / me + activity log
│   ├── users.js          # CRUD admin users (6 role)
│   ├── blog.js           # CRUD blog posts
│   ├── services.js       # CRUD service packages
│   ├── coverage.js       # CRUD coverage areas
│   ├── clients.js        # CRUD clients
│   ├── testimonials.js   # CRUD testimonials
│   ├── messages.js       # CRUD contact messages + Telegram notif
│   ├── tickets.js        # CRUD tickets + replies, dynamic UPDATE, teknisi filter
│   ├── telegram.js       # Polling, webhook, send, test, status, check-ai, set-webhook, callback_query, state machine (6 state)
│   ├── telegram-conversations.js  # Conversations: list, messages, reply, toggle mode, delete
│   ├── bot-settings.js   # CRUD telegram bots (token, role, AI provider/key/URL)
│   ├── settings.js       # Website settings
│   ├── dashboard.js      # Aggregate stats + recent activity
│   └── mikrotik.js       # RouterOS API: settings, status, interfaces, traffic, logs, PPPoE, history
├── services/
│   └── ai-providers.js   # OpenAI, Gemini, Claude, Custom API — masing-masing timeout 20s
└── data/database.sqlite  # File database (auto-create)
```

## Fitur Lengkap

### 🌐 Landing Page Publik
- Hero section MAZNET dengan Particles canvas animation
- About + 4 value cards (Cepat, Terpercaya, Terjangkau, Komunitas)
- Coverage (Wanasari, Wanajaya, Selang, Kab. Bekasi)
- Services bisa custom packet layanan
- Blog preview dari API
- Contact form dengan WhatsApp field
- StatsCounter (500+ pelanggan, 98% uptime, 10+ wilayah, 24/7 support)
- Dark theme dengan glassmorphism, Framer Motion animations

### 🔐 Dashboard Admin
- Login: `admin@maznet.id` / `admin123`
- 6 role: **super_admin** (full), **admin**, **cs** (messages + tickets), **marketing** (blog + services), **editor** (blog), **teknisi** (ticket terbatas)
- Sidebar dinamis sesuai role, animated dropdown user menu
- Activity logs untuk semua aksi CRUD + login

### 🤖 Multi-Bot Telegram
- Tambah multiple bot dengan token dan admin_chat_id
- 3 role per bot: admin, customer_service (AI), teknisi
- AI provider bot: OpenAI, Gemini, Claude, OpenRouter, atau Custom API (integrasi bot dengan AI)
- Custom API URL — override endpoint untuk setiap provider (Ollama, vLLM, dll.)
- **Long Polling** (interval 3 detik) — tanpa perlu URL publik
- **Webhook** — untuk deployment publik (otomatis stop polling)
- **Cek Status Ticket** — masukkan ID ticket → bot tampilkan status + konfirmasi close
- Tombol Test, Check Status, Check AI (dengan preview), Set Webhook, Start Polling per bot
- Per-conversation lock cegah duplicate AI processing
- Deduplikasi update_id cegah reproses pesan yang sama

### 💬 Telegram CS dengan State Machine (6 state)
- Menu interaktif dengan **inline keyboard**:
  - 🎫 **Buat Ticket** → tulis keluhan → ticket otomatis
  - 📶 **Upgrade Bandwidth** → input ID pelanggan → pilih paket → ticket upgrade
  - 🔧 **Instalasi Baru** → input alamat → share lokasi (maps) → ticket instalasi
  - 🔍 **Cek Status Ticket** → lihat status + konfirmasi close
  - 💬 **Bicara dengan CS** → dialihkan ke human mode
- Mode AI/Human per percakapan + **countdown 3 detik** saat switch Human→AI
- Semua pesan tersimpan di database + unread counter

### 💬 Contact Messages (Dashboard)
- Percakapan Telegram dengan chat bubble UI (auto-refresh 3 detik)
- Balas langsung dari dashboard → terkirim ke user via Telegram API
- Toggle AI ↔ Human per percakapan dengan konfirmasi countdown
- Bot status (online/offline) per bot
- Smart auto-scroll hanya jika di dekat bottom
- Hapus sesi + semua pesan

### 🎫 Ticketing
- 4 tipe: maintenance, upgrade, installation, **request**
- Status: open → in_progress → resolved → closed
- Priority: low, medium, high, checking
- Assign ke admin inline (combobox)
- Confirm dialog untuk close (resolved→closed) dan delete
- Filter by type + status
- Teknisi: hanya lihat open + in_progress, tanpa delete
- Ticket otomatis dari Telegram (keluhan, upgrade, instalasi)

### 📥 Incoming Requests
- Request dari form contact muncul sebagai ticket type "request"
- Proses request: pilih type (maintenance/upgrade/installation), priority, assign admin
- Card view + form modal dengan preview data pelanggan

### 🌐 Network Monitor (Mikrotik)
- Koneksi RouterOS API via `node-routeros`
- **Real-time traffic** per interface dengan sampling 60 detik
- **Chart area** (Recharts) dengan range: 3m, 30m, 1h, 1d, 1w, 1m
- Statistik: Current, Peak, Lowest traffic (RX/TX)
- **Logs** dari router (filtered: exclude telnet/debug/api)
- **PPPoE aktif** — daftar session + pagination
- Auto-refresh traffic history + logs
- Settings modal (host, port, username, password) — password dienkripsi base64

### 🤖 AI Webhook
- Multi-provider: OpenAI, Gemini, Claude, OpenRouter, Custom API
- Default model per provider (gpt-4o-mini, gemini-2.0-flash, claude-3-haiku)
- History context 10 pesan terakhir
- Timeout 20 detik per request (AbortController)
- System prompt Bahasa Indonesia untuk CS MAZNET

## Database

Database SQLite (`server/data/database.sqlite`) dengan 15 tabel:

| Tabel | Fungsi |
|---|---|
| `admin_users` | Pengguna admin (6 role: super_admin, admin, cs, marketing, editor, teknisi) |
| `blog_posts` | Artikel blog (slug unik, draft/published, category) |
| `service_packages` | Paket ISP (JSON features, popular flag, hidden price) |
| `coverage_areas` | Wilayah cakupan (active/inactive toggle) |
| `clients` | Data klien (industry, contact person) |
| `testimonials` | Testimonial (rating 1-5, approval, FK → clients) |
| `contact_messages` | Pesan form kontak (whatsapp, telegram_chat_id) |
| `tickets` / `ticket_replies` | Tiket & balasan (4 tipe, 4 status, 3 priority) |
| `telegram_bots` | Multi-bot config (token, role, AI provider/key/model/URL) |
| `telegram_conversations` | Percakapan per user (state machine, pending_data, unread) |
| `telegram_messages` | Riwayat pesan (user/bot/agent) |
| `website_settings` | Pengaturan website (company, contact, social media) |
| `mikrotik_settings` | Konfigurasi koneksi RouterOS (host, user, password terenkripsi) |
| `traffic_history` | Riwayat traffic per interface (RX/TX per sample) |
| `activity_logs` | Log aktivitas admin (type, action, detail, user_id) |

## Menjalankan

```bash
# Install dependencies
npm install                    # Frontend dependencies
cd server && npm install       # Backend dependencies
cd ..

# Inisialisasi database
node server/migrate.js         # Create 15 tabel
node server/seed.js            # Seed data awal MAZNET

# Development (jalankan 2 terminal)
npm run dev                    # Frontend (Vite, port 5173)
node server/index.js           # Backend (Express, port 3001)
```

Build production:
```bash
npm run build                  # Build frontend ke dist/
```
Frontend di-*serve* dari Express sebagai static files.

## Catatan Penting

- Setiap **restart server** → polling otomatis untuk semua bot `customer_service` aktif (interval 3 detik)
- Setelah **migrate/seed** → **restart server** (DB in-memory perlu reload)
- Password Mikrotik disimpan di database dalam base64 (bukan encryption)
- Bot hanya bisa kirim pesan ke user yang pernah chat bot sebelumnya
- `admin123` adalah password default untuk semua seed admin users
- Dark theme: `#0a0a0f` base, Plus Jakarta Sans font
- Pastikan Node.js 18+ untuk native `fetch` support

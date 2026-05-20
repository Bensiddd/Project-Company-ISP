# MAZNET — ISP Landing Page + Dashboard Admin + Telegram Bot

Sistem manajemen **ISP** full-stack dengan landing page publik, dashboard admin multi-role, integrasi multi-bot Telegram dengan AI webhook, monitoring jaringan Mikrotik, dan ticketing system.

## Tech Stack

- **Frontend**: React 18 + Vite 4 + Framer Motion + React Router 6 + Axios + Recharts
- **Backend**: Express.js + mysql2 (MySQL 8 via Docker)
- **Bot Telegram**: native `fetch` (Node 18+), long polling (3s) + webhook
- **AI**: Multi-provider (OpenAI, Gemini, Claude, OpenRouter, Custom API) — toggle per bot, template default
- **Mikrotik**: node-routeros (RouterOS API)
- **Database**: MySQL 8 (Docker)
- **Docker**: mysql:8 + phpMyAdmin, semua port bind 127.0.0.1 (loopback)

## Struktur Frontend

```
src/
├── components/          # Komponen UI reusable (Header, Footer, FormModal, PricingSection, DataTable, RichTextEditor, dll)
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
│       ├── BlogPosts.jsx             # Tabel blog posts (navigasi ke halaman editor)
│       ├── BlogEditor.jsx            # Blog post editor dengan TipTap WYSIWYG
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
├── index.js              # Express entry point, route mounting (16 route), init polling
├── db.js                 # mysql2/promise wrapper: init/run/get/all/insert/exec + logActivity
├── migrate.js            # Schema 16 tabel + ALTER TABLE + unique index + migration
├── seed.js               # Data awal MAZNET (5 admin, 4 coverage, 3 paket, telegram_bots, dll.)
├── .env                  # DB_HOST=127.0.0.1, DB_USER=root, DB_PASSWORD=root, DB_NAME=maznet
├── middleware/auth.js     # JWT generate/authenticate/optionalAuth
├── routes/
│   ├── auth.js           # Login / register / logout / me + activity log
│   ├── users.js          # CRUD admin users (6 role)
│   ├── blog.js           # CRUD blog posts (slug, tags, excerpt, featured image, author tracking)
│   ├── upload.js         # Image upload (multer, max 5MB, hanya gambar, /uploads/)
│   ├── services.js       # CRUD service packages
│   ├── coverage.js       # CRUD coverage areas
│   ├── clients.js        # CRUD clients
│   ├── testimonials.js   # CRUD testimonials
│   ├── messages.js       # CRUD contact messages + Telegram notif
│   ├── tickets.js        # CRUD tickets + replies, dynamic UPDATE, teknisi filter, telegram_conversation_id
│   ├── telegram.js       # Polling, webhook, send, test, status, set-webhook, stop-polling, callback_query, state machine (5 state), cooldown 6 jam, template/AI
│   ├── telegram-conversations.js  # Conversations: list, messages, reply, toggle mode, delete
│   ├── bot-settings.js   # CRUD telegram bots (token, role, AI provider/key/URL, ai_enabled toggle)
│   ├── settings.js       # Website settings
│   ├── dashboard.js      # Aggregate stats + recent activity
│   └── mikrotik.js       # RouterOS API: settings, status, interfaces, traffic, logs, PPPoE, history
├── services/
│   └── ai-providers.js   # OpenAI, Gemini, Claude, Custom API — masing-masing timeout 20s
├── docker-compose.yml    # MySQL 8 + phpMyAdmin (port bind 127.0.0.1)
└── data/database.sqlite.backup-20260519  # Backup SQLite sebelum migrasi ke MySQL
```

## Fitur Lengkap

### 🌐 Landing Page Publik
- Hero section MAZNET dengan Particles canvas animation
- About + 4 value cards (Cepat, Terpercaya, Terjangkau, Komunitas)
- Coverage (Wanasari, Wanajaya, Selang, Kab. Bekasi)
- Services bisa custom packet layanan
- Blog preview dari API (featured image thumbnail, tags, excerpt, read time)
- Blog detail page dengan hero cover image (blur + overlay gradient)
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
- 3 role per bot: admin, customer_service (AI/CS), teknisi
- **AI toggle per bot** (`ai_enabled`) — default template-based, opsional AI multi-provider
- AI provider: OpenAI, Gemini, Claude, OpenRouter, atau Custom API (Ollama, vLLM, dll.)
- **Long Polling** (interval 3 detik) — tanpa perlu URL publik
- **Webhook** — untuk deployment publik (otomatis stop polling)
- **Stop Polling** — button + endpoint `POST /stop-polling`, polling status indicator
- Tombol Test, Check AI (preview), Set Webhook, Start/Stop Polling per bot
- **Cooldown 6 jam** per conversation — auto-clear jika ticket terkait closed/deleted
- Per-conversation lock cegah duplicate AI processing
- Deduplikasi update_id cegah reproses pesan yang sama

### 💬 Telegram CS dengan State Machine (5 state)
- Menu interaktif dengan **inline keyboard**:
  - 🎫 **Buat Ticket** → tulis keluhan → ticket otomatis
  - 📶 **Upgrade Bandwidth** → input ID pelanggan → pilih paket → ticket upgrade
  - 🔧 **Instalasi Baru** → input alamat → share lokasi (maps) → ticket instalasi
  - 💬 **Bicara dengan CS** → dialihkan ke human mode
- Mode AI/Human per percakapan + **countdown 3 detik** saat switch Human→AI
- **Cooldown 6 jam** setelah ticket dibuat — bypass via talk_to_cs, menu, batal, /start, /stop
- Cooldown **ticket-aware** — auto-clear jika ticket dihapus atau status closed
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
- **Toggle per bot** (`ai_enabled`) — template default saat AI nonaktif: "Ada yang bisa saya bantu?" + MAIN_MENU
- Default model per provider (gpt-4o-mini, gemini-2.0-flash, claude-3-haiku)
- History context 10 pesan terakhir
- Timeout 20 detik per request (AbortController)
- System prompt Bahasa Indonesia untuk CS MAZNET

### ✍️ Blog Editor (WYSIWYG)
- TipTap rich text editor dengan toolbar: Bold, Italic, Underline, Strikethrough, Code, H1-H3, Lists, Align, Image, Link, Table, Undo/Redo
- **Featured image** — upload via multer ke `/uploads/`, preview di editor, thumbnail di card blog, hero cover di detail
- **Tags management** — add/remove tags per post, ditampilkan di card blog list dan detail
- **Excerpt** — cuplikan singkat yang tampil di card preview
- **Meta Description** — untuk SEO (tidak visible di frontend)
- **Author tracking** — setiap edit menyimpan `author_id` sebagai user yang terakhir mengubah
- Preview mode untuk lihat hasil render HTML
- Proxy Vite: `/uploads` diarahkan ke `http://localhost:3001`

## Database

**MySQL 8** via Docker (`mysql:8` image). Semua port bind ke `127.0.0.1` (loopback — tidak bisa diakses dari luar).

| Service | Port | Akses |
|---|---|---|
| MySQL | `127.0.0.1:3306` | root / root |
| phpMyAdmin | `http://127.0.0.1:8080` | root / root |

16 tabel:

| Tabel | Fungsi |
|---|---|
| `admin_users` | Pengguna admin (6 role: super_admin, admin, cs, marketing, editor, teknisi) |
| `blog_posts` | Artikel blog (slug unik, draft/published, category, tags JSON, featured_image_url, meta_description, read_time, excerpt) |
| `service_packages` | Paket ISP (JSON features, popular flag, hidden price) |
| `coverage_areas` | Wilayah cakupan (active/inactive toggle) |
| `clients` | Data klien (industry, contact person) |
| `testimonials` | Testimonial (rating 1-5, approval, FK → clients) |
| `contact_messages` | Pesan form kontak (whatsapp, telegram_chat_id) |
| `tickets` | Tiket (4 tipe, 4 status, 3 priority, telegram_conversation_id) |
| `ticket_replies` | Balasan ticket (FK → tickets, ON DELETE CASCADE) |
| `telegram_bots` | Multi-bot config (token, role, ai_enabled toggle, AI provider/key/model/URL) |
| `telegram_conversations` | Percakapan per user (state machine, pending_data, cooldown_until, unread) |
| `telegram_messages` | Riwayat pesan (user/bot) |
| `website_settings` | Pengaturan website (company, contact, social media) |
| `mikrotik_settings` | Konfigurasi koneksi RouterOS (host, user, password terenkripsi base64) |
| `traffic_history` | Riwayat traffic per interface (RX/TX per sample) |
| `activity_logs` | Log aktivitas admin (type, action, detail, user_id) |

## Prasyarat

- **Docker Desktop** (untuk MySQL 8 + phpMyAdmin)
- **Node.js 18+** (native `fetch` support)

## Menjalankan

```bash
# 1. Clone & install dependencies
git clone <repo-url> maznet
cd maznet
npm install                      # Frontend dependencies
cd server && npm install         # Backend dependencies
cd ..

# 2. Copy environment
cp server/.env.example server/.env   # Sesuaikan jika perlu

# 3. Start MySQL + phpMyAdmin
docker compose up -d                 # MySQL (3306) + phpMyAdmin (8080)

# 4. Inisialisasi database
node server/migrate.js               # Create 16 tabel
node server/seed.js                  # Seed data awal MAZNET

# 5. Development (2 terminal)
npm run dev                          # Frontend Vite (port 5173)
node server/index.js                 # Backend Express (port 3001)
```

Build production:
```bash
npm run build                        # Build frontend ke dist/
```
Frontend di-*serve* dari Express sebagai static files.

**API:** `http://localhost:3001`
**phpMyAdmin:** `http://127.0.0.1:8080` (root / root)
**Login:** `admin@maznet.id` / `admin123`

## Catatan Penting

- **Docker port bind**: Semua port Docker bind ke `127.0.0.1` (loopback) — tidak bisa diakses dari luar (kecuali port-forwarding)
- **Restart backend** → polling otomatis untuk semua bot `customer_service` aktif (interval 3 detik)
- **AI template default**: Bot baru `ai_enabled=0` — hanya balas dengan template "Ada yang bisa saya bantu?" + MAIN_MENU. Aktifkan AI via toggle di dashboard
- **Cooldown 6 jam**: Setelah membuat ticket/install/upgrade via Telegram. Auto-clear jika ticket dihapus atau status closed
- **Cooldown bypass**: `talk_to_cs`, `end_session`, `back_to_menu`, `/start`, `/stop`, menu, batal — tidak kena cooldown
- **Password Mikrotik**: disimpan di database dalam base64 (bukan encryption sesungguhnya)
- **Bot hanya bisa kirim pesan** ke user yang pernah chat bot sebelumnya
- **`admin123`** adalah password default untuk semua seed admin users
- **Dark theme**: `#0a0a0f` base, Plus Jakarta Sans font, glassmorphism
- **Vite proxy**: `/api` dan `/uploads` di-proxy ke `http://localhost:3001`
- **Node.js 18+** diperlukan untuk native `fetch` support

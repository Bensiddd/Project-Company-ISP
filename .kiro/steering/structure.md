# Project Structure

## Root

```
/
├── src/                    # Frontend (React/Vite)
├── server/                 # Backend (Express)
├── dist/                   # Production build output (generated)
├── uploads/                # Uploaded images (generated, served at /uploads)
├── docker-compose.yml      # MySQL 8 + phpMyAdmin
├── index.html              # Vite entry HTML
├── package.json            # Frontend dependencies
└── vite.config.js          # Vite config (proxy: /api, /uploads → localhost:3001)
```

## Frontend (`src/`)

```
src/
├── App.jsx                 # Router setup; hides Header/Footer on /admin routes
├── main.jsx                # React entry point
├── App.css
├── components/             # Shared/reusable UI components
│   ├── Header.jsx / .css
│   ├── Footer.jsx / .css
│   ├── DataTable.jsx       # Generic table with pagination/search
│   ├── FormModal.jsx       # Generic modal wrapper for forms
│   ├── RichTextEditor.jsx  # TipTap wrapper component
│   ├── PricingSection.jsx
│   ├── TestimonialsSection.jsx
│   ├── StatsCounter.jsx
│   ├── Particles.jsx       # Canvas particle animation (hero)
│   └── ScrollToTop.jsx
├── pages/
│   ├── Home.jsx            # Single-scroll landing page
│   ├── About.jsx
│   ├── Services.jsx
│   ├── Blog.jsx
│   ├── BlogDetail.jsx
│   ├── Contact.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   └── admin/              # All admin dashboard pages
│       ├── Dashboard.jsx           # Layout shell with role-based sidebar
│       ├── AdminOverview.jsx       # Stats + activity feed
│       ├── AdminUsers.jsx          # User CRUD (6 roles)
│       ├── BlogPosts.jsx           # Blog post list
│       ├── BlogEditor.jsx          # TipTap editor page
│       ├── ClientsTestimonials.jsx
│       ├── ContactMessages.jsx     # Telegram chat bubble UI
│       ├── TicketManagement.jsx
│       ├── IncomingRequests.jsx
│       ├── MikrotikMonitor.jsx     # Traffic charts + PPPoE
│       ├── ServicePackages.jsx
│       ├── CoverageAreas.jsx
│       ├── TelegramBots.jsx        # Multi-bot config + AI settings
│       └── WebsiteSettings.jsx
├── services/
│   └── api.js              # Single Axios instance + all API modules (authAPI, blogPostsAPI, ticketsAPI, telegramAPI, mikrotikAPI, etc.)
├── hooks/
│   └── useWebsiteSettings.js
├── data/
│   └── mockData.js         # Fallback mock data for development
└── styles/
    └── globals.css         # Dark theme vars, glassmorphism utilities, Plus Jakarta Sans
```

## Backend (`server/`)

```
server/
├── index.js                # Express entry: mounts all routes, starts DB, starts polling
├── db.js                   # mysql2/promise pool wrapper (get/all/insert/run/exec/logActivity)
├── migrate.js              # Schema migrations — run once to create/alter tables
├── seed.js                 # Initial data seed (admins, packages, bots, etc.)
├── .env                    # Environment config (DB, JWT, ENCRYPTION_KEY)
├── middleware/
│   └── auth.js             # generateToken, authenticate, optionalAuth
├── routes/                 # One file per resource domain
│   ├── auth.js             # /api/auth
│   ├── users.js            # /api/admin-users
│   ├── blog.js             # /api/blog-posts
│   ├── services.js         # /api/service-packages
│   ├── coverage.js         # /api/coverage-areas
│   ├── clients.js          # /api/clients
│   ├── testimonials.js     # /api/testimonials
│   ├── messages.js         # /api/contact-messages
│   ├── tickets.js          # /api/tickets
│   ├── telegram.js         # /api/telegram (polling, webhook, send, state machine)
│   ├── telegram-conversations.js  # /api/telegram-conversations
│   ├── bot-settings.js     # /api/telegram-bots
│   ├── settings.js         # /api/website-settings
│   ├── dashboard.js        # /api/dashboard
│   ├── mikrotik.js         # /api/mikrotik (RouterOS, traffic history)
│   └── upload.js           # /api/upload (multer)
├── services/
│   └── ai-providers.js     # OpenAI / Gemini / Claude / OpenRouter / Custom API calls
└── utils/
    └── encryption.js       # AES-256-GCM encrypt/decrypt helpers
```

## Database (16 tables)

`admin_users`, `blog_posts`, `service_packages`, `coverage_areas`, `clients`, `testimonials`, `contact_messages`, `tickets`, `ticket_replies`, `telegram_bots`, `telegram_conversations`, `telegram_messages`, `website_settings`, `mikrotik_settings`, `traffic_history`, `activity_logs`

## Key Structural Rules

- **New backend routes**: create a file in `server/routes/`, export a Router, mount it in `server/index.js` under `/api/<resource>`
- **New frontend API calls**: add a named export module to `src/services/api.js` — never call `fetch` or create a new Axios instance elsewhere
- **New admin pages**: add to `src/pages/admin/`, register in `Dashboard.jsx` sidebar and routing
- **Shared UI**: reusable components go in `src/components/`, not inside page files
- **CSS**: each component/page has its own `.css` file co-located alongside it; global utilities only in `globals.css`
- **Schema changes**: always go through `server/migrate.js` (ALTER TABLE or CREATE TABLE IF NOT EXISTS), never mutate the DB directly

# Tech Stack

## Frontend

- **Framework**: React 18 with Vite 4 (ES modules, `"type": "module"`)
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios — single instance in `src/services/api.js` with JWT interceptors
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Rich Text Editor**: TipTap (with extensions: image, link, placeholder, table, text-align, underline, starter-kit)
- **Icons**: React Icons
- **Styling**: Plain CSS per component/page, global dark theme in `src/styles/globals.css`

## Backend

- **Runtime**: Node.js 18+ (native `fetch` required)
- **Framework**: Express.js 4
- **Database**: MySQL 8 via `mysql2/promise` connection pool
- **Auth**: JWT (`jsonwebtoken`) — 24h expiry, Bearer token, stored in `localStorage` as `admin_token`
- **Password Hashing**: bcryptjs
- **Encryption**: AES-256-GCM via Node.js `crypto` — used for `ai_api_key` and Mikrotik password. Key from `ENCRYPTION_KEY` env var. Format: `enc:<base64-iv>:<base64-tag>:<base64-ct>`
- **File Uploads**: multer — max 5MB, images only, stored in `/uploads/`
- **Mikrotik**: node-routeros (RouterOS API)
- **Telegram**: Native `fetch` — long polling (3s interval) or webhook
- **Environment**: dotenv, `.env` in `server/`

## Infrastructure

- **Database**: MySQL 8 in Docker (`docker-compose.yml`), bound to `127.0.0.1:3306`
- **phpMyAdmin**: `http://127.0.0.1:8080` (root / root)
- **Vite Proxy**: `/api` and `/uploads` proxied to `http://localhost:3001`
- **Production**: Frontend built to `dist/`, served as static files from Express

## Environment Variables (`server/.env`)

```
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=root
DB_NAME=maznet
DB_PORT=3306
PORT=3001
JWT_SECRET=...
ENCRYPTION_KEY=<64-char hex>   # Never change after data is encrypted
```

## Common Commands

```bash
# Start infrastructure
docker compose up -d              # MySQL + phpMyAdmin

# Database setup (run once)
node server/migrate.js            # Create/alter 16 tables
node server/seed.js               # Seed initial data
# or combined:
cd server && npm run setup

# Development
npm run dev                       # Frontend — Vite dev server (port 5173)
cd server && npm run dev          # Backend — nodemon (port 3001)
# or without nodemon:
cd server && npm start            # node index.js

# Production build
npm run build                     # Vite build → dist/
npm run preview                   # Preview production build

# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Key Conventions

- All backend routes are ES modules (`import`/`export`), no CommonJS `require`
- DB access always goes through `db.js` helpers (`db.get`, `db.all`, `db.insert`, `db.run`) — never raw pool access in routes
- All API routes are prefixed `/api/` on the backend
- Frontend API calls go through the single Axios instance in `src/services/api.js` — never use `fetch` directly in components
- Sensitive values (API keys, passwords) are encrypted before DB storage and never returned raw to the frontend — masked as `••••<last4>` in responses
- Activity logging via `db.logActivity(type, action, detail, userId)` for all significant CRUD actions

# WhatsApp Integration - MAZNET ISP

## Overview

Fitur WhatsApp telah diintegrasikan ke sistem MAZNET dengan kemampuan yang sama seperti Telegram:
- Multi-bot WhatsApp (multiple nomor WA)
- State machine 5 state (buat ticket, upgrade, instalasi, bicara CS, idle)
- AI toggle per bot (OpenAI, Gemini, Claude, OpenRouter, Custom API)
- Template response saat AI nonaktif
- Cooldown 6 jam setelah buat ticket
- Chat bubble UI di dashboard
- Reply dari dashboard
- Semua pesan tersimpan di database

## Arsitektur

### Provider Pattern (Mudah Switch)

```
WhatsAppProvider (Abstract)
├── BaileysProvider (Development/Testing)
└── BusinessAPIProvider (Production)
    ├── Meta Cloud API
    ├── Twilio
    └── 360dialog
```

Anda tinggal **ganti provider** di config tanpa ubah logic bisnis!

## Database Tables

### 1. `whatsapp_bots`
```sql
- id, name, phone_number
- provider: 'baileys' | 'business-api'
- is_active, role, status
- ai_enabled, ai_provider, ai_model, ai_api_key (encrypted), ai_url
- api_key (encrypted, untuk Business API)
- webhook_url (untuk Business API)
- session_data (Baileys session)
- qr_code (Baileys QR)
- system_prompt
```

### 2. `whatsapp_conversations`
```sql
- id, bot_id, chat_id, user_name
- status: 'ai' | 'human' | 'ended'
- state: 'idle' | 'awaiting_ticket_name' | 'awaiting_upgrade_customer_id' | ...
- pending_data (JSON)
- cooldown_until
- unread, last_message
```

### 3. `whatsapp_messages`
```sql
- id, conversation_id, bot_id, chat_id
- role: 'user' | 'bot'
- message, created_at
```

### 4. `tickets` (Updated)
```sql
- ... (existing columns)
- whatsapp_conversation_id (FK)
- source: 'telegram' | 'whatsapp' | 'manual'
```

## Backend Structure

```
server/
├── services/
│   └── whatsapp/
│       ├── whatsapp-provider.js       # Abstract interface
│       ├── baileys-provider.js        # Baileys implementation
│       ├── business-api-provider.js   # Business API (Meta/Twilio/360dialog)
│       ├── message-handler.js         # State machine logic
│       └── provider-factory.js        # Provider switcher
├── routes/
│   ├── whatsapp.js                    # Main routes (connect, test, webhook)
│   ├── whatsapp-bots.js               # CRUD bots
│   └── whatsapp-conversations.js      # Chat & reply
└── data/
    └── whatsapp-sessions/             # Baileys session storage
        └── bot-{id}/                  # Per-bot session
```

## Installation

### 1. Install Dependencies

```bash
cd server
npm install
```

Dependencies yang ditambahkan:
- `@whiskeysockets/baileys` - WhatsApp Web protocol
- `@hapi/boom` - Error handling untuk Baileys
- `qrcode-terminal` - QR code display (optional)

### 2. Run Migration

```bash
node server/migrate.js
```

Ini akan membuat:
- 3 tabel baru: `whatsapp_bots`, `whatsapp_conversations`, `whatsapp_messages`
- Kolom baru di `tickets`: `whatsapp_conversation_id`, `source`

### 3. Start Server

```bash
# Development
cd server && npm run dev

# Production
cd server && npm start
```

Server akan otomatis initialize semua WhatsApp bots yang aktif.

## Usage

### Development (Baileys)

1. **Create Bot** via dashboard atau API:
```json
{
  "name": "MAZNET CS Bot",
  "phone_number": "628123456789",
  "provider": "baileys",
  "role": "customer_service",
  "ai_enabled": false
}
```

2. **Connect Bot**:
   - Klik "Connect" di dashboard
   - Scan QR code dengan WhatsApp
   - Status akan berubah jadi "connected"

3. **Test**:
   - Kirim pesan ke nomor bot dari WhatsApp Anda
   - Bot akan balas dengan menu

### Production (Business API)

#### Option 1: Meta Cloud API (Recommended)

1. **Setup di Meta Developer Console**:
   - Buat app di https://developers.facebook.com
   - Tambah WhatsApp product
   - Dapatkan Phone Number ID & Access Token
   - Set webhook URL: `https://yourdomain.com/api/whatsapp/webhook/{bot_id}`
   - Verify token: set di `.env` sebagai `WEBHOOK_VERIFY_TOKEN`

2. **Create Bot**:
```json
{
  "name": "MAZNET Production",
  "phone_number": "YOUR_PHONE_NUMBER_ID",
  "provider": "business-api",
  "api_key": "YOUR_ACCESS_TOKEN",
  "webhook_url": "https://yourdomain.com/api/whatsapp/webhook/1",
  "ai_enabled": true,
  "ai_provider": "openai",
  "ai_api_key": "sk-..."
}
```

3. **Connect**:
   - Klik "Connect" di dashboard
   - Bot langsung aktif (tidak perlu QR)

#### Option 2: Twilio

1. **Setup di Twilio Console**:
   - Buat WhatsApp Sender di https://console.twilio.com
   - Dapatkan Account SID & Auth Token
   - Set webhook URL

2. **Create Bot**:
```json
{
  "name": "MAZNET Twilio",
  "phone_number": "whatsapp:+14155238886",
  "provider": "business-api",
  "api_key": "ACCOUNT_SID:AUTH_TOKEN",
  "webhook_url": "https://yourdomain.com/api/whatsapp/webhook/1"
}
```

#### Option 3: 360dialog

1. **Setup di 360dialog**:
   - Daftar di https://www.360dialog.com
   - Dapatkan API Key
   - Set webhook URL

2. **Create Bot**:
```json
{
  "name": "MAZNET 360dialog",
  "phone_number": "628123456789",
  "provider": "business-api",
  "api_key": "YOUR_360DIALOG_API_KEY",
  "webhook_url": "https://yourdomain.com/api/whatsapp/webhook/1"
}
```

## API Endpoints

### Bots Management

```
GET    /api/whatsapp-bots           # List all bots
GET    /api/whatsapp-bots/:id       # Get bot detail
POST   /api/whatsapp-bots           # Create bot
PUT    /api/whatsapp-bots/:id       # Update bot
DELETE /api/whatsapp-bots/:id       # Delete bot
```

### Bot Actions

```
POST   /api/whatsapp/connect        # Connect bot
POST   /api/whatsapp/disconnect     # Disconnect bot
GET    /api/whatsapp/bots/:id/status # Get status
GET    /api/whatsapp/bots/:id/qr   # Get QR code (Baileys only)
POST   /api/whatsapp/test           # Test send message
POST   /api/whatsapp/set-webhook    # Set webhook (Business API)
POST   /api/whatsapp/check-ai       # Test AI response
```

### Conversations

```
GET    /api/whatsapp-conversations           # List conversations
GET    /api/whatsapp-conversations/:id/messages # Get messages
POST   /api/whatsapp-conversations/:id/reply    # Reply to user
POST   /api/whatsapp-conversations/:id/toggle   # Toggle AI/Human
DELETE /api/whatsapp-conversations/:id          # Delete conversation
```

### Webhook (Business API)

```
POST   /api/whatsapp/webhook/:bot_id  # Receive messages
GET    /api/whatsapp/webhook/:bot_id  # Webhook verification (Meta)
```

## State Machine

Sama seperti Telegram, WhatsApp menggunakan state machine 5 state:

### 1. Buat Ticket (Maintenance)
```
idle → awaiting_ticket_name → awaiting_ticket_customer_id → 
awaiting_ticket_address → awaiting_ticket_phone → 
awaiting_ticket_description → [CREATE TICKET] → idle (cooldown 6 jam)
```

### 2. Upgrade Bandwidth
```
idle → awaiting_upgrade_customer_id → awaiting_upgrade_package → 
[CREATE TICKET] → idle (cooldown 6 jam)
```

### 3. Instalasi Baru
```
idle → awaiting_install_name → awaiting_install_address → 
awaiting_install_phone → [CREATE TICKET] → idle (cooldown 6 jam)
```

### 4. Bicara dengan CS
```
idle → status='human' (manual reply dari dashboard)
```

### 5. Idle
```
Menu utama, AI/template response
```

## AI Integration

### Enable AI per Bot

```json
{
  "ai_enabled": true,
  "ai_provider": "openai",
  "ai_model": "gpt-4o-mini",
  "ai_api_key": "sk-...",
  "system_prompt": "Anda adalah CS MAZNET..."
}
```

### Supported Providers

- **OpenAI**: gpt-4o-mini, gpt-4o, gpt-3.5-turbo
- **Gemini**: gemini-2.0-flash, gemini-1.5-pro
- **Claude**: claude-3-haiku, claude-3-sonnet
- **OpenRouter**: openai/gpt-4o-mini, anthropic/claude-3-haiku
- **Custom API**: Ollama, vLLM, atau API compatible lainnya

### Template Response (AI Disabled)

Jika `ai_enabled=false`, bot akan balas dengan template:
```
Halo Sobat MAZNET! 👋

Selamat datang di layanan CS MAZNET. Silakan pilih opsi:

1️⃣ Buat Ticket
2️⃣ Upgrade Bandwidth
3️⃣ Instalasi Baru
4️⃣ Bicara dengan CS

Balas dengan nomor (1/2/3/4)
```

## Cooldown System

- **6 jam cooldown** setelah buat ticket (maintenance/upgrade/instalasi)
- **Auto-clear** jika ticket dihapus atau status `closed`/`resolved`
- **Bypass**: `/start`, `/stop`, `menu`, `batal`, atau pilih "Bicara dengan CS"

## Security

### Encryption

Semua sensitive data dienkripsi dengan AES-256-GCM:
- `ai_api_key` (OpenAI, Gemini, Claude, dll)
- `api_key` (WhatsApp Business API token)

Format: `enc:<base64-iv>:<base64-tag>:<base64-ct>`

### Masked Response

API response tidak pernah return raw key:
```json
{
  "ai_api_key": "••••abc123",
  "api_key": "••••xyz789"
}
```

## Frontend (TODO)

Anda perlu membuat UI untuk:

1. **WhatsApp Bots Management** (mirip `TelegramBots.jsx`):
   - List bots
   - Create/Edit/Delete bot
   - Connect/Disconnect button
   - QR code display (Baileys)
   - Test message
   - Check AI

2. **WhatsApp Conversations** (mirip `ContactMessages.jsx`):
   - List conversations
   - Chat bubble UI
   - Reply input
   - AI/Human toggle
   - Auto-refresh

3. **Tickets** (update existing):
   - Tambah badge "WhatsApp" atau "Telegram" berdasarkan `source`
   - Filter by source

## Migration dari Baileys ke Business API

Ketika Anda siap production:

1. **Buat bot baru** dengan `provider: 'business-api'`
2. **Copy AI config** dari bot Baileys lama
3. **Disconnect** bot Baileys
4. **Connect** bot Business API
5. **Delete** bot Baileys (optional)

Semua conversation & ticket history tetap tersimpan!

## Troubleshooting

### Baileys tidak connect

- Pastikan QR code di-scan dalam 60 detik
- Cek folder `server/data/whatsapp-sessions/bot-{id}` ada session
- Restart server jika stuck

### Business API tidak terima pesan

- Cek webhook URL sudah benar di provider console
- Cek `WEBHOOK_VERIFY_TOKEN` di `.env`
- Test webhook dengan curl:
  ```bash
  curl -X POST https://yourdomain.com/api/whatsapp/webhook/1 \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  ```

### AI tidak respon

- Cek `ai_enabled=1`
- Cek `ai_api_key` sudah diisi
- Test AI dengan endpoint `/api/whatsapp/check-ai`
- Cek log server untuk error

## Next Steps

1. ✅ Backend implementation (DONE)
2. ⏳ Frontend UI (WhatsApp Bots page)
3. ⏳ Frontend UI (WhatsApp Conversations page)
4. ⏳ Update Tickets page (add source badge)
5. ⏳ Testing dengan real WhatsApp number
6. ⏳ Production deployment dengan Business API

## Support

Jika ada pertanyaan atau issue, silakan buka issue di repository atau hubungi tim development.

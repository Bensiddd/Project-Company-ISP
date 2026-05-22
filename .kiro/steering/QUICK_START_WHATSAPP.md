# Quick Start - WhatsApp Integration

## 🚀 5 Menit Setup

### Step 1: Install Dependencies (1 menit)

```bash
cd server
npm install
```

Dependencies baru yang akan terinstall:
- `@whiskeysockets/baileys` - WhatsApp Web protocol
- `@hapi/boom` - Error handling
- `qrcode-terminal` - QR code display

### Step 2: Run Migration (30 detik)

```bash
node server/migrate.js
```

Output yang diharapkan:
```
Running migrations...
All tables created successfully.
Encrypted X ai_api_key value(s) in whatsapp_bots.
```

### Step 3: Start Server (30 detik)

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
npm run dev
```

Server akan otomatis initialize WhatsApp bots yang aktif.

### Step 4: Create WhatsApp Bot (2 menit)

1. Buka browser: `http://localhost:5173/admin`
2. Login: `admin@maznet.id` / `admin123`
3. Menu: **WhatsApp Bots** → **+ Add Bot**
4. Isi form:
   ```
   Bot Name: MAZNET CS Bot
   Phone Number: 628123456789
   Provider: Baileys (Development/Testing)
   Role: Customer Service (AI)
   AI Enabled: ☐ (unchecked untuk testing)
   Active: ☑ (checked)
   ```
5. Click **Save**

### Step 5: Connect & Scan QR (1 menit)

1. Click **Connect** pada bot card
2. QR code akan muncul di card
3. Buka WhatsApp di HP → **Linked Devices** → **Link a Device**
4. Scan QR code
5. Status berubah jadi **Connected** ✅

### Step 6: Test! (30 detik)

1. Kirim pesan ke nomor bot dari WhatsApp Anda
2. Bot akan balas dengan menu:
   ```
   Halo Sobat MAZNET! 👋

   Selamat datang di layanan CS MAZNET. Silakan pilih opsi:

   1️⃣ Buat Ticket
   2️⃣ Upgrade Bandwidth
   3️⃣ Instalasi Baru
   4️⃣ Bicara dengan CS

   Balas dengan nomor (1/2/3/4)
   ```
3. Balas dengan **1** untuk test buat ticket
4. Bot akan minta nama, ID pelanggan, alamat, dll
5. Setelah selesai, ticket akan muncul di **Ticketing** dengan badge **📱 WhatsApp**

---

## 🎯 Test Scenarios

### Scenario 1: Template Response (No AI)

**Setup:**
- AI Enabled: ☐ (unchecked)

**Test:**
1. Kirim: "Halo"
2. Bot balas: "Ada yang bisa saya bantu?" + menu
3. Kirim: "Terima kasih"
4. Bot balas: "Sama-sama! Ada lagi yang bisa saya bantu? 😊"

### Scenario 2: AI Response (With OpenAI)

**Setup:**
- AI Enabled: ☑ (checked)
- AI Provider: OpenAI
- AI Model: gpt-4o-mini
- AI API Key: sk-...

**Test:**
1. Kirim: "Berapa harga paket internet 50Mbps?"
2. Bot balas dengan AI response (context-aware)
3. Kirim: "Bagaimana cara upgrade?"
4. Bot balas dengan AI response (mengingat context sebelumnya)

### Scenario 3: Create Ticket

**Test:**
1. Kirim: "1" (Buat Ticket)
2. Bot: "Silakan masukkan Nama Anda:"
3. Kirim: "John Doe"
4. Bot: "Silakan masukkan ID Pelanggan Anda:"
5. Kirim: "12345"
6. Bot: "Silakan masukkan Alamat lengkap Anda:"
7. Kirim: "Jl. Raya No. 123"
8. Bot: "Silakan masukkan Nomor HP Anda:"
9. Kirim: "08123456789"
10. Bot: "Silakan tulis keluhan Anda dengan detail:"
11. Kirim: "Internet sering putus"
12. Bot: "✅ Laporan gangguan Anda telah diterima. Tim kami akan segera menangani."
13. Check dashboard **Ticketing** → ticket baru dengan badge **📱 WhatsApp**

### Scenario 4: Human Mode

**Test:**
1. Kirim: "4" (Bicara dengan CS)
2. Bot: "💬 Anda sekarang terhubung dengan CS MAZNET..."
3. Kirim: "Saya butuh bantuan"
4. Bot tidak balas (waiting for human)
5. Buka dashboard **WhatsApp Messages**
6. Pilih conversation
7. Ketik reply: "Halo, ada yang bisa dibantu?"
8. User terima pesan dari CS
9. Click **Switch to AI** untuk kembali ke AI mode

---

## 🔧 Common Issues & Solutions

### Issue 1: QR Code tidak muncul

**Solution:**
```bash
# Check server log
cd server
npm run dev

# Look for:
[Baileys] QR Code generated for bot 1
```

Jika tidak ada, restart server.

### Issue 2: Bot disconnect setelah scan

**Solution:**
- Pastikan session folder ada: `server/data/whatsapp-sessions/bot-1/`
- Jangan hapus folder ini
- Restart server untuk reconnect

### Issue 3: Pesan tidak masuk ke dashboard

**Solution:**
1. Check bot status: **Connected** ✅
2. Check conversation list: **WhatsApp Messages**
3. Refresh page (F5)
4. Check server log untuk error

### Issue 4: AI tidak respon

**Solution:**
1. Check **AI Enabled** ☑
2. Check **AI API Key** sudah diisi
3. Test AI: Click **🧠 Test AI dengan nilai form saat ini**
4. Jika error, check API key valid

---

## 📱 Production Setup (Business API)

### Meta Cloud API (Recommended)

**Step 1: Setup di Meta Developer Console**

1. Buka https://developers.facebook.com
2. Create App → Business → WhatsApp
3. Get **Phone Number ID** & **Access Token**
4. Set webhook:
   - URL: `https://yourdomain.com/api/whatsapp/webhook/1`
   - Verify Token: (set di `.env` sebagai `WEBHOOK_VERIFY_TOKEN`)
   - Subscribe to: `messages`

**Step 2: Create Bot di Dashboard**

```
Bot Name: MAZNET Production
Phone Number: YOUR_PHONE_NUMBER_ID (dari Meta)
Provider: Business API (Production)
API Key: YOUR_ACCESS_TOKEN (dari Meta)
Webhook URL: https://yourdomain.com/api/whatsapp/webhook/1
Role: Customer Service (AI)
AI Enabled: ☑
AI Provider: OpenAI
AI API Key: sk-...
Active: ☑
```

**Step 3: Connect**

Click **Connect** → Bot langsung aktif (no QR needed)

**Step 4: Test**

Kirim pesan ke nomor WhatsApp Business Anda → Bot balas otomatis

---

## 🎓 Tips & Best Practices

### Development
- ✅ Gunakan Baileys untuk testing
- ✅ Jangan commit session folder ke git
- ✅ Test semua state machine flow
- ✅ Test AI dengan berbagai provider

### Production
- ✅ Gunakan Business API (Meta/Twilio/360dialog)
- ✅ Setup webhook dengan HTTPS
- ✅ Monitor bot status
- ✅ Backup conversation data
- ✅ Set rate limiting

### Security
- ✅ Jangan expose API keys
- ✅ Gunakan ENCRYPTION_KEY yang kuat
- ✅ Jangan ganti ENCRYPTION_KEY setelah ada data
- ✅ Set WEBHOOK_VERIFY_TOKEN yang random

### Performance
- ✅ Monitor memory usage (Baileys bisa memory-intensive)
- ✅ Restart bot jika memory leak
- ✅ Use Business API untuk high traffic
- ✅ Consider message queue untuk scale

---

## 📊 Monitoring

### Check Bot Status

```bash
# Via API
curl http://localhost:3001/api/whatsapp/bots/1/status

# Response:
{
  "status": "connected",
  "qr_code": null
}
```

### Check Conversations

```bash
# Via API
curl http://localhost:3001/api/whatsapp-conversations

# Response:
[
  {
    "id": 1,
    "bot_id": 1,
    "chat_id": "628123456789",
    "user_name": "John Doe",
    "status": "ai",
    "unread": 2,
    ...
  }
]
```

### Check Server Logs

```bash
cd server
tail -f server.log

# Look for:
[WhatsApp] Bot 1 (MAZNET CS Bot) initialized with baileys
[WhatsApp] Message handling error: ...
```

---

## 🆘 Need Help?

1. **Check Documentation**:
   - `WHATSAPP_INTEGRATION.md` - Full guide
   - `IMPLEMENTATION_SUMMARY.md` - Technical details
   - `README.md` - Project overview

2. **Check Logs**:
   - Server: `server/server.log`
   - Error: `server/server-error.log`

3. **Debug Mode**:
   ```bash
   # Enable debug logging
   DEBUG=baileys* npm run dev
   ```

4. **Common Commands**:
   ```bash
   # Restart server
   cd server && npm run dev

   # Check migration
   node server/migrate.js

   # Check database
   docker exec -it maznet-mysql mysql -u root -proot maznet

   # Check tables
   SHOW TABLES;
   SELECT * FROM whatsapp_bots;
   SELECT * FROM whatsapp_conversations;
   ```

---

## ✅ Checklist

Before going to production:

- [ ] Tested Baileys QR scan
- [ ] Tested all state machine flows
- [ ] Tested AI responses
- [ ] Tested human mode
- [ ] Tested ticket creation
- [ ] Setup Business API
- [ ] Setup webhook
- [ ] Test webhook delivery
- [ ] Monitor bot status
- [ ] Backup database
- [ ] Set rate limiting
- [ ] Document for team

---

**Selamat! WhatsApp bot Anda sudah siap! 🎉**

Untuk pertanyaan lebih lanjut, baca dokumentasi lengkap di `WHATSAPP_INTEGRATION.md`.

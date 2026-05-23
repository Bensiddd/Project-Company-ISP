# MAZNET ISP — Tasklist Rencana & Progress Pembangunan

File ini merangkum seluruh rencana tindakan (plans) yang telah selesai diimplementasikan, diuji, dan diverifikasi di dalam proyek MAZNET ISP Management System.

---

## 📋 Daftar Rencana & Status Eksekusi

### 1. Fungsionalitas WhatsApp Bot, AI Bugs & Reconnect Update
* **File Rencana**: `.hermes/plans/2026-05-23_220000-whatsapp-bot-ai-bugs.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Normalisasi trailing slash dan segment `/v1` pada input URL custom AI API provider di `server/services/ai-providers.js`.
  - [x] Modifikasi PUT handler di `server/routes/whatsapp-bots.js` untuk menghindari reset/reconnect aliran kredensial Baileys apabila tidak terdapat perubahan data kredensial atau status penting.
  - [x] Pengenalan validasi isian model dan fallback API check di `server/routes/whatsapp.js` untuk mencegah crash/error 500 saat pengujian konektivitas.

---

### 2. Keterbacaan Auth State Serializer
* **File Rencana**: `.hermes/plans/2026-05-23_221500-whatsapp-auth-state-readability.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Penambahan metadata summary terenkripsi/readable `_summary` pada berkas serialized state `auth-state.json` di `server/services/whatsapp/single-file-auth.js` untuk kemudahan inspeksi manual.

---

### 3. Custom Toggle & Toast UI Notification (Framer Motion)
* **File Rencana**: `.hermes/plans/2026-05-23_222000-whatsapp-toggle-and-toast.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Pembuatan komponen `Toast.jsx` dan file gaya `Toast.css` terintegrasi dengan pustaka **Framer Motion** untuk efek transisi dan rendering yang dinamis dan modern.
  - [x] Integrasi `ToastProvider` ke dalam akar aplikasi `src/App.jsx`.
  - [x] Pembuatan rute endpoint mandiri `POST /api/whatsapp-bots/:id/toggle` di `server/routes/whatsapp-bots.js` untuk mengubah status bot (aktif/nonaktif) secara atomic tanpa memicu reconnect siklus penuh.
  - [x] Pendaftaran pemanggilan rute toggle di modul API frontend `src/services/api.js`.
  - [x] Desain ulang toggle UI switch pada laman manajemen `src/pages/admin/WhatsAppBots.jsx` terhubung dengan loader state transisi serta implementasi custom toast useToast.

---

### 4. Aturan Cooldown Pembuatan Tiket & Auto-Reset Status
* **File Rencana**: `.hermes/plans/2026-05-23_223000-ticket-cooldown-rules.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Pembersihan pesan cooldown global spammer `"⏳ Mohon tunggu..."` dari obrolan bebas (AI & CS) pada platform WhatsApp (`message-handler.js`) dan Telegram (`telegram.js`).
  - [x] Integrasi handler database saat tiket diupdate ke status `closed` atau `resolved` di `server/routes/tickets.js` untuk mereset `cooldown_until` menjadi `NULL`.
  - [x] Integrasi handler database saat tiket dihapus secara individual maupun massal di `server/routes/tickets.js` untuk mereset `cooldown_until` menjadi `NULL`.

---

### 5. Perbaikan Bug Cooldown Terlewati pada WhatsApp Bot
* **File Rencana**: `.hermes/plans/2026-05-23_224500-fix-whatsapp-cooldown-bug.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Perbaikan bug hilangnya nilai balik Boolean `true` di akhir blok `try` fungsi `isCooldownBlocked` pada `server/services/whatsapp/message-handler.js`.
  - [x] Eksekusi uji coba unit testing (`test-cooldown-return.js`) untuk memverifikasi alur intersep bypass dan state blocking pada WhatsApp bot berjalan dengan akurat.

---

### 6. Peringatan Cooldown Tiket dengan Waktu Tersembunyi
* **File Rencana**: `.hermes/plans/2026-05-23_230000-ticket-cooldown-hidden-time.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Penambahan intersep pesan statis `'⏳ Anda memiliki laporan aktif yang sedang diproses. Silakan hubungi CS jika memerlukan bantuan mendesak.'` di `handleMenuSelection` (WhatsApp) saat pelanggan memilih opsi tiket 1, 2, atau 3 selama masa cooldown aktif.
  - [x] Penambahan intersep pesan statis serupa pada `processCallbackQuery` (Telegram) saat pelanggan mengklik tombol tiket, disertai dengan flash notifikasi callback visual tipis di bagian atas aplikasi Telegram.

---

### 7. Pembatasan Token Maksimum AI Provider (Input/Output)
* **File Rencana**: `.hermes/plans/2026-05-23_231500-reduce-max-tokens.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Pengurangan batas maksimum token (`max_tokens` / `maxOutputTokens`) dari `500` menjadi `200` token pada OpenAI payload (`callOpenAI`) di `server/services/ai-providers.js`.
  - [x] Pengurangan batas serupa menjadi `200` pada Gemini payload (`callGemini`).
  - [x] Pengurangan batas serupa menjadi `200` pada Claude payload (`callClaude`).
  - [x] Pengurangan batas serupa menjadi `200` pada Custom API payload (`callCustom`).

---

### 8. Auto-Switch dari CS (Human) ke AI Setelah Inaktif 5 Menit
* **File Rencana**: `.hermes/plans/2026-05-23_233000-cs-auto-switch-to-ai.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Deteksi dinamis status percakapan `'human'` pada handler WhatsApp (`message-handler.js`) dan Telegram (`telegram.js`) saat menerima pesan masuk terbaru dari pelanggan.
  - [x] Pencarian waktu pesan terakhir yang dikirim oleh bot/CS di basis data.
  - [x] Pengalihan otomatis status percakapan kembali ke `'ai'` jika terdeteksi waktu inaktivitas respon CS melebihi batas waktu 5 menit.
  - [x] Pengiriman notifikasi transisi otomatis ramah ke chat pelanggan dan langsung memproses pesan terbaru mereka dengan AI pada turn percakapan yang sama.

---

### 9. Proaktif CS Timeout & Notifikasi Chat Masuk Khusus Panel Admin
* **File Rencana**: `.hermes/plans/2026-05-23_235900-proactive-cs-timeout-notification.md` & `.hermes/plans/2026-05-23_234500-whatsapp-incoming-cs-notification.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Pembuatan background worker polling `server/services/cs-timeout-worker.js` (berjalan setiap 30 detik) untuk mendeteksi timeout CS 5 menit secara proaktif baik di WhatsApp maupun Telegram.
  - [x] Pengiriman pesan pemberitahuan timeout proaktif ke nomor pelanggan target serta pengalihan otomatis status percakapan kembali ke `'ai'` tanpa menuntut tindakan obrolan baru dari pelanggan.
  - [x] Integrasi filter notifikasi pada halaman admin `src/pages/admin/WhatsAppMessages.jsx` menggunakan `notifiedConvosRef` untuk memicu audio chime Mixkit dan Toast popup hanya saat pesan baru masuk pada percakapan berstatus `'human'`. Obrolan berstatus `'ai'` diabaikan (senyap).

---

### 10. Penyempurnaan Chime Synthesizer & Auto-Switch Proaktif AI Instan
* **File Rencana**: `.hermes/plans/2026-05-24_001500-proactive-ai-trigger-on-timeout.md`
* **Status**: 🟢 **SELESAI (COMPLETED)**
* **Detail Implementasi**:
  - [x] Pemasangan **Web Audio API** chime sound synthesizer (`playChimeSound()`) lokal pada frontend `WhatsAppMessages.jsx` untuk performa andal bebas dependensi internet & cross-origin.
  - [x] Pemasangan document `click` listener untuk membuka kunci Audio Context secara global pada browser untuk kenyamanan audio seamless.
  - [x] Modifikasi background worker `cs-timeout-worker.js` untuk langsung memproses dan mengirimkan jawaban AI atas keluhan pelanggan terakhir secara instan tepat setelah notifikasi timeout terkirim (tanpa menunggu input baru).

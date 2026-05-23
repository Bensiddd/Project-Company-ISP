# Rencana Implementasi: Intersep Pesan Obrolan Selama Masa Cooldown Laporan Aktif

Rencana ini dibuat untuk menangani situasi di mana seorang pelanggan yang memiliki tiket aktif (dalam masa cooldown) mengirimkan pesan teks bebas ke bot.

## 1. Masalah
Saat pelanggan sudah berhasil membuat tiket (cooldown aktif), jika mereka mengirimkan pesan teks biasa (misalnya *"hallo pak"*, *"bagaimana status internet saya?"*), bot saat ini:
- Mengabaikan cooldown jika bot.ai_enabled mati dan memicu template, atau
- Memproses pesan langsung menggunakan AI (OpenAI/Gemini/dll) yang mungkin memberikan jawaban umum, bukannya mengingatkan status tiket aktif mereka.
- Pelanggan tidak mendapatkan pemberitahuan yang jelas bahwa tiket mereka sedang diproses dan mereka harus menunggu.

## 2. Pendekatan Solusi
Kami akan menyisipkan intersep pengecekan `isCooldownBlocked` tepat sebelum pemanggilan modul AI atau modul Template pada sistem penanganan pesan WhatsApp dan Telegram.

Jika terdeteksi cooldown aktif:
1. Kirimkan pesan intersep yang ramah:
   `⏳ Anda memiliki laporan aktif yang sedang diproses. Silakan hubungi CS jika memerlukan bantuan mendesak.`
2. Simpan pesan bot tersebut ke database.
3. Hentikan eksekusi turn pesan saat itu juga (return) tanpa memanggil AI / template.

## 3. Berkas yang Akan Diubah

### WhatsApp Handler
- `server/services/whatsapp/message-handler.js`
  - Sisipkan intersep tepat sebelum pemanggilan `handleAIResponse` dan `handleTemplateResponse`.

### Telegram Handler
- `server/routes/telegram.js`
  - Sisipkan helper `isCooldownBlocked` (atau panggil yang sudah didefinisikan jika ada).
  - Sisipkan intersep tepat sebelum pemanggilan blok `bot.ai_enabled`.

import 'dotenv/config';
import db from './db.js';
import bcrypt from 'bcryptjs';

const hash = bcrypt.hashSync('admin123', 10);

await db.init();

// Use INSERT IGNORE to preserve existing row IDs for FK references
await db.run('INSERT IGNORE INTO admin_users (id, username, password_hash, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [1, 'superadmin', hash, 'superadmin@maznet.id', 'Administrator', 'administrator', 1]);
await db.run('INSERT IGNORE INTO admin_users (id, username, password_hash, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [2, 'admin', hash, 'admin@maznet.id', 'Admin MAZNET', 'administrator', 1]);
await db.run('INSERT IGNORE INTO admin_users (id, username, password_hash, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [3, 'teknisi', hash, 'teknisi@maznet.id', 'Teknisi MAZNET', 'admin', 1]);
await db.run('INSERT IGNORE INTO admin_users (id, username, password_hash, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [4, 'cs', hash, 'cs@maznet.id', 'Customer Service', 'cs', 1]);
await db.run('INSERT IGNORE INTO admin_users (id, username, password_hash, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [5, 'marketing', hash, 'marketing@maznet.id', 'Marketing MAZNET', 'marketing', 1]);

await db.run('INSERT IGNORE INTO coverage_areas (id, name, description, is_active) VALUES (?, ?, ?, ?)', [1, 'Kabupaten Bekasi', 'Pusat layanan utama MAZNET dengan jangkauan fiber optik terluas.', 1]);
await db.run('INSERT IGNORE INTO coverage_areas (id, name, description, is_active) VALUES (?, ?, ?, ?)', [2, 'Wanasari', 'Wilayah padat penduduk dengan kebutuhan internet tinggi untuk WFH dan sekolah online.', 1]);
await db.run('INSERT IGNORE INTO coverage_areas (id, name, description, is_active) VALUES (?, ?, ?, ?)', [3, 'Wanajaya', 'Area pengembangan baru dengan potensi besar untuk layanan internet fiber optik.', 1]);
await db.run('INSERT IGNORE INTO coverage_areas (id, name, description, is_active) VALUES (?, ?, ?, ?)', [4, 'Selang', 'Kawasan strategis dengan banyak UMKM dan bisnis rumahan yang butuh internet cepat.', 1]);

await db.run('INSERT IGNORE INTO service_packages (id, name, description, type, price, bandwidth, features, is_active, popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [1, 'Starter', 'Cocok untuk rumah tangga dengan kebutuhan internet harian. Browsing, streaming, dan media sosial lancar tanpa hambatan.', 'monthly', 160000, '10 Mbps', JSON.stringify(['Fiber Optik', 'WiFi Router Gratis', 'Support 24/7', 'Instalasi Gratis', 'No FUP']), 1, 0]);
await db.run('INSERT IGNORE INTO service_packages (id, name, description, type, price, bandwidth, features, is_active, popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [2, 'Professional', 'Untuk keluarga atau usaha kecil yang butuh koneksi lebih kencang dan stabil.', 'monthly', 400000, '50 Mbps', JSON.stringify(['Fiber Optik', 'Static IP', 'WiFi 6 Router', 'Priority Support', 'Instalasi Gratis', 'No FUP']), 1, 1]);
await db.run('INSERT IGNORE INTO service_packages (id, name, description, type, price, bandwidth, features, is_active, popular) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [3, 'Enterprise', 'Solusi dedicated untuk perusahaan, kantor, dan organisasi. Bandwidth penuh, prioritas tertinggi.', 'dedicated', 0, 'Custom', JSON.stringify(['Bandwidth Dedicated', 'SLA Guarantee', '24/7 On-site Support', 'Static IP Multiple', 'Managed Router', 'On-premise Maintenance']), 1, 0]);

await db.run('INSERT IGNORE INTO website_settings (id, company_name, tagline, description, address, phone, email, facebook_url, twitter_url, instagram_url, linkedin_url, youtube_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [1, 'MAZNET', 'Internet Cepat, Harga Bersahabat', 'Penyedia layanan internet RT RW NET terbaik se-Kabupaten Bekasi.', 'Perumahan Grand Wisata, Kab. Bekasi', '(021) 1234-5678', 'info@maznet.id', 'https://facebook.com/maznet.id', 'https://twitter.com/maznet_id', 'https://instagram.com/maznet.id', 'https://linkedin.com/company/maznet', 'https://youtube.com/@maznet']);

await db.run('INSERT IGNORE INTO clients (id, company_name, contact_person, email, industry, is_active) VALUES (?, ?, ?, ?, ?, ?)', [1, 'Perumahan Grand Wisata', 'Pak RT 03', 'rt03@grandwisata.com', 'Residential', 1]);
await db.run('INSERT IGNORE INTO clients (id, company_name, contact_person, email, industry, is_active) VALUES (?, ?, ?, ?, ?, ?)', [2, 'Kantor Kecamatan Bekasi Timur', 'Budi Santoso', 'budi@bekasitimur.go.id', 'Government', 1]);
await db.run('INSERT IGNORE INTO clients (id, company_name, contact_person, email, industry, is_active) VALUES (?, ?, ?, ?, ?, ?)', [3, 'SMPN 1 Bekasi', 'Dewi Lestari', 'dewi@smpn1bekasi.sch.id', 'Education', 1]);
await db.run('INSERT IGNORE INTO clients (id, company_name, contact_person, email, industry, is_active) VALUES (?, ?, ?, ?, ?, ?)', [4, 'Toko Serba Ada', 'Hendra Gunawan', 'hendra@tokoserbaada.com', 'Retail', 1]);
await db.run('INSERT IGNORE INTO clients (id, company_name, contact_person, email, industry, is_active) VALUES (?, ?, ?, ?, ?, ?)', [5, 'Klinik Sehat Bersama', 'dr. Fitriani', 'fitriani@kliniksehat.com', 'Healthcare', 1]);
await db.run('INSERT IGNORE INTO clients (id, company_name, contact_person, email, industry, is_active) VALUES (?, ?, ?, ?, ?, ?)', [6, 'Warnet Cemerlang', 'Hendra Gunawan', 'hendra@warnetcemerlang.com', 'Retail', 1]);

await db.run('INSERT IGNORE INTO testimonials (id, client_id, author_name, author_position, content, rating, is_approved, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [1, 1, 'Ahmad Fauzi', 'Warga Perumahan Grand Wisata', 'Setelah pindah ke MAZNET, internet di rumah jadi jauh lebih stabil. Anak-anak bisa streaming dan saya WFH tanpa kendala.', 5, 1, '2024-01-15']);
await db.run('INSERT IGNORE INTO testimonials (id, client_id, author_name, author_position, content, rating, is_approved, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [2, 4, 'Siti Rahmawati', 'Pemilik Toko Serba Ada', 'Paket Professional MAZNET sangat membantu bisnis online saya. Upload produk dan live streaming jualan jadi super cepat!', 5, 1, '2024-02-20']);
await db.run('INSERT IGNORE INTO testimonials (id, client_id, author_name, author_position, content, rating, is_approved, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [3, 2, 'Rudi Hermawan', 'Ketua RT 03/07, Bekasi Timur', 'Kerjasama dengan MAZNET untuk jaringan RT kami sangat memuaskan. Respon teknis cepat, harga terjangkau untuk warga.', 5, 1, '2024-03-10']);
await db.run('INSERT IGNORE INTO testimonials (id, client_id, author_name, author_position, content, rating, is_approved, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [4, 3, 'Dewi Lestari', 'Guru SMPN 1 Bekasi', 'Internet MAZNET sangat membantu proses belajar mengajar online di sekolah kami. Siswa jadi lebih semangat!', 5, 1, '2024-04-05']);
await db.run('INSERT IGNORE INTO testimonials (id, client_id, author_name, author_position, content, rating, is_approved, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [5, 6, 'Hendra Gunawan', 'Pemilik Warnet Cemerlang', 'Paket Dedicated MAZNET jadi andalan warnet saya. 20 PC jalan lancar tanpa lag, pelanggan puas!', 5, 1, '2024-05-12']);
await db.run('INSERT IGNORE INTO testimonials (id, client_id, author_name, author_position, content, rating, is_approved, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [6, 5, 'dr. Fitriani', 'Pemilik Klinik Sehat Bersama', 'Koneksi internet MAZNET stabil untuk telemedicine dan sistem antrian online klinik kami. Sangat membantu.', 4, 1, '2024-06-20']);

await db.run('INSERT IGNORE INTO blog_posts (id, title, slug, excerpt, category, author_id, status, published_at, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [1, 'Tips Memilih Paket Internet untuk Remote Working', 'tips-memilih-paket-internet-remote-working', 'Panduan lengkap memilih paket internet yang tepat untuk bekerja dari rumah.', 'Tips & Trik', 1, 'published', '2024-03-15', '5 min']);
await db.run('INSERT IGNORE INTO blog_posts (id, title, slug, excerpt, category, author_id, status, published_at, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [2, 'Perbedaan Fiber Optic dan ADSL: Mana yang Lebih Baik?', 'perbedaan-fiber-optic-adsl', 'Kenali perbedaan mendasar antara koneksi Fiber Optic dan ADSL.', 'Teknologi', 1, 'published', '2024-03-10', '7 min']);
await db.run('INSERT IGNORE INTO blog_posts (id, title, slug, excerpt, category, author_id, status, published_at, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [3, 'Cara Mengoptimalkan Jaringan WiFi di Rumah', 'cara-optimalkan-wifi-rumah', 'Tips sederhana untuk memaksimalkan sinyal WiFi di seluruh sudut rumah Anda.', 'Tutorial', 2, 'published', '2024-03-05', '6 min']);
await db.run('INSERT IGNORE INTO blog_posts (id, title, slug, excerpt, category, author_id, status, published_at, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [4, 'Promo Ramadan: Diskon 20% Pasang Baru MAZNET', 'promo-ramadan-2024', 'Nikmati diskon spesial Ramadan untuk pemasangan baru MAZNET di seluruh wilayah Bekasi.', 'Promo', 3, 'draft', null, '3 min']);

await db.run('INSERT IGNORE INTO contact_messages (id, name, email, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)', [1, 'Budi Santoso', 'budi@email.com', 'Info Pasang Baru', 'Saya ingin pasang internet MAZNET di rumah. Ada promo?', 'unread']);
await db.run('INSERT IGNORE INTO contact_messages (id, name, email, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)', [2, 'Dewi Lestari', 'dewi@email.com', 'Kerjasama RT', 'Saya ketua RT, ingin kerjasama untuk jaringan internet warga.', 'read']);
await db.run('INSERT IGNORE INTO contact_messages (id, name, email, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)', [3, 'Ahmad Fauzi', 'ahmad@email.com', 'Gangguan Jaringan', 'Internet saya dari tadi siang lambat, mohon dicek.', 'read']);
await db.run('INSERT IGNORE INTO contact_messages (id, name, email, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)', [4, 'Rudi Hermawan', 'rudi@email.com', 'Upgrade Paket', 'Saya ingin upgrade dari Starter ke Professional. Bagaimana caranya?', 'replied']);

// Telegram bot dummy — ganti bot_token dengan token real dari @BotFather
// Set is_active=1 dan role='customer_service' agar polling berjalan otomatis
await db.run('INSERT IGNORE INTO telegram_bots (id, name, bot_token, role, is_active, ai_enabled, ai_provider, ai_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [1, 'MAZNET CS Bot', 'YOUR_BOT_TOKEN_HERE', 'customer_service', 1, 0, 'openai', 'gpt-4o-mini']);

console.log('Seed data MAZNET inserted successfully.');
process.exit(0);

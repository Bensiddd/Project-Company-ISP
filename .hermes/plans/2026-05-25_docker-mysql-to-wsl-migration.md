# Migrasi MySQL dari Docker ke WSL Native

**Goal:** Pindahkan database MAZNET dari Docker MySQL container ke MySQL 8 yang diinstall langsung di WSL Debian 13. Hapus ketergantungan Docker untuk dev environment.

**Tanggal:** 2026-05-25

---

## Current State

- MySQL 8 berjalan di Docker Desktop Windows via `docker-compose.yml`
- Container: `maznet-mysql` (mysql:8), `maznet-phpmyadmin` (phpmyadmin)
- Volume: `project-company-isp_mysql_data` (~/Documents/Project/Project-Company-ISP)
- DB config di `server/.env`: host=127.0.0.1, user=root, pass=root, db=maznet, port=3306
- Container status: **stopped** (exited 5 min ago)
- WSL: Debian 13, MySQL belum terinstall
- Node.js backend → hanya perlu koneksi TCP ke MySQL, tidak ada dependency Docker-specific

## Target State

- MySQL 8 native di WSL Debian 13 (service berjalan)
- Semua data ter-migrasi (tabel, seed, WhatsApp sessions, uploads)
- `server/.env` tetap sama (127.0.0.1:3306 — sekarang pointing ke WSL MySQL)
- `docker-compose.yml` → mysql + phpmyadmin services disabled/dihapus
- Docker volume bisa dihapus setelah verifikasi sukses

---

## Rencana Langkah

### Fase 1: Dump Data dari Docker

1. **Start Docker containers** via `cmd.exe`:
   ```
   cd C:\Users\ben\Documents\Project\Project-Company-ISP
   docker compose up -d mysql
   ```
   Tunggu health check OK (~15 detik).

2. **Dump semua database** via `mysqldump` dari container:
   ```
   docker exec maznet-mysql mysqldump -uroot -proot --databases maznet --routines --triggers --events --single-transaction > dump.sql
   ```
   File dump disimpan di project root (WSL accessible via `/mnt/c/...`).

3. **Cek ukuran dump** — pastikan tidak kosong.

### Fase 2: Install MySQL 8 di WSL

4. **Install MySQL 8** di Debian 13:
   ```bash
   sudo apt update
   sudo apt install -y mysql-server
   ```
   Debian 13 pakai MariaDB by default — pastikan `mysql-server` package install MySQL 8 (atau tambahkan MySQL APT repo jika perlu).

5. **Start & enable MySQL service:**
   ```bash
   sudo service mysql start
   ```

6. **Set root password & auth:**
   ```bash
   sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root'; FLUSH PRIVILEGES;"
   ```
   MySQL 8 default pakai `auth_socket` — perlu diubah ke `mysql_native_password` agar `mysql2` Node.js driver bisa konek dengan user/password.

7. **Buat database `maznet`:**
   ```bash
   mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS maznet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

### Fase 3: Import Data

8. **Import dump ke WSL MySQL:**
   ```bash
   mysql -uroot -proot < /mnt/c/Users/ben/Documents/Project/Project-Company-ISP/dump.sql
   ```

9. **Verifikasi data:**
   ```bash
   mysql -uroot -proot maznet -e "SHOW TABLES; SELECT COUNT(*) FROM admin_users; SELECT COUNT(*) FROM clients; SELECT COUNT(*) FROM service_packages;"
   ```

### Fase 4: Test Backend

10. **Install Node.js deps di server/** (jika belum):
    Dari `cmd.exe`:
    ```
    cd C:\Users\ben\Documents\Project\Project-Company-ISP\server
    npm install
    ```

11. **Test koneksi backend:**
    Jalankan `node -e "import './server/db.js'; import db from './server/db.js'; await db.init(); const r = await db.get('SELECT 1 as ok'); console.log(r); process.exit(0)"` (dengan working dir server/) — pastikan konek.

12. **Jalankan migrate + seed (dry-run safe — pakai IF NOT EXISTS / INSERT IGNORE):**
    ```
    npm run setup
    ```
    Pastikan tidak error.

13. **Start backend dev server:**
    ```
    npm run dev
    ```
    Test login via frontend, cek data tampil.

### Fase 5: Cleanup Docker

14. **Stop containers:**
    ```
    docker compose down
    ```

15. **Opsional — hapus Docker volume** (setelah konfirmasi data OK):
    ```
    docker volume rm project-company-isp_mysql_data
    ```

16. **Update `docker-compose.yml`** — comment out atau hapus mysql + phpmyadmin services.

---

## File yang Berubah

| File | Perubahan |
|------|-----------|
| `docker-compose.yml` | Hapus/comment mysql + phpmyadmin services |
| `server/.env` | Tidak berubah (127.0.0.1:3306 tetap) |
| WSL MySQL config | Set root password, native auth |

## Validation Checklist

- [ ] MySQL service running di WSL (`sudo service mysql status`)
- [ ] `mysql -uroot -proot maznet` bisa connect
- [ ] Semua tabel ada (cek vs daftar di `migrate.js` + `seed.js`)
- [ ] Seed data lengkap (admin_users, clients, packages, settings, blog, testimonials)
- [ ] Backend `npm run dev` start tanpa error DB
- [ ] Frontend bisa login (superadmin / admin123)
- [ ] CRUD client, invoice, payment berfungsi
- [ ] WhatsApp sessions di `server/data/whatsapp-sessions/` masih ada (file-system, bukan di Docker)

## Risiko & Catatan

1. **MySQL vs MariaDB:** Debian 13 default package `mysql-server` mungkin menginstall MariaDB, bukan MySQL 8 Oracle. MariaDB kompatibel tapi ada perbedaan minor. Jika perlu MySQL 8 asli, tambahkan MySQL APT repository (`dev.mysql.com/downloads/repo/apt`).

2. **auth_socket → mysql_native_password:** MySQL 8 di Debian default pakai UNIX socket auth untuk root. Harus diubah agar `mysql2` bisa connect via TCP dengan user/password.

3. **Port conflict:** Jika ada service lain di port 3306 WSL, perlu diubah. Cek dulu: `ss -tlnp | grep 3306`.

4. **Dump dari container stopped:** Container harus distart dulu sebelum bisa `mysqldump`. Jika container corrupt/ga bisa start, alternatif: mount volume ke container temporary.

5. **WSL file lock:** Hindari operasi npm/node dari WSL — tetap pakai `cmd.exe` untuk npm install/run. MySQL install & config dilakukan di WSL.

6. **phpMyAdmin:** Tidak di-migrasi ke WSL. Kalau user butuh GUI, bisa pakai phpMyAdmin Docker container terpisah atau alternatif seperti DBeaver/TablePlus dari Windows.

7. **Backup dump.sql:** Simpan dump di project root sebagai backup. Jangan di-commit ke git (tambahkan ke `.gitignore`).

---

## Estimasi Waktu

- Dump: ~1 menit
- Install MySQL: ~3 menit
- Import: ~1 menit
- Test: ~5 menit
- **Total: ~10-15 menit**

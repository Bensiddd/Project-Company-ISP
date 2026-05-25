# Plan: Fix Blog Display + Mobile Responsive

**Date:** 2026-05-25  
**Branch:** `billing-payment`  
**Workspace:** `/home/bensid/project/Project-Company-ISP`

---

## Goal

1. Perbaiki blog section di Home yang kadang tidak tampil
2. Perbaiki service/pricing section di Home yang kadang tidak tampil
3. Buat seluruh halaman public responsive untuk mobile (≤768px)

---

## Analysis

### Bug 1: Blog Tidak Tampil (Intermittent)

**Akar masalah:**
- `Home.jsx` line 39-45 — fetch blog via `blogPostsAPI.getAll()`, tidak ada loading state, tidak ada error fallback
- Jika API gagal (DB pool exhausted, server restarting, network hiccup), `catch(console.error)` silent — user tidak lihat apa-apa
- Blog juga di-fetch bersamaan dengan coverage areas — jika satu gagal, tidak ada indikasi ke user
- `db.js` menggunakan `pool.execute()` — connectionLimit=10. Jika semua koneksi sibuk, request antri

**Fix:**
1. Tambah state `blogLoading`, `blogError` di `Home.jsx`
2. Tampilkan skeleton loader saat loading
3. Tampilkan pesan error / retry button jika gagal
4. Jangan hide section — selalu render, isi dengan skeleton atau fallback
5. Tambah `fallback: true` di section blog (always visible)

### Bug 2: Service/Pricing Tidak Tampil (Intermittent)

**Akar masalah:**
- `PricingSection.jsx` line 26-30 — fetch packages via `servicePackagesAPI.getAll()`, tidak ada loading state
- `catch(console.error)` — silent fail, section render empty (tidak ada card)
- Sama seperti blog: jika API gagal, user lihat section kosong

**Fix:**
1. Tambah state `pkgLoading`, `pkgError`, `pkgRetry` di `PricingSection.jsx`
2. Tampilkan skeleton cards saat loading (3 placeholder)
3. Tampilkan pesan error + retry button jika gagal
4. Always render section — isi dengan skeleton atau fallback

### Bug 3: Tidak Mobile Responsive

**Halaman yang perlu fix:**

| Page | File | Issue |
|------|------|-------|
| Home hero | `Home.css` | `h1` font 4rem, `hero-description` 1.2rem, `stats-grid` inline, `hero-actions` gap |
| Home about | `Home.css` | `about-story-grid` no responsive, `values-grid` 4 columns |
| Home coverage | `Home.css` | `coverage-grid` 3 columns no breakpoint |
| Home blog | `Home.css` | `blog-grid` 3 columns, already has `Blog.css` breakpoint but inconsistent |
| Home contact | `Home.css` + `Contact.css` | `contact-grid` 2 columns no breakpoint |
| Blog page | `Blog.css` | Has 768px breakpoint but grid 2 at 1024 — OK basic |
| About page | `About.css` | Need check |
| Services page | no specific CSS | PricingSection likely has grid |
| Header | `Header.css` | Breakpoints at 1024/768 OK, but `nav-actions` hide terlalu early |
| Footer | `Footer.css` | Need check |

**Approach:** Tambah media queries di `globals.css` + masing-masing page CSS untuk breakpoint 768px dan 480px.

---

## Step-by-Step

### Phase 1: Fix Blog di Home

1. **`src/pages/Home.jsx`** — Tambah state loading/error:
   - `blogLoading`, `blogError` state
   - Skeleton placeholder cards (3 items)
   - Error state: "Gagal memuat artikel" + retry button
   - Always render `#blog` section, tidak conditional

2. **`src/pages/Home.css`** — Tambah skeleton styling:
   - `.blog-skeleton` card style
   - `.blog-error` state
   - `.blog-retry-btn`

### Phase 1b: Fix Service/Pricing di Home

2b. **`src/components/PricingSection.jsx`** — Tambah state loading/error:
   - `loading`, `error` state
   - Skeleton placeholder cards (3 items)
   - Error state: "Gagal memuat paket" + retry button
   - Always render section

2c. **`src/components/PricingSection.jsx`** — Tambah skeleton + error styling di inline `<style>`

### Phase 2: Mobile Responsive — Home Page

3. **`src/pages/Home.css`** — Tambah media queries:
   - 768px: hero h1 → 2.25rem, description → 1rem, actions stack, stats flex-wrap
   - 768px: about `about-story-grid` → 1fr, `values-grid` → 2fr then 1fr at 480px
   - 768px: `coverage-grid` → 1fr
   - 768px: `blog-grid` → 1fr
   - 480px: extra fine-tuning

4. **`src/pages/About.css`** — Cek + tambah responsive:
   - 768px: grid single column

5. **`src/pages/Contact.css`** — Tambah responsive:
   - 768px: `contact-grid` single column

6. **`src/styles/globals.css`** — Tambah utility responsive:
   - `.container` padding reduced on mobile
   - `.section` padding reduced
   - `.section-title` font-size responsive

### Phase 3: Header & Navigation

7. **`src/components/Header.css`** — Fine-tune:
   - `nav-actions` → jangan hide di 1024, hide di 768
   - Mobile drawer smoother animation

### Phase 4: Blog Page

8. **`src/pages/Blog.css`** — Sudah ada breakpoint 768 → 1fr, cukup

### Phase 5: Pricing Section (Services)

9. **`src/components/PricingSection.jsx`** + CSS — Cek grid
   - 768px: single column cards

### Phase 6: Dashboard Mobile Responsive

11. **`src/App.css`** — Overhaul admin responsive:
    - Sidebar: collapse ke hamburger drawer di ≤768px (tidak menutup konten)
    - Stats cards: 1-col di ≤480px
    - Data tables: horizontal scroll, font-size reduced
    - Form modals: fullscreen di mobile, max-width adjusted
    - Blog editor: sidebar drop below di ≤1024px
    - Messages layout: single column full-screen

12. **`src/pages/admin/Dashboard.jsx`** — Tambah hamburger toggle untuk sidebar mobile

### Phase 7: Test All

13. **Browser test:**
    - Buka `localhost:5173` → resize ke 375px, 768px, 1024px+
    - Public pages: semua section terbaca, tidak overflow horizontal
    - Blog & Pricing: refresh + test offline → skeleton → error → retry
    - Admin: sidebar hamburger di mobile, modal fullscreen, table scrollable

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Home.jsx` | Loading/error state untuk blog |
| `src/pages/Home.css` | Skeleton + error styling + responsive media queries |
| `src/components/PricingSection.jsx` | Loading/error state + skeleton for services |
| `src/styles/globals.css` | Container padding, section spacing responsive |
| `src/pages/About.css` | Responsive grid |
| `src/pages/Contact.css` | Responsive grid |
| `src/pages/Blog.css` | Sudah OK, minor tuning |
| `src/components/Header.css` | Nav breakpoint adjustment |
| `src/components/Footer.css` | Responsive check |
| `src/App.css` | **Dashboard sidebar hamburger + mobile responsive** |
| `src/pages/admin/Dashboard.jsx` | **Sidebar toggle button for mobile** |

---

## Validation

- [ ] Home page: blog selalu render (skeleton saat loading, error message saat gagal)
- [ ] Home page: service/pricing selalu render (skeleton saat loading, error message saat gagal)
- [ ] Home page: semua section readable di 375px width
- [ ] Tidak ada horizontal scroll di mobile
- [ ] Header hamburger berfungsi di ≤768px
- [ ] Teks tidak terpotong/font terlalu besar di mobile
- [ ] Form contact bisa diisi di mobile
- [ ] Blog page: grid 1 column di mobile

---

## Risks

- **Low risk** — CSS-only changes, tidak menyentuh backend/API
- One gotcha: `viewport` once di framer-motion — pastikan animasi tetap trigger di mobile
- `StatsCounter` dan `PricingSection` komponen dipakai di Home — perlu dicek internal CSS-nya juga

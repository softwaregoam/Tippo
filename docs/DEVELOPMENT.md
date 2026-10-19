# Tippo Dev gratis

Development memakai branch GitHub `dev` dan Supabase lokal melalui Docker. Ini tidak memakai fitur Branching Supabase, proyek cloud tambahan, atau paket berbayar. `main` tetap untuk produksi. Akun dan data lokal terpisah dari pelanggan asli.

## Menjalankan di komputer sendiri

Pasang Node.js 22+ (divalidasi 24.19.0), Git, dan Docker Desktop. Di Windows, aktifkan WSL 2 untuk Docker Desktop. Buka Docker Desktop sebelum menjalankan perintah berikut di terminal:

```sh
git clone --branch dev https://github.com/softwaregoam/Tippo.git tippo-dev
cd tippo-dev
npm ci
node scripts/local-dev.mjs start
npm run dev
```

Jika repo sudah ada, periksa dan simpan perubahan lokal sebelum pindah ke `dev`; tidak perlu clone kedua kali. Supabase CLI 2.54.11 dipakai lewat npx tanpa instalasi global. Jika CLI sudah dipasang melalui metode lain, `SUPABASE_CLI_PATH` dapat menunjuk executable tersebut.

Unduhan image Docker pertama memerlukan waktu dan beberapa GB ruang. Script menyalakan database, Auth, Storage, Realtime, Studio, dan inbox email lokal; analytics, image proxy, pooler, dan Edge Runtime tidak dijalankan. Seluruh migrasi diterapkan saat database lokal pertama dibuat. Database dimulai kosong, tanpa salinan data produksi.

Di komputer yang menjalankannya, buka Tippo pada port 3000, Supabase Studio pada port 54323, dan inbox email lokal pada port 54324. Ini layanan lokal, bukan website dev publik. Buat akun uji melalui Daftar; konfirmasi email lokal dimatikan agar pengujian awal mudah. Email reset sandi masuk inbox lokal. Google login perlu konfigurasi OAuth lokal tersendiri dan tidak diaktifkan otomatis.

`start` membuat `.env.local` dengan URL loopback dan anon key lokal. File konfigurasi sebelumnya disimpan satu kali sebagai `.env.local.before-dev`, tanpa ditimpa pada startup berikutnya. Kedua file diabaikan Git. Service-role key dari status CLI tidak dimasukkan ke frontend. Jangan membagikan log `.local-dev`, karena output CLI bisa berisi kredensial lokal.

```sh
node scripts/local-dev.mjs status
node scripts/local-dev.mjs stop
```

`stop` mempertahankan data uji; menjalankan `start` lagi tidak mereset database. Jangan memakai `supabase stop --no-backup` atau `supabase db reset` kecuali memang ingin menghapus data lokal.

## Perubahan dan rilis

1. Kerjakan fitur di `dev` atau branch fitur dari `dev`.
2. Uji secara lokal. Gunakan akun dan transaksi fiktif.
3. Untuk migrasi baru, jalankan `node scripts/local-dev.mjs migrate`; perintah ini selalu menggunakan `db push --local`.
4. Tinjau perubahan sebelum rilis. Setelah pengguna menyetujui, terapkan kebutuhan backend produksi terlebih dahulu, lalu gabungkan ke `main` untuk deployment produksi.

Pemeriksaan yang tersedia: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, dan tes Playwright yang relevan. Playwright membaca `.env.local` dan menyesuaikan endpoint mock serta penyimpanan sesi dengan proyek yang sedang digunakan. Pengujian browser memakai API terkontrol; kelulusannya tidak membuktikan kesiapan database remote. Jangan mengaktifkan pembayaran produksi untuk menguji UI.

## Pengaman koneksi

`next.config.ts` memeriksa konfigurasi sebelum server/build development berjalan. Development menolak proyek Supabase produksi Tippo, URL yang tidak cocok dengan ref dev, admin key, serta flag pembayaran produksi. Mode lokal hanya menerima endpoint loopback pada port 54321. Tab browser memakai judul Tippo Dev, dan metadata dev meminta mesin pencari tidak mengindeksnya.

Jangan melewati pengaman untuk memakai `.env.local` produksi. `NEXT_PUBLIC_*` masuk bundle browser; nilai barunya memerlukan restart/build ulang.

## Vercel

Vercel Production Branch tetap `main`. `vercel.json` mematikan deployment otomatis hanya untuk branch `dev`; branch lain mengikuti konfigurasi hosting. Supabase lokal di komputer tidak dapat dipakai oleh website Preview publik: `127.0.0.1` di browser menunjuk komputer pengunjung. Karena belum ada backend dev cloud, jangan memakai Preview tersebut sebagai lingkungan uji online dan jangan menyalin konfigurasi Supabase produksi ke scope Preview.

Jika Preview dipicu secara manual atau dari branch fitur, build akan berhenti jika konfigurasi dev terpisah belum diisi. Itu disengaja. Review saat ini dilakukan pada lingkungan lokal. Jika nanti ada slot Supabase cloud gratis, buat proyek dev terpisah, aktifkan deployment `dev` di `vercel.json`, lalu isi scope **Preview saja**:

| Variabel | Nilai |
| --- | --- |
| `TIPPO_APP_ENV` | `development` |
| `TIPPO_DEV_SUPABASE_PROJECT_REF` | Ref proyek dev, 20 karakter |
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek dev |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key proyek dev |
| `NEXT_PUBLIC_DOKU_PRO_ENABLED` | `false` |
| `NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED` | `false` |
| `NEXT_PUBLIC_DOKU_SANDBOX_ENABLED` | `false` pada setup awal |

Daftarkan redirect `/auth/callback` dan `/atur-ulang-password` dari origin dev pada Supabase dev. Jangan mengubah nilai scope Production untuk mengaktifkan dev. Website Preview membutuhkan deploy ulang setelah environment diubah.

## Pembayaran

Semua flag pembayaran dimatikan pada startup lokal. Fitur inti bisa diuji tanpa DOKU. Pengujian pembayaran sandbox adalah tahap terpisah: perlu Edge Runtime/Function, kunci sandbox, dan webhook yang bisa dijangkau DOKU. Setup lokal ini tidak memasang router, mengubah callback produksi, atau membuat checkout nyata.


## Batas verifikasi lingkungan cloud

Build frontend development, pemeriksaan pembatas konfigurasi, dan seluruh urutan migrasi pada PostgreSQL PGlite sudah diuji. PGlite memodelkan schema layanan Supabase untuk menguji migrasi aplikasi; itu bukan pengujian layanan Auth/Storage Supabase lengkap. Docker cloud sesi ini menggunakan driver VFS dan disk 32 GB; pemasangan stack penuh dihentikan karena kebutuhan ruang image. Pengujian login dan penyimpanan melalui layanan Supabase lokal lengkap masih harus dilakukan pada Docker Desktop atau lingkungan Docker dengan kapasitas yang memadai. Jangan memakai hasil build atau tes PGlite sebagai bukti login lokal sudah berfungsi.

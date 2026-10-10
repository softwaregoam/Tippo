# Mengaktifkan akun dan database Tippo

Website memakai proyek Supabase yang diberikan pengguna. URL dan publishable key
sudah dipasang pada `.env.local` di workspace ini; file tersebut diabaikan Git.
Publishable key adalah kunci browser, bukan izin administrasi database. Tidak ada
service-role key di aplikasi. Jangan memasukkan service-role key ke variabel
`NEXT_PUBLIC_*`.

## Satu kali pada proyek Supabase

1. Buka SQL Editor pada proyek Supabase dan jalankan seluruh
   [migration awal](../supabase/migrations/202610080001_tippo_workspace.sql).
   Script memakai transaksi, tabel berawalan `tippo_`, dan tidak menghapus data.
2. Pada Authentication → Providers, aktifkan Email/password. Konfirmasi email
   disarankan tetap aktif. Supabase dapat membatasi pengiriman email bawaan;
   siapkan SMTP untuk peluncuran kepada pengguna nyata.
3. Pada Authentication → URL Configuration, set Site URL ke origin website
   produksi dan tambahkan redirect URL yang tepat:
   `/auth/callback` dan `/atur-ulang-password` pada origin tersebut.
   Untuk pengembangan, tambahkan URL kedua rute pada origin dev yang digunakan.
   Hindari wildcard origin produksi.
4. Pada penyedia hosting Next.js, isi `NEXT_PUBLIC_SUPABASE_URL` dan
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dengan nilai dari proyek. Kedua nilai
   dibaca saat build; rebuild setelah mengubahnya. `.env.example` menunjukkan
   nama variabel. Jangan memasukkan kunci admin.
5. Buat akun melalui `/daftar`, konfirmasi email, masuk melalui `/masuk`, catat
   batch/pesanan pada `/app`, lalu masuk menggunakan akun yang sama dari browser
   kedua untuk memastikan data tersimpan dan dapat dimuat kembali.

## Apa yang sudah dibangun

- Supabase Auth: daftar email/password, konfirmasi email, masuk, keluar, lupa
  kata sandi, dan pemulihan melalui tautan email. Halaman privat memakai
  autentikasi client, sementara setiap permintaan database diverifikasi oleh
  `auth.uid()` pada server. HTML publik tidak berisi transaksi akun.
- Workspace akun dimulai kosong. Demo pada `/demo` terpisah dan tetap memakai
  browser. Impor JSON adalah tindakan eksplisit; demo tidak diunggah otomatis.
- RLS membatasi pembacaan ke pemilik akun. Browser tidak diberi izin menulis
  langsung ke tabel, mengubah `pro_until`, atau menghapus ledger kuota.
- RPC `get_tippo_workspace` memuat/membuat workspace akun yang sedang masuk.
- RPC `save_tippo_workspace` memvalidasi data, mengunci row, memeriksa versi,
  memberi waktu pembuatan pesanan dari server, menguji kuota tiap jenis, dan
  menyimpan semuanya secara atomik. Kegagalan tidak menutup form atau mengubah
  data yang sudah tersimpan. Konflik perangkat meminta pemuatan versi terbaru.
- Ledger server mempertahankan kuota setelah reset/restore. Satu pesanan
  multi-barang memakai satu slot. Batas produk termasuk arsip. Pro yang habis
  tetap boleh mengedit data lama; penambahan baru mengikuti kuota Gratis.
- Data akun hanya berada dalam memori aplikasi dan Supabase. Data akun tidak
  disalin ke localStorage demo. Sesi autentikasi dikelola oleh SDK Supabase.

## Pengujian dan batas verifikasi

Migration sudah dieksekusi pada PostgreSQL lokal melalui PGlite. Tes menjalankan
RPC dengan role `authenticated`/`anon` dan dua akun, memeriksa RLS, kuota
terpisah, rollback, waktu server, konflik versi, restore, batas produk, dan
kedaluwarsa Pro. Browser menguji API Supabase dengan respons terkontrol untuk
memeriksa jalur aplikasi; ini bukan bukti integrasi proyek remote.

Permintaan read-only ke API Supabase remote pada sesi ini menghasilkan
`Tunnel connection failed: 403 Forbidden` dari proxy cloud. Draft jaringan
menambahkan `bkplemoflteubfgvqhke.supabase.co` sambil mempertahankan domain yang
ada. Review/save di Environment Settings, lalu Publish environment untuk
menerapkan konfigurasi yang diperlukan. Saving draft tidak menerapkannya pada
runtime. Uji remote perlu diulang setelah akses tersedia; status migration,
provider email, dan URL redirect pada proyek remote belum dapat diverifikasi.

Kunci publishable tidak dapat menjalankan SQL administrasi. Karena tidak ada
akses manajemen proyek, migration tidak diklaim sudah diterapkan pada Supabase.
Jika tabel/RPC belum tersedia, pengguna mendapat layar pemulihan, bukan data
demo yang ditampilkan seolah tersimpan di akun.

## Paket Pro

Harga Pro Rp25.000/bulan. Pembayaran nyata belum tersedia. Akun tidak mempunyai
tombol aktivasi Pro demo dan tidak mempercayai entitlement localStorage. Hanya
layanan pembayaran/server dengan hak yang sesuai boleh mengubah `pro_until`.
Checkout, verifikasi, webhook idempotent, dan audit pembayaran perlu dibangun
setelah provider pembayaran dipilih. Jangan menjual aktivasi demo sebagai
langganan berbayar.

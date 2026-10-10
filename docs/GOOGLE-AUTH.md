# Mengaktifkan login dan daftar Google

Tombol **Masuk dengan Google** tersedia pada `/masuk` dan `/daftar`.
Supabase membuat akun baru pada login Google pertama dan menggunakan akun
tersebut pada login berikutnya. Nama usaha dari form email tidak diperlukan
untuk Google; workspace tetap terpisah sesuai ID user. Nama ruang usaha menggunakan
label “Usaha kamu” jika metadata nama usaha belum diisi.

## Konfigurasi Google Cloud

1. Buka [Google Cloud Console](https://console.cloud.google.com/), pilih proyek,
   lalu atur Google Auth Platform: Branding, Audience, dan Data Access.
   Gunakan scope dasar `openid`, email, dan profil.
2. Buat OAuth Client ID dengan tipe **Web application**.
3. Tambahkan authorized JavaScript origin `https://tippo.vercel.app`.
4. Tambahkan authorized redirect URI berikut secara persis:
   `https://bkplemoflteubfgvqhke.supabase.co/auth/v1/callback`.
5. Jika aplikasi Google masih berstatus Testing, tambahkan akun yang akan
   menguji pada Test users. Atur publishing untuk penggunaan publik.

## Konfigurasi Supabase

1. Buka [proyek Supabase](https://supabase.com/dashboard/project/bkplemoflteubfgvqhke),
   lalu **Authentication → Sign In / Providers → Google**.
2. Aktifkan Google, masukkan Client ID dan Client Secret dari Google Cloud,
   lalu simpan. Secret disimpan di Supabase; jangan masukkan ke source,
   GitHub, atau variabel `NEXT_PUBLIC_*`.
3. Di **Authentication → URL Configuration**, gunakan Site URL
   `https://tippo.vercel.app` dan tambahkan redirect URL
   `https://tippo.vercel.app/auth/callback`.
4. Untuk development, tambahkan origin lokal dan redirect callback lokal
   dengan port yang dipakai. Tambahkan domain custom secara terpisah bila ada.

Dua callback memiliki fungsi berbeda: Google kembali ke **Supabase**, kemudian
Supabase kembali ke **Tippo**. Jangan menukar URL di kedua pengaturan tersebut.
Konfigurasi provider tidak memerlukan perubahan public key atau redeploy.

## Pemeriksaan

Klik Google pada halaman Masuk maupun Daftar tanpa mengisi field email,
pilih akun, lalu pastikan kembali ke `/app`. Tolak/batalkan izin Google untuk
memeriksa halaman pemulihan. Pastikan record pelanggan/pesanan tetap milik
akun yang benar. Akun Google baru memulai paket Gratis; Pro demo dari browser
tidak mengaktifkan Pro pada akun cloud.

Saat provider belum aktif, tombol menampilkan petunjuk untuk menggunakan
email dan mempertahankan isian form. Koneksi gagal juga dapat dicoba ulang.
Pengujian otomatis memakai respons Google/Supabase terkontrol; login Google
sungguhan harus diuji setelah Client ID, Secret, dan redirect diaktifkan.

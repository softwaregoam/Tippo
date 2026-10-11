# Kritik & saran

Menu Kritik & saran tersedia pada kedua mode untuk akun Gratis maupun Pro. Form memuat jenis masukan (kritik, saran, laporan masalah), bagian Tippo (umum/Jastip/PO), judul 3–120 karakter dan pesan 10–2.000 karakter. Pengiriman tidak memakai kuota pesanan atau mengubah workspace. Pengguna melihat konfirmasi hanya setelah Supabase mengembalikan hasil penyimpanan yang valid.

## Aktivasi database

Jalankan seluruh isi `supabase/migrations/202610110001_tippo_feedback.sql` di SQL Editor proyek Supabase Tippo. Migration dapat dijalankan ulang dan tidak menghapus data yang sudah ada. Migration belum dijalankan pada proyek produksi dari lingkungan ini: tersedia publishable key saja, tanpa koneksi/izin admin database. Setelah SQL berhasil dan website versi terbaru terdeploy, kirim masukan dari menu Kritik & saran. Buka Table Editor → tippo_feedback untuk melihat data sebagai pengelola proyek.

RPC submit_tippo_feedback menetapkan owner dari auth.uid() dan timestamp dari server; pengguna tidak dapat menentukan pemilik atau waktu pengiriman. Tabel memakai RLS: pengguna hanya dapat membaca masukan sendiri, tanpa hak update/delete/insert langsung. Pengelola melalui akses admin Supabase dapat membaca seluruh masukan. UUID permintaan dipakai untuk retry idempotent; isi/pemilik berbeda dengan ID sama ditolak. Payload yang diedit setelah gagal memakai ID baru. API menerima kategori/bagian terbatas dan memeriksa panjang teks di server.

Jika migration belum aktif, UI menampilkan error pengiriman, tidak menyatakan sukses, dan mempertahankan isi form selama halaman masih terbuka. Data yang belum dikirim tidak disimpan sebagai draf saat pengguna meninggalkan halaman. Email/notifikasi eksternal, lampiran, panel moderasi, dan riwayat masukan pengguna belum ditambahkan.

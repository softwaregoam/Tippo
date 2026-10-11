# Navigasi dan sesi akun

Back browser dapat membawa pengguna dari `/app` ke beranda. Sebelumnya header beranda selalu menawarkan Masuk dan Buat akun gratis, meskipun sesi Supabase masih tersimpan. Kini header berlangganan perubahan sesi dan menampilkan Buka usaha saya untuk akun yang masuk. Halaman login dan daftar mengarahkan sesi aktif ke `/app`; halaman pemulihan kata sandi tetap memakai alurnya sendiri.

Perubahan ini tidak menghapus sesi saat navigasi dan tidak melewati pemeriksaan sesi workspace. Tombol Keluar tetap menggunakan Supabase signOut. Tidak ditemukan pemanggilan signOut dari Back browser. Sesi yang kedaluwarsa atau dicabut tetap dapat mengharuskan login kembali.

Validasi: lint dan build berhasil. Empat tes browser pada production build lokal berhasil: pengunjung tanpa sesi ditolak, Back/Forward/reload mempertahankan token tanpa permintaan logout, login email, serta penyimpanan workspace dan logout. Tes navigasi juga memeriksa pengalihan login/daftar untuk sesi aktif dan header tamu setelah logout. Pengujian memakai mock Supabase, bukan akun produksi; deployment Vercel belum diverifikasi.

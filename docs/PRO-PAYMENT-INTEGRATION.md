# Invoice langganan Pro

Format draf terbaru: INV-PRO-YYYYMMDD-16KARAKTER, tanggal berdasarkan Asia/Jakarta dan suffix dari UUID acak. Tanggal dibuat ditampilkan lengkap dengan jam WIB, memakai timestamp pembuatan yang tersimpan, bukan waktu halaman dibuka. Draf lama dengan nomor UUID diubah secara deterministik ke format ini saat dibaca, tanpa mengubah tanggal atau status. Ketika integrasi server tersedia, keunikan nomor tetap harus ditegakkan oleh constraint server.

Tahap saat ini: draf invoice lokal pada Paket & langganan. Satu draf terakhir disimpan per ID akun di browser; bukan rekaman pembayaran, tidak tersinkron antarperangkat, dan tidak termasuk cadangan data pesanan. Nomor memakai UUID, waktu ditampilkan dalam Asia/Jakarta, paket 1 bulan dengan total Rp25.000. Dokumen dapat disalin atau diunduh sebagai teks. Pembuatan/ekspor tidak menulis workspace Supabase maupun mengubah entitlement Pro. Status draf tetap sampai integrasi pembayaran selesai.

API InterActive QRIS dan webhook belum tersedia. Jangan menggunakan draf browser sebagai invoice resmi, sumber nominal pembayaran, atau bukti pembayaran. Tidak ada tombol konfirmasi pembayaran manual, QR palsu, maupun aktivasi Pro dari klien.

## Tahap integrasi berikutnya

Setelah dokumentasi penyedia tersedia, pindahkan penciptaan dan riwayat invoice ke server/Supabase dengan kepemilikan akun. Server menetapkan paket, nominal IDR 25000, durasi, nomor invoice, masa berlaku pembayaran, dan referensi transaksi penyedia. UI menampilkan QRIS dinamis dari respons penyedia, beserta status invoice yang dibaca dari server. API key hanya berada pada environment server.

Webhook harus diverifikasi sesuai spesifikasi InterActive, lalu mencocokkan invoice, nominal, mata uang, merchant dan referensi transaksi. Update invoice dan pro_until dilakukan atomik serta idempotent: notifikasi duplikat tidak menambah masa Pro dua kali. Aktivasi menambah satu bulan kalender dari max(waktu pembayaran terverifikasi, pro_until yang masih aktif), dengan penyesuaian hari akhir bulan sebagaimana perhitungan proExpiry. Jangan menyatakan lunas dari redirect checkout atau tombol pengguna.

Status server nantinya mencakup pending, paid, expired dan failed sesuai kontrak penyedia. Riwayat, pemulihan setelah reload/perangkat lain, transaksi kedaluwarsa, pembayaran terlambat, serta retry webhook perlu diuji dengan sandbox penyedia. Kontrak ini merupakan rencana implementasi, bukan integrasi yang sudah dijalankan. Draf lama tidak boleh otomatis diubah menjadi transaksi terbayar.

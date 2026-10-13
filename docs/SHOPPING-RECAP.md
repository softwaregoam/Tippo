# Rekap belanja dan kebutuhan produk

Buka Perjalanan Jastip atau Batch PO. Pada desktop, tombol rekap berada di bawah nama batch. Pada ponsel, buka detail batch/perjalanan lalu pilih Rekap belanja atau Rekap kebutuhan produk. Klik Lihat pelanggan untuk melihat jumlah per pelanggan.

Rekap memakai seluruh pesanan dalam batch, kecuali yang dibatalkan. Toko/brand, nama produk, varian, warna dan ukuran yang sama digabung; opsi berbeda tetap dipisahkan. Pesanan lama yang belum menyimpan toko/brand masuk Belum ditentukan. Informasi diambil dari snapshot pesanan, bukan master saat ini.

Isi Toko / brand pada tiap produk di form Jastip. Untuk Open PO, isi Toko / brand, Warna, dan Ukuran di master produk; informasi disalin saat pesanan baru dibuat. Perubahan master tidak mengubah pesanan lama. Template Excel Jastip dan master Produk mendukung kolom opsional toko_brand; master juga mendukung warna dan ukuran. Berkas Excel lama tetap dapat diimpor.

Jalankan seluruh supabase/migrations/202610130012_shopping_recap.sql di Supabase SQL Editor untuk validasi field tambahan pada server. Migrasi dapat dijalankan ulang, mempertahankan aturan diskon/kuota dan menerima data lama tanpa field tambahan. Data tetap tersimpan di JSON workspace akun, dengan aturan akses akun yang sama.

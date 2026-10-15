# Unduhan rekap belanja

Buka rekap pada Batch PO atau Perjalanan, lalu pilih **Unduh Excel**. Satu file berisi:

- **Per produk:** grup, produk beserta varian/warna/ukuran, qty, harga jual/unit, total baris, total qty grup, dan total harga grup. Open PO memakai kategori katalog; Jastip memakai toko/brand. Nama dan total grup memakai sel gabungan dengan warna latar bergantian. Total keseluruhan di bagian bawah. Harga beli dan HPP tidak disertakan. Produk dengan harga jual berbeda dipisah per baris.
- **Per pesanan:** pemesan (dengan nomor dan tanggal pesanan), produk/varian, qty, harga jual/unit, subtotal jual, total pesanan, alamat kirim, harga beli/unit, subtotal beli, total HPP, dan margin produk. Nama, alamat, dan total digabung per pesanan; warna lembut bergantian. Total qty, penjualan produk, HPP dan margin berada di bawah.

Produk, harga, dan jumlah berasal dari snapshot pesanan. Kategori Open PO mengikuti master produk yang terhubung saat ekspor; tanpa tautan/kategori masuk **Tanpa kategori**. Produk arsip tetap dapat menjadi sumber kategori. Perubahan master tidak mengganti nama atau harga pada laporan.

Pesanan dibatalkan dan pesanan batch lain dikecualikan. Nilai jual hanya produk, tanpa fee, ongkir, diskon, refund, atau biaya langsung batch. HPP produk = qty × harga beli/unit yang dicatat pada masing-masing pesanan, termasuk jika produk yang sama dibeli dengan harga berbeda.

Pada sheet Per pesanan, harga beli kosong menghasilkan **Belum lengkap**, bukan nol. Total HPP dan margin pesanan ditandai **Belum lengkap** jika salah satu harga beli kosong. Total HPP dan margin keseluruhan juga belum ditampilkan sebagai angka hingga seluruh harga beli lengkap. Harga beli nol adalah nilai yang sudah diketahui.

Dua teks penjelasan panjang tidak ditampilkan dalam workbook.

Total dan subtotal merupakan angka siap baca, bukan formula Excel. Nama pelanggan dan teks produk disimpan sebagai teks biasa. Alamat pelanggan dicantumkan sebagai alamat kirim bila terisi. Nomor telepon dan catatan pelanggan tidak disertakan.

Tidak memerlukan migrasi database.

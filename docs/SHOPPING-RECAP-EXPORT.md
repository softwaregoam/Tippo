# Unduhan rekap belanja

Buka rekap pada Batch PO atau Perjalanan, lalu pilih **Unduh Excel**. Satu file berisi:

- **Per produk:** grup, produk beserta varian/warna/ukuran, qty, harga jual/unit, total baris, total qty grup, dan total harga grup. Open PO memakai kategori katalog; Jastip memakai toko/brand. Nama dan total grup memakai sel gabungan dengan warna latar bergantian. Total keseluruhan di bagian bawah. Harga beli dan HPP tidak disertakan. Produk dengan harga jual berbeda dipisah per baris.
- **Per pesanan:** nomor pesanan, pelanggan, tanggal, produk, qty, harga jual/unit, subtotal jual, harga beli/unit, HPP; subtotal pesanan dan total batch.

Produk, harga, dan jumlah berasal dari snapshot pesanan. Kategori Open PO mengikuti master produk yang terhubung saat ekspor; tanpa tautan/kategori masuk **Tanpa kategori**. Produk arsip tetap dapat menjadi sumber kategori. Perubahan master tidak mengganti nama atau harga pada laporan.

Pesanan dibatalkan dan pesanan batch lain dikecualikan. Nilai jual hanya produk, tanpa fee, ongkir, diskon, refund, atau biaya langsung batch. HPP produk = qty × harga beli/unit yang dicatat pada masing-masing pesanan, termasuk jika produk yang sama dibeli dengan harga berbeda.

Pada sheet Per pesanan, harga beli kosong menghasilkan **Belum lengkap**, bukan nol. **HPP diketahui** menjumlahkan bagian yang telah diisi; **Qty HPP belum diisi** menunjukkan unit yang belum memiliki harga beli. Harga beli nol adalah nilai yang sudah diketahui.

Dua teks penjelasan panjang tidak ditampilkan dalam workbook.

Total dan subtotal merupakan angka siap baca, bukan formula Excel. Nama pelanggan dan teks produk disimpan sebagai teks biasa. Nomor telepon, alamat, dan catatan pelanggan tidak disertakan.

Tidak memerlukan migrasi database.

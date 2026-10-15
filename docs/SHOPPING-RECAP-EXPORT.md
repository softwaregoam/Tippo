# Unduhan rekap belanja

Buka rekap pada Batch PO atau Perjalanan, lalu pilih **Unduh Excel**. Satu file berisi:

- **Per produk:** kombinasi kategori, toko, nama, varian, warna, dan ukuran; total qty; harga beli/unit; HPP; subtotal kategori dan total batch.
- **Per pesanan:** nomor pesanan, pelanggan, tanggal, produk, qty, harga jual/unit, subtotal jual, harga beli/unit, HPP; subtotal pesanan dan total batch.

Produk, harga, dan jumlah berasal dari snapshot pesanan. Kategori mengikuti master produk yang terhubung saat ekspor; tanpa tautan/kategori masuk **Tanpa kategori**. Produk arsip tetap dapat menjadi sumber kategori. Perubahan master tidak mengganti nama atau harga pada laporan.

Pesanan dibatalkan dan pesanan batch lain dikecualikan. Nilai jual hanya produk, tanpa fee, ongkir, diskon, refund, atau biaya langsung batch. HPP produk = qty × harga beli/unit yang dicatat pada masing-masing pesanan, termasuk jika produk yang sama dibeli dengan harga berbeda.

Harga beli yang berbeda pada kombinasi produk yang sama ditulis **Bervariasi**. Harga beli kosong menghasilkan **Belum lengkap**, bukan nol. **HPP diketahui** menjumlahkan bagian yang telah diisi; **Qty HPP belum diisi** menunjukkan unit yang belum memiliki harga beli. Harga beli nol adalah nilai yang sudah diketahui.

Total dan subtotal merupakan angka siap baca, bukan formula Excel. Nama pelanggan dan teks produk disimpan sebagai teks biasa. Nomor telepon, alamat, dan catatan pelanggan tidak disertakan.

Tidak memerlukan migrasi database.

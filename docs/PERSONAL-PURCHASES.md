# Belanja untuk sendiri

Pilih **Untuk sendiri** pada pilihan pelanggan di form pesanan Jastip atau Open PO. Pelanggan tidak diperlukan. Harga beli wajib, harga jual disimpan nol. Catatan, varian, warna, ukuran, supplier/toko dan pengiriman tetap bisa dipakai. Di Open PO, harga beli dapat diisi khusus untuk pesanan pribadi tanpa mengubah master produk.

Belanja pribadi tidak menghasilkan penjualan, pembayaran, piutang, invoice, diskon atau refund. Pesanan yang memiliki riwayat pembayaran tidak dapat dialihkan ke Untuk sendiri. Barang pribadi tetap masuk rekap kebutuhan belanja dan Excel per produk, termasuk qty dan harga beli sebenarnya. Rekap per pesanan memberi nama Untuk sendiri dan subtotal belanja pribadi; margin usaha hanya menghitung pesanan pelanggan.

Ringkasan dan Laporan menampilkan belanja pribadi terpisah. Ekspor Laporan menambah sheet Belanja pribadi bila ada data, dengan tanggal, batch, produk, qty dan biaya. Perhitungan HPP dan margin usaha serta alokasi biaya bersama batch tidak memasukkan pesanan pribadi. Biaya pribadi hanya harga beli barang; biaya bersama batch tetap dialokasikan ke pesanan usaha. Pesanan pribadi yang dibatalkan tidak dihitung dalam belanja atau rekap.

Semua pesanan, termasuk Untuk sendiri, tetap memakai kuota pesanan bulanan. Menghapus atau mengubah jenis pesanan tidak mengembalikan kuota. Salinan JSON mempertahankan penanda `purpose: personal`; impor ditolak jika mengandung penagihan atau harga beli yang belum lengkap pada pesanan pribadi. Data lama tanpa penanda tetap merupakan pesanan pelanggan.

Produksi memerlukan migrasi `supabase/migrations/202610200001_personal_purchases.sql`. Migrasi hanya memperluas validasi, tanpa mengubah data lama, RPC kuota, atau RLS. Validator memakai referensi pelanggan sementara untuk pemeriksaan aturan lama, tanpa menyimpan pelanggan tersebut ke workspace.

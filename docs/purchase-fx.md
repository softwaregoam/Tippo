# Harga beli valas Jastip

Pesanan lama dan Open PO tetap memakai harga beli rupiah. Pada detail produk Jastip, pengguna bisa memilih mata uang asing, memasukkan harga beli per unit serta kurs, atau mengambil kurs referensi melalui tombol Frankfurter. Semua tagihan dan harga jual tetap rupiah.

`OrderItem.purchaseFx` bersifat opsional dan menyimpan `currency`, `amount`, `rate`, `status` (`estimate`/`final`), `source` (`manual`/`frankfurter`), serta `rateDate` untuk kurs referensi API. Angka desimal disimpan sebagai string bertitik tanpa pemisah ribuan. Input menggunakan format Indonesia, misalnya `1.000,50`. Batas angka adalah 12 digit utuh dan 6 desimal.

`unitCost` tetap berupa rupiah bulat, dihitung per unit dengan pembulatan setengah ke atas memakai aritmetika integer. Nilainya harus cocok dengan metadata konversi. Harga beli atau kurs yang kosong menghasilkan `unitCost=null`, bukan nol. Final membutuhkan harga beli dan kurs lengkap. Kurs dan status tidak berubah otomatis setelah pesanan tersimpan. Beralih dari valas estimasi ke Rupiah mengosongkan biaya, agar perkiraan tidak diam-diam menjadi biaya final.

Frankfurter v1: `https://api.frankfurter.dev/v1/latest?from=JPY&to=IDR`. Tidak memerlukan API key. Dokumentasi: https://frankfurter.dev/v1/ . Hanya kode mata uang dari daftar tetap yang dikirim; identitas dan rincian pesanan tidak dikirim. Respons diperiksa pasangan mata uang, jumlah dasar satu, angka positif, dan tanggal referensi. Pengambilan memiliki timeout, pembatalan saat input berubah, dan pengisian manual jika layanan gagal. Kurs baru dari API selalu berstatus estimasi. Pengguna dapat menandai Final setelah biaya pembayaran diketahui.

Bantuan harga jual hanya mengisi harga jual setelah tombol Gunakan harga ini ditekan. Rumusnya harga beli rupiah × (1 + untung dari modal / 100), dibulatkan ke atas per rupiah. Tidak termasuk fee, ongkir, diskon, atau biaya bersama. Persentase kalkulator tidak disimpan sebagai aturan yang otomatis mengubah harga jual.

HPP & Margin dapat mengubah/finalisasi FX. HPP, laporan, dan ekspor yang mencakup FX estimasi ditandai. Backup JSON mempertahankan snapshot FX; impor menolak metadata atau nilai konversi yang tidak valid.

## Deployment Supabase

Jalankan seluruh `supabase/migrations/202610180001_purchase_fx.sql` di SQL Editor proyek Tippo. SQL memperluas validator workspace, tanpa mengubah tabel, data, atau fungsi kuota. Pengulangan migrasi sudah diuji. Perubahan Git tidak menjalankan SQL Supabase otomatis; penerapan produksi harus dikonfirmasi operator.

Validasi lokal menggunakan PGlite menguji konversi, metadata, status Final, mata uang, dan aturan kuota. Tes browser memakai mock Frankfurter dan Supabase untuk menghindari perubahan data produksi.

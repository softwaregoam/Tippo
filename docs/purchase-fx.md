# Harga beli valas Jastip

Mata uang harga beli Jastip dipilih pada batch. Kurs referensi otomatis diambil saat memilih mata uang dan membuka pesanan baru. Pada detail produk, pengguna memasukkan harga beli per unit, dan tetap dapat menyesuaikan kurs secara manual. Pesanan lama mempertahankan kurs tersimpan; Open PO tetap memakai rupiah. Semua tagihan dan harga jual tetap rupiah.

`OrderItem.purchaseFx` bersifat opsional dan menyimpan `currency`, `amount`, `rate`, `status` (`estimate`/`final`), `source` (`manual`/`frankfurter`), serta `rateDate` untuk kurs referensi API. Angka desimal disimpan sebagai string bertitik tanpa pemisah ribuan. Input menggunakan format Indonesia, misalnya `1.000,50`. Batas angka adalah 12 digit utuh dan 6 desimal.

`unitCost` tetap berupa rupiah bulat, dihitung per unit dengan pembulatan setengah ke atas memakai aritmetika integer. Nilainya harus cocok dengan metadata konversi. Harga beli atau kurs yang kosong menghasilkan `unitCost=null`, bukan nol. Final membutuhkan harga beli dan kurs lengkap. Kurs dan status tidak berubah otomatis setelah pesanan tersimpan. Beralih dari valas estimasi ke Rupiah mengosongkan biaya, agar perkiraan tidak diam-diam menjadi biaya final.

Frankfurter v1: `https://api.frankfurter.dev/v1/latest?from=JPY&to=IDR`. Tidak memerlukan API key. Dokumentasi: https://frankfurter.dev/v1/ . Hanya kode mata uang dari daftar tetap yang dikirim; identitas dan rincian pesanan tidak dikirim. Respons diperiksa pasangan mata uang, jumlah dasar satu, angka positif, dan tanggal referensi. Pengambilan memiliki timeout, pembatalan saat input berubah, dan pengisian manual jika layanan gagal. Kurs baru dari API selalu berstatus estimasi. Pengguna dapat menandai Final setelah biaya pembayaran diketahui.

Bantuan harga jual hanya mengisi harga jual setelah tombol Gunakan harga ini ditekan. Rumusnya harga beli rupiah × (1 + untung dari modal / 100), dibulatkan ke atas per rupiah. Tidak termasuk fee, ongkir, diskon, atau biaya bersama. Persentase kalkulator tidak disimpan sebagai aturan yang otomatis mengubah harga jual.

HPP & Margin dapat mengubah/finalisasi FX. HPP, laporan, dan ekspor yang mencakup FX estimasi ditandai. Backup JSON mempertahankan snapshot FX; impor menolak metadata atau nilai konversi yang tidak valid.

## Deployment Supabase

Jalankan seluruh `supabase/migrations/202610180001_purchase_fx.sql` di SQL Editor proyek Tippo. SQL memperluas validator workspace, tanpa mengubah tabel, data, atau fungsi kuota. Pengulangan migrasi sudah diuji. Perubahan Git tidak menjalankan SQL Supabase otomatis; penerapan produksi harus dikonfirmasi operator.

Validasi lokal menggunakan PGlite menguji konversi, metadata, status Final, mata uang, dan aturan kuota. Tes browser memakai mock Frankfurter dan Supabase untuk menghindari perubahan data produksi.


## Mata uang batch dan pengambilan otomatis

Mata uang harga beli dipilih pada batch Jastip (Rupiah secara default). Memilih atau mengganti mata uang asing langsung meminta kurs Frankfurter. Batch menyimpan mata uang, kurs referensi terakhir, sumber, dan tanggal kurs melalui `Batch.purchaseFx`; field yang tidak ada berarti IDR.

Membuka Tambah pesanan, atau memilih batch lain dalam pesanan baru, meminta kurs baru satu kali untuk batch tersebut (`cache: no-store`). Kurs yang berhasil diambil memperbarui referensi batch tanpa mengubah pesanan tersimpan. Produk baru dalam formulir memakai kurs batch dengan status Estimasi. Harga beli wajib diisi pada form tambah/edit pesanan Jastip; nilai nol berarti biaya diketahui nol. Harga beli berada sebelum harga jual, di luar detail opsional. Data lama yang belum memiliki HPP tetap dapat dibaca. Pesanan dan HPP yang sudah tersimpan menyimpan kurs masing-masing; membukanya untuk diedit tidak mengambil kurs otomatis.

Saat API gagal, tampilkan pesan yang jelas dan pertahankan kurs referensi sebelumnya sebagai estimasi, atau isi manual. Mengganti mata uang membuang kurs mata uang sebelumnya. Respons permintaan yang dibatalkan diabaikan. Selama pengambilan berlangsung, tombol simpan menunggu; mengisi kurs batch manual membatalkan permintaan.

Validasi server batch ada di `supabase/migrations/202610180002_batch_purchase_fx.sql`. Jalankan setelah `202610180001_purchase_fx.sql`; kedua migrasi aman dijalankan ulang, tidak menghapus data, dan tidak mengubah aturan kuota.

Pada form pesanan, kurs bersama berada di bagian 1. Harga beli per produk ditampilkan sebagai satu input dengan kode mata uang dan hasil konversi rupiah. Form edit dengan kurs bersama menampilkan snapshot pesanan, bukan kurs batch terkini; pesanan lama dengan kurs berbeda per produk tetap mempertahankan kontrol masing-masing. Finalisasi tetap tersedia di HPP & Margin. Nama penyedia API tidak ditampilkan pada form. Desktop menggunakan dua kolom: harga beli dan harga jual berurutan di kiri; bantuan harga jual di kanan, sejajar dengan awal harga beli. Pada ponsel keduanya disusun ke bawah. Bantuan tidak mengulang modal; catatan biaya tambahan tersedia lewat tombol info yang dapat dibuka melalui sentuhan dan keyboard.

Form tambah/edit batch tidak menampilkan teks tanggal dan bantuan pembaruan kurs. Detail produk menempatkan toko di samping varian, serta warna di samping ukuran, termasuk di ponsel.

Bantuan harga jual menempatkan input persentase di samping label dan menampilkan harga saran serta laba dalam blok ringkas. Jika modal belum diisi atau persentase tidak valid, hasil dan tombol penerapan tidak ditampilkan; hanya petunjuk pengisian.

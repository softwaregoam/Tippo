# Harga beli valas Jastip

Mata uang harga beli Jastip dipilih pada batch. Kurs referensi otomatis diambil saat memilih mata uang dan membuka pesanan baru. Pada detail produk, pengguna memasukkan harga beli per unit, dan tetap dapat menyesuaikan kurs secara manual. Pesanan lama mempertahankan kurs tersimpan; Open PO tetap memakai rupiah. Semua tagihan dan harga jual tetap rupiah.

`OrderItem.purchaseFx` bersifat opsional dan menyimpan `currency`, `amount`, `rate`, `status` (`estimate`/`final`), `source` (`manual`/`frankfurter`/`exchange-api`), serta `rateDate` untuk kurs referensi API. Angka desimal disimpan sebagai string bertitik tanpa pemisah ribuan. Input menggunakan format Indonesia, misalnya `1.000,50`. Batas angka adalah 12 digit utuh dan 6 desimal.

`unitCost` tetap berupa rupiah bulat, dihitung per unit dengan pembulatan setengah ke atas memakai aritmetika integer. Nilainya harus cocok dengan metadata konversi. Harga beli atau kurs yang kosong menghasilkan `unitCost=null`, bukan nol. Final membutuhkan harga beli dan kurs lengkap. Kurs dan status tidak berubah otomatis setelah pesanan tersimpan. Beralih dari valas estimasi ke Rupiah mengosongkan biaya, agar perkiraan tidak diam-diam menjadi biaya final.

exchange-api: https://github.com/fawazahmed0/exchange-api . Endpoint utama: `https://latest.currency-api.pages.dev/v1/currencies/jpy.json`; cadangan: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/jpy.json`. Cloudflare diprioritaskan karena kebijakan cache terbaru lebih pendek; kedua permintaan memakai `cache: no-store`. Tidak memerlukan API key. Hanya kode mata uang dari daftar tetap yang dikirim, tanpa identitas atau rincian pesanan. Respons harus memuat objek basis yang diminta, nilai kurs basis sendiri 1, kurs IDR positif, serta tanggal kalender valid yang tidak di masa depan dan tidak lebih dari 3 hari. Kurs dibulatkan ke 6 desimal untuk snapshot. Setiap endpoint memiliki timeout 6 detik; kegagalan HTTP, JSON, tanggal, atau nilai kurs mencoba endpoint cadangan. Pembatalan pengguna menghentikan kedua endpoint. Jika keduanya gagal, UI mempertahankan kurs sebelumnya sebagai estimasi dan menyediakan input manual. Kurs API baru selalu Estimasi; Final dapat dipilih di HPP & Margin setelah biaya diketahui.

Snapshot lama dengan `source: frankfurter` tetap valid, tidak diganti atau dihitung ulang saat dibaca. Semua permintaan kurs baru memakai `exchange-api`, termasuk tombol pada HPP.

Bantuan harga jual hanya mengisi harga jual setelah tombol Gunakan harga ini ditekan. Rumusnya harga beli rupiah × (1 + untung dari modal / 100), dibulatkan ke atas per rupiah. Tidak termasuk fee, ongkir, diskon, atau biaya bersama. Persentase kalkulator tidak disimpan sebagai aturan yang otomatis mengubah harga jual.

HPP & Margin dapat mengubah/finalisasi FX. HPP, laporan, dan ekspor yang mencakup FX estimasi ditandai. Backup JSON mempertahankan snapshot FX; impor menolak metadata atau nilai konversi yang tidak valid.

## Deployment Supabase

Jalankan seluruh `supabase/migrations/202610180001_purchase_fx.sql` di SQL Editor proyek Tippo. SQL memperluas validator workspace, tanpa mengubah tabel, data, atau fungsi kuota. Pengulangan migrasi sudah diuji. Perubahan Git tidak menjalankan SQL Supabase otomatis; penerapan produksi harus dikonfirmasi operator.

Validasi lokal menggunakan PGlite menguji konversi, metadata, status Final, mata uang, dan aturan kuota. Tes browser memakai mock exchange-api dan Supabase untuk menghindari perubahan data produksi.


## Mata uang batch dan pengambilan otomatis

Mata uang harga beli dipilih pada batch Jastip (Rupiah secara default). Memilih atau mengganti mata uang asing langsung meminta kurs exchange-api. Batch menyimpan mata uang, kurs referensi terakhir, sumber, dan tanggal kurs melalui `Batch.purchaseFx`; field yang tidak ada berarti IDR.

Membuka Tambah pesanan, atau memilih batch lain dalam pesanan baru, meminta kurs baru satu kali untuk batch tersebut (`cache: no-store`). Kurs yang berhasil diambil memperbarui referensi batch tanpa mengubah pesanan tersimpan. Produk baru dalam formulir memakai kurs batch dengan status Estimasi. Harga beli wajib diisi pada form tambah/edit pesanan Jastip; nilai nol berarti biaya diketahui nol. Harga beli berada sebelum harga jual, di luar detail opsional. Data lama yang belum memiliki HPP tetap dapat dibaca. Pesanan dan HPP yang sudah tersimpan menyimpan kurs masing-masing; membukanya untuk diedit tidak mengambil kurs otomatis.

Saat API gagal, tampilkan pesan yang jelas dan pertahankan kurs referensi sebelumnya sebagai estimasi, atau isi manual. Mengganti mata uang membuang kurs mata uang sebelumnya. Respons permintaan yang dibatalkan diabaikan. Selama pengambilan berlangsung, tombol simpan menunggu; mengisi kurs batch manual membatalkan permintaan.

Validasi server batch ada di `supabase/migrations/202610180002_batch_purchase_fx.sql`. Jalankan setelah `202610180001_purchase_fx.sql`; kedua migrasi aman dijalankan ulang, tidak menghapus data, dan tidak mengubah aturan kuota.

Pada form pesanan, kurs bersama berada di bagian 1. Harga beli per produk ditampilkan sebagai satu input dengan kode mata uang dan hasil konversi rupiah. Form edit dengan kurs bersama menampilkan snapshot pesanan, bukan kurs batch terkini; pesanan lama dengan kurs berbeda per produk tetap mempertahankan kontrol masing-masing. Finalisasi tetap tersedia di HPP & Margin. Nama penyedia API tidak ditampilkan pada form. Desktop menempatkan harga beli dan harga jual sejajar dalam dua kolom, dengan bantuan harga jual selebar form di bawahnya. Saat bantuan dibuka, persentase, hasil, dan tombol penerapan tersusun mendatar. Pada ponsel field harga dan isi bantuan disusun ke bawah. Bantuan tidak mengulang modal; catatan biaya tambahan tersedia lewat tombol info yang dapat dibuka melalui sentuhan dan keyboard.

Form tambah/edit batch tidak menampilkan teks tanggal dan bantuan pembaruan kurs. Detail produk menempatkan toko di samping varian, serta warna di samping ukuran, termasuk di ponsel.

Bantuan harga jual menempatkan input persentase di samping label dan menampilkan harga saran serta laba dalam blok ringkas. Jika modal belum diisi atau persentase tidak valid, hasil dan tombol penerapan tidak ditampilkan; hanya petunjuk pengisian.

Input kurs dan harga beli valas otomatis memakai titik pemisah ribuan dan koma desimal, termasuk saat angka diperbarui dari API. Pemisah hanya untuk tampilan; snapshot JSON tetap memakai desimal bertitik tanpa pemisah ribuan. Input Untung dari modal dibatasi 0–100%; angka di atas 100 otomatis menjadi 100 dan kalkulator menolak persentase di luar batas.


## Mengaktifkan sumber exchange-api pada produksi

Jalankan seluruh `supabase/migrations/202610190001_exchange_api.sql` di SQL Editor proyek Supabase Tippo sebelum merilis frontend yang menulis `source: exchange-api`. Script ini dapat langsung digunakan setelah validator shopping recap, maupun setelah dua migrasi FX sebelumnya, dan aman dijalankan ulang. Script memperbarui validasi metadata; tidak menulis ulang data atau mengubah fungsi kuota. Penerapan frontend menunggu konfirmasi operator bahwa SQL berhasil, karena deployment Git tidak menerapkan SQL Supabase.

Pilihan mata uang di batch dan HPP menyediakan pencarian berdasarkan kode, nama, dan negara/wilayah, dengan alias umum seperti China dan Inggris. IDR tetap tersedia di batch; HPP valas hanya menawarkan daftar mata uang asing yang sudah didukung. Pencarian tidak mengubah kurs sampai pilihan dikonfirmasi; Escape menutup pencarian tanpa menutup form.


## Seluruh mata uang negara

Katalog tetap `src/lib/currency-catalog.ts` mencakup 158 pilihan (IDR + 157 valas) yang tersedia di exchange-api: mata uang negara/wilayah aktif menurut Unicode CLDR 48, pound/dolar wilayah, dan yuan lepas pantai. Kripto, logam, unit akuntansi, dan mata uang yang sudah diganti tidak ditampilkan. Nama mata uang dan negara berbahasa Indonesia menggunakan CLDR; kode serta alias Inggris API tetap dapat dicari. Daftar dibundel sehingga pencarian tidak memerlukan jaringan; penambahan kode berikutnya harus memperbarui validator SQL juga. Sumber metadata: https://github.com/unicode-org/cldr-json (lisensi Unicode-3.0).

Sebelum merilis katalog baru, jalankan seluruh `supabase/migrations/202610190002_all_currencies.sql` di Supabase produksi dan konfirmasikan keberhasilannya. Migrasi memperluas whitelist di validator item dan batch tanpa mengubah data, perhitungan uang, akses, atau kuota. Deployment frontend menunggu SQL agar mata uang baru tidak ditolak saat disimpan.

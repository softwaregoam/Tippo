# Arah tampilan website Tippo

[DESIGN.md](../DESIGN.md) menyimpan brief pengguna, pilihan implementasi, palet,
tipografi, dan alasan desain. Pengguna memilih arah hangat dan berkarakter
untuk pemilik usaha kecil Indonesia. Dials: ENERGY 2, RHYTHM 3, MOTION 1;
layar operasional dan akun memakai RHYTHM 2. Logo sementara berupa wordmark teks `Tippo.` karena logo
asli menyusul.

Jastip dan Open PO terlihat sebagai pilihan usaha yang berbeda sejak awal.
Landing page memperlihatkan contoh pesanan fiktif yang dapat diganti antara
Jastip dan Open PO, termasuk beberapa barang, total, pembayaran, dan sisa tagihan.
Komposisi memakai slip pesanan, pasangan konteks usaha,
uraian operasional, dan perbandingan paket; fitur tidak dipaksa menjadi kartu bento
atau tiga langkah pemakaian. Pengguna bisa membuka `/demo` sebelum membuat
akun.

Latar paper `#F7F4ED`, teal `#245C4E`, dan tinta `#233D35` membentuk palet
hangat. Bidang teal pekat `#173F38` memisahkan navigasi dari isi kerja dan
membingkai contoh pesanan. Amber `#94501F` pada `#FFF2DE` menjadi aksen terbatas untuk
Open PO atau status yang membutuhkan perhatian. Plus Jakarta Sans dibundel
lokal. Tombol dan input memiliki sudut sederhana; bayangan menandai dialog dan dropdown,
sementara ruang kosong serta pemisah membantu pembacaan daftar pesanan.

Ruang kerja mempertahankan navigasi Ringkasan, Jastip, Open PO, HPP & Margin,
Pelanggan, dan Pengaturan data. Ringkasan angka tampil sebagai satu kelompok yang mudah
dibandingkan. Tombol Akun membuka dropdown Profil bisnis, pilihan tema, dan Keluar;
mode demo menyediakan Keluar demo. Menu dapat dibuka dengan Enter atau tombol
panah, dinavigasi dengan panah/Home/End, serta ditutup dengan Escape, Tab, atau
klik di luar. Fokus kembali ke tombol akun setelah Escape atau memilih profil bisnis.
Katalog mendahulukan nama, harga, HPP, serta aksi produk tanpa
sampul gambar kosong. Pencarian yang tidak cocok menyediakan reset ke data yang
ada. Form Jastip menampung beberapa barang dengan varian, warna,
serta ukuran per barang. Form Open PO memilih master produk dan jumlah.
Import Excel menampilkan validasi sebelum konfirmasi; invoice menyediakan
aksi salin untuk ditempel ke WhatsApp.

Navigasi ponsel, target interaksi minimum 44px, input minimum 16px, label form,
fokus keyboard, serta keadaan kosong, memuat, dan gagal merupakan bagian dari
desain. Penanda demo berbeda dari akun. Pesan gagal simpan mempertahankan
isian, termasuk ketika terjadi konflik versi. Reduced motion dihormati.

Konten hanya menyebut fitur dan aturan paket yang tersedia. Tidak ada
testimoni, angka pelanggan, atau klaim keamanan buatan. Data contoh ditandai
demo; pembayaran Pro produksi belum tersedia dan aktivasi pada demo adalah
simulasi. Referensi produk lain tidak menjadi template dan tidak ada klaim
screenshot aplikasi lain berhasil dikumpulkan.

Pratinjau implementasi:
[desktop](./preview-website-desktop.png),
[mobile](./preview-website-mobile.png),
[daftar mobile](./preview-signup-mobile.png).

Hasil pemeriksaan implementasi dicatat terpisah dari arah desain ini.

Sidebar desktop dapat diperkecil menjadi ikon melalui tombol burger dan diperluas kembali. Pada ponsel menu tetap dibuka sebagai drawer lengkap. Breadcrumb menggunakan label “Halaman”. Identitas akun hanya berada di dropdown dengan tanda chevron; footer identitas sidebar dan bar status penyimpanan akun dihapus. Status proses menyimpan dan pesan kegagalan tetap terlihat saat diperlukan.

Dropdown pilihan menggunakan komponen Radix yang sudah terpasang, dengan tampilan paper/teal, centang untuk pilihan aktif, navigasi keyboard, pencarian dengan mengetik, Escape, serta posisi yang menyesuaikan ruang layar. Field disabled, pilihan yang dinonaktifkan, nilai baca-saja, dan filter bulan paket Gratis menggunakan abu-abu. Label Akun Supabase di header dihapus; tombol akun bertuliskan Akun. Tagline pengguna: “Titip & Pesan, Beres di Tippo.” Judul tab utama: “Tippo: Jastip & Open PO”.

Halaman Pelanggan memiliki tombol Tambah pelanggan dan form nama wajib/nomor WhatsApp opsional; halaman kosong juga menawarkan tambah pelanggan. Data bisa diedit melalui kartu pelanggan. Ringkasan, HPP, dan Pelanggan tidak menampilkan tombol Pesanan baru di header. Toast berada di tengah atas, dengan offset safe area dan tombol tutup. Wordmark ditulis Tippo., sesuai kapitalisasi yang diminta pengguna.

Form Pesanan PO baru dimulai kosong, termasuk batch, pelanggan, tanggal,
produk dan jumlah. Tanda * menunjukkan kolom wajib; harga ditampilkan setelah
produk dipilih. Pembayaran dan ongkir boleh kosong jika belum ada. Baris barang
tambahan dimulai kosong. Saat edit, data pesanan asal tetap ditampilkan.

Semua field wajib memakai tanda * merah, termasuk dalam tema gelap.
Klik backdrop form tidak menutup isian; gunakan tutup, Batal, atau Escape.
Keterangan umum "Wajib diisi" tidak ditampilkan pada form PO.

Input biaya bersama batch dihapus. HPP berfokus pada harga beli per barang;
label margin menjadi Estimasi margin. Petunjuk biaya batch juga dihapus dari
form batch/pesanan dan landing. Biaya lama tetap tersimpan dan diperhitungkan,
dengan penjelasan read-only khusus batch yang masih memilikinya.

Tombol HPP bernama Simpan harga beli dan hanya muncul jika batch terpilih
memiliki pesanan aktif. Tidak ada footer simpan pada batch kosong atau hanya
berisi pesanan batal; petunjuk ongkir/kemasan di sebelah tombol dihapus.


Tiga template Excel memiliki jalur terpisah: Produk pada katalog Open PO,
Pesanan Jastip pada tab Pesanan Jastip, dan Pesanan Open PO pada tab Pesanan
Open PO. Dialog menampilkan urutan Unduh template → Isi data → Unggah →
Periksa → Import. Produk dapat diimpor tanpa batch. Pratinjau menampilkan
kesalahan per baris dan kuota; semua valid sebelum penyimpanan sekaligus.


Template dan import Excel produk, pesanan Jastip, serta pesanan Open PO hanya tersedia untuk paket Pro. Akun Gratis diarahkan ke halaman paket dan tidak dapat mengunduh template, mengunggah, atau mengonfirmasi import. Langganan diperiksa kembali sebelum penyimpanan; kedaluwarsa mempertahankan pratinjau tanpa menyimpan data. Input manual Gratis tetap tersedia: 5 pesanan per jenis per bulan dan 5 produk termasuk arsip.


Alamat pelanggan bersifat opsional, maksimal 1.000 karakter dan mendukung beberapa baris. Field tersedia pada tambah/edit pelanggan serta pelanggan baru dalam form Jastip dan Open PO. Data lama tanpa alamat tetap valid; alamat ikut tersimpan dalam workspace akun dan backup JSON. Mengedit pelanggan dapat mengosongkan alamat kembali.

Header tabel mengikuti jangkar isi kolom: teks rata kiri, jumlah dan nominal
rata kanan, serta tindakan terpusat. Judul pelanggan dimulai sejajar nama
setelah avatar; judul status sejajar teks dropdown. Aturan numerik berlaku
pada Ringkasan, Jastip, Open PO, HPP, serta pratinjau import Excel.


Profil bisnis membuka nama usaha (wajib), email akun (baca-saja), nomor WhatsApp usaha serta alamat usaha (opsional). Simpan menampilkan proses dan pesan berhasil; kegagalan mempertahankan isian. Pada akun login, profil disimpan sebagai metadata akun Supabase; profil demo disimpan terpisah di browser.

## Kategori produk dan refund

Open PO → Produk → Produk baru/Edit menyediakan Kategori (opsional). Filter kategori menggunakan dropdown yang sama dengan kontrol katalog; pencarian juga membaca kategori. Template import produk menyertakan kolom kategori opsional.

Tabel pesanan menyediakan tindakan Refund dengan nama aksesibel pesanan. Dialog menampilkan pembayaran tersisa, nominal dan tanggal wajib dengan bintang merah, catatan opsional, pilihan refund penuh sekaligus batal, serta riwayat. Backdrop tidak menutup form; Escape, Batal, dan tutup tersedia ketika tidak menyimpan. Kegagalan penyimpanan mempertahankan isian. Setelah pembayaran nol, tindakan tetap tersedia untuk membaca riwayat.

## Kategori tersimpan, pembayaran cepat, dan status

Kategori produk bisa diketik baru atau dipilih dari kategori produk yang sudah tersimpan (termasuk produk arsip), menggunakan dropdown khusus Tippo. Tombol Lunas pada form Jastip dan Open PO mengisi total tagihan saat ini; Bayar sebagian mengosongkan nominal dan memfokuskan input agar pengguna mengisi pembayaran sebenarnya. Tombol ini tidak menyimpan pesanan otomatis.

Pilihan status pesanan hanya Tercatat (amber), Dikirim (biru), Selesai (hijau), dan Dibatalkan (merah). Data lama dengan status Dibelikan/Siap dikirim tetap terbaca sebagai Tercatat pada tabel, filter, dan invoice. Status batch terpisah. Pembatalan berbayar tetap memerlukan refund. Tema gelap memakai pasangan warna yang terang untuk keterbacaan.

## Redesain form pesanan, 9 Oktober 2026

Form Jastip dan Open PO memakai empat kelompok: Informasi pesanan, Barang/Produk pesanan, Pembayaran, dan Ringkasan. Tanggal Jastip berpindah ke informasi pesanan. Nama barang memakai lebar penuh; varian/warna/ukuran membentuk satu baris desktop, diikuti jumlah/harga jual/harga beli. Pada ponsel seluruh input menjadi satu kolom. Jarak antar-field 20 piksel desktop dan 18 piksel ponsel; label, subtotal, serta tombol hapus memakai posisi yang konsisten.

Header dan pembayaran memakai latar hijau lembut dari token tema; barang tetap pada bidang netral dengan batas yang jelas. Ringkasan dua kolom menonjolkan total tagihan. Detail tambahan PO tetap dapat dibuka sesuai kebutuhan. Pilihan produk, multi-barang, format rupiah, validasi, bintang merah, pembayaran cepat, dan larangan tutup lewat backdrop tetap tersedia. ENERGY 2 / RHYTHM 2 / MOTION 1; tanpa gerak dekoratif.

## Panel filter dan kartu katalog, 9 Oktober 2026

Pencarian, filter status produk, dan filter kategori disatukan dalam panel katalog dengan gap 10 piksel, tanpa distribusi space-between. Desktop mengelompokkan kontrol di kiri; ponsel menempatkan pencarian pada satu baris penuh dan dua filter di baris berikutnya. Judul dan tindakan import/tambah produk berada pada panel yang sama.

Kartu produk memakai header SKU/status hijau lembut, nama dan varian, kategori terpisah dengan ikon tag, dua kolom harga dengan garis pemisah, serta tindakan di bawah. Tinggi isi dan posisi tindakan konsisten antar-kartu. Kartu tambah produk mengikuti palet dan struktur katalog. Tema gelap menggunakan token yang sama; ukuran sentuh tetap minimal 44 piksel.

## Revisi susunan pesanan sesuai sketsa

Produk/nama barang dan jumlah sejajar dengan lebar sama, termasuk pada ponsel. Varian, warna, ukuran Jastip tetap terlihat. Ikon hapus merah, dinonaktifkan jika tinggal satu barang. Tanggal memakai kontrol ringkas. Jika tepat satu batch aktif dari jenis pesanan yang sesuai, batch otomatis terpilih; edit mempertahankan batch asal dan konteks batch Jastip yang dipilih eksplisit tetap dihormati.

Ongkir lalu catatan langsung terlihat sebelum pembayaran, tanpa expand. Pembayaran menampilkan total dan tombol Belum dibayar, Bayar sebagian, Lunas. Perubahan nominal masih harus disimpan melalui Simpan pesanan. Field wajib merah, format ribuan, harga master, validasi pembayaran, dan larangan menutup backdrop tetap berlaku.

## Tata letak informasi pesanan, 10 Oktober 2026

Batch menempati lebar penuh. Pelanggan dan tanggal sejajar pada baris berikutnya; tanggal tetap ringkas (maksimal 240 piksel). Alamat pelanggan baru menggunakan lebar penuh. Tata letak berlaku pada form Jastip dan Open PO, dengan dua kolom pelanggan/tanggal pada ponsel.

## Tombol tambah dan bantuan pembayaran, 10 Oktober 2026

Tombol Tambah barang memakai lebar penuh dan warna utama hijau. Bantuan Belum dibayar dihapus. Tombol Lunas dan Bayar sebagian berada di samping input Sudah dibayar; khusus ponsel tombol bertumpuk di sisi kanan agar input nominal tetap terbaca. Label, format angka, fokus, dan validasi pembayaran tetap sama.

## Batch aktif dan nomor bagian, 10 Oktober 2026

Pilihan batch untuk pesanan PO baru hanya berisi batch aktif. Saat mengedit, batch asal tetap tersedia meskipun ditutup/selesai untuk menjaga hubungan historis pesanan; batch tertutup lain tidak ditampilkan. Judul bagian form Jastip/PO memakai nomor 1 Informasi pesanan, 2 Barang/Produk, 3 Ongkir & catatan, 4 Pembayaran. Nomor tampil dalam penanda kecil mengikuti palet tema.

## Konfirmasi produk dan pilihan produk

Ikon arsip katalog memakai Trash2 merah berukuran 16, sama dengan hapus barang. Sebelum arsip, dialog menyebut produk dan menjelaskan histori tetap tersimpan serta bisa diaktifkan kembali. Batal mendapat fokus awal; saat menyimpan, tombol ditahan dan kegagalan ditampilkan. Pilih produk hanya placeholder input kosong, tidak menjadi opsi dropdown.

## Tabel produk dan batch PO, 10 Oktober 2026

Produk dan batch Open PO kini memakai tabel. Produk menampilkan nama/SKU, kategori, varian, harga jual/beli rata kanan, status, dan aksi pesan/edit/arsip. Kartu tambah produk dihapus; tombol Produk baru tetap pada panel pencarian/filter. Batch PO menampilkan nama, supplier, tanggal tutup, jumlah pesanan non-batal, status yang bisa diubah, dan aksi edit/HPP/tambah pesanan. Jastip tetap menggunakan tampilan perjalanan yang ada.

Pada layar kecil, tabel berubah menjadi daftar baris dengan label kolom per nilai. Aksi tetap berukuran sentuh, arsip tetap membutuhkan konfirmasi, dan data histori tidak berubah.

## Tabel perjalanan Jastip, 10 Oktober 2026

Perjalanan Jastip kini memakai tabel yang sama dengan batch PO: nama, lokasi/supplier, tanggal tutup, jumlah pesanan non-batal, status, dan aksi edit/HPP/tambah pesanan. Ponsel memakai daftar berlabel. Komponen tabel dibagikan agar jarak, alignment, status, dan kontrol konsisten.

## Hapus demo dan sederhanakan aksi tabel, 10 Oktober 2026

Demo publik dihapus: tautan di landing/auth/pemulihan dihapus dan URL lama /demo mengarah ke /masuk. Ruang usaha wajib akun Supabase. Tabel produk hanya edit dan arsip/aktifkan. Tabel batch PO/perjalanan hanya edit, dengan status tetap bisa dipilih. Pesanan baru melalui tombol halaman; HPP melalui sidebar. Data akun tetap tersimpan.

## Tabel pelanggan, 10 Oktober 2026

Pelanggan memakai tabel konsisten dengan produk/perjalanan: nama, WhatsApp, alamat, jumlah pesanan non-batal, dan edit. Pencarian dan Tambah pelanggan tetap di atas. Pada ponsel setiap baris menjadi daftar berlabel; alamat membungkus dan mempertahankan baris baru. Field kosong ditandai Belum diisi.

## Pesanan ringkasan hanya baca, 10 Oktober 2026

Bagian Pesanan terbaru pada ringkasan hanya menampilkan data. Tombol Semua pesanan dan kolom Tindakan dihapus; status tampil sebagai label berwarna, bukan dropdown. Pengelolaan pesanan tetap pada halaman Jastip/Open PO. Komponen tabel menerima mode readOnly khusus ringkasan.

## Daftar ringkas ponsel, 10 Oktober 2026

Pada lebar maksimal 600 piksel, tabel pesanan, produk, batch/perjalanan, dan pelanggan diganti daftar baris ringkas. Setiap baris menampilkan nama, konteks singkat, nominal/jumlah pesanan, dan status bila ada. Ketuk untuk membuka dialog detail. Produk menyediakan edit dan status; batch/perjalanan menyediakan edit/status; pelanggan menyediakan alamat/kontak dan edit; pesanan menyediakan status/edit/invoice/refund. Ringkasan pesanan tetap hanya baca. Desktop mempertahankan tabel. Dialog dapat ditutup melalui tombol atau Escape, mengembalikan fokus ke baris, dan tindakan edit/invoice/refund menutup detail sebelum membuka form berikutnya.

## Data terbaru di atas

Data baru ditambahkan di depan daftar pelanggan, produk, batch/perjalanan, dan pesanan. Import baru muncul sebelum data yang sudah ada, mempertahankan urutan baris dalam kelompok impor. Pesanan ditampilkan berdasarkan createdAt menurun, bukan tanggal transaksi yang bisa diedit. Edit mempertahankan posisi dan createdAt. Data master lama tanpa timestamp tidak disusun ulang secara spekulatif.

Aliran pembayaran pada Ringkasan memakai kartu dengan tinggi mengikuti isi: donut di kiri, label dan nominal di kanan, pemisah untuk setiap nominal. Lebar grafik menyesuaikan lebar kartu; angka tetap terbaca pada ponsel dan tema gelap.

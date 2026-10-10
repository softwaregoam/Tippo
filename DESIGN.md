# Design Tippo

## Sumber arah desain

Brief pengguna: aplikasi jastip dan open PO dengan tampilan menarik dan ramah,
input pesanan cepat, grafik bulanan, dan perhitungan HPP. Jastip dan Open PO
memiliki menu serta tampilan sendiri. Satu pesanan dapat berisi beberapa barang
atau makanan. Open PO memakai master produk; jastip mencatat varian, warna, dan
ukuran. Logo asli menyusul.

Pada revisi 8 Oktober 2026, pengguna memilih arah **hangat dan berkarakter**.
Palet, tipografi, motif, dan komposisi di bawah adalah pilihan implementasi
agen berdasarkan arah tersebut, bukan panduan merek yang ditulis pengguna.
Arah ini dapat diperbarui saat logo atau panduan merek tersedia.

Pengguna menetapkan judul website **Tippo: Jastip & Open PO** dan tagline
**Titip & Pesan, Beres di Tippo.** Tagline ditampilkan pada hero, footer, dan
caption sidebar; metadata utama memakai judul dan tagline tersebut.

## Design Read

Reading this as: landing page dan ruang kerja pencatatan pesanan untuk pemilik
usaha kecil Indonesia, dengan bahasa visual buku pesanan yang hangat dan
berkarakter, dial ENERGY 2 / RHYTHM 3 / MOTION 1. Layar operasional dan akun
memakai RHYTHM 2 agar tugas berulang tetap terasa konsisten.

| Dial | Nilai | Bentuk dalam antarmuka |
| --- | --- | --- |
| ENERGY | 2 | Judul jelas, bahasa sehari-hari, dan satu aksi utama pada setiap layar. |
| RHYTHM | 3 | Landing berganti antara judul besar, slip pesanan interaktif, dua alur usaha, uraian operasional, dan tabel paket. |
| MOTION | 1 | Umpan balik hover dan fokus; tidak ada gerak dekoratif atau reveal saat scroll. |

## Identitas dan warna

Tippo terasa seperti buku pesanan yang mudah dibaca: nama pelanggan, barang,
jumlah, dan tagihan menjadi pusat perhatian. Motifnya adalah slip pesanan:
judul tegas, detail berbaris, dan total pada bagian akhir. Pasangan Jastip /
Open PO muncul sebagai dua konteks yang jelas. Identitas sementara menggunakan
wordmark teks `Tippo.`; tidak ada logo atau avatar buatan yang dipresentasikan
sebagai aset final.

| Peran | Warna | Alasan |
| --- | --- | --- |
| Paper | `#F7F4ED` | Latar krem menguatkan suasana buku pesanan dan memisahkan isi dari bidang navigasi. |
| Teal utama | `#245C4E`, bidang `#173F38` | Aksi utama dan navigasi memakai satu keluarga warna; bidang pekat membingkai slip pesanan. |
| Tinta | `#233D35` | Judul dan isi memiliki kontras kuat di atas latar paper. |
| Aksen amber | `#94501F` pada `#FFF2DE` | Aksen terbatas membedakan konteks Open PO atau status yang membutuhkan perhatian. |

Putih serta abu-abu netral melayani permukaan, pemisah, dan informasi sekunder.
Warna pastel lilac, mint, dan peach dari versi sebelumnya tidak menjadi tiga
identitas tambahan. Warna status harus mempunyai label teks agar warna bukan
satu-satunya pembeda. Kontras perlu diverifikasi terhadap pasangan warna yang
benar-benar dipakai, termasuk teks sekunder, hover, dan fokus.

Tema terang tetap merupakan pilihan merek: paper, buku pesanan, dan invoice
menjadi bahasa visual yang konsisten dari landing page sampai ruang kerja.
Pilihan ini meneruskan website terang yang sudah ada; tema gelap memerlukan
arah merek dan pengujian semua komponen tersendiri.

## Keputusan visual

| Keputusan | Alasan satu baris |
| --- | --- |
| Plus Jakarta Sans lokal | Karakter ramah dan bentuk angka yang terbaca meneruskan tipografi yang sudah dipakai tanpa unduhan font saat runtime. |
| Nominal sejajar dan angka tabular | Harga, jumlah, HPP, serta sisa tagihan dapat dibandingkan cepat antarbaris. |
| Slip pesanan dari data demo | Pengunjung melihat contoh gabungan barang dan harga dari dataset demo, dengan total terhitung; label fiktif mencegahnya terlihat seperti aktivitas pelanggan sungguhan. |
| Bidang teal pekat | Membedakan navigasi dari isi kerja dan membingkai contoh pesanan tanpa dekorasi tambahan. |
| Judul lebih besar pada landing | Membuat manfaat pencatatan terbaca sebelum detail produk dan rincian paket. |
| Katalog tanpa sampul gambar kosong | Nama, harga, HPP, dan aksi produk tetap menjadi isi utama ketika gambar produk belum tersedia. |
| Hasil pencarian kosong dengan reset | Pengguna dapat kembali ke data yang ada ketika pencarian atau filter tidak cocok. |
| Garis konteks pada intro usaha dan pemulihan | Garis menandai konteks Jastip/PO atau kebutuhan tautan pemulihan, selalu disertai penjelasan teks. |
| Ringkasan angka tersambung | Penjualan, margin, jumlah pesanan, dan tagihan dibaca sebagai satu kelompok, tanpa empat panel yang saling bersaing. |
| Pilihan Jastip dan Open PO terlihat di awal | Pemilik memilih alur usahanya sebelum menghadapi form dengan kebutuhan data berbeda. |
| Komposisi mengikuti isi | Penjelasan pesanan, Excel, invoice, dan paket tidak dipaksa menjadi bento atau tiga langkah seragam. |
| Ruang kosong menjadi pemisah | Jarak antarbagian lebih besar daripada jarak label ke input sehingga kelompok informasi terlihat jelas. |
| Kartu hanya untuk kelompok nyata | Form, konteks usaha, dan ringkasan mempunyai batas yang membantu pengguna membaca dan mengambil tindakan. |
| Radius sederhana | Tombol dan input memiliki sudut lebih kecil daripada panel; semua elemen tidak menjadi pil. |
| Bayangan pada dialog dan dropdown | Elevasi menandai lapisan aktif di atas ruang kerja, bukan menghias panel isi. |
| Burger sidebar | Memperkecil navigasi desktop menjadi ikon 76px agar ruang pesanan lebih luas; label aksesibel dan tooltip tetap tersedia. Di ponsel navigasi tetap berupa drawer penuh. |
| Dropdown pilihan | Daftar Radix memakai permukaan paper, pilihan aktif teal dengan centang, target 44px, fokus keyboard, dan posisi yang menyesuaikan tepi layar. |
| Field terkunci | Latar abu-abu #E9EAE7, teks #626762, dan batas #7D817D membedakan nilai baca-saja atau filter yang tidak bisa diubah. |
| Sorotan teks | Selection #C9DDD0 dengan teks #173F38 membuat teks yang disalin tetap terbaca dalam palet Tippo. |
| Chevron pada akun | Menunjukkan tombol Akun membuka menu; arah berbalik ketika menu terbuka. |
| Toast di atas | Status singkat muncul di tengah bagian atas ruang kerja, mengikuti safe area ponsel dan dapat ditutup tanpa memindahkan fokus. |
| Tambah pelanggan | Tombol dan form khusus menyimpan nama serta nomor opsional tanpa membuat pesanan; form edit memakai alur yang sama. |
| Dropdown Akun | Profil bisnis, tema, dan keluar berada pada dropdown akun; Pengaturan data berada di sidebar sesuai permintaan pengguna; Escape, Tab, tombol panah, dan klik di luar menutup atau menavigasi menu. |
| Ikon fungsional | Ikon mewakili navigasi atau tindakan nyata dan mendampingi label, bukan menggantikan informasi. |
| Tanpa dekorasi latar | Tidak ada grid titik, glow, glass, sparkle, atau gradien yang mengganggu pembacaan pesanan. |
| Gerak terbatas | Perubahan hover dan fokus membantu orientasi; isi tidak muncul dengan animasi berulang. |
| Indikator memuat | Putaran indikator hanya berlangsung selama permintaan akun, disertai status teks dan berhenti ketika selesai atau gagal. |
| Grafik dapat dipilih | Tombol bulan membuka nilai penjualan dan HPP dengan sentuhan atau keyboard; garis putus-putus membedakan seri biaya. |

## Bahasa dan konten

Bahasa Indonesia memakai istilah yang digunakan pemilik usaha: pesanan,
barang, pelanggan, DP, sisa tagihan, produk PO, dan harga beli. CTA menyebut
tindakannya, misalnya `Buka demo`, `Buat akun gratis`, `Tambah barang`, atau
`Salin invoice WhatsApp`. Pesan kesalahan menyebut masalah dan langkah yang
bisa dilakukan, tanpa menghapus isian pengguna.

Angka pelanggan, testimoni, dan klaim keamanan atau kinerja hanya tampil jika
ada bukti. Data contoh tetap diberi penanda demo. Contoh tidak dipresentasikan
sebagai omzet atau aktivitas pengguna sungguhan. Tidak ada klaim telah
mengumpulkan screenshot aplikasi lain.

Paket Gratis menawarkan masing-masing 5 pesanan Jastip dan 5 pesanan Open PO
setiap bulan kalender Jakarta, 5 master produk PO termasuk arsip, serta
ringkasan bulan berjalan. Banyak barang dalam satu pesanan tetap memakai satu
slot. Harga Pro adalah Rp25.000/bulan; pembayaran langganan produksi belum
tersedia. Aktivasi Pro pada demo harus disebut simulasi. HPP dan laba kotor
mengikuti biaya yang dicatat; harga beli yang kosong berarti belum lengkap.
Invoice disalin untuk ditempel ke WhatsApp, bukan dikirim otomatis.

## Layar, keadaan, dan akses

Navigasi akun dimulai dari switch Jastip | Open PO; Ringkasan, Pesanan,
Perjalanan atau Produk/Batch PO, serta HPP & Margin mengikuti mode. Pelanggan
dan Pengaturan Data tetap bersama. Rute demo mengarahkan ke halaman masuk.
Pesanan Jastip memakai barang bebas dengan atribut per barang; form Open PO
memilih master produk dan jumlah. Tanggal, ongkir, serta catatan opsional
dapat ditempatkan pada detail tambahan agar input utama tetap ringkas.

Layar ponsel mengalir dalam satu kolom dengan input sekurang-kurangnya 16px
dan target interaksi sekurang-kurangnya 44px. Ukuran teks memakai rem dan
skala yang dapat mengalir; nama barang panjang serta nominal tetap berada
dalam kontainernya. Tabel hanya boleh menggulir dalam wadahnya, bukan membuat
seluruh halaman meluber.

Label, fokus yang terlihat, urutan Tab, aktivasi Enter atau Space, serta Escape
untuk dialog merupakan bagian dari desain. Setiap layar data mempunyai
keadaan kosong, memuat, dan gagal. Saat penyimpanan berlangsung, aksi utama
memberi penanda sedang menyimpan; kegagalan dan konflik mempertahankan input.
Preferensi reduced motion tetap dihormati.

Dokumen ini menyimpan arah dan alasan desain. Bukti build, pemeriksaan kontras,
responsivitas, dan klik setiap interaksi dicatat dalam laporan validasi saat
implementasi selesai; dokumen ini tidak menyatakan pemeriksaan tersebut lulus.

### Tema gelap dan input angka
Pilihan pengguna menambahkan tema gelap: tema terang tetap bawaan, pilihan disimpan pada perangkat dan tersedia melalui Akun serta header halaman publik. Permukaan gelap hangat, teks terang, dan aksen hijau menjaga identitas serta keterbacaan. Field terkunci tetap abu-abu. Angka memakai titik sebagai pemisah ribuan pada tampilan, sementara penyimpanan dan perhitungan memakai angka tanpa pemisah; nilai kosong dan nominal tidak valid tetap dapat dibedakan.

### Form PO baru tanpa pilihan awal
Sesuai permintaan pengguna, batch, pelanggan, tanggal, produk, jumlah, pembayaran,
dan ongkir dimulai kosong. Produk baru pada baris tambahan juga kosong.
Tanda * menandai batch, pelanggan, tanggal, produk, jumlah, dan nama pelanggan
baru ketika dipilih. Tanggal wajib dipindahkan ke bagian utama agar tidak
tersembunyi dalam detail opsional. Pembayaran/ongkir kosong bernilai nol saat
disimpan. Edit mempertahankan nilai dan snapshot pesanan asal.

### Penanda wajib dan backdrop form
Penanda * memakai merah semantik untuk kebutuhan pengguna dan kontras kedua
 tema. Penanda mengikuti validasi yang sudah ada, termasuk field wajib Jastip,
PO, pelanggan, batch, produk, akun, dan impor. Field opsional tidak ditandai.
Keterangan umum wajib isi pada PO dihapus atas permintaan pengguna.
Backdrop form tidak menutup draft; tutup eksplisit, Batal, dan Escape tetap ada.

### HPP tanpa input biaya bersama
Pengguna memilih menghapus biaya bersama dari MVP untuk mengurangi beban
pengisian. HPP cukup memakai harga beli per barang × jumlah; petunjuk menjelaskan
bahwa ongkir supplier/kemasan dapat dimasukkan ke harga beli per barang.
Label Estimasi margin menunjukkan batas kelengkapan biaya yang dicatat.
Biaya batch yang sudah ada tetap tersimpan dan dihitung; keterangan read-only
serta kolom Biaya lama hanya muncul bila batch memiliki biaya historis.

### Tiga jalur template Excel
Template Produk berada pada katalog Open PO; template Pesanan Jastip dan
Pesanan Open PO berada pada tab pesanan masing-masing. Urutan unduh, isi,
unggah, periksa, import dijelaskan dengan daftar teks ringkas supaya pengguna
listing lama dapat menyalin kolom tanpa mempelajari pemetaan bebas. Produk
memiliki pratinjau nama, varian/SKU, harga, dan kesalahan per baris. Import
menambah katalog tanpa menimpa master/histori; kuota dan duplikat menjadi
pesan yang bisa diperbaiki sebelum penyimpanan sekaligus. Warna, tipografi,
focus, dan perilaku backdrop mengikuti form yang sudah disepakati.


Import Excel khusus Pro: badge Pro pada tindakan import menjelaskan syarat paket tanpa menghilangkan jalur upgrade. Gratis tetap memakai form manual. Ketika paket berakhir, kontrol template, unggah, dan simpan menjadi abu-abu; pratinjau serta tindakan tutup tetap tersedia agar hasil pemeriksaan tidak hilang tiba-tiba.

Tombol Google mengikuti referensi visual yang dikirim pengguna: kapsul putih,
batas abu-abu, logo G berwarna, dan label Indonesia “Masuk dengan Google”.
Bentuk kapsul khusus tindakan provider, sedangkan tombol Tippo memakai radius
sistem yang ada. Putih pada kedua tema mempertahankan tampilan referensi dan
kontras logo. Aset resmi Google diambil tanpa modifikasi dari
https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png dan disimpan
lokal agar tidak bergantung pada pemuatan gambar lintas domain. Penggunaan
logo secara eksplisit diminta pengguna melalui contoh tombolnya.


Profil bisnis memakai satu form dengan lebar maksimum 720 px agar nama dan kontak usaha mudah dibaca; nomor serta alamat bersifat opsional. Email akun tampil abu-abu sebagai baca-saja. Tidak ada logo baru atau form pesanan pada halaman profil dan pengaturan.

## Kategori dan refund, 9 Oktober 2026

Kategori memakai field dan dropdown katalog yang sudah ada; tidak menambah navigasi baru. Refund berada dekat invoice/edit pada baris pesanan agar konteks pelanggan tetap jelas. Dialog memakai permukaan padat, nominal terformat, fokus terlihat, bintang wajib merah, dan jarak antar-field yang konsisten. Riwayat berupa baris tanggal/nominal, tanpa dekorasi baru. Arah hangat, ENERGY 2 / RHYTHM 2 untuk ruang kerja / MOTION 1, serta tema terang dan gelap dipertahankan.

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

## Dua usaha dengan switch

Keputusan pengguna: Tippo memiliki dua mode, Jastip dan Open PO, tanpa ringkasan gabungan. Switch berlabel tetap terlihat di atas isi halaman, navigasi mengikuti mode, dan pilihan terakhir disimpan di browser. Jastip memakai teal, Open PO memakai jingga hangat; warna status pesanan konsisten di kedua mode. Permukaan/tabel/font dan pengaturan terang/gelap tetap sama. ENERGY 2 / RHYTHM 2 / MOTION 1 untuk ruang kerja. Aksen PO terang #94501f dengan putih pada tombol, PO gelap #e8b484 dengan ink #14251e. Sidebar PO memakai cokelat gelap agar konteks terlihat tanpa mewarnai seluruh halaman. HPP pada grafik PO memakai warna netral dan garis putus-putus untuk dibedakan dari penjualan jingga. Scope mode berlaku pada ringkasan, grafik, pembayaran/refund, tagihan, pesanan, batch/perjalanan dan HPP. Akun, langganan, profil, data cadangan dan daftar kontak pelanggan tetap bersama.

## Status batch satu arah

Revisi ikon: aksi Dibuka menggunakan CircleArrowRight dengan tooltip Tutup batch; Ditutup menggunakan CircleCheck dengan tooltip Selesaikan batch. Status Selesai menampilkan LockKeyhole abu-abu tanpa handler atau tab stop. Nama aksesibel menyertakan nama batch. Target tombol tetap 44×44 piksel, sama dengan edit, agar nyaman disentuh. Dialog dan aturan status satu arah tetap sama. Ikon dipilih untuk menunjukkan tindakan berikutnya, bukan perpindahan dua arah.

Batch PO dan perjalanan Jastip memakai label status berwarna dan tombol Ubah status dalam kolom Aksi. Dialog menunjukkan status saat ini, status tujuan, dan akibat perubahan sebelum Simpan perubahan. Urutan Dibuka → Ditutup → Selesai; Ditutup tidak dapat dibuka kembali dan Selesai tidak menyediakan tindakan ubah status. Batal menerima fokus awal untuk mengurangi perubahan tidak sengaja; klik backdrop tidak menutup dialog. Ponsel membuka tindakan dari detail batch. Kegagalan simpan mempertahankan dialog dan status lama. Status pesanan tidak ikut berubah, sedangkan pengeditan nama/lokasi/tanggal batch tetap tersedia. Pemeriksaan dalam fungsi persist juga menolak perubahan status mundur melalui penyimpanan aplikasi, termasuk pemulihan cadangan. Tidak ada perubahan skema Supabase untuk revisi UI ini; pemeriksaan ini berada di aplikasi, bukan constraint database.

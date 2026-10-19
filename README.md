> Development gratis menggunakan branch `dev` + Supabase lokal Docker. Lihat [panduan Tippo Dev](docs/DEVELOPMENT.md). `main` tetap untuk rilis produksi; pengembangan rutin tidak langsung dirilis.

> Pembaruan 10 Oktober 2026: fitur demo publik dihapus. Semua penggunaan aplikasi melalui akun Supabase. Tombol pesan produk, HPP, dan tambah pesanan di tabel dihapus; pembuatan pesanan tetap melalui tombol halaman dan HPP melalui sidebar. Bagian riwayat implementasi lokal di bawah bukan fitur yang tersedia untuk pengguna.

# Tippo

Aplikasi MVP jastip dan open PO untuk satu pemilik usaha: input pesanan cepat,
grafik bulanan, HPP, margin, DP/piutang, batch, dan pelanggan. Antarmuka memakai
Next.js, React, TypeScript, Tailwind CSS, komponen shadcn/ui, dan Framer Motion.
Satu pesanan dapat memuat beberapa barang atau makanan, dengan invoice siap
disalin ke WhatsApp.

## Menjalankan

Gunakan Node.js 22 atau lebih baru (divalidasi pada 24.19.0).

```sh
cd /workspace/Tippo
export npm_config_cache=/workspace/.cache/npm
export NEXT_TELEMETRY_DISABLED=1
npm ci
npm run dev
```

Jika port 3000 dipakai proses lain, pilih port kosong, misalnya
`npm run dev -- --port 3001`. Proses validasi saat pengembangan menggunakan port
3001. Gunakan origin `localhost` untuk pemeriksaan browser lokal agar resource
development Next.js dapat dimuat.

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Playwright menguji server pada port 3001 dan dapat menjalankannya otomatis.
Pada cloud environment ini, Chromium sistem digunakan; di mesin lain instal
browser Playwright dengan `npx playwright install chromium`.

## Website dan akun

- `/`: landing page, fitur, cara kerja, harga, dan FAQ.
- `/demo`: URL lama, mengarah ke `/masuk`; fitur demo sudah dihapus.
- `/daftar`, `/masuk`, `/lupa-password`, `/atur-ulang-password`: Supabase Auth.
- `/app`: workspace akun dengan penyimpanan Supabase; wajib masuk.

Konfigurasi proyek pengguna sudah ada pada `.env.local` di cloud workspace.
File ini tidak masuk Git. Untuk menyiapkan database, email redirect, dan hosting,
ikuti [SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md).

## Cakupan MVP

- Ringkasan penjualan, margin diketahui, piutang, grafik enam bulan, dan status
  pembayaran. Periode berdasarkan tanggal pesanan.
- Menu **Jastip** dan **Open PO** terpisah dengan daftar serta batch masing-masing.
  Jastip memakai barang bebas; Open PO diawali master produk.
- Master produk PO: nama, varian/SKU opsional, harga jual/beli, edit dan arsip.
  Pesanan PO cukup memilih produk, pelanggan, jumlah, batch, dan DP; harga
  otomatis. Detail tanggal, ongkir, dan catatan bisa dibuka; harga master diedit
  melalui Produk dan harga beli pesanan lama dilengkapi di HPP & Margin.
- Input dan edit pesanan banyak barang/makanan, pilihan varian, warna, dan ukuran
  untuk setiap barang jastip, pelanggan baru langsung di form, serta
  validasi DP yang tidak melebihi tagihan. Perubahan harga master tidak mengubah
  snapshot nama/harga pesanan lama. Jasa, ongkir, dan pembayaran dicatat sekali
  untuk seluruh pesanan.
- Batch jastip/open PO, tenggat, dan status. Jenis batch mengikuti
  halaman yang sedang dipakai.
- HPP dari harga beli per unit × jumlah; input biaya batch dihapus.
  Biaya lama tetap dihitung untuk menjaga histori.
  Harga beli kosong berarti HPP belum lengkap, bukan nol.
- Pelanggan, pencarian/filter pesanan, serta pembaruan status.
- **Import produk Excel** pada Open PO → Produk: unduh template produk, isi
  listing lama, unggah, periksa pratinjau, lalu import sekaligus. Duplikat
  SKU/nama-varian dan kelebihan kuota Gratis termasuk arsip ditolak.
- **Import Excel** pada tab Pesanan Jastip/PO: unduh template `.xlsx`, pilih batch
  aktif, unggah, tinjau validasi, lalu konfirmasi. PO mencocokkan master melalui
  SKU atau nama + varian dan memakai harga master. Batas 5 MB/1.000 baris;
  kesalahan baris memblokir seluruh impor agar tidak ada hasil parsial.
- Invoice teks berisi seluruh item dan pilihannya, subtotal, jasa, ongkir, DP,
  serta sisa tagihan. Tombol **Salin invoice WhatsApp** menyalin teks untuk
  ditempelkan sendiri ke chat pelanggan; harga beli dan margin tidak disertakan.
- Paket Gratis: masing-masing 5 pesanan Jastip dan 5 pesanan Open PO per bulan kalender Jakarta,
  5 master produk PO termasuk arsip, dan ringkasan hanya bulan berjalan.
  Kuota menghitung pesanan, bukan jumlah barang, berdasarkan waktu pencatatan
  yang terpisah dari tanggal transaksi yang bisa diedit.
- Paket Pro Rp25.000/bulan: tanpa kuota paket untuk pesanan/produk dan akses
  ringkasan historis. Pembayaran langganan belum tersedia.
- Ekspor/impor JSON dan pengosongan data dengan konfirmasi.
- Layout responsif dengan navigasi ponsel dan dukungan keyboard.

Data awal adalah contoh fiktif. **Pengaturan data → Hapus semua & mulai kosong**
menyiapkan workspace untuk transaksi sendiri. Ekspor salinan terlebih dahulu
bila ada data yang ingin dipertahankan.

## Mengisi tiga template Excel (khusus Pro)

Paket Gratis memakai input manual; ketiga template dan import Excel memerlukan Pro.

**Produk:** buka Open PO → Produk → Import produk Excel, lalu unduh
`tippo-template-produk.xlsx`. Isi lembar Produk: `produk`, `varian`,
`sku_produk`, `harga_jual`, `harga_beli`. Nama dan harga jual wajib;
kolom lain opsional. Hapus/ganti baris contoh, simpan .xlsx, unggah,
periksa, dan import. Produk lama tidak ditimpa.

**Pesanan Jastip dan Open PO:**

Pada **Jastip/Open PO → Pesanan → Import Excel**, pilih batch tujuan yang masih
dibuka lalu unduh **Template Excel**. Isi lembar `Pesanan`, unggah kembali, tinjau
baris dan tagihan, lalu tekan **Import N pesanan** setelah seluruh baris valid.

| Template | Kolom |
| --- | --- |
| Keduanya | `nomor_pesanan`, `nama_pelanggan`, `telepon`, `jumlah`, `ongkir`, `dp`, `tanggal`, `catatan` |
| Tambahan Jastip | `produk`, `varian`, `warna`, `ukuran`, `harga_jual`, `harga_beli`, `fee_jastip` |
| Tambahan PO | `sku_produk`, `produk`, `varian` |

Nama pelanggan, jumlah, dan tanggal wajib. Jastip juga mewajibkan produk dan
harga jual; harga beli boleh kosong. PO memakai SKU atau nama + varian yang sama
persis dengan master aktif di lembar `Produk`; harga diambil otomatis dari master.
Isi nominal sebagai rupiah bulat tanpa teks/pemisah ribuan, telepon/SKU sebagai
teks agar nol awal tetap ada, dan tanggal `YYYY-MM-DD` atau tanggal Excel.
Formula ditolak. Ganti atau hapus baris **CONTOH, ganti nama pelanggan** sebelum
impor; baris contoh sengaja tidak bisa disimpan. Pelanggan yang cocok digunakan
kembali tanpa menimpa data; kecocokan ambigu ditampilkan sebagai kesalahan.

Isi `nomor_pesanan` yang sama pada beberapa baris untuk menggabungkan barang
menjadi satu pesanan. Jika kosong, tiap baris menjadi pesanan sendiri. Pelanggan,
telepon, tanggal, jasa, ongkir, DP, dan catatan merupakan data tingkat pesanan:
isi sekali, lalu kosongkan pada baris berikutnya atau ulangi nilai yang sama.
Nilai berbeda untuk satu nomor pesanan ditolak. Jasa, ongkir, dan DP tidak
dijumlahkan berulang. Pratinjau menghitung pesanan hasil penggabungan, dan kuota
Gratis juga memakai jumlah pesanan tersebut. Maksimal 100 item per pesanan.

## Batas yang perlu diketahui

Demo menyimpan data v3 di localStorage (key `tippo.workspace.v1`). Workspace
akun menyimpan transaksi melalui RPC Supabase dan dimulai tanpa data contoh.
Supabase Auth dan migration RLS/kuota tersedia, tetapi penerapan migration dan
verifikasi koneksi proyek remote membutuhkan akses yang belum tersedia dari
proxy cloud pada sesi ini. Lihat [panduan aktivasi](docs/SUPABASE-SETUP.md).
Belum ada pembayaran Pro nyata atau cadangan otomatis.

`paid` adalah pembayaran kumulatif per pesanan. Grafik pembayaran bukan laporan
kas berdasarkan tanggal transfer. Pembatalan pesanan berbayar diblokir karena
refund belum didukung. HPP/margin merupakan perhitungan sementara dari biaya
tercatat dan belum dikurangi biaya operasional umum. Ketika harga beli belum
lengkap, margin hanya mencakup pesanan dengan HPP yang diketahui.

Penyimpanan browser dapat hilang saat data situs dihapus. Ekspor JSON secara rutin
dan lindungi berkas karena dapat memuat data pelanggan. Impor mengganti seluruh
workspace setelah validasi dan konfirmasi. Ekspor memakai `schemaVersion: 3`
dengan array item per pesanan; backup versi 1 dan 2 tetap dapat diimpor. Data lama
dimigrasikan menjadi satu item per pesanan tanpa mengubah nominal/riwayat, dan
master PO versi 1 diturunkan dari nama produk PO yang sudah ada. Timestamp pembuatan
pesanan lama diperkirakan dari tanggal transaksi karena format lama belum mencatatnya.
Produk arsip tidak tersedia untuk pesanan baru, tetapi riwayat
dan edit pesanan lama tetap tersedia.

Status paket demo disimpan terpisah di `tippo.subscription.demo.v1`. Setelah
masa demo berakhir, aturan Gratis kembali berlaku dan data lama tetap tersimpan.
Pencatatan pesanan yang dibatalkan tetap memakai kuota bulan pembuatan; mengganti
tanggal transaksi tidak mengembalikan kuota. Arsip produk tidak mengosongkan slot.
Metadata pemakaian pesanan pada `tippo.usage.demo.v1` mempertahankan ID, jenis,
dan bulan pencatatan setelah **Hapus semua & mulai kosong**. Reset data transaksi
tidak mereset kuota atau paket. Memulihkan ID pesanan yang sama tidak memakai slot
dua kali; impor ID baru tetap mengikuti sisa kuota. Membersihkan contoh bawaan
tidak menghabiskan kuota untuk data usaha baru.
Paket lokal dapat diubah lewat browser dan belum menjadi pengamanan langganan
produksi. Peluncuran berbayar membutuhkan aktivasi/verifikasi Supabase dan pemeriksaan kuota di
server/database, transaksi atomik, penyedia pembayaran, serta webhook langganan.

## Dokumen produk

- [PRD: MVP, fitur nanti, alur layar, dan gaya visual](docs/PRD.md)
- [Kebutuhan data, rumus HPP, dan rancangan Supabase](docs/DATA-MODEL.md)
- [DESIGN.md: arah visual dan alasan keputusan](DESIGN.md)
- [Validasi revisi Ponytail dan Anti Slop](docs/DESIGN-VALIDATION.md)

Gaya yang dipilih pengguna: hangat dan berkarakter, dengan motif slip pesanan.
Paper `#F7F4ED`, teal `#245C4E` serta bidang pekat `#173F38`, tinta `#233D35`,
dan amber `#94501F` membedakan konteks Open PO. Landing menampilkan contoh
pesanan fiktif multi-barang dengan total dan sisa tagihan terhitung. Font
Plus Jakarta Sans dibundel lokal. Logo asli menyusul.

Pratinjau terbaru: [Jastip](docs/preview-jastip.png), [Open PO](docs/preview-po.png),
[PO mobile](docs/preview-po-mobile.png), [form PO](docs/preview-po-form.png),
[form PO mobile](docs/preview-po-form-mobile.png), dan
[pratinjau Excel](docs/preview-excel.png). Fitur terbaru:
[jastip banyak barang](docs/preview-multiitem-jastip.png),
[invoice WhatsApp](docs/preview-invoice.png), dan
[paket langganan](docs/preview-subscription.png).

Komponen Button berasal dari shadcn-ui/ui commit
`97ddbf4274ed09d02aa7fd34375f2cf1e48cbbf0`; lisensi MIT tersimpan di
[docs/shadcn-LICENSE.md](docs/shadcn-LICENSE.md).

Dropdown akun: [desktop](docs/preview-account-menu-desktop.png) dan
[mobile](docs/preview-account-menu-mobile.png). Profil bisnis, tema, dan Keluar
tersedia melalui tombol Akun. Pengaturan data berada di sidebar.

Tampilan website terbaru: [desktop](docs/preview-website-desktop.png),
[mobile](docs/preview-website-mobile.png), dan
[form daftar](docs/preview-signup-mobile.png). Arah visual dan referensi
konseptual dijelaskan di [UI-UX.md](docs/UI-UX.md).

Validasi terkini: 71 tes unit/database dan 54 workflow browser lulus
pada build produksi, termasuk pesanan multi-barang, Excel, HPP, invoice,
kuota per jenis pesanan, fokus menu ponsel, dan pemilihan bulan grafik dengan
keyboard. TypeScript, lint, dan build produksi lulus. Detail pemeriksaan
visual serta Delivery Gate ada di [laporan validasi](docs/DESIGN-VALIDATION.md).
Pengujian akun memakai respons API terkontrol dan tidak menggantikan
verifikasi proyek Supabase remote. Pembayaran Pro belum tersedia.


Template dan import Excel produk, pesanan Jastip, serta pesanan Open PO hanya tersedia untuk paket Pro. Akun Gratis diarahkan ke halaman paket dan tidak dapat mengunduh template, mengunggah, atau mengonfirmasi import. Langganan diperiksa kembali sebelum penyimpanan; kedaluwarsa mempertahankan pratinjau tanpa menyimpan data. Input manual Gratis tetap tersedia: 5 pesanan per jenis per bulan dan 5 produk termasuk arsip.

## Login dan daftar Google

Halaman `/masuk` dan `/daftar` menyediakan **Masuk dengan Google**.
Aktifkan provider Google di Supabase menggunakan OAuth Client ID/Secret dari
Google Cloud dan redirect yang sesuai. Ikuti [panduan konfigurasi](docs/GOOGLE-AUTH.md).
Secret hanya disimpan di Supabase; tombol memberi pesan dan tetap menyediakan
login email saat provider belum aktif.


Profil bisnis: **Akun → Profil bisnis** untuk mengubah nama usaha, nomor WhatsApp, dan alamat usaha. Email akun baca-saja. Profil akun tersimpan di metadata Supabase; profil demo tersimpan lokal dan tidak dipindahkan ke akun. **Pengaturan data** kini tersedia langsung di sidebar.

### Kategori produk dan refund

Kategori opsional tersedia pada master produk Open PO, pencarian/filter katalog, dan template Excel produk (import khusus Pro). Refund dicatat dari tindakan pada tabel pesanan: sebagian atau seluruh pembayaran yang tersisa, dengan opsi membatalkan pesanan. Ini pencatatan pengembalian manual, bukan transfer dana. Refund sebagian tidak mengurangi tagihan; edit pesanan jika harga/jumlah berubah. Riwayat tersimpan bersama workspace dan muncul dalam invoice. Tidak diperlukan migrasi Supabase tambahan untuk kedua fitur.

### Router callback pembayaran

Paket [payment-router](payment-router/README.md) menyiapkan router callback DOKU untuk Helipod/container atau VPS: antrean SQLite persisten, verifikasi DOKU, signature internal per aplikasi, retry, backup lokal, dan receiver Supabase Tippo. Checkout baru baru dialihkan jika secret `TIPPO_DOKU_ROUTER_URL` diaktifkan; webhook invoice lama tetap tersedia. Bukucatering belum dihubungkan. Kode dan pengujian lokal tidak berarti layanan remote sudah dipasang atau pembayaran produksi sudah dialihkan.

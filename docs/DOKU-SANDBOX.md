# Integrasi pembayaran Pro Tippo melalui DOKU — sandbox

Pengguna memilih DOKU menggantikan InterActive pada 12 Oktober 2026. Belum ada kode pembayaran provider di aplikasi. Invoice Tippo masih draf browser; pembayaran belum diaktifkan.

## Pilihan integrasi

- Pilihan pengguna: **DOKU Checkout**, dikonfirmasi pada 12 Oktober 2026. Halaman pembayaran DOKU mendukung QRIS. Tippo membuat invoice serta meminta checkout URL dari backend, lalu mengarahkan pengguna ke URL pembayaran tersebut.
- Adapter menggunakan kontrak Checkout Non-SNAP; Direct API QRIS SNAP tidak dipakai. Jangan mencampur endpoint dan signature kedua produk tersebut.
- Akses Checkout serta channel QRIS perlu dicocokkan dengan dashboard sandbox DOKU pengguna sebelum tes provider.

## Langkah awal DOKU Checkout sandbox

Jika belum memiliki akun uji, buka [pendaftaran sandbox DOKU](https://sandbox.doku.com/bo/sandbox-registration), isi nama lengkap, nama usaha (Tippo), email bisnis dan kata sandi, setujui ketentuan setelah dibaca, lalu daftarkan akun. Setelah berhasil, buka [login sandbox](https://sandbox.doku.com/bo/login). Akun sandbox terpisah dari akun produksi, sesuai [panduan pendaftaran resmi](https://developers.doku.com/get-started-with-doku-api/user-registration).

1. Masuk ke dashboard DOKU untuk lingkungan sandbox, bukan produksi.
2. Buka **Integrations > API Keys**, sesuai dokumentasi Retrieve Payment Credential. Pastikan Client ID dan Secret Key yang digunakan merupakan kredensial sandbox, serta channel QRIS tersedia pada akun uji.
3. Simpan kredensial melalui pengaturan secrets backend. Nama aplikasi yang diusulkan: `DOKU_ENV=sandbox`, `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`. Nama ini untuk konfigurasi Tippo, bukan parameter body DOKU. Jangan menggunakan `NEXT_PUBLIC_*` untuk secret atau memasukkan nilainya ke chat/Git.
4. Gunakan deployment sandbox dan database Supabase uji. Backend disarankan memakai Supabase Edge Functions agar akses administratif database tetap berada di backend. Sandbox tidak boleh mengaktifkan Pro pada database produksi.
5. Setelah endpoint notifikasi tersedia, daftarkan Notification URL HTTPS publik di konfigurasi channel DOKU yang digunakan. Endpoint webhook memverifikasi signature DOKU, bukan sesi pengguna Supabase. DOKU harus dapat mengaksesnya tanpa login Vercel atau JWT pengguna. Dokumentasi melarang domain ngrok untuk Notification URL.
6. Backend membuat invoice Pro Rp25.000 untuk satu bulan, kemudian meminta checkout ke `POST https://api-sandbox.doku.com/checkout/v1/payment`. Jangan mencoba kredensial contoh pada dokumentasi sebagai kredensial akun pengguna.
7. Pengguna membuka URL checkout dan melakukan pembayaran uji melalui [simulator resmi](https://sandbox.doku.com/integration/simulator/), mengikuti channel yang dipilih.
8. Backend menerima notifikasi terverifikasi, mencocokkan invoice, nominal, mata uang, merchant dan status sukses, lalu memperpanjang Pro di database uji secara atomik dan satu kali per invoice.

Tidak ada kredensial DOKU di environment workspace saat panduan dibuat. URL Supabase dan publishable key tersedia; akses deploy/admin Supabase uji perlu disiapkan untuk menguji aktivasi server. Sandbox provider belum dipanggil karena kredensial akun belum tersedia.

## Alur Tippo

**Paket & langganan → Bayar Pro → invoice pending di server → checkout DOKU → simulasi pembayaran → notifikasi terverifikasi → invoice paid → Pro aktif.**

- Nominal Rp25.000 dan durasi satu bulan ditentukan backend. Backend memverifikasi sesi pengguna pada permintaan membuat invoice, dan menentukan pemilik dari sesi tersebut.
- Invoice perlu tersimpan di database, bukan hanya localStorage. Simpan ID internal, nomor invoice DOKU, pemilik, lingkungan, nominal, mata uang, status, URL checkout, waktu dibuat dan kedaluwarsa.
- Gunakan request ID unik dan penanganan idempotensi serta timeout sesuai kontrak DOKU. Cegah double-click membuat beberapa invoice aktif tanpa alasan.
- Request Checkout memakai header Client-Id, Request-Id, Request-Timestamp dan Signature Non-SNAP. Signature HMAC-SHA256 harus dibuat server sesuai dokumentasi, menggunakan body yang persis dikirim. Jangan menyamakan signature notifikasi dengan signature respons API.
- Untuk Checkout QRIS, dokumentasi Supported Payment Methods menggunakan nilai `QRIS` pada `payment.payment_method_types`; tetap pastikan channel tersebut aktif pada akun sandbox.
- URL kembali (callback/redirect) hanya mengembalikan pengguna ke Tippo. Kedatangan pengguna pada URL tersebut tidak membuktikan transaksi lunas.
- Notifikasi palsu, invoice milik akun lain, nominal tidak sesuai, lingkungan berbeda dan status non-sukses tidak mengaktifkan Pro. Validasi signature berdasarkan raw body, path endpoint dan header sesuai spesifikasi notifikasi yang dipilih.
- Perubahan invoice paid dan entitlement harus satu transaksi database. Notifikasi duplikat tidak menambah masa Pro dua kali. Jika Pro masih aktif, perpanjang dari waktu berakhir; jika sudah habis, dari waktu aktivasi.
- UI Tippo memuat ulang invoice dan entitlement dari server. Pembayaran pending/gagal/kedaluwarsa tetap ditampilkan sesuai statusnya.
- Ini pembayaran satu periode Pro; belum merupakan penagihan berulang otomatis atau penyimpanan metode pembayaran pelanggan.

## Validasi yang dibutuhkan

Tes signature valid/palsu dan raw body berubah, sesi/kepemilikan invoice, nominal dimanipulasi, idempotensi create, notifikasi sukses/pending/gagal/duplikat, pembayaran setelah expiry sesuai status otoritatif provider, kegagalan database, satu kali perpanjangan Pro, dan pemisahan lingkungan. Lanjutkan dengan pembayaran simulator DOKU serta notifikasi ke endpoint HTTPS sandbox. Jangan menyebut tes mock sebagai pembayaran DOKU end-to-end.

## Referensi resmi yang dibaca

- [Backend Checkout](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration)
- [Simulate Payment and Notification](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/simulate-payment-and-notification)
- [Supported Payment Methods](https://developers.doku.com/accept-payments/doku-checkout/configuration/supported-payment-methods)
- [Retrieve Payment Credential](https://developers.doku.com/get-started-with-doku-api/retrieve-payment-credential)
- [Notification](https://developers.doku.com/get-started-with-doku-api/notification)
- [Setup Notification URL](https://developers.doku.com/get-started-with-doku-api/notification/setup-notification-url)
- [Direct API QRIS SNAP](https://developers.doku.com/accept-payments/direct-api/snap/integration-guide/qris)

Panduan ini belum menerapkan migration, kode pembayaran, secret, konfigurasi dashboard, deployment atau aktivasi langganan.

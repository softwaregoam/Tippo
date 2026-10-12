# Integrasi pembayaran Pro Tippo melalui DOKU — sandbox

Pengguna memilih DOKU Checkout menggantikan InterActive pada 12 Oktober 2026. Backend dan tampilan sandbox sudah disiapkan dalam repository. Deployment fungsi, pemasangan secret, migration remote dan pembayaran simulator belum dijalankan. Tampilan pembayaran sandbox mati secara default; invoice draf lama tetap digunakan jika flag sandbox tidak diaktifkan.

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
8. Backend menerima notifikasi terverifikasi, mencocokkan invoice, nominal, mata uang, merchant dan status sukses, lalu memperpanjang simulasi masa Pro secara atomik dan satu kali per invoice. Simulasi disimpan di tabel sandbox terpisah, tanpa mengubah `tippo_workspaces.pro_until`, paket atau kuota produksi.

Tidak ada kredensial DOKU di environment workspace saat panduan dibuat. URL Supabase dan publishable key tersedia; akses deploy/admin Supabase uji perlu disiapkan untuk menguji aktivasi server. Sandbox provider belum dipanggil karena kredensial akun belum tersedia.

## Alur Tippo

**Paket & langganan → Buat pembayaran sandbox → invoice pending di server → checkout DOKU → simulator → notifikasi terverifikasi → invoice paid → simulasi masa Pro bertambah.** Paket dan kuota akun produksi tetap mengikuti entitlement aslinya.

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

## Pemasangan backend yang sudah disiapkan

1. Pastikan Supabase proyek uji sudah memiliki Auth dan RPC workspace Tippo. Untuk proyek baru, ikuti [setup Supabase Tippo](SUPABASE-SETUP.md) dan pasang migration aplikasi terlebih dahulu. Lalu buka **SQL Editor** dan jalankan seluruh [migration sandbox](../supabase/migrations/202610120001_doku_sandbox.sql). Script tidak mengubah tabel workspace maupun entitlement produksi. Tiga tabel sandbox baru dilindungi RLS; browser hanya boleh membaca metadata invoice miliknya, bukan Client ID/body request provider. RPC mutasi hanya dapat dipanggil `service_role` backend.
2. Buka **Edge Functions → Secrets** dan isi nilai langsung di dashboard:

   | Nama | Nilai |
   | --- | --- |
   | `DOKU_ENV` | `sandbox` |
   | `DOKU_CLIENT_ID` | Client ID sandbox dari dashboard DOKU |
   | `DOKU_SECRET_KEY` | Secret Key sandbox dari dashboard DOKU |
   | `TIPPO_SITE_URL` | Origin HTTPS deployment Preview Tippo, tanpa path; harus cocok persis dengan origin yang digunakan browser |

   `SUPABASE_URL`, `SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` tersedia otomatis di Edge Runtime. Jangan menyalin service-role key ke Next.js/Vercel `NEXT_PUBLIC_*`. Secret DOKU dipakai server untuk HMAC dan tidak dikembalikan oleh endpoint.
3. Dari checkout repository di komputer dengan Supabase CLI, jalankan login dan deployment. Ganti placeholder project ref dengan ID proyek Supabase uji, bukan URL atau nama proyek:

   ```sh
   supabase login
   supabase functions deploy tippo-doku-sandbox --project-ref <PROJECT_REF> --use-api --no-verify-jwt
   ```

   [CLI resmi](https://supabase.com/docs/reference/cli/supabase-functions-deploy) mendokumentasikan `--use-api` untuk bundling server. Fungsi memakai `supabase/functions/deno.json` dan konfigurasi `verify_jwt=false` karena DOKU tidak memiliki JWT Supabase. Handler tetap memverifikasi sesi Supabase pada endpoint checkout/status dan signature DOKU pada webhook. Jangan menonaktifkan verifikasi di handler.
4. Gunakan branch **doku-sandbox** untuk Preview. Di Vercel untuk **Preview saja**, isi `NEXT_PUBLIC_DOKU_SANDBOX_ENABLED=true`, beserta URL Supabase uji dan publishable key-nya, lalu rebuild. Jangan mengaktifkan flag pada deployment produksi. Izinkan origin Preview itu sebagai redirect Auth Supabase jika pengguna perlu login Google. Isi `TIPPO_SITE_URL` dengan origin Preview stabil yang sama; pengaturan origin yang berbeda akan ditolak CORS.
5. Daftarkan **Notification URL** berikut pada konfigurasi pembayaran QRIS di dashboard DOKU sandbox. Ganti placeholder project ref:

   ```text
   https://<PROJECT_REF>.supabase.co/functions/v1/tippo-doku-sandbox/webhook
   ```

   Fungsi juga memasang URL tersebut pada `additional_info.override_notification_url` di permintaan Checkout. Pastikan konfigurasi channel menerima notifikasi. Tidak diperlukan JWT pengguna untuk panggilan DOKU; signature HMAC tetap wajib.
6. Masuk ke akun uji di Preview Tippo, buka Paket & langganan, klik **Buat pembayaran sandbox**, lalu **Buka pembayaran DOKU**. Selesaikan simulasi di simulator DOKU. Klik **Cek status pembayaran** di Tippo untuk membaca status server setelah webhook tersimpan. Tombol cek hanya membaca database; aplikasi tidak melakukan polling cepat ke DOKU. Redirect kembali ke `/app?billing=sandbox` membuka panel langganan, tanpa menjadikan redirect sebagai bukti pembayaran.
7. Setelah status Lunas (sandbox), ulangi notifikasi/cek status: simulasi masa Pro tidak boleh bertambah dua kali untuk invoice yang sama. **Uji perpanjangan Pro** membuat invoice baru. Periksa bahwa paket akun produksi tetap Gratis/Pro sesuai entitlement sebelumnya.

Jika create timeout, invoice berstatus creating tetap disimpan dan retry memakai Request-Id serta body yang sama. Respons idempotensi DOKU 409 diterima bila memuat data Checkout yang cocok. Notifikasi FAILED adalah percobaan pembayaran gagal dan tidak membatalkan invoice Checkout; notifikasi SUCCESS tetap dapat diterima kemudian. Notifikasi EXPIRED mengakhiri invoice belum lunas; notifikasi duplikat tidak mengubah invoice paid.

Jika dashboard menampilkan `Failed to update notify URL`, periksa endpoint dan lingkungan dashboard sebelum menyimpulkan penyebabnya. GET/HEAD pada URL webhook memiliki pemeriksaan ketersediaan HTTP 200; ini tidak membaca atau mengubah database. POST tanpa signature tetap HTTP 401. Setelah pembaruan fungsi, deploy ulang sebelum mencoba menyimpan URL. Jika masih gagal, ambil status HTTP dan pesan respons permintaan Save dari DevTools Network; jangan membagikan Cookie, Authorization header atau secret. Health check tidak membuktikan bahwa DOKU memakai GET saat memvalidasi URL.

## Pengujian lokal

Kode signature, handler HTTP dan migration diuji dengan PostgreSQL/PGlite lokal dan transport DOKU terkontrol. Ini bukan bukti kredensial merchant atau pembayaran simulator remote. Deno memeriksa entry Edge Function; Next.js lint/build memeriksa frontend dan shared types.

```sh
node --experimental-strip-types --test tests/doku-billing.test.ts tests/pro-invoice.test.ts tests/subscription.test.ts
DENO_DIR=/tmp/tippo-deno-cache npx --cache /tmp/tippo-tool-cache --yes deno check --config supabase/functions/deno.json supabase/functions/tippo-doku-sandbox/index.ts
NEXT_PUBLIC_DOKU_SANDBOX_ENABLED=true npm run build
npm run start -- --port 3004
# Di terminal kedua, setelah server siap:
PLAYWRIGHT_DOKU_SANDBOX=true PLAYWRIGHT_BASE_URL=http://localhost:3004 npx playwright test tests/website.spec.ts --grep 'DOKU sandbox'
```

Jangan menjalankan build lain saat tes browser masih memakai server dari build tersebut. Tes browser sandbox memiliki flag tersendiri; tidak dijalankan pada build normal tanpa panel sandbox. Migration diuji lokal, tetapi tetap harus dipasang melalui SQL Editor proyek uji sebelum deployment remote dapat digunakan.

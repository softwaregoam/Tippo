# Uji produksi DOKU SNAP — Virtual Account BNI Rp10

**Panduan historis.** Pengguna kembali memilih [DOKU Checkout](DOKU-PRODUCTION-TEST.md). Alur SNAP tidak ditampilkan pada aplikasi; jangan aktifkan fungsi SNAP untuk alur Checkout.

Alur SNAP baru memakai DGPC (DOKU Generate Payment Code), closed amount Rp10, VA sekali pakai dan masa bayar 60 menit. Nomor VA muncul di Tippo dan dapat disalin. Ini pembayaran nyata khusus penguji, tidak mengaktifkan Pro; harga langganan tetap Rp25.000.

Integrasi Checkout Non-SNAP lama tetap terpisah. Aktifkan SNAP dan matikan flag produksi Checkout lama agar pengguna hanya melihat satu alur pengujian.

## 1. Database

Jalankan seluruh isi [migration SNAP](../supabase/migrations/202610120003_doku_snap_test.sql) melalui SQL Editor Supabase pada project bkplemoflteubfgvqhke. Migration dapat dijalankan ulang. Invoice, notifikasi dan hak akses SNAP terpisah dari Checkout maupun langganan asli.

## 2. Secrets Supabase

Di Supabase → Edge Functions → Secrets:

| Nama | Isi |
| --- | --- |
| DOKU_SNAP_TEST_ENABLED | true |
| DOKU_PRODUCTION_CLIENT_ID | Client ID produksi untuk brand yang telah mengaktifkan BNI VA SNAP |
| DOKU_PRODUCTION_SECRET_KEY | Secret Key produksi brand tersebut |
| DOKU_SNAP_PRIVATE_KEY | Seluruh Private Key RSA PKCS#8 PEM, pasangan Public Key yang sudah terdaftar di DOKU |
| DOKU_SNAP_BNI_PARTNER_SERVICE_ID | BIN/company code BNI yang diberikan DOKU; string 8 karakter, termasuk padding spasi jika diperlukan |
| DOKU_SNAP_BNI_CUSTOMER_PREFIX | Prefix sub-BIN/customerNo untuk mode DGPC yang diberikan DOKU |
| DOKU_PRODUCTION_TEST_USER_IDS | User UID akun Tippo penguji dari Authentication → Users; beberapa UID dipisahkan koma |
| TIPPO_SITE_URL | Origin situs yang dipakai menguji, misalnya https://tippo-git-doku-sandbox-jq13.vercel.app atau https://tippo.vercel.app |

Jangan memakai BIN/prefix contoh dari dokumentasi. Minta DOKU bila konfigurasi merchant tidak menampilkannya. Status VA aktif belum membuktikan BIN/prefix DGPC sudah disiapkan.

Private Key harus dimulai dengan BEGIN PRIVATE KEY (PKCS#8), bukan BEGIN RSA PRIVATE KEY. Jika file lama masih PKCS#1, konversi di Git Bash lokal:

    openssl pkcs8 -topk8 -nocrypt -in private.pem -out private-pkcs8.pem

Jangan menjalankan perintah itu jika file sumber dan tujuan sama. Gunakan output private-pkcs8.pem di Secrets; konversi format mempertahankan pasangan Public Key. Private Key tidak dikirim ke chat/Git/Vercel. Backend menerima newline PEM asli atau literal \n.

TIPPO_SITE_URL dipakai bersama fungsi pembayaran lama, jadi sesuaikan dengan origin yang digunakan. Nilai secret tidak tersedia di workspace pengembangan ini.

## 3. Deploy dari folder proyek Tippo

Buka folder Tippo yang berisi package.json dan supabase di File Explorer, ketik cmd di kolom alamat, tekan Enter. Pastikan repository lokal sudah mengambil perubahan terbaru.

    npx supabase login
    npx supabase functions deploy tippo-doku-snap-test --project-ref bkplemoflteubfgvqhke --no-verify-jwt --use-api --import-map supabase/functions/deno.json

Gateway JWT dinonaktifkan hanya karena DOKU tidak membawa sesi Supabase. Checkout/status di dalam fungsi tetap memverifikasi sesi pengguna dan daftar akun penguji. Webhook hanya menerima POST dengan HMAC-SHA512 sah yang mengikat method, path, bearer token, minified body dan timestamp.

## 4. Notifikasi DOKU

Menurut dokumentasi resmi: **Settings → Payment Settings → Virtual Account SNAP → BNI → Configure**. Jika dashboard hanya menampilkan Virtual Account, buka menu tersebut dan cari tab SNAP/configuration BNI. Jika tidak tersedia, minta DOKU memastikan kanal SNAP untuk brand ini.

Isi Notification URL:

    https://bkplemoflteubfgvqhke.supabase.co/functions/v1/tippo-doku-snap-test/webhook

Halaman HTTP Notifications → Pengaturan hanya mengatur email ketika pengiriman gagal; bukan tempat mengisi URL. Endpoint QRIS Notify URL tidak dipakai untuk VA.

GET webhook memberi health response setelah konfigurasi fungsi tersedia; GET tidak mencatat pembayaran. Jangan mengganti signature dengan token Supabase atau menonaktifkan verifikasi HMAC. Bila konfigurasi DOKU meminta merchant Get Token URL/kontrak token masuk tambahan, hubungi DOKU untuk memastikan kontraknya sebelum pengujian pembayaran; token issuer merchant belum diimplementasikan. Handler menerima kontrak notifikasi VA BNI yang terdokumentasi dengan Authorization, CHANNEL-ID H2H dan HMAC merchant.

## 5. Vercel dan pengujian

Set pada environment Vercel yang digunakan:

    NEXT_PUBLIC_DOKU_SNAP_TEST_ENABLED=true
    NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED=false
    NEXT_PUBLIC_DOKU_SANDBOX_ENABLED=false

Redeploy, login dengan akun penguji, buka Paket & langganan atau /app?billing=snap-test. Pilih **Buat VA BNI Rp10**, lalu **Salin nomor VA**. Pastikan nama penerima dan total sesuai sebelum membayar di aplikasi bank.

Tombol Cek status pembayaran membaca ledger server dari notifikasi terverifikasi; bukan polling API Check Status DOKU. Jika notifikasi gagal, gunakan riwayat HTTP Notifications untuk kirim ulang setelah penyebabnya diperbaiki. Jangan menganggap redirect, screenshot transfer atau VA yang berhasil dibuat sebagai bukti lunas.

Rp10 belum dipastikan diterima bank/DOKU. Penolakan tidak menaikkan nominal. Timeout mempertahankan invoice, body dan external ID; konflik 409 tidak membuat invoice pengganti. Periksa dashboard DOKU jika VA dibuat tetapi respons hilang. Jangan mencoba membayar invoice kedaluwarsa.

Setelah selesai, matikan DOKU_SNAP_TEST_ENABLED dan NEXT_PUBLIC_DOKU_SNAP_TEST_ENABLED, lalu redeploy. Nonaktifkan juga DOKU_PRODUCTION_TEST_ENABLED bila fungsi Checkout lama sudah tidak diuji. Invoice lama tetap disimpan untuk rekonsiliasi. Notifikasi lama dapat gagal setelah fungsi dimatikan; selesaikan rekonsiliasi invoice pending sebelum mematikannya.

## Validasi lokal dan keterbatasan

Tes menggunakan key RSA sementara, transport DOKU tiruan dan PostgreSQL PGlite, bukan merchant produksi. Cakupan: signature independen RSA/HMAC, jumlah/kepemilikan, sesi dan allowlist, RLS, notifikasi palsu/berulang/datang lebih awal, kegagalan DB, timeout/409, URL instruksi dan pemisahan entitlement.

Kredensial merchant, BIN/prefix, deployment remote dan transaksi bank nyata masih diperlukan untuk membuktikan integrasi produksi. Akses API SNAP aktif dan Public Key terdaftar perlu dikonfirmasi pada brand yang Client ID-nya dipakai.

## Referensi

- [BNI Virtual Account SNAP](https://developers.doku.com/accept-payments/direct-api/snap/integration-guide/virtual-account/bni-virtual-account)
- [B2B Token](https://developers.doku.com/accept-payments/direct-api/snap/integration-guide/get-token-api/b2b)
- [Asymmetric Signature](https://developers.doku.com/get-started-with-doku-api/signature-component/snap/asymmetric-signature)
- [Symmetric Signature](https://developers.doku.com/get-started-with-doku-api/signature-component/snap/symmetric-signature)
- [Setup Notification URL](https://developers.doku.com/get-started-with-doku-api/notification/setup-notification-url)

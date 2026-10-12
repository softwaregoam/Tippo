# Pembayaran Tippo Pro melalui DOKU Checkout

Tippo Pro Rp25.000 untuk satu bulan kalender memakai popup resmi DOKU. Invoice pelanggan, status dan riwayat tersimpan di database. Pro baru diberikan setelah notifikasi SUCCESS yang signature, merchant, nominal, invoice dan Request ID-nya diverifikasi. Callback browser, popup ditutup, atau pembayaran uji tidak mengaktifkan Pro.

## Pemasangan

1. Dalam folder checkout Tippo, jalankan `git pull origin main`.
2. Di Supabase → SQL Editor, jalankan seluruh [migration 010](../supabase/migrations/202610120010_doku_pro_billing.sql). Migration workspace utama harus sudah terpasang. Migration billing uji 001–009 tetap dipertahankan bila fitur tes masih dipakai.
3. Di Supabase → Edge Functions → Secrets, tambahkan **DOKU_PRO_ENABLED=true**. Gunakan kembali `DOKU_PRODUCTION_CLIENT_ID`, `DOKU_PRODUCTION_SECRET_KEY`, dan `TIPPO_SITE_URL=https://tippo.vercel.app` yang sudah benar. Jangan memasukkan secret ke Vercel/NEXT_PUBLIC atau kode. Variabel Supabase bawaan tetap dipakai fungsi.
4. Deploy kedua fungsi di bawah. Fungsi tes tetap dipertahankan; pembaruannya mengarahkan invoice uji baru ke URL notifikasi bersama ketika Pro diaktifkan. Endpoint webhook lama tetap menerima notifikasi invoice uji lama.

```bash
npx supabase functions deploy tippo-doku-pro --project-ref bkplemoflteubfgvqhke --no-verify-jwt --use-api --import-map supabase/functions/deno.json
npx supabase functions deploy tippo-doku-production-test --project-ref bkplemoflteubfgvqhke --no-verify-jwt --use-api --import-map supabase/functions/deno.json
```

5. Di konfigurasi notifikasi **DOKU Checkout produksi**, simpan:

```text
https://bkplemoflteubfgvqhke.supabase.co/functions/v1/tippo-doku-pro/webhook
```

Gunakan konfigurasi Checkout, bukan Direct API SNAP atau kolom email kegagalan notifikasi. `override_notification_url` invoice baru memakai URL yang sama; ini menghindari perbedaan path dengan URL yang dikonfigurasi di DOKU. URL bersama merutekan TPR (Pro) dan TPT (tes) ke ledger yang berbeda, sambil tetap memverifikasi signature asli. Jika fitur tes tetap aktif, pertahankan `DOKU_PRODUCTION_TEST_ENABLED=true` dan `DOKU_PRODUCTION_TEST_USER_IDS` yang sudah terpasang.

6. Untuk aksi Batalkan, aktifkan **Settings → Checkout Appearance → System Settings → Order Settings → Order Cancellation**. DOKU mendukung QRIS dan Bank Transfer kecuali BTN, BNC, BPD, OCBC. Channel lain dapat menolak pembatalan; status tidak diubah menjadi Dibatalkan saat ditolak atau belum terkonfirmasi. Pembatalan bukan refund.
7. Di Vercel → Environment Variables, tambahkan **NEXT_PUBLIC_DOKU_PRO_ENABLED=true** untuk Production. Redeploy sampai Ready. Flag uji Rp10.000 tidak perlu dihapus; panel tes tetap terpisah sampai pengguna mengizinkan penghapusannya. Sandbox dapat tetap `false` untuk website produksi.

## Perilaku

- Satu invoice aktif per akun; harga, periode dan pemilik ditentukan backend, bukan input browser.
- Nama/email pelanggan dibaca dari akun dan disimpan bersama body request yang tetap sama saat retry.
- Nomor invoice TPR + 24 karakter hex, sesuai batas Checkout kartu kredit.
- Pembayaran pertama menambah satu bulan kalender dalam zona waktu Jakarta dari waktu verifikasi. Jika Pro masih aktif, perpanjangan dihitung dari akhir masa aktif. Tidak ada penagihan atau auto-debit berulang.
- Notifikasi ulang tidak memperpanjang masa Pro dua kali. Pembayaran sah yang datang terlambat tetap direkonsiliasi. Membatalkan invoice belum lunas tidak mengubah Pro yang telah dibayar.
- Setelah popup ditutup atau Cek status ditekan, UI membaca ledger dan memuat ulang entitlement terverifikasi melalui RPC workspace. Data usaha dan versi penyimpanan tidak diganti oleh refresh langganan.
- Riwayat berlangganan menampilkan 20 invoice terbaru, status dan periode invoice lunas. Invoice pending dapat dicek statusnya atau dibatalkan dengan konfirmasi.
- Riwayat dibatasi berdasarkan ID akun dari sesi yang telah diverifikasi backend; parameter pemilik dari browser tidak digunakan. RLS juga menolak pembacaan invoice akun lain. Email akun ditampilkan sebagai konteks riwayat.
- Desktop memakai tabel invoice dan periode. Ponsel memakai daftar ringkas yang dapat dibuka untuk melihat tanggal pembayaran, periode Pro atau batas bayar. Tombol cek status, batalkan dan konfirmasinya berada dalam detail invoice dengan ukuran penuh; halaman tidak perlu digeser ke samping.
- Status dibaca dari notifikasi yang sudah tersimpan. Jika pembayaran sudah dilakukan tetapi masih pending, cek HTTP Notification DOKU dan Logs Edge Function, lalu kirim ulang notifikasi melalui DOKU. Jangan menetapkan status paid/Pro secara manual untuk menutupi webhook yang gagal.
- Invoice uji dan sandbox tidak memberikan entitlement produksi. Draf invoice lokal lama bukan transaksi DOKU dan tidak dimigrasikan menjadi tagihan.
- Panel uji Rp10.000 hanya ditampilkan setelah backend mengonfirmasi akun ada di `DOKU_PRODUCTION_TEST_USER_IDS`. Panel tetap tersembunyi selama pemeriksaan dan untuk akun yang tidak terdaftar. Daftar penguji tidak dikirim ke frontend; status, pembuatan dan pembatalan pembayaran uji tetap dilindungi backend.

## Validasi setelah deployment

Buka Paket & langganan, buat invoice Rp25.000, dan periksa nama/email serta invoice pada Checkout Order Report DOKU. Pastikan popup dapat ditutup tanpa membatalkan invoice. Jika hendak melakukan pembayaran nyata, setelah pembayaran selesai pastikan webhook mendapat HTTP 200, invoice menjadi Lunas, periode langganan muncul dan Paketmu berubah menjadi Pro. Refresh halaman untuk memastikan Pro tersimpan pada server. Pembayaran nyata tidak dijalankan oleh tes lokal.

Tes otomatis memakai PostgreSQL PGlite dan transport DOKU tiruan: RLS, harga/pemilik tetap, signature, pemisahan tes, pemberian/perpanjangan tepat sekali, pembatalan, riwayat, popup dan refresh paket di desktop/ponsel. Build untuk tes UI:

```bash
NEXT_PUBLIC_DOKU_PRO_ENABLED=true NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED=true npm run build
npm run start -- --port 3137
PLAYWRIGHT_DOKU_PRO_ENABLED=true PLAYWRIGHT_DOKU_PRODUCTION_TEST=true PLAYWRIGHT_BASE_URL=http://localhost:3137 npx playwright test tests/website.spec.ts --grep 'DOKU (Pro|production)'
```

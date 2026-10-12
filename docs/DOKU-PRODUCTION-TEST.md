# Uji QRIS produksi Rp10

Pengujian terbaru menggunakan [SNAP Virtual Account BNI](DOKU-SNAP-TEST.md). Panduan ini tetap menjelaskan alur Checkout QRIS lama; fungsi, migration dan Notification URL keduanya berbeda.

Invoice uji terpisah dari langganan Pro Rp25.000. Pembayaran ini memakai uang nyata dan tidak mengaktifkan Pro. Nominal dikunci Rp10 di database/backend; jika DOKU atau aplikasi pembayaran menolak, tidak ada kenaikan nominal otomatis. Batas minimum QRIS pada merchant ini belum terkonfirmasi.

## Pemasangan

1. Jalankan [migration produksi uji](../supabase/migrations/202610120002_doku_production_test.sql) melalui Supabase → SQL Editor pada project bkplemoflteubfgvqhke. Tabel sandbox dan langganan asli tetap terpisah.
2. Buka DOKU **produksi**, ambil Client ID dan Secret Key untuk Checkout, serta pastikan QRIS aktif. Kredensial sandbox tidak dapat dipakai.
3. Supabase → Authentication → Users: salin **User UID** akun Tippo milikmu.
4. Supabase → Edge Functions → Secrets: tambahkan:
   - DOKU_PRODUCTION_CLIENT_ID: Client ID produksi.
   - DOKU_PRODUCTION_SECRET_KEY: Secret Key produksi.
   - DOKU_PRODUCTION_TEST_ENABLED: true.
   - DOKU_PRODUCTION_TEST_USER_IDS: User UID tadi (beberapa UUID dipisahkan koma).
   - TIPPO_SITE_URL: https://tippo-git-doku-sandbox-jq13.vercel.app untuk memakai preview pengujian yang ada. Jika memakai deployment utama, gunakan https://tippo.vercel.app dan aktifkan flag frontend di environment Production.

Jangan memasukkan secret ke Git, chat, atau variabel NEXT_PUBLIC. TIPPO_SITE_URL dipakai bersama sandbox: sesuaikan origin frontend yang digunakan kedua fungsi.

5. Dari terminal di folder repository:

```sh
npx supabase login
npx supabase functions deploy tippo-doku-production-test --project-ref bkplemoflteubfgvqhke --no-verify-jwt --use-api --import-map supabase/functions/deno.json
```

Gateway JWT dimatikan hanya untuk webhook DOKU. Endpoint checkout/status tetap memeriksa sesi Supabase dan daftar akun penguji; webhook POST wajib signature sah.

6. Pada konfigurasi notifikasi **DOKU Checkout produksi**, simpan:

```text
https://bkplemoflteubfgvqhke.supabase.co/functions/v1/tippo-doku-production-test/webhook
```

Konfigurasi notifikasi dashboard harus tersedia agar override_notification_url dapat digunakan. Jika dashboard mengembalikan “The product has not been Activated”, hubungi DOKU untuk aktivasi produk Checkout pada merchant/brand terkait.

7. Vercel → Settings → Environment Variables: NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED=true pada environment pengujian yang digunakan; redeploy. Flag sandbox boleh dimatikan untuk mengurangi kebingungan.
8. Masuk memakai akun yang UID-nya terdaftar → Paket & langganan → **Uji QRIS produksi → Siapkan pembayaran Rp10 → Buka pembayaran DOKU**. Bayar secara manual, lalu klik **Cek status pembayaran**. Redirect saja tidak menandakan lunas.
9. Setelah selesai, matikan kedua flag produksi uji dan redeploy. Simpan ledger invoice untuk rekonsiliasi.

## Validasi

Tes lokal memakai transport DOKU tiruan dan PostgreSQL PGlite: nominal tetap Rp10, pembatasan akun, signature/replay, kegagalan provider, pemisahan entitlement dan RLS. Ini tidak membuktikan merchant menerima Rp10. Deployment remote, aktivasi merchant, pembayaran nyata dan penerimaan webhook harus diperiksa setelah pemasangan.

Endpoint produksi mengikuti [Checkout backend integration](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration); host checkout jokul.doku.com mengikuti [frontend integration](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/frontend-integration).

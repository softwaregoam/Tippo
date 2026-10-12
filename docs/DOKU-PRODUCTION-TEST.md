# Uji DOKU Checkout produksi Rp10.000

Pilihan terbaru pengguna adalah **DOKU Checkout**, bukan Direct API SNAP. Pengguna memilih metode pembayaran di halaman DOKU. Private Key RSA dan BIN/prefix VA BNI tidak diperlukan.

Invoice uji terpisah dari langganan Pro Rp25.000. Pembayaran ini memakai uang nyata dan tidak mengaktifkan Pro. Nominal dikunci Rp10.000 di database/backend; jika DOKU atau aplikasi pembayaran menolak, tidak ada kenaikan nominal otomatis. Batas minimum mengikuti metode pembayaran yang dipilih dan belum terkonfirmasi.

## Pemasangan

1. Jalankan [migration produksi uji](../supabase/migrations/202610120002_doku_production_test.sql) melalui Supabase → SQL Editor pada project bkplemoflteubfgvqhke. Lalu jalankan [migration pilihan metode Checkout](../supabase/migrations/202610120004_doku_checkout_methods.sql) dan [migration nominal Rp1.000](../supabase/migrations/202610120005_doku_checkout_test_1000.sql), kemudian [migration nominal terbaru Rp10.000](../supabase/migrations/202610120006_doku_checkout_test_10000.sql). Tabel sandbox dan langganan asli tetap terpisah.
2. Buka DOKU **produksi**, ambil Client ID dan Secret Key untuk Checkout, serta pastikan metode pembayaran yang ingin dipakai sudah aktif. Kredensial sandbox tidak dapat dipakai.
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

7. Vercel → Settings → Environment Variables: NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED=true pada environment pengujian yang digunakan; NEXT_PUBLIC_DOKU_SNAP_TEST_ENABLED=false dan NEXT_PUBLIC_DOKU_SANDBOX_ENABLED=false. Redeploy. Supabase: set DOKU_SNAP_TEST_ENABLED=false bila fungsi SNAP sebelumnya pernah deployed.
8. Masuk memakai akun yang UID-nya terdaftar → Paket & langganan → **Uji pembayaran produksi → Siapkan pembayaran Rp10.000 → Buka pembayaran DOKU**. Bayar secara manual, lalu klik **Cek status pembayaran**. Redirect saja tidak menandakan lunas.
9. Setelah selesai, matikan kedua flag produksi uji dan redeploy. Simpan ledger invoice untuk rekonsiliasi.

## Validasi

Pembaruan format: jalankan [migration invoice Checkout](../supabase/migrations/202610120007_doku_checkout_invoice_format.sql) setelah migration nominal. Invoice baru berisi 27 karakter alfanumerik tanpa simbol. DOKU membatasi invoice maksimal 30 karakter jika channel kartu kredit aktif, dan KKI tidak menerima simbol. Invoice lama 36 karakter ditutup secara lokal saat invoice baru dibuat; body/nomor lama tetap disimpan untuk rekonsiliasi.

Jika permintaan ditolak, backend mengembalikan HTTP provider dan kode error yang telah divalidasi, tanpa pesan mentah/header/kredensial. Tampilan memperbarui status invoice gagal dari server. Kode penolakan membantu diagnosis; pesan umum sebelumnya tidak membuktikan nominal terlalu kecil.

Tes lokal memakai transport DOKU tiruan dan PostgreSQL PGlite: nominal tetap Rp10.000, pembatasan akun, signature/replay, kegagalan provider, pemisahan entitlement dan RLS. Ini tidak membuktikan merchant menerima Rp10.000. Deployment remote, aktivasi merchant, pembayaran nyata dan penerimaan webhook harus diperiksa setelah pemasangan.

Endpoint produksi mengikuti [Checkout backend integration](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration); host checkout jokul.doku.com mengikuti [frontend integration](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/frontend-integration).

Invoice baru tidak mengirim payment_method_types, sehingga DOKU menampilkan seluruh metode yang tersedia pada merchant. Invoice lama mempertahankan body/Request ID aslinya untuk rekonsiliasi; link yang sudah terbit di DOKU tidak dibatalkan oleh migration.

Lokasi Notification URL perlu dicocokkan dengan konfigurasi Checkout/brand DOKU. HTTP Notifications → Pengaturan adalah pengaturan email kegagalan pengiriman, bukan kolom URL webhook. Jika konfigurasi Checkout tidak terlihat, minta DOKU menunjukkan konfigurasi notifikasi Checkout Non-SNAP untuk Client ID/brand tersebut; jangan memakai konfigurasi Direct API SNAP.

Perubahan nominal: invoice uji baru dikunci Rp10.000. Invoice Rp10/Rp1.000 yang masih creating/pending ditutup secara lokal saat membuat invoice baru; request body dan nomor lama tetap disimpan, dan notifikasi pembayaran lama tetap dapat direkonsiliasi. Ini tidak membatalkan link yang sudah diterbitkan DOKU. Nominal notifikasi harus cocok dengan invoice terkait; pembayaran Rp10/Rp1.000 tidak melunasi invoice Rp10.000.

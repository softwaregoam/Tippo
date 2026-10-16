# Router callback DOKU untuk Tippo

Paket ini memusatkan **penerimaan dan pengiriman ulang notifikasi pembayaran**. Checkout, pembatalan, invoice, dan aktivasi langganan tetap dikelola Tippo/Supabase. Bukucatering belum dihubungkan. Tidak membutuhkan proyek Supabase baru atau database PostgreSQL di Helipod.

```text
DOKU -- signature DOKU --> router Node.js
                           |
                           +-- SQLite di volume persisten
                           |
                           +-- worker + signature internal --> tippo-payment-events
                                                              |
                                                              +-- validasi invoice dan nominal
                                                              +-- ledger pembayaran Tippo
                                                              +-- aktivasi Pro sekali saja
```

## Yang sudah tersedia

- `POST /webhooks/doku`: batas body 64 KB, verifikasi signature terhadap body asli dan path router, pemeriksaan merchant, mata uang, nominal, status, dan prefix.
- Hanya invoice `TPR` + 24 karakter hex milik langganan Pro Rp25.000 yang dirutekan. Prefix lain termasuk invoice test `TPT` ditolak; tidak dianggap berhasil diproses.
- Notifikasi disimpan secara transaksional sebelum balasan sukses ke DOKU. Kegagalan disk/database menghasilkan 503 agar DOKU mencoba ulang.
- SQLite WAL, `synchronous=FULL`, satu replica, lease antrean untuk pemulihan setelah proses mati, deduplikasi berdasarkan Request-Id dan digest.
- Worker mengirim ke satu URL Supabase yang disetel operator. URL dalam payload pembayaran tidak dipakai. Redirect HTTP tidak diikuti.
- Signature internal berbeda dari secret DOKU, mengikat aplikasi, metode, path, ID event, timestamp, dan body. Header disegarkan saat retry; event ID tetap.
- Retry bertahap, maksimal 20 percobaan. Event yang belum selesai masuk antrean `dead` untuk diperiksa dan dikirim ulang secara eksplisit.
- Backup lokal terkompresi saat startup dan setiap 24 jam; tujuh salinan disimpan di `/data/backups`. Ini belum merupakan backup luar server.
- Log hanya berisi jenis kejadian, ID event, dan jumlah percobaan; body asli DOKU, pelanggan, dan secret tidak disimpan di log. Antrean memuat informasi pembayaran minimum, tanpa nama/email pelanggan.
- Endpoint `GET /healthz`. Tidak ada halaman admin atau API publik untuk membaca antrean.

## Persiapan akses

Untuk menjalankan pemasangan diperlukan:

1. Project dan environment Helipod yang aktif, dengan kapasitas container dan volume yang cukup.
2. Akses deploy container/Dockerfile atau image registry. API otomatis memakai `HELIPOD_API_KEY` berizin **Container API** dan dibatasi ke project terkait.
3. Akses deployment Edge Function pada proyek Supabase Tippo yang sekarang. Kredensial admin Supabase **tidak diperlukan di router Helipod**.
4. Client ID dan Secret Key DOKU merchant yang sama dengan Tippo.

Simpan secret melalui kolom secret platform/lingkungan deployment. Jangan kirim password, API key, service-role key, atau private key melalui chat, commit Git, screenshot, atau argumen perintah.

## Helipod: pilihan untuk paket Nano

Dokumentasi Helipod menyediakan deployment image/Dockerfile, volume persisten, domain `*.helipod.app`, HTTPS otomatis, dan API. Paket dengan "Pods Unlimited" adalah layanan container; tidak perlu mengasumsikan akses SSH/root.

Pengaturan service:

| Pengaturan | Nilai |
|---|---|
| Nama | `tippo-payment-router` |
| Build context | root repository Tippo |
| Dockerfile | `payment-router/Dockerfile` |
| HTTP port | `8080` |
| Health check | `/healthz` |
| CPU awal | 250 millicore / 0,25 vCPU |
| RAM awal | 256 MB |
| Replica | **1**, autoscaling mati |
| Volume | `/data`, mulai 1 GB, persisten |
| User volume | dapat ditulis UID/GID `1000` (`node`) |
| HTTPS | gunakan domain bawaan Helipod dulu; domain sendiri opsional |

Jangan menggunakan filesystem container sementara untuk SQLite. Volume harus mendukung penguncian file SQLite/WAL; hindari NFS/RWX bersama. Konfirmasikan mode volume ke Helipod jika jenis filesystem tidak terlihat. Jangan menjalankan beberapa replica berbagi database SQLite di host berbeda. Jika nanti membutuhkan banyak replica, pindahkan antrean ke database server terlebih dahulu.

Untuk source Git, pilih Dockerfile di atas dan pastikan **context tetap root**, karena image membutuhkan dua modul verifikasi dari `supabase/functions/_shared`. Jika antarmuka tidak menyediakan pemilihan Dockerfile, gunakan image hasil build yang sama; jangan mengganti build Tippo menjadi router.

Environment variables service:

| Nama | Isi |
|---|---|
| `ROUTER_DOMAIN` | hostname service yang diberikan Helipod, tanpa `https://` atau path |
| `ROUTER_DB_PATH` | `/data/router.sqlite` |
| `DOKU_CLIENT_ID` | Client ID merchant produksi Tippo |
| `DOKU_SECRET_KEY` | Secret Key DOKU produksi, **secret** |
| `TIPPO_CALLBACK_URL` | `https://PROJECT_REF_TIPPO.supabase.co/functions/v1/tippo-payment-events` |
| `TIPPO_ROUTER_EVENT_KEY` | secret acak baru minimal 32 karakter, **secret**; sama dengan secret receiver Tippo |

Buat signing key dengan `openssl rand -hex 32` di terminal privat, lalu simpan langsung ke secret manager/platform. Router ini ditujukan untuk produksi; jangan memasukkan kredensial sandbox dan menghubungkannya ke Tippo produksi.

Urutan awal: buat service **tanpa menjalankannya dulu**, pasang volume, dapatkan domain, isi variable/secret, pastikan satu replica, lalu deploy. Jangan mengubah URL callback DOKU sebelum receiver dan router tervalidasi.

### Build image sendiri

```sh
docker build -f payment-router/Dockerfile -t tippo-payment-router:RELEASE .
```

Image sudah memakai base image berdasarkan digest yang diuji dan tidak menginstal dependency npm runtime. Image berjalan sebagai user non-root dan memerlukan Node.js 24 karena menggunakan SQLite bawaan Node.

Untuk deploy dari image registry, tag dan push image ke registry yang Anda kendalikan, lalu gunakan **digest image**, bukan tag bergerak, di Helipod. Jika registry privat, berikan kredensial pull melalui secret registry Helipod. File `.env`, API key, dan `.helipod-state.json` tidak masuk build context/image.

### Helper API Helipod

`helipod.mjs` mengikuti endpoint resmi Container API dan menyediakan pemasangan awal dengan price dry-run serta state lokal untuk melanjutkan pemasangan yang terhenti. Ini bukan pengelola upgrade otomatis. Helper tidak menghapus service, volume, atau domain.

Set variable privat di lingkungan eksekusi helper:

- `HELIPOD_API_KEY`: Container API project-scoped.
- `HELIPOD_ENVIRONMENT_ID`: UUID environment Helipod.
- `ROUTER_IMAGE`: image registry dengan digest `...@sha256:...` yang sudah dipublikasikan sendiri.
- Jika image privat: `GHCR_USERNAME` dan `GHCR_READ_TOKEN` atau kredensial registry yang kompatibel.

Price-only, **tanpa membuat service**:

```sh
node --experimental-strip-types payment-router/helipod.mjs
```

Sesudah harga diperiksa, set `HELIPOD_MAX_DAILY_COST_IDR` sebagai batas biaya harian yang disetujui. Isi juga empat variable DOKU/receiver dari tabel di atas. Helper membuat domain gratis `*.helipod.app`, sehingga `ROUTER_DOMAIN` tidak wajib di lingkungan helper.

```sh
node --experimental-strip-types payment-router/helipod.mjs --apply
```

Helper menyimpan ID service/deployment di `.helipod-state.json` (diabaikan Git) dan tidak mencetak secret. Simpan file state ini; jika service dengan nama sama sudah ada tetapi state hilang, helper berhenti untuk mencegah service ganda. Periksa status deployment sampai `success` di dashboard/API, health check, volume, dan log. Respons deploymentId hanya berarti deployment sudah masuk antrean, bukan sudah aktif.

Biaya service/volume/build mengikuti penawaran aktual Helipod dan dapat berbeda dari promo paket. Helper tidak dijalankan ke akun pengguna tanpa kredensial dan batas biaya yang tersedia. API key deploy **jangan dimasukkan sebagai variable runtime router**.

Referensi resmi yang digunakan:

- https://docs.helipod.io/docs/container-api/services
- https://docs.helipod.io/docs/container-api/volumes
- https://docs.helipod.io/docs/container-api/variables
- https://docs.helipod.io/docs/container-api/domains
- https://docs.helipod.io/docs/container-api/scale
- https://docs.helipod.io/docs/container-api/deployments

## Receiver dan transisi Tippo

1. Deploy function baru `tippo-payment-events` ke **proyek Supabase Tippo yang sekarang**. Konfigurasi `verify_jwt=false` sudah ada; otorisasinya menggunakan signature internal, bukan akses anonim ke database.

   ```sh
   npx supabase functions deploy tippo-payment-events --project-ref PROJECT_REF_TIPPO
   ```

2. Pada Edge Function Secrets proyek Tippo, isi `TIPPO_ROUTER_EVENT_KEY` yang sama dengan Helipod. Receiver juga menggunakan `DOKU_PRODUCTION_CLIENT_ID`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY` yang sudah dipakai backend Tippo. Service-role key tidak dipindahkan ke router.

3. Sebelum checkout baru dialihkan, verifikasi `/healthz` router, signature palsu ditolak, dan volume tetap ada setelah restart. Lakukan pengujian integrasi dengan fixture/staging terpisah; jangan memakai notifikasi pembayaran palsu untuk mengaktifkan akun produksi.

4. Deploy versi `tippo-doku-pro` yang memuat dukungan optional `TIPPO_DOKU_ROUTER_URL`. Selama secret ini belum diset, perilakunya tetap seperti sebelum perubahan.

5. Set `TIPPO_DOKU_ROUTER_URL=https://HOSTNAME_ROUTER/webhooks/doku` pada Edge Function Secrets Tippo. Hanya callback invoice **Pro baru** yang menggunakan alamat router melalui `override_notification_url`. Prefix test tidak dialihkan. Verifikasi melalui satu checkout/pembayaran nyata yang disepakati; perubahan secret saja bukan bukti DOKU sudah menerima override untuk merchant tersebut.

6. Invoice lama yang mempunyai callback langsung tetap diterima `/tippo-doku-pro/webhook`. Path verifikasi signature webhook lama sengaja tidak diganti oleh override checkout baru. Request-Id notifikasi yang sama tetap idempoten di ledger Tippo, termasuk jika pernah melewati jalur langsung.

7. **Jangan mengubah URL dashboard DOKU pada tahap awal ini.** Setelah alur baru terbukti dan seluruh prefix website/test yang masih aktif mempunyai tujuan yang benar, URL dashboard bisa dipusatkan. Router saat ini hanya menangani Pro Tippo `TPR`; Bukucatering dan test `TPT` belum memiliki route.

Tidak diperlukan migrasi database bisnis Tippo: receiver memakai RPC `tippo_accept_pro_notification` yang sudah ada. Periksa nominal Rp25.000, mata uang, status, merchant, invoice, dan original request sebelum grant; invoice tidak dikenal mengembalikan 409 sehingga tetap masuk retry router.

Rollback: hapus secret `TIPPO_DOKU_ROUTER_URL` untuk checkout berikutnya. **Tetap jalankan router dan receiver** untuk invoice yang sudah dibuat dengan callback router sampai notifikasi/pembayarannya selesai. Jangan menghapus volume atau mematikan router hanya karena checkout baru sudah kembali ke jalur lama.

## VPS penuh: Docker Compose opsional

Jalur ini untuk mesin yang memiliki Docker/Compose dan akses pengelolaan server, bukan syarat memakai Helipod container.

```sh
cp payment-router/.env.example payment-router/.env
chmod 600 payment-router/.env
```

Isi variable melalui editor privat, arahkan DNS hostname ke VPS, buka port 80/443, lalu:

```sh
docker compose -f payment-router/compose.yaml up -d --build
docker compose -f payment-router/compose.yaml ps
```

Caddy menyediakan HTTPS dan pembaruan sertifikat otomatis. Database router tidak dipublikasikan melalui port jaringan. Hindari `docker compose down -v`: flag `-v` menghapus volume antrean.

## Operasional dan backup

Di terminal container Helipod:

```sh
node payment-router/cli.mjs stats
node payment-router/cli.mjs backup
node payment-router/cli.mjs retry EVENT_UUID
```

Dengan Compose, awali perintah dengan `docker compose -f payment-router/compose.yaml exec router`.

- Periksa antrean `dead`/tertunda, `backup_failed`, disk penuh, status deployment, dan kesehatan service. Hubungkan alert platform ke operator; tidak ada email/WhatsApp alert yang otomatis dikirim paket ini.
- Backup disimpan di `/data/backups`. Unduh/cadangkan salinan terenkripsi ke lokasi lain melalui mekanisme operator/provider. Backup di volume yang sama tidak melindungi dari penghapusan volume atau kehilangan akun hosting.
- Untuk restore, hentikan router, pertahankan salinan database lama, ekstrak backup ke database di volume kosong dengan izin UID1000, lalu jalankan ulang. Jangan menimpa database yang masih aktif atau memasangkan WAL lama dengan backup berbeda. Uji restore sebelum produksi.
- Bersihkan hanya event `delivered` berumur lebih dari 90 hari. Antrean `queued`, `processing`, dan `dead` tidak dibersihkan otomatis.
- Batas file database SQLite sekitar 256 MB serta antrean belum selesai 10.000 event membuat server gagal tertutup/503 jika penuh. Pantau kapasitas dan naikkan arsitektur sebelum volume transaksi mendekati batas ini.
- Kunci internal dapat dirotasi lewat pembaruan secret di kedua sisi yang terkoordinasi. Jika salah satu sisi belum diperbarui, event gagal sementara dan tetap bisa dikirim ulang.
- Pertahankan waktu sistem/NTP yang benar; signature internal mempunyai jendela lima menit. Worker memberikan timestamp baru pada setiap retry.

## Verifikasi lokal

```sh
node --experimental-strip-types --test tests/payment-router.test.ts tests/doku-billing.test.ts
npm run lint
npm run typecheck
docker build -f payment-router/Dockerfile -t tippo-payment-router:review .
```

Pengujian mencakup tampering/signature palsu, timestamp lama, nominal salah, route tidak dikenal, body terlalu besar, kegagalan simpan, restart/lease antrean, retry, dead queue, restore backup, aktivasi Pro idempoten melalui database lokal, dan kompatibilitas webhook lama. Test tidak membuat pembayaran DOKU atau mengubah data produksi.

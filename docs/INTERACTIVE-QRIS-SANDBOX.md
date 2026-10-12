# Integrasi Interactive QRIS untuk Tippo — sandbox

Referensi: https://qris.interactive.co.id/api-doc/#sandbox (dibaca 12 Oktober 2026).

## Kondisi Tippo

Invoice Pro saat ini merupakan draf di localStorage, Rp25.000 untuk satu bulan. Draf tidak menerima pembayaran atau mengaktifkan Pro. Entitlement akun ditentukan dari `tippo_workspaces.pro_until` di Supabase, yang tidak dapat ditulis oleh browser. Belum ada backend pembayaran atau webhook.

## Mulai dari pengujian pembuatan QR

1. Buka halaman sandbox pada referensi di atas.
2. Untuk trial awal, gunakan parameter demo yang sudah terisi pada dokumentasi: APIKEY `interactive`, mID `125193375`. Keduanya adalah contoh publik milik dokumentasi, bukan kredensial merchant Tippo.
3. Isi nomor transaksi unik, misalnya `TIPPO-SBX-20261012-001`, dan nominal `25000`.
4. Klik Generate QRIS. Respons berhasil seharusnya berisi `qris_content`, `qris_request_date`, `qris_invoiceid`, dan `qris_nmid`. Simpan respons trial untuk memastikan format sebelum implementasi.
5. Tahap ini hanya menguji pembuatan QR. Dokumentasi tidak menjelaskan endpoint simulasi pembayaran sandbox atau menjamin pemindaian QR tidak mendebit saldo. Jangan menguji pembayaran dengan aplikasi bank/e-wallet nyata sebelum InterActive mengonfirmasi fasilitas sandbox pembayaran.

Halaman dokumentasi menggunakan GET ke `https://qris.interactive.co.id/api-doc/sandbox-qris-generate.php` dengan `action=generate_qris`, `apikey`, `mID`, `cliTrxNumber`, `cliTrxAmount`, dan `useTip=no`. Ini adalah endpoint yang dipakai form trial; dokumentasi belum menetapkannya sebagai kontrak API sandbox lengkap untuk pembayaran dan webhook.

## Lingkungan uji Tippo

- Gunakan Vercel Preview dan proyek Supabase uji, dengan akun pengguna uji. Jangan mengubah entitlement akun produksi saat simulasi.
- Backend pembayaran disarankan memakai Supabase Edge Functions. API key dan akses administratif database disimpan sebagai secrets backend, tidak di `NEXT_PUBLIC_*`, Git, localStorage, atau URL frontend.
- Nama konfigurasi yang diusulkan untuk kode Tippo: `QRIS_ENV=sandbox`, `INTERACTIVE_QRIS_API_KEY`, `INTERACTIVE_QRIS_MERCHANT_ID`. Ini nama variabel aplikasi; parameter provider tetap `apikey` dan `mID`.
- Dua konfigurasi Supabase publik saat ini tersedia di workspace. Kredensial QRIS dan akses administratif deployment belum tersedia di lingkungan ini. Tidak perlu membagikan nilai secret di chat.
- Di sandbox, backend harus membatasi tujuan request ke sandbox yang sudah diverifikasi dan menolak fallback otomatis ke API produksi.

## Alur aplikasi yang akan dibangun

1. Pengguna membuka Paket & langganan lalu memilih Bayar Pro dengan QRIS.
2. Backend memverifikasi sesi Supabase. Harga Rp25.000 dan periode satu bulan ditetapkan server, bukan dari nominal atau owner ID kiriman browser.
3. Backend membuat invoice unik di database, terkait pemilik akun dan lingkungan sandbox. Pembuatan ulang harus mengembalikan invoice pending yang masih valid, serta menangani double-click/request serentak.
4. Backend meminta QRIS dan menyimpan ID invoice provider, konten QR, tanggal request dan kedaluwarsa. Menurut dokumentasi QR berlaku 30 menit sejak tanggal request WIB.
5. Frontend menampilkan QR, nominal, nomor/tanggal invoice, sisa waktu, label Sandbox dan tombol Cek pembayaran. QR dibuat dari konten provider, tanpa mengirim kontennya ke layanan gambar eksternal.
6. Pemeriksaan pembayaran dilakukan oleh server untuk invoice milik pengguna tersebut. Dokumentasi menyarankan pengecekan melalui tindakan pengguna dan melarang auto-check terlalu sering. Batasi pengecekan server; jangan membuat polling cepat dari browser.
7. Setelah server memverifikasi pembayaran, simpan status paid dan perpanjang Pro secara atomik. Satu invoice hanya boleh memperpanjang sekali, meskipun pengecekan atau webhook diulang. Tambahkan satu bulan dari masa akhir Pro jika masih aktif, atau dari waktu aktivasi jika sudah habis.
8. Reload entitlement dari Supabase. Pembayaran gagal, pending, kedaluwarsa, atau respons yang tidak dapat diverifikasi tidak mengaktifkan Pro.

Status uji invoice: pending, paid, expired, failed. Data pembayaran sandbox tidak boleh mengaktifkan langganan produksi. Bila provider belum menyediakan simulasi paid, gunakan mock terkontrol dalam tes; tandai sebagai tes aplikasi, bukan verifikasi pembayaran sandbox provider.

## Kontrak produksi yang didokumentasikan

Ini referensi untuk adapter berikutnya, bukan endpoint yang boleh dipakai sebagai fallback sandbox.

- Generate: GET `https://qris.interactive.co.id/restapi/qris/show_qris.php` dengan `do=create-invoice`, `apikey`, `mID`, `cliTrxNumber`, `cliTrxAmount`, `useTip=no`.
- Cek: GET `https://qris.interactive.co.id/restapi/qris/checkpaid_qris.php` dengan `do=checkStatus`, `apikey`, `mID`, `invid`, `trxvalue`, `trxdate` (YYYY-MM-DD). Ambil invoice, nominal dan tanggal dari database server. Tangani pergantian hari WIB saat memeriksa invoice yang belum kedaluwarsa.
- Respons lunas cek API: `status=success` dan `data.qris_status=paid`.
- Webhook: POST JSON; contoh memakai `invoice`, `rrn`, `qris_status=success`, dan `qris_paid_date`. Status webhook berbeda dari nilai `paid` pada API cek.

Dokumentasi publik belum mencantumkan signature/secret verifikasi webhook. Jangan langsung mengaktifkan Pro dari payload webhook. Cocokkan invoice tercatat dan verifikasi ulang melalui API provider sebelum memperbarui entitlement. Jangan mencatat API key atau URL provider lengkap yang memuat API key ke log.

## Informasi yang perlu dikonfirmasi ke InterActive

1. Apakah form Sandbox Generate Invoice hanya trial pembuatan QR, atau ada lingkungan pembayaran simulasi tanpa saldo nyata?
2. Apa endpoint dan APIKEY/mID khusus sandbox untuk create, check, dan simulasi paid/expired/failed?
3. Bagaimana autentikasi webhook: signature, secret, header, retry, dan respons acknowledgement yang wajib?
4. Apakah `cliTrxNumber` bersifat idempotent dan apa yang harus dilakukan jika create timeout tetapi invoice sudah dibuat?
5. Apakah nominal, mata uang dan merchant dapat diverifikasi dari respons cek, serta aturan tanggal cek jika invoice melintasi tengah malam WIB?

## Kriteria sebelum produksi

Tes invoice sukses, pending, kedaluwarsa dan gagal; QR dibuat ulang/double-click; sesi dan kepemilikan invoice; nominal dimanipulasi; webhook palsu/berulang; timeout provider; perpanjangan Pro sekali; dan isolasi sandbox dari produksi. Uji provider end-to-end baru dinyatakan lolos setelah fasilitas sandbox paid dikonfirmasi dan dijalankan.

Belum ada kode pembayaran, migration, secret, deployment atau perubahan entitlement yang diterapkan melalui panduan ini.

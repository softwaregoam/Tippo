# Template invoice

Menu **Template invoice** mengatur nama toko, awalan nomor invoice, logo, warna, tata letak, catatan penutup, serta rekening pembayaran. Pengaturan tersimpan per akun dan berlaku pada invoice Jastip dan Open PO. Nama toko kosong tidak ditampilkan. Rekening ditampilkan hanya jika nama bank, nomor rekening, dan atas nama diisi lengkap; invoice dibatalkan tidak menampilkan instruksi transfer. Logo, warna, dan tata letak dipakai pada pratinjau serta hasil cetak/PDF; salinan WhatsApp berupa teks.

## Aktifkan unggah logo

1. Buka project Tippo di Supabase → **SQL Editor** → **New query**.
2. Salin isi [`supabase/migrations/202610140013_invoice_logos.sql`](../supabase/migrations/202610140013_invoice_logos.sql), lalu **Run**. Jika memakai CLI, jalankan migrasi melalui alur deployment database yang biasa dipakai.
3. Periksa **Storage**: bucket **invoice-logos** harus tersedia.
4. Di Tippo → **Template invoice**, unggah PNG/JPG/WebP maksimal 2 MB, lalu **Simpan template**.

Bucket menyimpan logo yang dapat ditampilkan pada invoice. Path berkas menggunakan folder ID pemilik dan nama acak. Kebijakan database membatasi unggah, daftar berkas, dan hapus ke folder akun pemilik. Logo diperkecil hingga 512 px dan disimpan sebagai WebP maksimal 1 MB. Tidak ada API key baru, secret, atau perubahan Edge Function yang diperlukan.

Sebelum migrasi dijalankan, pengaturan nama toko, nomor, warna, tata letak, dan catatan tetap dapat disimpan. Unggah logo menampilkan kegagalan dan mempertahankan isian untuk dicoba kembali.

## Pemeriksaan

- Simpan template lalu muat ulang: identitas dan tampilan harus tetap sama.
- Buka invoice pesanan: gunakan **Cetak / PDF**, atau **Salin invoice WhatsApp**.
- Invoice pelanggan tidak memuat HPP, status/batch, saldo pembayaran, atau ongkir bernilai nol.
- Periksa akun lain: logo dan template tidak mengikuti akun sebelumnya.

Tanggal kirim, jam kirim (24 jam), dan metode kirim opsional pada pesanan. Pengiriman, catatan pesanan, dan alamat pelanggan hanya muncul di invoice jika diisi. Catatan penutup ditampilkan rata tengah. Data pengiriman disimpan bersama JSON pesanan, sehingga tidak memerlukan migrasi tabel baru.

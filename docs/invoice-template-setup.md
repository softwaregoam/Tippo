# Template invoice

Menu **Template invoice** mengatur nama toko, awalan nomor invoice, logo, warna, tata letak, dan catatan penutup. Rekening pembayaran diatur di **Profil bisnis**. Pengaturan tersimpan per akun dan berlaku pada invoice Jastip dan Open PO. Nama toko kosong tidak ditampilkan. Rekening ditampilkan hanya jika nama bank, nomor rekening, dan atas nama diisi lengkap; invoice dibatalkan tidak menampilkan instruksi transfer. Logo, warna, dan tata letak dipakai pada pratinjau serta hasil cetak/PDF; salinan WhatsApp berupa teks.

## Aktifkan unggah logo

1. Buka project Tippo di Supabase → **SQL Editor** → **New query**.
2. Salin isi [`supabase/migrations/202610140013_invoice_logos.sql`](../supabase/migrations/202610140013_invoice_logos.sql), lalu **Run**. Jika memakai CLI, jalankan migrasi melalui alur deployment database yang biasa dipakai.
3. Periksa **Storage**: bucket **invoice-logos** harus tersedia.
4. Di Tippo → **Template invoice**, unggah PNG/JPG/WebP maksimal 2 MB, lalu **Simpan template**.

Bucket menyimpan logo yang dapat ditampilkan pada invoice. Path berkas menggunakan folder ID pemilik dan nama acak. Kebijakan database membatasi unggah, daftar berkas, dan hapus ke folder akun pemilik. Logo diperkecil hingga 512 px dan disimpan sebagai WebP maksimal 1 MB. Tidak ada API key baru, secret, atau perubahan Edge Function yang diperlukan.

Sebelum migrasi dijalankan, pengaturan nama toko, nomor, warna, tata letak, dan catatan tetap dapat disimpan. Unggah logo menampilkan kegagalan dan mempertahankan isian untuk dicoba kembali.

## Pemeriksaan

- Simpan template lalu muat ulang: identitas dan tampilan harus tetap sama.
- Buka invoice pesanan: gunakan **Cetak / PDF**, atau pilih tab **Teks WhatsApp** → **Salin invoice WhatsApp**.
- Invoice pelanggan tidak memuat HPP, status/batch, saldo pembayaran, atau ongkir bernilai nol.
- Periksa akun lain: logo dan template tidak mengikuti akun sebelumnya.

Tanggal kirim, jam kirim (24 jam), dan metode kirim opsional pada pesanan. Pengiriman, catatan pesanan, dan alamat pelanggan hanya muncul di invoice jika diisi. Catatan penutup ditampilkan rata tengah. Data pengiriman disimpan bersama JSON pesanan, sehingga tidak memerlukan migrasi tabel baru.

Warna invoice diatur terpisah untuk Jastip (hijau) dan Open PO (cokelat). Logo, identitas toko, rekening, tata letak, dan catatan penutup dipakai bersama. Pratinjau memuat contoh alamat, pengiriman, dan catatan pelanggan; fee jastip hanya muncul pada contoh Jastip. Bagian 3 form pesanan tertutup saat dibuka; jam kirim berupa input HH:mm 24 jam, bukan pilihan jam/menit.

Rekening lama otomatis tampil di Profil bisnis tanpa perlu diisi ulang atau migrasi SQL. Nama bank, nomor rekening, dan atas nama disimpan bersama dalam satu penyimpanan profil agar kedua bentuk invoice selalu menggunakan rekening yang sama. Teks WhatsApp memakai sapaan pelanggan dan rincian produk satu kali; bagian Pembayaran via transfer tampil sebelum catatan penutup jika rekening lengkap, termasuk untuk invoice lunas. Permintaan bukti transfer hanya muncul pada pesanan belum lunas. Invoice dibatalkan tidak menampilkan rekening atau meminta bukti transfer.

Pada dialog invoice, tab **Invoice gambar** menyediakan Cetak/PDF dan **Unduh gambar** (PNG 2× dengan lebar tetap 794 px agar terbaca saat diunduh dari ponsel). Tab **Teks WhatsApp** menyediakan salin teks dan **Bagikan ke WhatsApp**. Tautan membuka chat pelanggan jika nomor valid tersedia, atau pemilih penerima jika kosong. Pesan tetap dikirim oleh pengguna dari WhatsApp. PNG dibuat di browser; kegagalan memuat logo ditampilkan agar unduhan tidak diam-diam menghilangkan logo.

Khusus ponsel, tab Invoice gambar menampilkan PNG satu lembar utuh yang disesuaikan dengan ruang pratinjau. Gunakan cubitan dua jari, ketuk dua kali, atau tombol zoom untuk memperbesar; geser untuk membaca detail. Tombol sesuaikan mengembalikan seluruh lembar ke dalam pratinjau. Desktop tetap memakai dokumen langsung.


## QRIS terpisah

Di **Profil bisnis → QRIS pembayaran**, unggah QRIS resmi usaha dalam format PNG/JPG/WebP maksimal 1 MB, lalu **Simpan profil**. Ganti dan hapus juga berlaku setelah profil disimpan. File asli dipertahankan tanpa pemotongan atau kompresi ulang.

Pada invoice dengan sisa tagihan, tab **QRIS** menampilkan gambar dan sisa pembayaran. Gunakan **Unduh QRIS**, lalu kirim gambar secara terpisah. Pelanggan dapat memilih gambar dari galeri jika aplikasi pembayarannya mendukung. QRIS tidak ditambahkan ke invoice gambar atau teks WhatsApp. Tab disembunyikan untuk invoice lunas, bernilai nol, atau dibatalkan. QRIS ini statis; owner tetap mencatat pembayaran setelah memeriksa dana masuk.

Penyimpanan memakai bucket `invoice-logos` dan kebijakan pemilik yang sudah tersedia, dengan path `<owner-id>/qris-<uuid>.<ext>`. Tidak memerlukan migrasi baru jika migrasi bucket di atas sudah diterapkan. URL tersimpan di metadata akun `invoice_template.qrisUrl`, terpisah dari logo. Gagal menyimpan profil tidak menghapus QRIS lama; penggantian yang berhasil membersihkan berkas QRIS lama milik akun.


Tombol **Bagikan gambar** dan **Bagikan QRIS** membuka pilihan aplikasi berbagi pada perangkat yang mendukung berbagi berkas. Gambar disiapkan sebelum tombol ditekan; file PNG invoice atau file QRIS asli dikirim tanpa menambahkan teks WhatsApp. Jika berbagi berkas tidak didukung, tombol tersebut mengunduh gambar dan menampilkan petunjuk melampirkannya secara manual. Membatalkan pilihan berbagi tidak memicu unduhan. Tombol Unduh dan Cetak/PDF tetap tersedia.

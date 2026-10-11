# Diskon pesanan

Form Jastip dan Open PO menyediakan diskon opsional berupa rupiah atau persen pada bagian Diskon, ongkir & catatan. Nilai persen berupa bilangan bulat 0–100. Diskon berlaku untuk jumlah harga jual barang ditambah fee pesanan, tidak termasuk ongkir. Potongan persen dibulatkan ke rupiah terdekat (setengah dibulatkan naik) dengan perhitungan bilangan bulat yang aman. Mengubah jenis diskon mengosongkan nilainya untuk menghindari salah tafsir rupiah menjadi persen.

Pesanan menyimpan `discount: { type: "amount" | "percent", value: number }`. Pesanan lama tanpa properti ini tetap memiliki total yang sama. Nilai rupiah tidak boleh melebihi subtotal, dan pembayaran tidak boleh melebihi tagihan setelah diskon. Total, sisa tagihan, ringkasan, grafik, margin, invoice WhatsApp dan detail ponsel memakai perhitungan yang sama. HPP tidak dipotong. Saat mengedit pesanan, riwayat refund dipertahankan. Impor Excel tetap memakai template saat ini tanpa kolom diskon; diskon dapat ditambahkan setelah impor.

## Aktivasi Supabase

Jalankan `supabase/migrations/202610110004_order_discount.sql` di SQL Editor, setelah migrasi workspace awal. Migrasi tidak mengubah data atau kuota: validator sebelumnya dipertahankan dan validator baru memeriksa diskon serta pembayaran bersih. Migrasi dapat dijalankan ulang. Lingkungan ini hanya memiliki publishable key; SQL belum dijalankan di produksi.

## Validasi

Lint dan production build berhasil. Seluruh 88 tes unit/database berhasil, termasuk kedua jenis diskon, pembulatan dan angka besar, ongkir/HPP, ringkasan/margin/invoice, pembayaran berlebih dan invalid discount. Tes PGlite menjalankan migrasi dua kali dan memeriksa penyimpanan, penolakan data tidak valid, dan kuota saat edit.

Tiga skenario browser unik berhasil: Jastip desktop, Open PO desktop dan Open PO 390px. Masing-masing memeriksa diskon persen, batas 100%, tombol Lunas, penyimpanan/reload, penggantian ke rupiah, dan pembayaran berlebih sebelum menyimpan ulang. Tes mobile awal memakai nama tombol edit desktop; diperbaiki menjadi tombol Edit dalam dialog detail, lalu lulus. Build awal menolak literal BigInt dengan target TypeScript proyek; diganti constructor BigInt tanpa mengubah target. Screenshot form desktop Jastip dan ponsel PO ditinjau visual. Supabase browser dimock; deployment Vercel belum diverifikasi.

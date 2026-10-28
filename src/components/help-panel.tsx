import { CUSTOMER_SERVICE_PHONE, CUSTOMER_SERVICE_WHATSAPP_URL } from "@/lib/support";
import type { Batch } from "@/lib/types";

type HelpDestination = "products" | "batches" | "orders" | "hpp" | "settings" | "feedback" | "reports" | "invoice-template" | "subscription";

export function HelpPanel({ mode, onNavigate }: { mode: Batch["type"]; onNavigate: (page: HelpDestination) => void }) {
  const po = mode === "po";
  const business = po ? "Open PO" : "Jastip";
  const guides: { id: string; title: string; steps: string[]; destination: HelpDestination; action: string }[] = [
    {
      id: "mulai", title: `Mulai mencatat ${business}`,
      steps: po ? [
        "Buka Produk, lalu simpan nama, varian, harga jual, dan harga beli jika sudah diketahui. Kategori boleh dipilih dari daftar atau ditulis lewat toggle Tambah Kategori.",
        "Buat Batch PO untuk satu periode pemesanan. Isi nama batch dan tanggal tutup pesanan.",
        "Buka Pesanan untuk mencatat pembelian pelanggan dari produk yang sudah kamu simpan.",
      ] : [
        "Buka Perjalanan, lalu buat batch untuk satu perjalanan atau kegiatan titip belanja. Isi nama batch dan tanggal tutup pesanan.",
        "Buka Pesanan untuk mencatat titipan pelanggan. Nama produk, varian, warna, ukuran, dan harga diisi langsung pada pesanan.",
        "Satu pesanan bisa berisi beberapa produk. Gunakan Tambah produk untuk mencatat produk berikutnya.",
      ], destination: po ? "products" : "batches", action: po ? "Buka Produk" : "Buka Perjalanan",
    },
    ...(!po ? [{
      id: "kurs", title: "Mata uang dan kurs Jastip",
      steps: [
        "Pilih mata uang saat membuat atau mengedit perjalanan. Cari lewat kode, nama mata uang, atau negara; kurs referensi harian diambil otomatis.",
        "Saat menambah pesanan, Tippo mengambil kurs terbaru untuk mata uang batch. Isi harga beli dalam mata uang tersebut; nilai rupiahnya dihitung otomatis sebagai HPP. Harga jual dan tagihan pelanggan tetap rupiah.",
        "Sesuaikan kurs secara manual jika berbeda dengan kurs yang kamu bayar. Kurs referensi berstatus Estimasi; ubah ke Final di HPP & Margin setelah harga beli dan kurs pembayaran pasti.",
        "Pesanan yang sudah tersimpan tetap memakai kursnya sendiri. Untuk menentukan harga jual, buka Bantu hitung harga jual, isi untung dari modal (0–100%), lalu pilih Gunakan harga ini.",
      ], destination: "batches" as const, action: "Atur mata uang perjalanan",
    }] : []),
    {
      id: "pesanan", title: "Isi pesanan dan pembayaran",
      steps: [
        "Pilih batch yang masih dibuka. Jika hanya ada satu batch aktif, Tippo memilihnya otomatis. Cari pelanggan lewat nama atau WhatsApp, lalu pilih kontaknya. Gunakan + Pelanggan baru jika belum ada.",
        "Pilih tanggal lewat kalender, lalu isi produk dan jumlahnya. Field bertanda bintang merah wajib diisi.",
        "Buka bagian tambahan untuk mengisi diskon, ongkir, catatan, tanggal kirim, jam 24 jam, dan metode kirim jika diperlukan.",
        "Gunakan Lunas untuk mengisi seluruh total tagihan atau Bayar sebagian untuk menulis nominal yang sudah diterima. Klik Simpan pesanan setelah datanya lengkap.",
        "Pesanan baru berstatus Diproses. Pilih Tandai selesai setelah barang diterima atau diambil pelanggan, atau Batalkan pesanan jika tidak dilanjutkan. Konfirmasi sebelum menyimpan. Pesanan yang sudah dibayar perlu refund seluruh pembayaran sebelum dibatalkan.",
      ], destination: "orders", action: "Buka Pesanan",
    },
    {
      id: "hpp", title: "Periksa HPP dan margin",
      steps: [
        "Buka HPP & Margin dan pilih batch. Klik ikon pensil pada pesanan, isi harga beli per produk dalam dialog, lalu klik Simpan HPP. Card menampilkan total HPP, margin, jumlah pesanan, dan HPP belum lengkap untuk batch yang dipilih.",
        "HPP produk dihitung dari harga beli dikalikan jumlah produk. Jika ongkir supplier atau kemasan ingin masuk HPP, sertakan dalam harga beli per produk.",
        "Margin dihitung dari nilai produk dan fee setelah diskon, dikurangi HPP. Ongkir yang ditagihkan ke pelanggan tidak menambah margin.",
        "Ringkasan menampilkan penjualan, estimasi margin, pembayaran, dan sisa tagihan untuk usaha serta bulan yang dipilih. Periksa HPP yang belum lengkap sebelum menilai margin.",
      ], destination: "hpp", action: "Buka HPP & Margin",
    },
    {
      id: "rekap", title: "Siapkan rekap belanja",
      steps: [
        "Pesanan Untuk sendiri tetap masuk rekap belanja; biayanya terpisah dari penjualan dan margin usaha.",
        "Buka Batch PO atau Perjalanan, lalu pilih ikon rekap pada kolom Aksi. Di ponsel, buka detail batch untuk melihat tombol rekap.",
        "Rekap menjumlahkan kebutuhan produk dari pesanan aktif, beserta varian, warna, ukuran, dan toko. Buka Lihat pelanggan untuk melihat pembagiannya.",
        "Pilih Per produk atau Per pesanan sebelum Unduh Excel. Rekap per produk memakai harga beli dan total belanja; rekap per pesanan memuat harga jual, HPP, dan margin jika lengkap.",
      ], destination: "batches", action: "Buka rekap batch",
    },
    {
      id: "invoice", title: "Atur dan bagikan invoice",
      steps: [
        "Isi rekening bank di Profil bisnis. Di Template invoice, atur nama toko, awalan nomor invoice, logo, warna per usaha, dan catatan penutup.",
        "Buka Invoice dari pesanan. Tab Invoice gambar menyediakan Bagikan gambar, Unduh gambar, dan Cetak / PDF; tab Teks WhatsApp menyediakan salin dan bagikan ke WhatsApp.",
        "Untuk QRIS, unggah gambar di Profil bisnis dan simpan. Tab QRIS tersedia pada invoice belum lunas; bagikan atau unduh gambarnya terpisah. Catat pembayaran setelah dana diterima.",
        "Invoice menampilkan status pembayaran dan sisa tagihan jika belum lunas. Alamat, pengiriman, catatan, serta rekening muncul jika diisi. Harga beli dan HPP tidak ikut ditampilkan.",
      ], destination: "invoice-template", action: "Buka Template invoice",
    },
    {
      id: "laporan", title: "Periksa laporan penjualan",
      steps: [
        "Buka Laporan untuk melihat penjualan, HPP, margin, jumlah pesanan, dan produk terlaris. Gunakan pencarian pada filter batch untuk membatasi laporan.",
        "Paket Gratis menampilkan bulan berjalan. Dengan Pro, pilih periode lain dan ekspor Excel berisi Ringkasan, Pesanan, serta Produk terlaris. Sheet Pesanan berisi satu baris per pesanan.",
        "HPP dan margin yang belum lengkap tidak dianggap nol. Periksa jumlah pesanan dengan harga beli belum lengkap sebelum menilai hasil usaha.",
      ], destination: "reports", action: "Buka Laporan",
    },
    {
      id: "status", title: "Kelola status dan refund",
      steps: [
        "Status pesanan terdiri dari Diproses, Selesai, dan Dibatalkan. Tandai selesai atau batalkan dari halaman Pesanan. Pembayaran tetap terpisah; pesanan selesai belum tentu lunas. Status pada Ringkasan hanya untuk dilihat.",
        "Untuk batch atau perjalanan, gunakan ikon ubah status. Alurnya Dibuka → Ditutup → Selesai. Setelah ditutup tidak bisa dibuka kembali; setelah selesai status terkunci.",
        "Jika ada uang yang dikembalikan, buka Refund pada pesanan dan isi nominal serta tanggalnya. Tippo mencatat pengembalian; transfer uang ke pelanggan dilakukan di luar Tippo.",
      ], destination: "orders", action: "Kelola Pesanan",
    },
    {
      id: "data", title: "Import Excel dan cadangkan data",
      steps: [
        "Pelanggan Pro bisa mengunduh template produk, pesanan Jastip, atau pesanan Open PO melalui tombol import pada halaman terkait.",
        "Pindahkan data Excel ke template Tippo, lalu unggah kembali. Baris dengan nomor pesanan yang sama menjadi satu pesanan. Periksa pratinjau sebelum menyimpan import.",
        "Buka Pengaturan data untuk mengekspor cadangan. Simpan salinan secara rutin, terutama sebelum mengganti atau memulihkan data.",
      ], destination: "settings", action: "Buka Pengaturan data",
    },
  ];
  const questions = [
    ["Apakah data Jastip dan Open PO digabung?", "Ringkasan, pesanan, batch, dan HPP mengikuti usaha yang sedang dipilih. Kontak pelanggan, profil bisnis, pengaturan data, dan langganan dipakai bersama dalam akun."],
    ["Mengapa batch tidak muncul pada pilihan pesanan baru?", "Hanya batch atau perjalanan yang masih dibuka yang bisa dipilih untuk pesanan baru. Batch PO yang sudah ditutup atau selesai tidak ditampilkan. Pada Jastip, perjalanan yang sudah ditutup atau selesai tidak bisa dipilih untuk pesanan baru."],
    ...(!po ? [
      ["Kapan kurs Jastip diperbarui?", "Kurs referensi harian diambil saat memilih mata uang pada perjalanan dan saat menambah pesanan. Kurs bukan harga transaksi langsung. Pesanan lama tetap memakai kurs tersimpan, termasuk saat diedit; perubahan kurs batch tidak menghitung ulang pesanan lama."],
      ["Apa bedanya kurs Estimasi dan Final?", "Estimasi dipakai sebelum kurs pembayaran pasti, sehingga HPP dan laba masih perkiraan. Sesuaikan kurs dengan pembayaran sebenarnya, lalu pilih Final di HPP & Margin. Jika kurs otomatis gagal diambil, kamu bisa mengisi kurs manual."],
      ["Apakah invoice pelanggan ikut memakai mata uang asing?", "Tidak. Mata uang asing hanya untuk harga beli Jastip dan perhitungan HPP. Harga jual, pembayaran pelanggan, dan invoice tetap dalam rupiah."],
    ] : []),
    ["Bagaimana menyalin atau mengarsipkan produk?", "Gunakan Duplikat produk untuk menyalin produk menjadi entri baru. Produk yang diarsipkan tidak tersedia untuk pesanan baru; aktifkan kembali melalui halaman Produk."],
    ["Apakah perubahan harga produk mengubah pesanan lama?", "Tidak. Harga produk disalin saat pesanan dibuat dan tersimpan pada pesanan tersebut. Perubahan master produk digunakan untuk pesanan berikutnya."],
    ["Di mana melihat rekap belanja?", "Buka Perjalanan untuk Jastip atau Batch PO untuk Open PO, lalu pilih Rekap belanja atau Rekap kebutuhan produk. Produk digabung menurut toko/brand, nama, varian, warna, dan ukuran. Klik Lihat pelanggan untuk memeriksa pembagian jumlahnya. Pesanan yang dibatalkan tidak disertakan. Isi Toko / brand pada tiap produk Jastip atau pada master produk PO; pesanan lama tetap memakai informasi saat dibuat."],
    ["Bagaimana batas diskon dihitung?", "Diskon persen maksimal 100% dari subtotal produk dan fee, tidak termasuk ongkir. Diskon rupiah maksimal total tagihan sebelum diskon, termasuk ongkir. Nominal input otomatis dibatasi sesuai batas tersebut."],
    ["Apa yang berubah setelah refund dicatat?", "Pembayaran yang masih diterima berkurang dan riwayat refund tersimpan. Pada pesanan aktif, total tagihan tetap sehingga sisa tagihan bisa bertambah. Pilihan refund seluruh pembayaran dan batalkan pesanan juga mengubah status menjadi Dibatalkan."],
    ["Mengapa saya tidak bisa memakai import Excel?", "Import template tersedia pada paket Pro. Paket Gratis tetap bisa mencatat produk dan pesanan secara manual."],
    ["Apa batas paket Gratis?", "Kamu bisa mencatat 5 pesanan Jastip dan 5 pesanan Open PO per bulan, serta menyimpan maksimal 5 produk Open PO termasuk produk yang diarsipkan. Kuota pesanan dihitung berdasarkan bulan pencatatan dan tidak kembali karena pesanan dibatalkan."],
    ["Kapan langganan Pro aktif?", "Pro aktif setelah pembayaran terverifikasi. Membuat invoice pembayaran saja belum mengaktifkan Pro. Cek status dan Riwayat langganan pada menu Paket & langganan; perpanjangan ditambahkan dari akhir masa Pro yang masih aktif."],
    ["Bagaimana melihat atau mengedit detail pesanan?", "Klik baris pesanan di desktop atau ketuk kartu di ponsel untuk membuka detail. Daftar menampilkan maksimal dua produk; detail menampilkan semuanya. Dari halaman Pesanan, detail menyediakan aksi yang tersedia seperti Edit, Invoice, dan Refund. Detail pesanan pada Ringkasan hanya untuk dilihat."],
    ["Apakah data langsung tersimpan saat saya mengetik?", "Perubahan dalam form disimpan setelah kamu menekan tombol simpan. Tunggu pemberitahuan berhasil. Jika penyimpanan gagal, periksa koneksi dan coba lagi sebelum menutup form."],
    ["Bagaimana mengirim ide atau melaporkan kendala?", "Buka Kritik & saran, pilih jenis masukan dan bagian Tippo, lalu isi judul serta pesan. Sertakan langkah yang kamu lakukan agar kendalanya lebih mudah ditelusuri."],
  ];

  return <div className="help-layout">
    <nav className="help-index" aria-label="Daftar isi panduan">
      <strong>Di halaman ini</strong>
      {guides.map(guide => <a key={guide.id} href={`#panduan-${guide.id}`}>{guide.title}</a>)}
      <a href="#panduan-faq">Pertanyaan umum</a>
    </nav>
    <div className="help-content">
      <section className="card help-guide" aria-label={`Panduan ${business}`}>
        {guides.map((guide, index) => <section key={guide.id} id={`panduan-${guide.id}`} className="help-topic">
          <h2><span className="order-section-number">{index + 1}</span>{guide.title}</h2>
          <ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>
          <button className="btn btn-secondary" onClick={() => onNavigate(guide.destination)}>{guide.action}</button>
        </section>)}
      </section>
      <section id="panduan-faq" className="card help-faq" aria-labelledby="help-faq-title">
        <h2 id="help-faq-title">Pertanyaan umum</h2>
        {questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
      <div className="help-contact"><div><strong>Butuh bantuan?</strong><p>WhatsApp CS: {CUSTOMER_SERVICE_PHONE}</p></div><div className="help-contact-actions"><button className="btn btn-secondary" onClick={() => onNavigate("feedback")}>Kritik & saran</button><a className="btn btn-primary" href={CUSTOMER_SERVICE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Hubungi CS via WhatsApp</a></div></div>
    </div>
  </div>;
}

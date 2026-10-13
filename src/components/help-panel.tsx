import type { Batch } from "@/lib/types";

type HelpDestination = "products" | "batches" | "orders" | "hpp" | "settings" | "feedback";

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
    {
      id: "pesanan", title: "Isi pesanan dan pembayaran",
      steps: [
        "Pilih batch yang masih dibuka. Jika hanya ada satu batch aktif, Tippo memilihnya otomatis. Pilih pelanggan yang sudah ada atau + Pelanggan baru; alamat dan WhatsApp boleh kosong.",
        "Pilih tanggal lewat kalender, lalu isi produk dan jumlahnya. Field bertanda bintang merah wajib diisi.",
        "Tambahkan diskon, ongkir yang ditagihkan, dan catatan jika diperlukan. Periksa total tagihan sebelum mengisi pembayaran.",
        "Gunakan Lunas untuk mengisi seluruh total tagihan atau Bayar sebagian untuk menulis nominal yang sudah diterima. Klik Simpan pesanan setelah datanya lengkap.",
        "Untuk mengubah status pesanan, klik ikon panah dua arah pada kolom Tindakan atau Ubah status pada detail ponsel. Pilih status baru, lalu klik Simpan status. Pesanan yang sudah dibayar perlu refund seluruh pembayaran sebelum dibatalkan.",
      ], destination: "orders", action: "Buka Pesanan",
    },
    {
      id: "hpp", title: "Periksa HPP dan margin",
      steps: [
        "Buka HPP & Margin dan pilih batch yang ingin diperiksa. Lengkapi harga beli per produk yang belum diketahui, lalu simpan.",
        "HPP produk dihitung dari harga beli dikalikan jumlah produk. Jika ongkir supplier atau kemasan ingin masuk HPP, sertakan dalam harga beli per produk.",
        "Ringkasan menampilkan penjualan, estimasi margin, pembayaran, dan sisa tagihan untuk usaha serta bulan yang dipilih. Periksa HPP yang belum lengkap sebelum menilai margin.",
      ], destination: "hpp", action: "Buka HPP & Margin",
    },
    {
      id: "status", title: "Kelola status dan refund",
      steps: [
        "Ubah status pesanan dari halaman Pesanan: Tercatat, Dikirim, Selesai, atau Dibatalkan. Status pada Ringkasan hanya untuk dilihat.",
        "Untuk batch atau perjalanan, gunakan ikon ubah status. Alurnya Dibuka → Ditutup → Selesai. Setelah ditutup tidak bisa dibuka kembali; setelah selesai status terkunci.",
        "Jika ada uang yang dikembalikan, buka Refund pada pesanan dan isi nominal serta tanggalnya. Tippo mencatat pengembalian; transfer uang ke pelanggan dilakukan di luar Tippo.",
      ], destination: "orders", action: "Kelola Pesanan",
    },
    {
      id: "data", title: "Import Excel dan cadangkan data",
      steps: [
        "Pelanggan Pro bisa mengunduh template produk, pesanan Jastip, atau pesanan Open PO melalui tombol import pada halaman terkait.",
        "Pindahkan data Excel ke template Tippo, lalu unggah kembali. Periksa hasil pratinjau dan perbaiki baris yang bermasalah sebelum menyimpan import.",
        "Buka Pengaturan data untuk mengekspor cadangan. Simpan salinan secara rutin, terutama sebelum mengganti atau memulihkan data.",
      ], destination: "settings", action: "Buka Pengaturan data",
    },
  ];
  const questions = [
    ["Apakah data Jastip dan Open PO digabung?", "Ringkasan, pesanan, batch, dan HPP mengikuti usaha yang sedang dipilih. Kontak pelanggan, profil bisnis, pengaturan data, dan langganan dipakai bersama dalam akun."],
    ["Mengapa batch tidak muncul pada pilihan pesanan baru?", "Hanya batch atau perjalanan yang masih dibuka yang bisa dipilih untuk pesanan baru. Batch PO yang sudah ditutup atau selesai tidak ditampilkan. Pada Jastip, perjalanan yang sudah ditutup atau selesai tidak bisa dipilih untuk pesanan baru."],
    ["Apakah perubahan harga produk mengubah pesanan lama?", "Tidak. Harga produk disalin saat pesanan dibuat dan tersimpan pada pesanan tersebut. Perubahan master produk digunakan untuk pesanan berikutnya."],
    ["Di mana melihat rekap belanja?", "Buka Perjalanan untuk Jastip atau Batch PO untuk Open PO, lalu pilih Rekap belanja atau Rekap kebutuhan produk. Produk digabung menurut toko/brand, nama, varian, warna, dan ukuran. Klik Lihat pelanggan untuk memeriksa pembagian jumlahnya. Pesanan yang dibatalkan tidak disertakan. Isi Toko / brand pada tiap produk Jastip atau pada master produk PO; pesanan lama tetap memakai informasi saat dibuat."],
    ["Bagaimana batas diskon dihitung?", "Diskon persen maksimal 100% dari subtotal produk dan fee, tidak termasuk ongkir. Diskon rupiah maksimal total tagihan sebelum diskon, termasuk ongkir. Nominal input otomatis dibatasi sesuai batas tersebut."],
    ["Apa yang berubah setelah refund dicatat?", "Pembayaran yang masih diterima berkurang dan riwayat refund tersimpan. Pada pesanan aktif, total tagihan tetap sehingga sisa tagihan bisa bertambah. Pilihan refund seluruh pembayaran dan batalkan pesanan juga mengubah status menjadi Dibatalkan."],
    ["Mengapa saya tidak bisa memakai import Excel?", "Import template tersedia pada paket Pro. Paket Gratis tetap bisa mencatat produk dan pesanan secara manual."],
    ["Apa batas paket Gratis?", "Kamu bisa mencatat 5 pesanan Jastip dan 5 pesanan Open PO per bulan, serta menyimpan maksimal 5 produk Open PO termasuk produk yang diarsipkan. Kuota pesanan dihitung berdasarkan bulan pencatatan dan tidak kembali karena pesanan dibatalkan."],
    ["Apakah membuat invoice Pro langsung mengaktifkan langganan?", "Belum. Draf invoice adalah rincian tagihan, bukan bukti pembayaran atau tanda bahwa Pro sudah aktif. Periksa status paket pada halaman Paket & langganan."],
    ["Bagaimana melihat atau mengedit pesanan di ponsel?", "Ketuk baris pesanan untuk membuka detail. Dari halaman Pesanan, detail menyediakan aksi yang tersedia seperti Edit, Invoice, dan Refund. Detail pesanan pada Ringkasan hanya untuk dilihat."],
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
      <div className="help-contact"><p>Masih ada yang ingin ditanyakan?</p><button className="btn btn-secondary" onClick={() => onNavigate("feedback")}>Buka Kritik & saran</button></div>
    </div>
  </div>;
}

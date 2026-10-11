"use client";

import { ThemeToggle } from "@/components/theme-toggle";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wordmark } from "./wordmark";
import { formatCurrency, orderRevenue, outstanding } from "@/lib/finance";
import { seedData } from "@/lib/seed";
import type { Order } from "@/lib/types";

const exampleOrders: Record<"jastip" | "po", Order> = {
  jastip: {
    ...seedData.orders[12],
    items: [seedData.orders[12].items[0], seedData.orders[14].items[0]],
  },
  po: {
    ...seedData.orders[20],
    items: seedData.products.map((product, index) => ({
      id: product.id, productId: product.id, product: product.name,
      variant: product.variant, color: "", size: "", quantity: index === 0 ? 2 : 1,
      unitPrice: product.unitPrice, unitCost: product.unitCost,
    })),
  },
};

const questions = [
  ["Apa bedanya Jastip dan Open PO?", "Jastip cocok untuk barang titipan dengan varian, warna, ukuran, dan fee jasa. Open PO memakai master produk, sehingga kamu cukup memilih produk dan jumlahnya saat mencatat pesanan. Ganti mode melalui switch Jastip / Open PO; masing-masing memiliki menu dan ringkasan sendiri."],
  ["Apakah ringkasan Jastip dan Open PO digabung?", "Tidak. Penjualan, HPP, pembayaran, tagihan, dan grafik bulanan hanya menampilkan usaha yang sedang dipilih. Jastip memakai aksen teal, Open PO memakai jingga hangat. Akun, kontak pelanggan, profil bisnis, cadangan data, dan langganan tetap digunakan bersama."],
  ["Satu pesanan bisa berisi beberapa barang?", "Bisa. Tambahkan beberapa barang atau makanan dalam satu pesanan. Pembayaran, ongkir, dan invoice tetap menjadi satu. Kuota menghitung pesanan, bukan jumlah barang."],
  ["Bagaimana batas paket Gratis dihitung?", "Kamu mendapat 5 pesanan Jastip dan 5 pesanan Open PO secara terpisah setiap bulan, serta maksimal 5 produk Open PO termasuk produk yang diarsipkan. Kuota pesanan kembali tersedia tanggal 1 pukul 00.00 WIB. Pesanan yang dibatalkan tetap terhitung."],
  ["Bisa pindahkan pesanan dari Excel?", "Bisa, dengan paket Pro. Tersedia template produk, pesanan Jastip, dan pesanan Open PO. Pilih mode usaha lalu buka Pesanan untuk import pesanan, atau Produk pada Open PO untuk import katalog. Unduh template, isi data, lalu unggah. Baris dengan nomor pesanan yang sama digabung menjadi satu pesanan. Kamu bisa memeriksa hasilnya sebelum menyimpan."],
  ["Bagaimana status batch atau perjalanan diubah?", "Dari daftar Batch PO atau Perjalanan, gunakan ikon Tutup batch atau Selesaikan batch lalu konfirmasi. Alurnya Dibuka, Ditutup, lalu Selesai. Batch yang ditutup tidak bisa dibuka kembali; status Selesai terkunci. Status pesanan di dalamnya tetap diatur secara terpisah."],
  ["Apakah invoice langsung terkirim ke WhatsApp?", "Invoice dapat disalin lalu kamu tempel ke chat WhatsApp pelanggan. Pengiriman tetap kamu lakukan sendiri. Harga beli, HPP, dan catatan internal tidak ikut dalam invoice."],
  ["Apakah paket Pro sudah bisa dibeli?", "Harga Pro adalah Rp25.000 per bulan. Pembayaran langganan sedang disiapkan. Kamu dapat mulai memakai paket Gratis."],
];

const planRows = [
  ["Pesanan Jastip", "5 per bulan", "Tanpa batas kuota"],
  ["Pesanan Open PO", "5 per bulan", "Tanpa batas kuota"],
  ["Master produk Open PO", "Maksimal 5 produk", "Tanpa batas kuota"],
  ["Template dan import Excel", "Tidak tersedia", "Produk, Jastip, dan Open PO"],
  ["Ringkasan & grafik per usaha", "Bulan berjalan", "Termasuk bulan sebelumnya"],
];

const testimonials = [
  { mode: "Jastip", quote: "Yang bikin ribet itu nyari lagi warna, ukuran, sama siapa yang udah bayar. Kalau detailnya ngumpul per pesanan, nggak perlu bolak-balik cari di chat.", context: "Contoh cerita usaha titipan belanja" },
  { mode: "Open PO", quote: "Produkku itu-itu aja, jadi enak kalau tinggal pilih produk dan jumlah. Terus kelihatan siapa yang belum lunas, biar pas tutup PO nggak ada yang kelewat.", context: "Contoh cerita usaha makanan PO" },
];

export function LandingPage() {
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState<"jastip" | "po">("jastip");
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const example = exampleOrders[preview];

  useEffect(() => {
    if (!menu) return;
    navigation.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menu]);

  return (
    <div className="landing">
      <a className="skip-link" href="#konten">Lewati ke konten</a>
      <header className="landing-header">
        <div className="landing-nav landing-container">
          <Wordmark />
          <nav id="website-menu" ref={navigation} aria-label="Navigasi website" className={menu ? "is-open" : ""}>
            <a href="#fitur" onClick={() => setMenu(false)}>Fitur</a>
            <a href="#cara-kerja" onClick={() => setMenu(false)}>Cara kerja</a>
            <a href="#harga" onClick={() => setMenu(false)}>Harga</a>
            <a href="#faq" onClick={() => setMenu(false)}>FAQ</a>
          </nav>
          <div className="landing-nav-actions">
            <ThemeToggle />
            <Link href="/masuk" className="landing-login">Masuk</Link>
            <Link href="/daftar" className="landing-button primary small">Buat akun gratis</Link>
            <button ref={menuButton} type="button" className="landing-menu" aria-label={menu ? "Tutup menu" : "Buka menu"} aria-controls="website-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? "Tutup" : "Menu"}</button>
          </div>
        </div>
      </header>

      <main id="konten" tabIndex={-1}>
        <section className="landing-hero landing-container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-kicker">Untuk usaha jastip & open PO</p>
            <h1 id="hero-title">Titip &amp; Pesan, <br /><span>Beres di Tippo.</span></h1>
            <p>Pilih Jastip atau Open PO lewat satu switch. Pesanan, HPP, tagihan, dan ringkasan mengikuti usaha yang kamu pilih, dengan catatan masing-masing.</p>
            <div className="hero-actions">
              <Link href="/daftar" className="landing-button primary">Buat akun gratis</Link>

            </div>
            <p className="hero-start-note">Gratis 5 pesanan Jastip + 5 pesanan Open PO setiap bulan.<br />Satu pesanan boleh berisi banyak barang.</p>
          </div>

          <div className={`order-ledger ${preview === "po" ? "ledger-po" : ""}`}>
            <div className="ledger-cover"><strong>Dua mode, fokus masing-masing.</strong><span>Contoh pesanan fiktif</span></div>
            <div className="ledger-tabs" role="group" aria-label="Pilihan alur pesanan">
              <button type="button" aria-pressed={preview === "jastip"} aria-controls="ledger-content" onClick={() => setPreview("jastip")}>Jastip</button>
              <button type="button" aria-pressed={preview === "po"} aria-controls="ledger-content" onClick={() => setPreview("po")}>Open PO</button>
            </div>
            <div className="ledger-mode-context" aria-live="polite"><strong>Menu {preview === "jastip" ? "Jastip" : "Open PO"}</strong><p>{preview === "jastip" ? "Ringkasan · Perjalanan · Pesanan · HPP & Margin" : "Ringkasan · Produk · Batch PO · Pesanan · HPP & Margin"}</p></div>
            <div id="ledger-content" className="ledger-page" aria-live="polite">
              <div className="ledger-heading">
                <p>{preview === "jastip" ? "Titipan belanja" : "Pesanan dari katalog"}</p>
                <h2>{preview === "jastip" ? "Setiap titipan punya detailnya." : "Produk siap, pesanan lebih ringkas."}</h2>
              </div>
              <div className="ledger-items">
                <div className="ledger-column-labels"><span>Barang / jumlah</span><span>Subtotal</span></div>
                {example.items.map((item) => <div className="ledger-product" key={item.id}><div><strong>{item.product}</strong><span>{item.quantity} × {formatCurrency(item.unitPrice)}</span></div><strong>{formatCurrency(item.quantity * item.unitPrice)}</strong></div>)}
                <p className="ledger-item-note">{preview === "jastip" ? "Varian, warna, dan ukuran bisa dicatat per barang." : "Harga dan HPP mengikuti master produk yang dipilih."}</p>
              </div>
              <dl className="ledger-calculation">
                {preview === "jastip" && <div><dt>Fee jastip</dt><dd>{formatCurrency(example.serviceFee)}</dd></div>}
                <div><dt>Ongkir</dt><dd>{formatCurrency(example.shippingCharge)}</dd></div>
                <div className="ledger-total"><dt>Total pesanan</dt><dd>{formatCurrency(orderRevenue(example))}</dd></div>
                <div><dt>Sudah dibayar</dt><dd>{formatCurrency(example.paid)}</dd></div>
              </dl>
              <div className="ledger-payment"><span>Sisa tagihan</span><strong>{formatCurrency(outstanding(example))}</strong></div>
            </div>
            <p className="ledger-caption">Ringkasan tiap usaha terpisah. Ini contoh perhitungan satu pesanan; harga beli tidak masuk invoice pelanggan.</p>
          </div>
        </section>

        <section id="fitur" className="mode-section landing-container" aria-labelledby="mode-title">
          <div className="landing-mode-intro">
            <p className="section-label">Satu akun, dua mode usaha</p>
            <h2 id="mode-title">Dua cara jualan.<br />Punya catatan<br />masing-masing.</h2>
            <p>Ganti usaha melalui switch Jastip / Open PO. Menu, form, dan ringkasan mengikuti mode aktif tanpa menggabungkan transaksi kedua usaha.</p>
          </div>
          <div className="mode-notes">
            <article className="mode-note">
              <span className="mode-note-context">Titipan belanja</span>
              <h3>Jastip</h3>
              <p>Untuk barang yang kamu belikan atas titipan pelanggan.</p>
              <ul><li>Kelompokkan pesanan dalam perjalanan.</li><li>Isi varian, warna, dan ukuran per barang.</li><li>Catat harga beli serta fee jastip.</li><li>Periksa ringkasan dan tagihan Jastip.</li></ul>
            </article>
            <article className="mode-note mode-note-po">
              <span className="mode-note-context">Produk dari katalog</span>
              <h3>Open PO</h3>
              <p>Untuk produk atau makanan yang sudah punya katalog.</p>
              <ul><li>Siapkan master produk beserta kategorinya.</li><li>Pilih produk dan jumlah saat membuat pesanan.</li><li>Kelompokkan pesanan dalam batch PO.</li><li>Periksa ringkasan dan tagihan Open PO.</li></ul>
            </article>
          </div>
        </section>

        <section id="cara-kerja" className="working-section" aria-labelledby="working-title">
          <div className="landing-container working-layout">
            <div className="working-heading">
              <p className="section-label">Saat pesanan mulai ramai</p>
              <h2 id="working-title">Satu pesanan,<br />semua barangnya.</h2>
              <p>Pembayaran, ongkir, dan sisa tagihan mengikuti pesanan. Detail barang tetap bisa kamu periksa satu per satu.</p>
              <Link href="/daftar" className="landing-text-link">Mulai catat pesanan</Link>
            </div>
            <div className="working-list">
              <article><h3>Isi cepat atau impor Excel</h3><p>Dengan Pro, gunakan template sesuai jenis usaha. Baris dengan nomor pesanan yang sama akan menjadi satu pesanan. Periksa pratinjau sebelum menyimpan.</p></article>
              <article><h3>Lengkapi modal, cek margin</h3><p>HPP memakai harga beli per barang dan jumlahnya. Tippo menandai biaya yang belum lengkap agar kamu tahu pesanan mana yang perlu diperiksa.</p></article>
              <article><h3>Periksa ringkasan usaha terpilih</h3><p>Penjualan, HPP, margin, pembayaran, dan tagihan mengikuti mode Jastip atau Open PO yang aktif. Grafik kedua usaha tidak digabung. Paket Gratis menampilkan bulan berjalan.</p></article>
              <article><h3>Salin invoice ke WhatsApp</h3><p>Invoice memuat seluruh barang, pembayaran, dan sisa tagihan. Kamu salin lalu tempel ke chat pelanggan. HPP serta catatan internal tetap di catatanmu.</p></article>
            </div>
          </div>
        </section>

        <section className="testimonials-section landing-container" aria-labelledby="testimonials-title">
          <div className="testimonials-heading"><p className="section-label">Contoh testimoni</p><h2 id="testimonials-title">Catatan rapi itu<br />bikin kerja lebih ringan.</h2><p>Contoh tulisan dengan bahasa sehari-hari. Belum merupakan ulasan pelanggan asli.</p></div>
          <div className="testimonials-list">{testimonials.map(item => <figure className={item.mode === "Open PO" ? "testimonial-po" : ""} key={item.mode}><blockquote><p>“{item.quote}”</p></blockquote><figcaption><strong>{item.mode}</strong><span>{item.context}</span></figcaption></figure>)}</div>
        </section>

        <section id="harga" className="pricing-section landing-container" aria-labelledby="pricing-title">
          <div className="pricing-heading">
            <div><p className="section-label">Paket sesuai kebutuhan</p><h2 id="pricing-title">Mulai dari Gratis.</h2><p>Fitur pencatatan sudah tersedia. Pilih paket sesuai jumlah pesanan dan riwayat yang kamu perlukan.</p></div>
            <Link href="/daftar" className="landing-button primary">Buat akun gratis</Link>
          </div>
          <table className="plan-table">
            <caption>Perbandingan paket Tippo</caption>
            <thead><tr><td /><th scope="col">Gratis<strong>Rp0<span>/ bulan</span></strong></th><th scope="col">Pro<strong>Rp25.000<span>/ bulan</span></strong></th></tr></thead>
            <tbody>{planRows.map(([feature, free, pro]) => <tr key={feature}><th scope="row">{feature}</th><td>{free}</td><td>{pro}</td></tr>)}</tbody>
          </table>
          <div className="plan-notes">
            <p>Multi-barang, perhitungan HPP, dan invoice tersedia di kedua paket. Template dan import Excel tersedia khusus Pro. Kuota pesanan Gratis reset setiap tanggal 1 pukul 00.00 WIB.</p>
            <p><strong>Pembayaran Pro sedang disiapkan.</strong> Belum bisa berlangganan. Kamu dapat mulai dengan paket Gratis.</p>
          </div>
        </section>

        <section id="faq" className="faq-section landing-container" aria-labelledby="faq-title">
          <div className="faq-heading"><h2 id="faq-title">Sebelum mencatat<br />pesanan pertama.</h2><p>Rincian kuota, impor, dan invoice agar kamu tahu cara memakai Tippo.</p></div>
          <div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true" className="faq-marker">+</span></summary><p>{answer}</p></details>)}</div>
        </section>
      </main>

      <footer className="landing-footer landing-container">
        <div><Wordmark /><p>Titip &amp; Pesan, Beres di Tippo.</p></div>
        <nav aria-label="Tautan footer"><Link href="/masuk">Masuk</Link><Link href="/privasi">Privasi</Link><Link href="/ketentuan">Ketentuan</Link></nav>
      </footer>
    </div>
  );
}

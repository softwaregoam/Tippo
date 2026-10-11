"use client";

import { useState } from "react";
import { Copy, Download, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProInvoice, parseProInvoice, proInvoiceText, type ProInvoice } from "@/lib/pro-invoice";

export function ProInvoicePanel({ account, onNotify }: { account: { id: string; name: string; email: string }; onNotify?: (message: string) => void }) {
  const key = `tippo.pro-invoice.draft.v1.${account.id}`;
  const [invoice, setInvoice] = useState<ProInvoice | null>(() => {
    try { return parseProInvoice(JSON.parse(localStorage.getItem(key) ?? "null"), account.id); } catch { return null; }
  });
  const [error, setError] = useState("");
  const [copying, setCopying] = useState(false);

  function create() {
    setError("");
    try {
      const next = createProInvoice(account);
      localStorage.setItem(key, JSON.stringify(next));
      setInvoice(next); onNotify?.("Draf invoice Pro dibuat");
    } catch { setError("Draf belum tersimpan. Izinkan penyimpanan browser, lalu coba lagi."); }
  }
  async function copy() {
    if (!invoice || copying) return;
    setError(""); setCopying(true);
    try { await navigator.clipboard.writeText(proInvoiceText(invoice)); onNotify?.("Invoice disalin"); }
    catch { setError("Invoice belum bisa disalin. Gunakan Unduh invoice."); }
    finally { setCopying(false); }
  }
  function download() {
    if (!invoice) return;
    setError("");
    try {
      const url = URL.createObjectURL(new Blob([proInvoiceText(invoice)], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `${invoice.id}.txt`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Invoice belum bisa diunduh. Coba lagi."); }
  }

  return <section id="invoice-pro" className="card pro-invoice-panel" aria-label="Invoice langganan Pro">
    <div className="card-header"><div><h2>Invoice langganan Pro</h2><p>Tippo Pro untuk Jastip dan Open PO dalam satu akun.</p></div><ReceiptText size={22} aria-hidden="true" /></div>
    <div className="pro-invoice-body">
      <p className="field-hint">Pembayaran QRIS belum tersedia. Draf ini bukan bukti pembayaran dan tidak mengaktifkan Pro. Tersimpan hanya di browser ini, terpisah per akun.</p>
      {invoice ? <>
        <dl className="pro-invoice-details"><dt>Nomor invoice</dt><dd>{invoice.id}</dd><dt>Tanggal</dt><dd>{new Date(invoice.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</dd><dt>Nama usaha</dt><dd>{invoice.businessName}</dd><dt>Email</dt><dd>{invoice.email}</dd><dt>Paket</dt><dd>Tippo Pro · 1 bulan</dd><dt>Status</dt><dd><span className="status-tag">Draf · pembayaran belum tersedia</span></dd><dt>Total</dt><dd><strong>Rp25.000</strong></dd></dl>
        <p className="field-hint">Masa aktif dihitung setelah pembayaran terverifikasi. Jika Pro masih aktif, 1 bulan ditambahkan dari tanggal berakhirnya.</p>
        <div className="pro-invoice-actions"><Button className="btn btn-secondary" disabled={copying} onClick={copy}><Copy size={16} />{copying ? "Menyalin…" : "Salin invoice"}</Button><Button className="btn btn-primary" onClick={download}><Download size={16} />Unduh invoice (.txt)</Button></div>
      </> : <div className="pro-invoice-empty"><p>Belum ada invoice langganan. Buat draf untuk melihat rincian paket dan tagihan sebelum pembayaran tersedia.</p><Button className="btn btn-primary" onClick={create}><ReceiptText size={16} />Buat draf invoice Pro</Button></div>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </div>
  </section>;
}

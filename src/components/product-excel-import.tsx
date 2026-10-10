"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildProductImport, createProductTemplate, previewProductImport, type ProductImportPreview } from "@/lib/excel-import";
import { formatCurrency } from "@/lib/finance";
import type { AppData, Product } from "@/lib/types";

export function ProductExcelImportDialog({ data, importAllowed, productLimit, onImport, onClose }: {
  data: AppData;
  importAllowed: boolean;
  productLimit?: number;
  onImport: (products: Product[]) => boolean | Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const operation = useRef(0);
  const submitting = useRef(false);
  const [busy, setBusy] = useState<"template" | "reading" | "importing" | null>(null);
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const canImport = Boolean(importAllowed && preview && preview.rows.length && preview.validCount === preview.rows.length && !preview.errors.length && !busy);
  useEffect(() => {
    const element = dialog.current;
    const counter = operation;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { counter.current++; element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  async function download() {
    if (busy || !importAllowed) return;
    const token = ++operation.current; setBusy("template"); setError("");
    try {
      const bytes = await createProductTemplate();
      if (token !== operation.current) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
      const link = document.createElement("a"); link.href=url; link.download="tippo-template-produk.xlsx";
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch { if (token === operation.current) setError("Template belum dapat diunduh. Coba lagi."); }
    finally { if (token === operation.current) setBusy(null); }
  }
  async function read(file?: File) {
    if (!importAllowed) return;
    const token=++operation.current; setPreview(null); setError(""); setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 5 * 1024 * 1024) { setError("Gunakan file .xlsx dengan ukuran maksimal 5 MB."); return; }
    setBusy("reading");
    try {
      const next = await previewProductImport(await file.arrayBuffer(), data, productLimit);
      if (token === operation.current) setPreview(next);
    } catch { if (token === operation.current) setError("File belum dapat dibaca. Gunakan template produk Tippo."); }
    finally { if (token === operation.current) setBusy(null); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!preview || !canImport || submitting.current) return;
    submitting.current=true; setBusy("importing"); setError("");
    try {
      const products=buildProductImport(preview,data,productLimit);
      if (await onImport(products)) onClose();
      else setError("Produk belum tersimpan. Periksa data dan koneksi, lalu coba lagi.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Periksa file sebelum import produk."); }
    finally { submitting.current=false; setBusy(null); }
  }
  return <dialog ref={dialog} className="native-dialog excel-import-dialog" aria-labelledby="product-import-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <div className="modal-header"><div><span className="eyebrow">MASTER PRODUK OPEN PO</span><h2 id="product-import-title">Import produk Excel</h2><p>Pindahkan listing produk ke katalog Tippo.</p></div><button type="button" className="icon-button" aria-label="Tutup import produk" disabled={Boolean(busy)} onClick={onClose}><X size={20}/></button></div>
    <form onSubmit={submit} noValidate aria-busy={Boolean(busy)}>
      <div className="modal-body">
        {!importAllowed && <p className="error-message" role="alert">Import template Excel hanya tersedia untuk paket Pro. Pratinjau tetap tersimpan selama form ini terbuka.</p>}
        <ol className="import-steps" aria-label="Langkah import"><li>Unduh template</li><li>Isi data</li><li>Unggah</li><li>Periksa</li><li>Import</li></ol>
        <div className="field"><span className="field-label">1. Template produk</span><Button type="button" className="btn btn-secondary" onClick={download} disabled={Boolean(busy) || !importAllowed}>{busy==="template"?<LoaderCircle size={16} className="animate-spin"/>:<Download size={16}/>}Unduh template produk</Button><p className="field-hint">Satu baris untuk satu produk atau varian. Isi nama dan harga jual; SKU, varian, kategori, dan harga beli boleh kosong. Ganti atau hapus baris contoh.</p></div>
        <div className="field"><label className="field-label" htmlFor="product-import-file">2. Unggah template yang sudah diisi<span className="required-mark" aria-hidden="true"> *</span></label><input id="product-import-file" aria-label="File Excel produk" aria-required="true" className="input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy) || !importAllowed} style={{padding:"9px 12px",height:"auto"}} onChange={event=>void read(event.target.files?.[0])}/><p className="field-hint">Maksimal 5 MB dan 1.000 produk. Gunakan nilai biasa, bukan formula. {productLimit !== undefined && `Sisa slot Gratis: ${Math.max(0,productLimit-data.products.length)} dari ${productLimit}, termasuk produk arsip.`}</p></div>
        <p className="field-hint">Import menambah produk aktif. SKU atau nama + varian yang sudah ada akan ditolak; produk dan histori pesanan lama tetap tersimpan.</p>
        {busy==="reading"&&<p role="status">Membaca file produk…</p>}
        {error&&<p className="error-message" role="alert">{error}</p>}
        {preview&&<section aria-labelledby="product-preview-title" style={{marginTop:20}}><h3 id="product-preview-title">3. Periksa produk</h3><p className="field-hint" style={{overflowWrap:"anywhere"}}>{fileName} · {preview.validCount} dari {preview.rows.length} produk valid. Belum ada data yang disimpan.</p>{preview.errors.map((message,index)=><p key={index} className="error-message" role="alert">{message}</p>)}
          {preview.rows.length>0&&<div className="table-wrap" tabIndex={0} role="region" aria-label="Pratinjau produk Excel" style={{maxHeight:320,overflowY:"auto",marginTop:12}}><table className="orders-table"><thead><tr><th scope="col">Baris</th><th scope="col">Produk</th><th scope="col">Varian / SKU</th><th scope="col" className="numeric-cell">Harga jual</th><th scope="col" className="numeric-cell">Harga beli</th><th scope="col">Validasi</th></tr></thead><tbody>{preview.rows.map(row=><tr key={row.rowNumber}><td>{row.rowNumber}</td><td style={{whiteSpace:"normal",overflowWrap:"anywhere",minWidth:150}}>{String(row.source.produk??"")}</td><td style={{whiteSpace:"normal",overflowWrap:"anywhere",minWidth:130}}>{String(row.source.varian??"")}<div className="field-hint">{String(row.source.sku_produk??"")}</div>{row.source.kategori && <div className="field-hint">Kategori: {String(row.source.kategori)}</div>}</td><td className="numeric-cell">{row.normalized?formatCurrency(row.normalized.unitPrice):"Periksa data"}</td><td className="numeric-cell">{!row.normalized?"Periksa data":row.normalized.unitCost===null?"Belum diisi":formatCurrency(row.normalized.unitCost)}</td><td style={{whiteSpace:"normal",overflowWrap:"anywhere",minWidth:200}}>{row.errors.length?<ul className="error-message" style={{paddingLeft:16}}>{row.errors.map((message,index)=><li key={index}>{message}</li>)}</ul>:<span className="positive">Valid</span>}</td></tr>)}</tbody></table></div>}
          {(preview.errors.length > 0 || preview.validCount !== preview.rows.length)&&<p className="field-hint" style={{marginTop:12}}>Perbaiki baris bermasalah di Excel, lalu unggah ulang sebelum import.</p>}
        </section>}
      </div>
      <div className="modal-footer"><Button className="btn btn-secondary" type="button" disabled={Boolean(busy)} onClick={onClose}>Batal</Button><Button className="btn btn-primary" type="submit" disabled={!canImport}>{busy==="importing"?<LoaderCircle size={16} className="animate-spin"/>:<Check size={16}/>}Import {preview?.validCount??0} produk</Button></div>
    </form>
  </dialog>;
}

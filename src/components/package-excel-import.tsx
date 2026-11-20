"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPackageImport, createPackageTemplate, previewPackageImport, type PackageImportPreview } from "@/lib/excel-import";
import { formatCurrency } from "@/lib/finance";
import type { AppData, ProductPackage } from "@/lib/types";

export function PackageExcelImportDialog({ data, importAllowed, onImport, onClose }: {
  data: AppData;
  importAllowed: boolean;
  onImport: (packages: ProductPackage[]) => boolean | Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const operation = useRef(0);
  const submitting = useRef(false);
  const [busy, setBusy] = useState<"template" | "reading" | "importing" | null>(null);
  const [preview, setPreview] = useState<PackageImportPreview | null>(null);
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
      const bytes = await createPackageTemplate();
      if (token !== operation.current) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = "tippo-template-paket.xlsx";
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (token === operation.current) setError("Template belum dapat diunduh. Coba lagi."); }
    finally { if (token === operation.current) setBusy(null); }
  }

  async function read(file?: File) {
    if (!importAllowed) return;
    const token = ++operation.current; setPreview(null); setError(""); setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 5 * 1024 * 1024) { setError("Gunakan file .xlsx dengan ukuran maksimal 5 MB."); return; }
    setBusy("reading");
    try {
      const next = await previewPackageImport(await file.arrayBuffer(), data);
      if (token === operation.current) setPreview(next);
    } catch { if (token === operation.current) setError("File belum dapat dibaca. Gunakan template paket Tippo."); }
    finally { if (token === operation.current) setBusy(null); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!preview || !canImport || submitting.current) return;
    submitting.current = true; setBusy("importing"); setError("");
    try {
      const packages = buildPackageImport(preview, data);
      if (await onImport(packages)) onClose();
      else setError("Paket belum tersimpan. Periksa data dan koneksi, lalu coba lagi.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Periksa file sebelum import paket."); }
    finally { submitting.current = false; setBusy(null); }
  }

  return <dialog ref={dialog} className="native-dialog excel-import-dialog" aria-labelledby="package-import-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-header"><div><h2 id="package-import-title">Import paket Excel</h2><p>Unggah produk paket dari template Excel.</p></div><button type="button" className="icon-button" aria-label="Tutup import paket" disabled={Boolean(busy)} onClick={onClose}><X size={20} /></button></div>
    <form onSubmit={submit} noValidate aria-busy={Boolean(busy)}>
      <div className="modal-body">
        {!importAllowed && <p className="error-message" role="alert">Import Excel tersedia di paket Pro.</p>}
        <div className="field"><span className="field-label">Template paket</span><Button type="button" className="btn btn-secondary" onClick={download} disabled={Boolean(busy) || !importAllowed}>{busy === "template" ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />} Unduh template paket</Button><p className="field-hint">Ganti atau hapus baris contoh sebelum diunggah.</p></div>
        <div className="field"><label className="field-label" htmlFor="package-import-file">File Excel<span className="required-mark" aria-hidden="true"> *</span></label><input id="package-import-file" aria-describedby="package-import-file-hint" aria-label="File Excel paket" aria-required="true" className="input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={Boolean(busy) || !importAllowed} style={{ padding: "9px 12px", height: "auto" }} onChange={event => void read(event.target.files?.[0])} /><p className="field-hint" id="package-import-file-hint">.xlsx · Maks. 5 MB · 1.000 baris. Impor menambah paket baru.</p></div>
        <details className="form-section">
          <summary>Panduan pengisian</summary>
          <ul className="field-hint" style={{ paddingLeft: 18, lineHeight: 1.8, marginTop: 8 }}>
            <li>Satu baris untuk satu produk anggota. Gabungkan baris dengan nama_paket yang sama menjadi satu paket.</li>
            <li>nama_paket, nama_produk, jumlah, dan harga_paket wajib diisi.</li>
            <li>Produk anggota harus cocok dengan nama produk di katalog aktif.</li>
            <li>Isi harga dengan angka biasa, bukan formula.</li>
            <li>Nama paket yang sudah ada akan ditolak.</li>
          </ul>
        </details>
        {busy === "reading" && <p role="status">Membaca file paket…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {preview && <section aria-labelledby="package-preview-title" style={{ marginTop: 20 }}>
          <h3 id="package-preview-title">Pratinjau paket</h3>
          <p className="field-hint" style={{ overflowWrap: "anywhere" }}>{fileName} · {preview.validCount} dari {preview.rows.length} paket valid.</p>
          {preview.errors.map((message, index) => <p key={index} className="error-message" role="alert">{message}</p>)}
          {preview.rows.length > 0 && <div className="table-wrap" tabIndex={0} role="region" aria-label="Pratinjau paket Excel" style={{ maxHeight: 320, overflowY: "auto", marginTop: 12 }}>
            <table className="orders-table"><thead><tr><th scope="col">Baris</th><th scope="col">Nama paket</th><th scope="col">SKU paket</th><th scope="col">Produk anggota</th><th scope="col" className="numeric-cell">Jumlah</th><th scope="col" className="numeric-cell">Harga paket</th><th scope="col">Validasi</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td style={{ whiteSpace: "normal", overflowWrap: "anywhere", minWidth: 150 }}>{String(row.source.nama_paket ?? "")}</td><td style={{ whiteSpace: "normal", overflowWrap: "anywhere", minWidth: 130 }}>{String(row.source.sku_paket ?? "")}</td><td style={{ whiteSpace: "normal", overflowWrap: "anywhere", minWidth: 200 }}>{String(row.source.nama_produk ?? "")}<div className="field-hint">{String(row.source.jumlah ?? "")} ×</div></td><td className="numeric-cell">{row.normalized ? formatCurrency(row.normalized.unitPrice) : "Periksa data"}</td><td style={{ whiteSpace: "normal", overflowWrap: "anywhere", minWidth: 200 }}>{row.errors.length ? <ul className="error-message" style={{ paddingLeft: 16 }}>{row.errors.map((message, index) => <li key={index}>{message}</li>)}</ul> : <span className="positive">Valid</span>}</td></tr>)}</tbody></table>
          </div>}
          {(preview.errors.length > 0 || preview.validCount !== preview.rows.length) && <p className="field-hint" style={{ marginTop: 12 }}>Perbaiki baris bermasalah, lalu unggah ulang.</p>}
        </section>}
      </div>
      <div className="modal-footer"><Button className="btn btn-secondary" type="button" disabled={Boolean(busy)} onClick={onClose}>Batal</Button><Button className="btn btn-primary" type="submit" disabled={!canImport}>{busy === "importing" ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />} Import {preview?.validCount ?? 0} paket</Button></div>
    </form>
  </dialog>
}
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, LoaderCircle, X } from "lucide-react";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/finance";
import { buildImport, createOrderTemplate, previewOrderImport } from "@/lib/excel-import";
import type { ImportPreview } from "@/lib/excel-import";
import type { AppData, BatchType, Customer, Order } from "@/lib/types";

type ExcelImportDialogProps = {
  type: BatchType;
  data: AppData;
  importAllowed: boolean;
  defaultBatchId?: string;
  onImport: (orders: Order[], customers: Customer[]) => boolean | Promise<boolean>;
  onClose: () => void;
};

const maxFileSize = 5 * 1024 * 1024;

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ExcelImportDialog({ type, data, importAllowed, defaultBatchId, onImport, onClose }: ExcelImportDialogProps) {
  const batches = data.batches.filter((batch) => batch.type === type && batch.status === "open");
  const [batchId, setBatchId] = useState(() => batches.find((batch) => batch.id === defaultBatchId)?.id ?? batches[0]?.id ?? "");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"reading" | "template" | "importing" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const operationRef = useRef(0);
  const submittingRef = useRef(false);
  const modeLabel = type === "po" ? "PO" : "jastip";
  const hasBatch = batches.some((batch) => batch.id === batchId);
  const problemRows = preview?.rows.filter((row) => row.errors.length > 0).length ?? 0;
  const canImport = Boolean(importAllowed && preview && preview.rowCount > 0 && preview.validCount === preview.rowCount && !preview.errors.length && !problemRows && hasBatch && !busy);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      operationRef.current += 1;
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function resetPreview(nextBatchId: string) {
    operationRef.current += 1;
    setBatchId(nextBatchId);
    setPreview(null);
    setFileName("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function downloadTemplate() {
    if (busy || !importAllowed) return;
    const operation = ++operationRef.current;
    setBusy("template");
    setError("");
    try {
      const bytes = await createOrderTemplate(type, data);
      if (operation !== operationRef.current) return;
      const buffer = new Uint8Array(bytes instanceof ArrayBuffer ? bytes : bytes.slice());
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tippo-template-${type}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (operation === operationRef.current) setError(readableError(cause, "Template belum dapat diunduh. Coba lagi."));
    } finally {
      if (operation === operationRef.current) setBusy(null);
    }
  }

  async function chooseFile(file: File | undefined) {
    if (!importAllowed) return;
    const operation = ++operationRef.current;
    setPreview(null);
    setError("");
    setFileName(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Gunakan file Excel berformat .xlsx. Unduh template untuk format kolom yang sesuai.");
      return;
    }
    if (file.size > maxFileSize) {
      setError("Ukuran file maksimal 5 MB. Pisahkan pesanan menjadi beberapa file.");
      return;
    }
    if (!hasBatch) {
      setError(`Pilih batch ${modeLabel} yang masih aktif sebelum membaca file.`);
      return;
    }
    setBusy("reading");
    try {
      const buffer = await file.arrayBuffer();
      const nextPreview = await previewOrderImport(buffer, type, batchId, data);
      if (operation === operationRef.current) setPreview(nextPreview);
    } catch (cause) {
      if (operation === operationRef.current) setError(readableError(cause, "File Excel tidak dapat dibaca. Gunakan template .xlsx dan coba lagi."));
    } finally {
      if (operation === operationRef.current) setBusy(null);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || !canImport || submittingRef.current) return;
    submittingRef.current = true;
    setBusy("importing");
    setError("");
    try {
      // Validate against the current workspace again before appending any records.
      const imported = buildImport(preview, data);
      if (await onImport(imported.orders, imported.customers)) onClose();
      else setError("Pesanan belum dapat disimpan. Periksa data dan coba lagi.");
    } catch (cause) {
      setError(readableError(cause, "Data berubah atau ada baris yang belum valid. Periksa file sebelum mengimpor."));
    } finally {
      submittingRef.current = false;
      setBusy(null);
    }
  }

  return <dialog
    ref={dialogRef}
    className="native-dialog"
    style={{ width: "min(900px, calc(100vw - 32px))" }}
    aria-labelledby="excel-import-title"
    aria-describedby="excel-import-description"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
  >
    <div className="modal-header">
      <div>
        <h2 id="excel-import-title">Import Excel {modeLabel}</h2>
        <p id="excel-import-description">Unggah pesanan dari template Excel.</p>
      </div>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup import Excel"><X size={20} /></button>
    </div>
    <form onSubmit={submit} noValidate aria-busy={Boolean(busy)}>
      <div className="modal-body">
        {!importAllowed && <p className="error-message" role="alert">Import Excel tersedia di paket Pro.</p>}
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="excel-import-batch">Batch tujuan<span className="required-mark" aria-hidden="true"> *</span></label>
            <Select aria-required="true" aria-label="Batch tujuan" id="excel-import-batch" className="input" value={batchId} onValueChange={(value) => resetPreview(value)} disabled={Boolean(busy) || !importAllowed || !batches.length}>
              {!hasBatch && <SelectOption value="">Pilih batch aktif</SelectOption>}
              {batches.map((batch) => <SelectOption key={batch.id} value={batch.id}>{batch.name}</SelectOption>)}
            </Select>
          </div>
          <div className="field">
            <span className="field-label">Template pesanan</span>
            <Button type="button" className="btn btn-secondary" onClick={downloadTemplate} disabled={Boolean(busy) || !importAllowed}>
              {busy === "template" ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
              Template Excel
            </Button>
            <span className="field-hint">Ganti atau hapus baris contoh sebelum diunggah.</span>
          </div>
        </div>
        {!batches.length && <p className="error-message" role="status">Belum ada batch {modeLabel} aktif. Buat atau buka batch terlebih dahulu.</p>}
        <div className="field">
          <label className="field-label" htmlFor="excel-import-file">File Excel<span className="required-mark" aria-hidden="true"> *</span></label>
          <input
            ref={fileRef}
            aria-required="true" aria-label="File Excel" id="excel-import-file"
            className="input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ padding: "9px 12px", height: "auto", minHeight: 42 }}
            disabled={Boolean(busy) || !importAllowed || !hasBatch}
            onChange={(event) => { void chooseFile(event.target.files?.[0]); }}
            aria-describedby="excel-import-file-hint"
          />
          <span className="field-hint" id="excel-import-file-hint">.xlsx · Maks. 5 MB · 1.000 baris. Impor menambah pesanan baru.</span>
        </div>
        <details className="form-section">
          <summary>Panduan pengisian</summary>
          <ul className="field-hint" style={{ paddingLeft: 18, lineHeight: 1.8, marginTop: 8 }}>
            <li>Satu baris per produk, maksimal 100 produk per pesanan. Semua pesanan masuk ke batch tujuan.</li>
            <li>Gunakan nomor_pesanan yang sama untuk beberapa produk dalam satu pesanan. Jika kosong, dibuat pesanan terpisah.</li>
            <li>Untuk pesanan yang sama, pelanggan, tanggal, fee, ongkir, dan DP cukup diisi sekali.</li>
            <li>{type === "po"
              ? "Cocokkan SKU atau nama dan varian dengan katalog. Harga otomatis dari katalog."
              : "Isi nama produk, jumlah, dan harga jual. Varian dan harga beli opsional."}</li>
          </ul>
        </details>
        {busy === "reading" && <p role="status">Membaca dan memeriksa file Excel…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {preview && <section aria-labelledby="excel-preview-title" style={{ marginTop: 20 }}>
          <div className="section-heading" style={{ marginBottom: 12 }}>
            <div><h3 id="excel-preview-title">Pratinjau pesanan</h3><p style={{ overflowWrap: "anywhere" }}>{fileName}</p></div>
          </div>
          <p role="status" className="field-hint" style={{ marginBottom: 12 }}>
            {preview.sourceRowCount} baris produk · {preview.rowCount} pesanan · {preview.validCount} valid · {problemRows} perlu diperbaiki
          </p>
          {preview.errors.length > 0 && <div className="error-message" role="alert">
            {preview.errors.map((message, index) => <p key={`${index}-${message}`}>{message}</p>)}
          </div>}
          {preview.rows.length > 0 && <div className="card" style={{ marginTop: 12, overflow: "hidden" }}>
            <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }} tabIndex={0} role="region" aria-label="Pratinjau baris Excel">
              <table className="orders-table">
                <caption className="sr-only">Pesanan dari Excel yang akan ditambahkan; baris bermasalah perlu diperbaiki di file.</caption>
                <thead><tr><th scope="col">Baris / nomor</th><th scope="col">Pelanggan</th><th scope="col">Produk</th><th scope="col" className="numeric-cell center-cell">Jumlah</th><th scope="col" className="numeric-cell">Tagihan</th><th scope="col">Validasi</th></tr></thead>
                <tbody>{preview.rows.map((row) => <tr key={row.rowNumber}>
                  <td style={{ whiteSpace: "normal", minWidth: 100 }}>{row.rowNumbers.join(", ")}{row.orderNumber && <div className="field-hint" style={{ overflowWrap: "anywhere" }}>{row.orderNumber}</div>}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 120 }}>{row.customer || "Belum terisi"}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 150 }}>{row.product || "Belum terisi"}</td>
                  <td className="numeric-cell center-cell">{row.quantity ?? "Belum terisi"}</td>
                  <td className="numeric-cell">{row.total === null ? "Belum lengkap" : formatCurrency(row.total)}</td>
                  <td style={{ whiteSpace: "normal", minWidth: row.errors.length ? 230 : 70 }}>
                    {row.errors.length
                      ? <ul style={{ paddingLeft: 16, color: "var(--danger)", lineHeight: 1.7 }}>{row.errors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul>
                      : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--primary)" }}><Check size={13} aria-hidden="true" />Valid</span>}
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>}
          {(problemRows > 0 || preview.errors.length > 0) && <p className="field-hint" style={{ marginTop: 12 }}>Perbaiki baris bermasalah, lalu unggah ulang.</p>}
        </section>}
      </div>
      <div className="modal-footer" style={{ flexWrap: "wrap" }}>
        <Button type="button" className="btn btn-secondary" onClick={onClose}>Batal</Button>
        <Button type="submit" className="btn btn-primary" disabled={!canImport}>
          {busy === "importing" ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
          Import {preview?.validCount ?? 0} pesanan
        </Button>
      </div>
    </form>
  </dialog>;
}

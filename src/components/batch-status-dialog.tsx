"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { batchStatusLabels, nextBatchStatus } from "@/lib/batch-status";
import type { Batch } from "@/lib/types";

export function BatchStatusDialog({ batch, onClose, onSave }: {
  batch: Batch;
  onClose: () => void;
  onSave: (batch: Batch, status: Batch["status"]) => boolean | Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = nextBatchStatus(batch.status);

  useEffect(() => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = overflow; focus?.focus(); };
  }, []);

  async function save() {
    if (lock.current || !next) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (await onSave(batch, next)) onClose();
      else setError("Status belum tersimpan. Coba lagi.");
    } catch { setError("Status belum tersimpan. Coba lagi."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <dialog ref={ref} className="native-dialog" aria-labelledby="batch-status-title" aria-describedby="batch-status-impact" onCancel={event => { event.preventDefault(); if (!lock.current) onClose(); }}>
    <div className="modal-header"><h2 id="batch-status-title">Ubah status {batch.type === "po" ? "batch PO" : "perjalanan"}</h2><button className="icon-button" aria-label="Tutup perubahan status" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    <div className="modal-body batch-status-body">
      <strong>{batch.name}</strong>
      <div className="batch-status-flow" aria-label="Perubahan status"><span className={`status-tag status-${batch.status === "open" ? "done" : "cancelled"}`}>{batchStatusLabels[batch.status]}</span><ArrowRight size={18} aria-hidden="true" /><span className={`status-tag status-${next === "completed" ? "shipped" : "cancelled"}`}>{next ? batchStatusLabels[next] : "Selesai"}</span></div>
      <p id="batch-status-impact">{next === "closed" ? "Batch tidak akan muncul pada pilihan batch untuk pesanan baru. Pesanan yang sudah ada tetap dapat diproses. Batch yang ditutup tidak bisa dibuka kembali." : "Status batch akan terkunci dan tidak bisa diubah lagi. Status setiap pesanan tetap mengikuti perubahan yang Anda buat pada pesanan."}</p>
      {error && <p className="error-message" role="alert">{error}</p>}
    </div>
    <div className="modal-footer"><Button ref={cancelRef} className="btn btn-secondary" disabled={busy} onClick={onClose}>Batal</Button><Button className="btn btn-primary" disabled={busy || !next} onClick={save}>{busy ? "Menyimpan…" : "Simpan perubahan"}</Button></div>
  </dialog>;
}

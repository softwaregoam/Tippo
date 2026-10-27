"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { visibleOrderStatus } from "@/lib/order-status";
import { orderLabel } from "@/lib/finance";
import type { Order } from "@/lib/types";

export const orderStatuses = [
  { value: "new", label: "Tercatat" },
  { value: "shipped", label: "Dikirim" },
  { value: "done", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
] as const;
export type OrderStatusHandler = (order: Order, status: Order["status"]) => boolean | Promise<boolean>;

export function OrderStatusDialog({ order, onClose, onSave }: { order: Order; onClose: () => void; onSave: OrderStatusHandler }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const current = visibleOrderStatus(order.status);
  const [status, setStatus] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsRefund = status === "cancelled" && order.paid > 0;
  useEffect(() => {
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = overflow; focus?.focus(); };
  }, []);
  async function save() {
    if (lock.current || status === current || needsRefund) return;
    lock.current = true; setBusy(true); setError("");
    try { if (await onSave(order, status)) onClose(); else setError("Status belum tersimpan. Coba lagi."); }
    catch { setError("Status belum tersimpan. Coba lagi."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <dialog ref={ref} className="native-dialog" aria-labelledby="order-status-title" onCancel={e => { e.preventDefault(); if (!lock.current) onClose(); }}>
    <div className="modal-header"><h2 id="order-status-title">Ubah status pesanan</h2><button className="icon-button" aria-label="Tutup perubahan status" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    <div className="modal-body order-status-body"><strong>{orderLabel(order)}</strong><p>Status saat ini: <span className={`status-tag order-status-${current}`}>{orderStatuses.find(s => s.value === current)?.label}</span></p>
      <fieldset className="order-status-options" disabled={busy}><legend>Status baru</legend>{orderStatuses.map(s => <label key={s.value} className="order-status-option"><input type="radio" name="order-status" value={s.value} checked={status === s.value} onChange={() => { setStatus(s.value); setError(""); }} /><span className={`status-tag order-status-${s.value}`}>{s.label}</span></label>)}</fieldset>
      {needsRefund && <p className="error-message">Catat refund seluruh pembayaran sebelum membatalkan pesanan ini.</p>}{error && <p role="alert" className="error-message">{error}</p>}
    </div>
    <div className="modal-footer"><Button ref={cancelRef} className="btn btn-secondary" disabled={busy} onClick={onClose}>Batal</Button><Button className="btn btn-primary" disabled={busy || status === current || needsRefund} onClick={save}>{busy ? "Menyimpan…" : "Simpan status"}</Button></div>
  </dialog>;
}

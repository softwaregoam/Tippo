"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { visibleOrderStatus } from "@/lib/order-status";
import { isPersonalOrder, orderLabel } from "@/lib/finance";
import type { Order } from "@/lib/types";

export const orderStatuses = [
  { value: "new", label: "Diproses" },
  { value: "done", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
] as const;
export type OrderStatusHandler = (order: Order, status: Order["status"]) => boolean | Promise<boolean>;

export function OrderStatusDialog({ order, onClose, onSave }: { order: Order; onClose: () => void; onSave: OrderStatusHandler }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const current = visibleOrderStatus(order.status);
  const [status, setStatus] = useState<"done" | "cancelled" | null>(null);
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
    if (lock.current || !status || status === current || needsRefund) return;
    lock.current = true; setBusy(true); setError("");
    try { if (await onSave(order, status)) onClose(); else setError("Status belum tersimpan. Coba lagi."); }
    catch { setError("Status belum tersimpan. Coba lagi."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <dialog ref={ref} className="native-dialog" aria-labelledby="order-status-title" aria-describedby="order-status-impact" onCancel={e => { e.preventDefault(); if (!lock.current) onClose(); }}>
    <div className="modal-header"><h2 id="order-status-title">Ubah status pesanan</h2><button className="icon-button" aria-label="Tutup perubahan status" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    <div className="modal-body order-status-body"><strong>{orderLabel(order)}</strong><p>Status saat ini: <span className={`status-tag order-status-${current}`}>{orderStatuses.find(s => s.value === current)?.label}</span></p>
      <fieldset className="order-status-options" disabled={busy}><legend>Pilih tindakan</legend>{([{value:"done",label:"Tandai selesai"},{value:"cancelled",label:"Batalkan pesanan"}] as const).map(option=><label key={option.value} className="order-status-option"><input type="radio" name="order-status" value={option.value} checked={status===option.value} onChange={()=>{setStatus(option.value);setError("");}}/>{option.label}</label>)}</fieldset>
      <p id="order-status-impact">{!status ? "Perubahan disimpan setelah kamu menekan Simpan status." : isPersonalOrder(order) ? status === "done" ? "Barang untuk sendiri sudah diterima atau diambil." : "Belanja sendiri ini tidak dilanjutkan." : status === "done" ? "Barang sudah diterima atau diambil pelanggan. Status pembayaran tetap terpisah." : "Pesanan tidak dilanjutkan dan dikeluarkan dari perhitungan penjualan serta margin."}</p>
      {needsRefund && <p className="error-message">Catat refund seluruh pembayaran sebelum membatalkan pesanan ini.</p>}{error && <p role="alert" className="error-message">{error}</p>}
    </div>
    <div className="modal-footer"><Button ref={cancelRef} className="btn btn-secondary" disabled={busy} onClick={onClose}>Kembali</Button><Button className="btn btn-primary" disabled={busy || !status || status === current || needsRefund} onClick={save}>{busy ? "Menyimpan…" : "Simpan status"}</Button></div>
  </dialog>;
}

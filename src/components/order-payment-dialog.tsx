"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { formatCurrency, orderRevenue, outstanding } from "@/lib/finance";
import { addOrderPayment } from "@/lib/order-payment";
import type { Order } from "@/lib/types";

export type PaymentHandler = (id: string, amount: number) => Promise<boolean>;

export function OrderPaymentDialog({ order, customerName, onPayment, onClose }: {
  order: Order; customerName: string; onPayment: PaymentHandler; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null), saving = useRef(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remaining = outstanding(order);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    setError("");
    try { addOrderPayment(order, Number(amount)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Periksa nominal pembayaran."); input.current?.focus(); return; }
    saving.current = true; setBusy(true);
    try {
      if (await onPayment(order.id, Number(amount))) onClose();
      else setError("Pembayaran belum tersimpan. Periksa koneksi dan coba lagi.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Pembayaran belum tersimpan. Coba lagi."); }
    finally { saving.current = false; setBusy(false); }
  }

  return <dialog ref={dialog} className="native-dialog order-payment-dialog" aria-labelledby="order-payment-title" onCancel={event => { event.preventDefault(); if (!saving.current) onClose(); }}>
    <div className="modal-header"><div><h2 id="order-payment-title">Catat pembayaran</h2><p>{customerName}</p></div><button className="icon-button" aria-label="Tutup pembayaran" disabled={busy} onClick={onClose}><X size={20}/></button></div>
    <form onSubmit={submit}>
      <div className="modal-body">
        <dl className="order-payment-summary"><div><dt>Total tagihan</dt><dd>{formatCurrency(orderRevenue(order))}</dd></div><div><dt>Sudah dibayar</dt><dd>{formatCurrency(order.paid)}</dd></div><div className="order-payment-remaining"><dt>Sisa tagihan</dt><dd>{formatCurrency(remaining)}</dd></div></dl>
        <div className="field"><label className="field-label" htmlFor="order-payment-amount">Pembayaran tambahan<span className="required-mark" aria-hidden="true"> *</span></label><NumberInput ref={input} id="order-payment-amount" aria-label="Pembayaran tambahan" className="input" value={amount} onValueChange={value => { setAmount(value); setError(""); }} disabled={busy || remaining === 0} placeholder="Nominal rupiah" aria-required="true" aria-invalid={!!error} aria-describedby={error ? "order-payment-error" : undefined}/></div>
        <Button type="button" className="btn btn-secondary order-payment-settle" disabled={busy || remaining === 0} onClick={() => { setAmount(String(remaining)); setError(""); }}>Lunasi sisa tagihan</Button>
        {error && <p id="order-payment-error" className="error-message" role="alert">{error}</p>}
      </div>
      <div className="modal-footer"><Button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Batal</Button><Button type="submit" className="btn btn-primary" disabled={busy || remaining === 0}>{busy ? "Menyimpan…" : "Simpan pembayaran"}</Button></div>
    </form>
  </dialog>;
}

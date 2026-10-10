import type { Order } from "./types.ts";
export const refundedTotal = (order: Order) => (order.refunds ?? []).reduce((sum, entry) => sum + entry.amount, 0);
export function applyRefund(order: Order, amount: number, date: string, reason: string, cancel: boolean): Order {
  if (order.status === "cancelled" || !Number.isSafeInteger(amount) || amount <= 0 || amount > order.paid) throw new Error("Nominal refund harus lebih dari nol dan tidak melebihi pembayaran yang masih diterima.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error("Isi tanggal refund yang valid.");
  if (reason.length > 1000) throw new Error("Catatan refund maksimal 1.000 karakter.");
  if (cancel && amount !== order.paid) throw new Error("Kembalikan seluruh pembayaran yang masih diterima sebelum membatalkan pesanan.");
  if ((order.refunds?.length ?? 0) >= 100 || !Number.isSafeInteger(refundedTotal(order) + amount + order.paid - amount)) throw new Error("Batas pencatatan refund pesanan tercapai.");
  return {...order, paid:order.paid-amount, status:cancel?"cancelled":order.status, refunds:[...(order.refunds ?? []),{id:crypto.randomUUID(),amount,date,reason:reason.trim(),createdAt:new Date().toISOString()}]};
}

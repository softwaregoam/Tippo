import { refundedTotal } from "./refund.ts";
import { formatCurrency, itemLabel, orderDiscount, orderRevenue, outstanding } from "./finance.ts";
import type { Batch, Customer, Order } from "./types.ts";

const statusLabels: Record<Order["status"], string> = {
  new: "Tercatat",
  purchased: "Tercatat",
  ready: "Tercatat",
  shipped: "Dikirim",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

function textLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function invoiceDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(value);
}

/** A customer-facing WhatsApp message. Purchase costs and internal notes stay private. */
export function buildInvoice(order: Order, batch?: Batch, customer?: Customer): string {
  const cancelled = order.status === "cancelled";
  const total = orderRevenue(order);
  const lines = [
    "*INVOICE TIPPO*",
    `No. invoice: TIP-${textLine(order.id).toUpperCase()}`,
    `Tanggal: ${invoiceDate(order.date)}`,
    `Jenis: ${batch?.type === "jastip" ? "Jastip" : batch?.type === "po" ? "Open PO" : "Pesanan"}`,
    ...(batch ? [`Batch: ${textLine(batch.name)}`] : []),
    `Pelanggan: ${textLine(customer?.name ?? "Pelanggan")}`,
    ...(customer?.phone ? [`WhatsApp: ${textLine(customer.phone)}`] : []),
    "",
    "*Rincian pesanan*",
    ...order.items.flatMap((item, index) => [
      `${index + 1}. ${textLine(itemLabel(item))}`,
      `   ${item.quantity} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.quantity * item.unitPrice)}`,
    ]),
    "",
    `Subtotal produk: ${formatCurrency(order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}`,
    `Fee jastip: ${formatCurrency(order.serviceFee)}`,
    ...(orderDiscount(order) > 0 ? [`Diskon${order.discount?.type === "percent" ? ` (${order.discount.value}%)` : ""}: -${formatCurrency(orderDiscount(order))}`] : []),
    `Ongkir: ${formatCurrency(order.shippingCharge)}`,
    `${cancelled ? "Total sebelum pembatalan" : "*Total tagihan*"}: ${formatCurrency(total)}`,
    ...(refundedTotal(order) > 0 ? [`Pembayaran sebelum refund: ${formatCurrency(order.paid + refundedTotal(order))}`, `Refund: ${formatCurrency(refundedTotal(order))}`, `Pembayaran tersisa: ${formatCurrency(order.paid)}`] : [`Sudah dibayar: ${formatCurrency(order.paid)}`]),
    `*Sisa tagihan*: ${formatCurrency(outstanding(order))}`,
    `Status: ${statusLabels[order.status]}`,
    "",
    cancelled ? "Pesanan dibatalkan. Tidak ada tagihan untuk pesanan ini." : "Terima kasih sudah memesan!",
  ];
  return lines.join("\n");
}

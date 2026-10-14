import { invoiceBankDetails, readInvoiceAppearance } from "./invoice-template.ts";
import { refundedTotal } from "./refund.ts";
import { formatCurrency, itemLabel, orderDiscount, orderRevenue } from "./finance.ts";
import { readBusinessProfile, type InvoiceSettings } from "./business-profile.ts";
import type { Batch, Customer, Order } from "./types.ts";

function textLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function invoiceDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(value);
}

export function isInvoicePaid(order: Order): boolean {
  return order.status !== "cancelled" && order.paid >= orderRevenue(order);
}

/** A customer-facing WhatsApp message. Purchase costs stay private. Order notes are customer-facing. */
export function buildInvoice(order: Order, batch?: Batch, customer?: Customer, settings?: Partial<InvoiceSettings>): string {
  const profile = readBusinessProfile(settings);
  const appearance=readInvoiceAppearance(settings?.appearance),footer=appearance.footer,bank=invoiceBankDetails(appearance);
  const cancelled = order.status === "cancelled";
  const total = orderRevenue(order);
  const store=profile.invoiceStoreName?textLine(profile.invoiceStoreName).toLocaleUpperCase("id-ID"):"";
  const paid=isInvoicePaid(order);
  const schedule=[order.shippingDate?invoiceDate(order.shippingDate):"",order.shippingTime].filter(Boolean).join(" · ");
  const lines = [
    `Halo, ${textLine(customer?.name ?? "Pelanggan")}! 🤍`,
    `Berikut rincian pesananmu${store?` di ${store}`:""}.`,
    ...(!cancelled?["Mohon cek kembali pesanannya, ya."]:[]),
    "",
    "*INVOICE*",
    `No. invoice: ${profile.invoicePrefix}-${textLine(order.id).toUpperCase()}`,
    `Tanggal: ${invoiceDate(order.date)}`,
    ...(customer?.phone ? [`WhatsApp: ${textLine(customer.phone)}`] : []),
    "",
    "*Pesanan*",
    ...order.items.flatMap(item => [
      `• ${textLine(itemLabel(item))}`,
      `  ${item.quantity} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.quantity * item.unitPrice)}`,
    ]),
    "",
    `Subtotal produk: ${formatCurrency(order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}`,
    ...(batch?.type === "po" ? order.serviceFee > 0 ? [`Biaya tambahan: ${formatCurrency(order.serviceFee)}`] : [] : order.serviceFee>0?[`Fee jastip: ${formatCurrency(order.serviceFee)}`]:[]),
    ...(orderDiscount(order) > 0 ? [`Diskon${order.discount?.type === "percent" ? ` (${order.discount.value}%)` : ""}: -${formatCurrency(orderDiscount(order))}`] : []),
    ...(order.shippingCharge > 0 ? [`Ongkir: ${formatCurrency(order.shippingCharge)}`] : []),
    `${cancelled ? "Total sebelum pembatalan" : "*Total tagihan*"}: ${formatCurrency(total)}`,
    ...(refundedTotal(order) > 0 ? [`Refund: ${formatCurrency(refundedTotal(order))}`] : []),
    ...(paid ? ["*LUNAS*"] : []),
    "",
    ...((schedule||order.shippingMethod?.trim()||customer?.address?.trim()) ? ["*Pengiriman*",...(schedule?[schedule]:[]),...(order.shippingMethod?.trim()?[textLine(order.shippingMethod)]:[]),...(customer?.address?.trim()?[`Alamat: ${textLine(customer.address)}`]:[]),""] : []),
    ...(order.notes.trim() ? ["*Catatan*",order.notes.trim(),""] : []),
    ...(!cancelled&&!paid&&bank ? ["*Transfer ke*",`${bank.name} ${bank.account}`,`a.n ${bank.holder}`,"","Mohon kirim bukti transfer setelah membayar.",""] : []),
    ...(cancelled ? ["Pesanan dibatalkan. Tidak ada tagihan untuk pesanan ini."] : footer ? [footer] : []),
  ];
  return lines.join("\n");
}

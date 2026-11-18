import { productDisplayName } from "./product-name.ts";
import { invoiceBankDetails, readInvoiceAppearance } from "./invoice-template.ts";
import { refundedTotal } from "./refund.ts";
import { formatCurrency, orderDiscount, orderRevenue, outstanding } from "./finance.ts";
import { readBusinessProfile, type InvoiceSettings } from "./business-profile.ts";
import type { Batch, Customer, Order, OrderItem, Product, ProductPackage } from "./types.ts";

/** Keep existing short references; compact generated UUIDs consistently across invoice outputs. */
export function invoiceNumber(order: Pick<Order, "id">, settings?: Partial<InvoiceSettings>): string {
  const id = textLine(order.id).toUpperCase();
  const reference = /^[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}$/.test(id)
    ? id.replace(/-/g, "").slice(0, 12)
    : id;
  return `${readBusinessProfile(settings).invoicePrefix}-${reference}`;
}

export function invoiceItemLabel(item: OrderItem): string {
  const name=[productDisplayName(item.product),item.variant].map(value=>value.trim()).filter(Boolean).join(" ");
  return [name,item.color.trim(),item.size.trim()].filter(Boolean).join(" · ");
}

function packageMemberLabels(pack: ProductPackage, products: Product[], packageQuantity = 1): string[] {
  return invoicePackageMemberDetails(pack, products, packageQuantity).map((member) => `${member.quantity}x ${member.label}`);
}

export type InvoicePackageMember = { label: string; quantity: number };

export function invoicePackageMemberDetails(pack: ProductPackage, products: Product[], packageQuantity = 1): InvoicePackageMember[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const counts = new Map<string, number>();
  for (const id of pack.productIds) {
    const product = productById.get(id);
    const label = product
      ? [productDisplayName(product.name), product.variant.trim(), product.color?.trim(), product.size?.trim()].filter(Boolean).join(" ")
      : "Produk tidak tersedia";
    counts.set(label, (counts.get(label) ?? 0) + packageQuantity);
  }
  return [...counts.entries()].map(([label, quantity]) => ({ label, quantity }));
}

export function invoicePackageMemberLabels(pack: ProductPackage, products: Product[], packageQuantity = 1): string[] {
  return packageMemberLabels(pack, products, packageQuantity);
}

function invoiceItemLines(item: OrderItem, packages: ProductPackage[], products: Product[]): string[] {
  const pack = item.packageId ? packages.find((entry) => entry.id === item.packageId) : undefined;
  if (!pack) return [`• ${textLine(invoiceItemLabel(item))}`, `  ${item.quantity} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.quantity * item.unitPrice)}`];
  return [
    `• ${textLine(invoiceItemLabel(item))}`,
    ...packageMemberLabels(pack, products, item.quantity).map((label) => `  ${textLine(label)}`),
    `  ${item.quantity} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.quantity * item.unitPrice)}`,
  ];
}

export function invoiceItemMarkup(item: OrderItem, packages: ProductPackage[], products: Product[]): { label: string; members: string[] } {
  const pack = item.packageId ? packages.find((entry) => entry.id === item.packageId) : undefined;
  return { label: invoiceItemLabel(item), members: pack ? packageMemberLabels(pack, products, item.quantity) : [] };
}

export type InvoiceProductCatalog = { products?: Product[]; packages?: ProductPackage[] };

function invoiceCatalog(catalog?: InvoiceProductCatalog): { products: Product[]; packages: ProductPackage[] } {
  return { products: catalog?.products ?? [], packages: catalog?.packages ?? [] };
}

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
export function buildInvoice(order: Order, batch?: Batch, customer?: Customer, settings?: Partial<InvoiceSettings>, catalog?: InvoiceProductCatalog): string {
  const { products, packages } = invoiceCatalog(catalog);
  if(order.purpose==="personal")return "";
  const profile = readBusinessProfile(settings);
  const appearance=readInvoiceAppearance(settings?.appearance),footer=appearance.footer,bank=invoiceBankDetails(appearance);
  const cancelled = order.status === "cancelled";
  const total = orderRevenue(order);
  const store=profile.invoiceStoreName?textLine(profile.invoiceStoreName).toLocaleUpperCase("id-ID"):"";
  const paid=isInvoicePaid(order);
  const name=textLine(customer?.name ?? "Pelanggan");
  const shipping=[
    ...(order.shippingDate?[`Tanggal kirim: ${invoiceDate(order.shippingDate)}`]:[]),
    ...(order.shippingTime?[`Jam: ${order.shippingTime}`]:[]),
    ...(order.shippingMethod?.trim()?[`Metode kirim: ${textLine(order.shippingMethod)}`]:[]),
  ];
  const sections:string[][]=[
    [
      `Halo, ${name}!`,
      `Berikut rincian pesananmu${store?` di ${store}`:""}.`,
      ...(!cancelled?["Mohon cek kembali pesanannya, ya."]:[]),
    ],
    [
      "*INVOICE*",
      `No. invoice: ${invoiceNumber(order, settings)}`,
      `Tanggal pesanan: ${invoiceDate(order.date)}`,
      `Nama: ${name}`,
      ...(customer?.phone ? [`WhatsApp: ${textLine(customer.phone)}`] : []),
    ],
    [
      "*PESANAN*",
      ...order.items.flatMap(item => invoiceItemLines(item, packages, products)),
      "",
      `Subtotal produk: ${formatCurrency(order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}`,
      ...(batch?.type === "po" ? order.serviceFee > 0 ? [`Biaya tambahan: ${formatCurrency(order.serviceFee)}`] : [] : order.serviceFee>0?[`Fee jastip: ${formatCurrency(order.serviceFee)}`]:[]),
      ...(orderDiscount(order) > 0 ? [`Diskon${order.discount?.type === "percent" ? ` (${order.discount.value}%)` : ""}: -${formatCurrency(orderDiscount(order))}`] : []),
      ...(order.shippingCharge > 0 ? [`Ongkir: ${formatCurrency(order.shippingCharge)}`] : []),
      `${cancelled ? "Total sebelum pembatalan" : "*Total tagihan*"}: ${formatCurrency(total)}`,
      ...(outstanding(order) > 0 ? [`*Sisa tagihan*: ${formatCurrency(outstanding(order))}`] : []),
      ...(refundedTotal(order) > 0 ? [`Refund: ${formatCurrency(refundedTotal(order))}`] : []),
      ...(paid ? ["Status: *LUNAS*"] : !cancelled ? ["Status: *BELUM LUNAS*"] : []),
    ],
    ...((shipping.length||customer?.address?.trim()) ? [["*PENGIRIMAN*",...shipping,...(customer?.address?.trim()?[`Alamat: ${textLine(customer.address)}`]:[])]] : []),
    ...(order.notes.trim() ? [["*CATATAN*",order.notes.trim()]] : []),
  ];
  // Payment details continue the previous section: a blank line, no divider.
  const payment:string[]=[];
  if(!cancelled&&bank)payment.push(...(!paid?["Mohon kirim bukti transfer setelah membayar.",""]:[]),"*PEMBAYARAN VIA TRANSFER*",`${bank.name} ${bank.account}`,`a.n. ${bank.holder}`);
  if(cancelled)payment.push("Pesanan dibatalkan. Tidak ada tagihan untuk pesanan ini.");
  if(payment.length)sections[sections.length-1].push("",...payment);
  if(!cancelled&&footer)sections.push([footer]);
  const divider="───────────";
  return sections.map(section=>section.join("\n")).join(`\n\n${divider}\n`);
}

/** Open a customer chat when a usable number is available, otherwise let WhatsApp choose a recipient. */
export function invoiceWhatsAppUrl(message: string, phone = ""): string {
  let digits=phone.replace(/[\s()+.\-]/g,"");
  if(!/^\d+$/.test(digits))digits="";
  if(digits.startsWith("0"))digits="62"+digits.slice(1);
  else if(digits.startsWith("8"))digits="62"+digits;
  if(!/^[1-9]\d{7,14}$/.test(digits))digits="";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

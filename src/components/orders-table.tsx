"use client";
import { visibleOrderStatus } from "@/lib/order-status";

import { OrderStatusDialog, orderStatuses as statuses, type OrderStatusHandler } from "@/components/order-status-dialog";

import { useRef, useState } from "react";
import { ArrowLeftRight, FileText, Pencil, Search, ShoppingBag, RotateCcw } from "lucide-react";
import { RefundDialog, type RefundHandler } from "@/components/refund-dialog";
import { refundedTotal } from "@/lib/refund";
import type { InvoiceSettings } from "@/lib/business-profile";
import { InvoiceDialog } from "@/components/invoice-dialog";
import { formatCurrency, itemLabel, orderHpp, orderLabel, orderQuantity, orderRevenue, outstanding } from "@/lib/finance";
import {MobileDataList,DataDetailDialog} from "@/components/mobile-data-list";
import type { AppData, Order } from "@/lib/types";

type OrdersTableProps = {
  data: AppData;
  invoiceSettings?: InvoiceSettings;
  orders: Order[];
  onEdit: (order: Order) => void;
  onStatus: OrderStatusHandler;
  onRefund: RefundHandler;
  compact?: boolean;
  readOnly?: boolean;
};


const avatarColors = ["teal", "peach", "lavender", "gold"];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "?";
}

export function OrdersTable({ data, invoiceSettings, orders, onEdit, onStatus, onRefund, compact = false, readOnly = false }: OrdersTableProps) {
  const [detailOrderId,setDetailOrderId]=useState<string|null>(null);
  const detailOrder=data.orders.find(order=>order.id===detailOrderId);
  const detailContent=(order:Order)=><MobileOrderDetail order={order} data={data} readOnly={readOnly} onEdit={()=>onEdit(order)} onStatus={()=>setStatusOrderId(order.id)} onInvoice={()=>setInvoiceOrderId(order.id)} onRefund={()=>setRefundId(order.id)}/>;
  const [statusOrderId, setStatusOrderId] = useState<string | null>(null);
  const statusOrder = data.orders.find(order => order.id === statusOrderId);
  const [refundId,setRefundId]=useState<string|null>(null);
  const refundOrder=data.orders.find(order=>order.id===refundId);
  const [invoiceOrderId, setInvoiceOrderId] = useState<string | null>(null);
  const invoiceOrder = data.orders.find((order) => order.id === invoiceOrderId);
  if (!orders.length) {
    return (
      <div style={{ padding: "52px 20px", display: "grid", justifyItems: "center", gap: 12, textAlign: "center" }}>
        <span className="avatar avatar-teal" style={{ width: 48, height: 48 }}><ShoppingBag size={23} /></span>
        <strong>Belum ada pesanan di sini</strong>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Tambahkan pesanan baru atau sesuaikan filter untuk melihat pesanan.</p>
      </div>
    );
  }

  return (
    <><MobileDataList entries={orders.map(order=>({id:order.id,dialogClassName:"order-data-dialog",title:data.customers.find(c=>c.id===order.customerId)?.name||"Pelanggan",subtitle:<>{order.items.slice(0,2).map(item=><span className="order-preview-product" key={item.id}>{itemLabel(item)} × {item.quantity}</span>)}{order.items.length>2&&<span className="order-more-products">+{order.items.length-2} produk lainnya</span>}</>,meta:`${formatCurrency(orderRevenue(order))} · ${outstanding(order)>0?`Sisa ${formatCurrency(outstanding(order))}`:"Lunas"}`,status:statuses.find(s=>s.value===visibleOrderStatus(order.status))?.label,statusClassName:`status-tag order-status-${visibleOrderStatus(order.status)}`,details:detailContent(order)}))}/><div className="table-wrap desktop-data-table">
      <table className={`orders-table ${readOnly ? "orders-readonly" : ""}`}>
        <caption className="sr-only">Daftar pesanan jastip dan open PO</caption>
        <thead>
          <tr>
            <th scope="col"><span className="customer-column-title">Pelanggan & produk</span></th>
            <th scope="col">Batch</th>
            <th scope="col" className="numeric-cell">Total tagihan</th>
            {!compact && <th scope="col" className="numeric-cell">HPP</th>}
            <th scope="col">Pembayaran</th>
            <th scope="col" className="center-cell"><span className="status-column-title">Status</span></th>
            {!readOnly && <th scope="col" className="actions-cell">Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const customer = data.customers.find((entry) => entry.id === order.customerId);
            const batch = data.batches.find((entry) => entry.id === order.batchId);
            const hpp = orderHpp(order, data.orders, data.batches);
            const remaining = outstanding(order);
            const revenue = orderRevenue(order);
            const color = avatarColors[Math.max(0, data.customers.findIndex((entry) => entry.id === order.customerId)) % avatarColors.length];
            const cancelled = order.status === "cancelled";
            const label = orderLabel(order);
            return (
              <tr key={order.id} className="order-detail-row" tabIndex={0} aria-label={`Detail ${customer?.name??"Pelanggan"}`} onClick={event=>{if(!(event.target as HTMLElement).closest("button,a,input,select,textarea,[role=button]"))setDetailOrderId(order.id);}} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==="Enter"||event.key===" ")){event.preventDefault();setDetailOrderId(order.id);}}}>
                <td>
                  <div className="customer-cell">
                    <span className={`avatar avatar-${color}`} aria-hidden="true">{initials(customer?.name ?? "Pelanggan")}</span>
                    <div>
                      <div className="row-title">{customer?.name ?? "Pelanggan tidak ditemukan"}</div>
                      {order.items.slice(0,2).map((item) => <div className="row-subtitle" key={item.id} title={itemLabel(item)} style={{ maxWidth: 270, overflow: "hidden", textOverflow: "ellipsis" }}>{itemLabel(item)} <span className="muted">× {item.quantity}</span></div>)}
                      {order.items.length>2&&<div className="row-subtitle order-more-products">+{order.items.length-2} produk lainnya</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="row-title" style={{ fontWeight: 500 }}>{batch?.name ?? "Batch tidak ditemukan"}</div>
                  <span className="row-subtitle">{batch?.type === "jastip" ? "Jastip" : "Open PO"}</span>
                </td>
                <td className="numeric-cell"><span className="row-title" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatCurrency(revenue)}</span></td>
                {!compact && <td className="numeric-cell"><span className={hpp === null ? "row-subtitle" : "row-title"} style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{hpp === null ? "Belum lengkap" : formatCurrency(hpp)}</span></td>}
                <td>
                  {refundedTotal(order)>0 && <div className="row-subtitle">Refund {formatCurrency(refundedTotal(order))}</div>}
                  {cancelled ? <span className="payment-label muted">Dibatalkan</span> : remaining === 0 ? <span className="payment-label payment-paid">Lunas</span> : <>
                    <span className={`payment-label ${order.paid > 0 ? "payment-partial" : "muted"}`}>{order.paid > 0 ? `Bayar sebagian ${formatCurrency(order.paid)}` : "Belum dibayar"}</span>
                    <div className="row-subtitle">Sisa {formatCurrency(remaining)}</div>
                  </>}
                </td>
                <td className="center-cell">
                  <span className={`status-tag order-status-${visibleOrderStatus(order.status)}`}>{statuses.find(s=>s.value===visibleOrderStatus(order.status))?.label}</span>
                </td>
                {!readOnly && <td className="actions-cell"><div className="order-actions"><button className="icon-button" type="button" aria-label={`Ubah status pesanan ${label} untuk ${customer?.name ?? "pelanggan"}`} title="Ubah status" onClick={()=>setStatusOrderId(order.id)}><ArrowLeftRight size={16}/></button><button className="icon-button" type="button" onClick={() => setInvoiceOrderId(order.id)} aria-label={`Invoice ${label}`} title="Invoice WhatsApp"><FileText size={16} /></button><button className="icon-button" type="button" onClick={() => onEdit(order)} aria-label={`Edit pesanan ${label}`}><Pencil size={16} /></button><button className="icon-button" type="button" aria-label={`Refund ${label}`} title="Refund pesanan" disabled={order.paid===0 && !order.refunds?.length} onClick={()=>setRefundId(order.id)}><RotateCcw size={16}/></button></div></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>{detailOrder&&<DataDetailDialog entry={{id:detailOrder.id,dialogClassName:"order-data-dialog",title:data.customers.find(customer=>customer.id===detailOrder.customerId)?.name||"Pelanggan",meta:"",details:detailContent(detailOrder)}} onClose={()=>setDetailOrderId(null)}/ >}{statusOrder && !readOnly && <OrderStatusDialog order={statusOrder} onSave={onStatus} onClose={()=>setStatusOrderId(null)}/ >}{refundOrder && <RefundDialog order={refundOrder} onRefund={onRefund} onClose={()=>setRefundId(null)}/ >}{invoiceOrder && <InvoiceDialog settings={invoiceSettings} order={invoiceOrder} data={data} onClose={() => setInvoiceOrderId(null)} />}</>
  );
}


function MobileOrderDetail({ order, data, readOnly, onEdit, onStatus, onInvoice, onRefund }: { order: Order; data: AppData; readOnly: boolean; onEdit: () => void; onStatus: () => void; onInvoice: () => void; onRefund: () => void }) {
  const hpp = orderHpp(order, data.orders, data.batches);
  const [search,setSearch]=useState("");
  const list=useRef<HTMLDivElement>(null);
  const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase("id").trim();
  const tokens=normalize(search).split(/\s+/).filter(Boolean);
  const products=order.items.filter(item=>tokens.every(token=>normalize([itemLabel(item),item.store].filter(Boolean).join(" ")).includes(token)));
  return <div className="order-mobile-detail">
    <p className="order-detail-batch"><span>Batch</span><strong>{data.batches.find(batch => batch.id === order.batchId)?.name || "Belum diisi"}</strong></p>
    <section className="order-detail-product-section" aria-label="Rincian produk pesanan">
      <div className="order-detail-product-heading"><h3>Produk</h3><span aria-live="polite">{tokens.length?`${products.length} dari ${order.items.length} produk`:`${order.items.length} produk · ${orderQuantity(order)} unit`}</span></div>
      {order.items.length>5&&<div className="search-field order-detail-search"><Search size={17} aria-hidden="true"/><input aria-label="Cari produk di detail pesanan" placeholder="Cari produk, varian, atau toko…" value={search} onChange={event=>{setSearch(event.target.value);if(list.current)list.current.scrollTop=0;}}/></div>}
      <div ref={list} className="order-detail-products-scroll" role="region" aria-label="Daftar produk pesanan" tabIndex={0}>
        <ul className="order-detail-products" aria-label="Produk pesanan">{products.map(item => <li key={item.id}><div><strong>{item.product}</strong>{[item.variant, item.color, item.size, item.store].filter(Boolean).length > 0 && <small>{[item.variant, item.color, item.size, item.store].filter(Boolean).join(" · ")}</small>}</div><span>× {item.quantity}</span></li>)}</ul>
        {!products.length&&<p className="order-detail-products-empty" role="status">Produk tidak ditemukan.</p>}
      </div>
    </section>
    <dl className="order-detail-payment"><div className="order-detail-total"><dt>Total tagihan</dt><dd>{formatCurrency(orderRevenue(order))}</dd></div><div><dt>Sudah dibayar</dt><dd>{formatCurrency(order.paid)}</dd></div><div><dt>Sisa tagihan</dt><dd>{formatCurrency(outstanding(order))}</dd></div><div><dt>HPP</dt><dd>{hpp === null ? "Belum lengkap" : formatCurrency(hpp)}</dd></div></dl>
    {!readOnly && <div className="order-detail-actions"><button data-close-detail className="btn btn-primary" onClick={onEdit}><Pencil size={16} aria-hidden="true"/>Edit</button><button data-close-detail className="btn btn-secondary" onClick={onInvoice}><FileText size={16} aria-hidden="true"/>Invoice</button><button data-close-detail className="btn btn-secondary" aria-label="Ubah status" onClick={onStatus}><ArrowLeftRight size={16} aria-hidden="true"/>Status</button><button data-close-detail className="btn btn-secondary" disabled={order.paid === 0 && !order.refunds?.length} onClick={onRefund}><RotateCcw size={16} aria-hidden="true"/>Refund</button></div>}
  </div>;
}

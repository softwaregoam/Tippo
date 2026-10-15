"use client";
import { visibleOrderStatus } from "@/lib/order-status";

import { OrderStatusDialog, orderStatuses as statuses, type OrderStatusHandler } from "@/components/order-status-dialog";

import { useState } from "react";
import { ArrowLeftRight, FileText, Pencil, ShoppingBag, RotateCcw } from "lucide-react";
import { RefundDialog, type RefundHandler } from "@/components/refund-dialog";
import { refundedTotal } from "@/lib/refund";
import type { InvoiceSettings } from "@/lib/business-profile";
import { InvoiceDialog } from "@/components/invoice-dialog";
import { formatCurrency, itemLabel, orderHpp, orderLabel, orderRevenue, outstanding } from "@/lib/finance";
import {MobileDataList} from "@/components/mobile-data-list";
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
    <><MobileDataList entries={orders.map(order=>({id:order.id,title:data.customers.find(c=>c.id===order.customerId)?.name||"Pelanggan",subtitle:orderLabel(order),meta:`${formatCurrency(orderRevenue(order))} · ${outstanding(order)>0?`Sisa ${formatCurrency(outstanding(order))}`:"Lunas"}`,status:statuses.find(s=>s.value===visibleOrderStatus(order.status))?.label,statusClassName:`status-tag order-status-${visibleOrderStatus(order.status)}`,details:<MobileOrderDetail order={order} data={data} readOnly={readOnly} onEdit={()=>onEdit(order)} onStatus={()=>setStatusOrderId(order.id)} onInvoice={()=>setInvoiceOrderId(order.id)} onRefund={()=>setRefundId(order.id)} />}))}/><div className="table-wrap desktop-data-table">
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
              <tr key={order.id}>
                <td>
                  <div className="customer-cell">
                    <span className={`avatar avatar-${color}`} aria-hidden="true">{initials(customer?.name ?? "Pelanggan")}</span>
                    <div>
                      <div className="row-title">{customer?.name ?? "Pelanggan tidak ditemukan"}</div>
                      {order.items.map((item) => <div className="row-subtitle" key={item.id} title={itemLabel(item)} style={{ maxWidth: 270, overflow: "hidden", textOverflow: "ellipsis" }}>{itemLabel(item)} <span className="muted">× {item.quantity}</span></div>)}
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
    </div>{statusOrder && !readOnly && <OrderStatusDialog order={statusOrder} onSave={onStatus} onClose={()=>setStatusOrderId(null)}/ >}{refundOrder && <RefundDialog order={refundOrder} onRefund={onRefund} onClose={()=>setRefundId(null)}/ >}{invoiceOrder && <InvoiceDialog settings={invoiceSettings} order={invoiceOrder} data={data} onClose={() => setInvoiceOrderId(null)} />}</>
  );
}


function MobileOrderDetail({ order, data, readOnly, onEdit, onStatus, onInvoice, onRefund }: { order: Order; data: AppData; readOnly: boolean; onEdit: () => void; onStatus: () => void; onInvoice: () => void; onRefund: () => void }) {
  const hpp = orderHpp(order, data.orders, data.batches);
  return <div className="order-mobile-detail">
    <p className="order-detail-batch"><span>Batch</span><strong>{data.batches.find(batch => batch.id === order.batchId)?.name || "Belum diisi"}</strong></p>
    <ul className="order-detail-products" aria-label="Produk pesanan">{order.items.map(item => <li key={item.id}><div><strong>{item.product}</strong>{[item.variant, item.color, item.size, item.store].filter(Boolean).length > 0 && <small>{[item.variant, item.color, item.size, item.store].filter(Boolean).join(" · ")}</small>}</div><span>× {item.quantity}</span></li>)}</ul>
    <dl className="order-detail-payment"><div className="order-detail-total"><dt>Total tagihan</dt><dd>{formatCurrency(orderRevenue(order))}</dd></div><div><dt>Sudah dibayar</dt><dd>{formatCurrency(order.paid)}</dd></div><div><dt>Sisa tagihan</dt><dd>{formatCurrency(outstanding(order))}</dd></div><div><dt>HPP</dt><dd>{hpp === null ? "Belum lengkap" : formatCurrency(hpp)}</dd></div></dl>
    {!readOnly && <div className="order-detail-actions"><button data-close-detail className="btn btn-primary" onClick={onEdit}><Pencil size={16} aria-hidden="true"/>Edit</button><button data-close-detail className="btn btn-secondary" onClick={onInvoice}><FileText size={16} aria-hidden="true"/>Invoice</button><button data-close-detail className="btn btn-secondary" onClick={onStatus}><ArrowLeftRight size={16} aria-hidden="true"/>Ubah status</button><button data-close-detail className="btn btn-secondary" disabled={order.paid === 0 && !order.refunds?.length} onClick={onRefund}><RotateCcw size={16} aria-hidden="true"/>Refund</button></div>}
  </div>;
}

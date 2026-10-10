"use client";
import { visibleOrderStatus } from "@/lib/order-status";

import { Select, SelectOption } from "@/components/ui/select";

import { useState } from "react";
import { FileText, Pencil, ShoppingBag, RotateCcw } from "lucide-react";
import { RefundDialog, type RefundHandler } from "@/components/refund-dialog";
import { refundedTotal } from "@/lib/refund";
import { InvoiceDialog } from "@/components/invoice-dialog";
import { formatCurrency, itemLabel, orderHpp, orderLabel, orderRevenue, outstanding } from "@/lib/finance";
import {MobileDataList} from "@/components/mobile-data-list";
import type { AppData, Order } from "@/lib/types";

type OrdersTableProps = {
  data: AppData;
  orders: Order[];
  onEdit: (order: Order) => void;
  onStatus: (order: Order, status: Order["status"]) => void;
  onRefund: RefundHandler;
  compact?: boolean;
  readOnly?: boolean;
};

const statuses: { value: Order["status"]; label: string }[] = [
  { value: "new", label: "Tercatat" },
  { value: "shipped", label: "Dikirim" },
  { value: "done", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

const avatarColors = ["teal", "peach", "lavender", "gold"];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "?";
}

export function OrdersTable({ data, orders, onEdit, onStatus, onRefund, compact = false, readOnly = false }: OrdersTableProps) {
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
    <><MobileDataList entries={orders.map(order=>({id:order.id,title:data.customers.find(c=>c.id===order.customerId)?.name||"Pelanggan",subtitle:orderLabel(order),meta:`${formatCurrency(orderRevenue(order))} · ${outstanding(order)>0?`Sisa ${formatCurrency(outstanding(order))}`:"Lunas"}`,status:statuses.find(s=>s.value===visibleOrderStatus(order.status))?.label,details:<><dl className="mobile-detail-fields"><dt>Batch</dt><dd>{data.batches.find(b=>b.id===order.batchId)?.name}</dd><dt>Barang</dt><dd>{order.items.map(i=><p key={i.id}>{itemLabel(i)} × {i.quantity}</p>)}</dd><dt>Total tagihan</dt><dd>{formatCurrency(orderRevenue(order))}</dd><dt>Sudah dibayar</dt><dd>{formatCurrency(order.paid)}</dd><dt>Sisa tagihan</dt><dd>{formatCurrency(outstanding(order))}</dd><dt>HPP</dt><dd>{orderHpp(order,data.orders,data.batches)===null?"Belum lengkap":formatCurrency(orderHpp(order,data.orders,data.batches)!)}</dd></dl>{!readOnly&&<><Select className="input" aria-label={`Status pesanan ${orderLabel(order)}`} value={visibleOrderStatus(order.status)} onValueChange={v=>onStatus(order,v as Order["status"])}>{statuses.map(s=><SelectOption key={s.value} value={s.value}>{s.label}</SelectOption>)}</Select><div className="management-actions"><button data-close-detail className="btn btn-primary" onClick={()=>onEdit(order)}>Edit</button><button data-close-detail className="btn btn-secondary" onClick={()=>setInvoiceOrderId(order.id)}>Invoice</button><button data-close-detail className="btn btn-secondary" disabled={order.paid===0&&!order.refunds?.length} onClick={()=>setRefundId(order.id)}>Refund</button></div></>}</>}))}/><div className="table-wrap desktop-data-table">
      <table className={`orders-table ${readOnly ? "orders-readonly" : ""}`}>
        <caption className="sr-only">Daftar pesanan jastip dan open PO</caption>
        <thead>
          <tr>
            <th scope="col"><span className="customer-column-title">Pelanggan & barang</span></th>
            <th scope="col">Batch</th>
            <th scope="col" className="numeric-cell">Total tagihan</th>
            {!compact && <th scope="col" className="numeric-cell">HPP</th>}
            <th scope="col">Pembayaran</th>
            <th scope="col"><span className="status-column-title">Status</span></th>
            {!readOnly && <th scope="col" className="actions-cell">Tindakan</th>}
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
                  {cancelled ? <span className="payment-label muted">Dibatalkan</span> : remaining === 0 ? <span className="payment-label" style={{ color: "var(--primary, #24756b)" }}>Lunas</span> : <>
                    <span className="payment-label" style={{ color: order.paid > 0 ? "var(--warning, #aa762c)" : "var(--muted, #83908c)" }}>{order.paid > 0 ? `DP ${formatCurrency(order.paid)}` : "Belum dibayar"}</span>
                    <div className="row-subtitle">Sisa {formatCurrency(remaining)}</div>
                  </>}
                </td>
                <td>
                  {readOnly ? <span className={`status-tag status-${visibleOrderStatus(order.status)}`}>{statuses.find(s=>s.value===visibleOrderStatus(order.status))?.label}</span> : <Select className={`tiny-select status-tag status-${visibleOrderStatus(order.status)}`} value={visibleOrderStatus(order.status)} onValueChange={(value) => onStatus(order, value as Order["status"])} aria-label={`Status pesanan ${label} untuk ${customer?.name ?? "pelanggan"}`}>
                    {statuses.map((status) => <SelectOption key={status.value} value={status.value}>{status.label}</SelectOption>)}
                  </Select>}
                </td>
                {!readOnly && <td className="actions-cell"><div className="order-actions"><button className="icon-button" type="button" onClick={() => setInvoiceOrderId(order.id)} aria-label={`Invoice ${label}`} title="Invoice WhatsApp"><FileText size={16} /></button><button className="icon-button" type="button" onClick={() => onEdit(order)} aria-label={`Edit pesanan ${label}`}><Pencil size={16} /></button><button className="icon-button" type="button" aria-label={`Refund ${label}`} title="Refund pesanan" disabled={order.paid===0 && !order.refunds?.length} onClick={()=>setRefundId(order.id)}><RotateCcw size={16}/></button></div></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>{refundOrder && <RefundDialog order={refundOrder} onRefund={onRefund} onClose={()=>setRefundId(null)}/ >}{invoiceOrder && <InvoiceDialog order={invoiceOrder} data={data} onClose={() => setInvoiceOrderId(null)} />}</>
  );
}

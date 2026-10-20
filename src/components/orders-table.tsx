"use client";
import { hasEstimatedCost } from "@/lib/purchase-fx";
import { visibleOrderStatus } from "@/lib/order-status";

import { OrderStatusDialog, orderStatuses as statuses, type OrderStatusHandler } from "@/components/order-status-dialog";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeftRight, FileText, Pencil, Search, ShoppingBag, RotateCcw } from "lucide-react";
import { RefundDialog, type RefundHandler } from "@/components/refund-dialog";
import { refundedTotal } from "@/lib/refund";
import type { InvoiceSettings } from "@/lib/business-profile";
import { InvoiceDialog } from "@/components/invoice-dialog";
import { formatCurrency, itemLabel, orderHpp, orderLabel, orderQuantity, orderRevenue, outstanding, isPersonalOrder, personalExpense } from "@/lib/finance";
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

function OrderPaymentBadges({order}:{order:Order}) {
  if(isPersonalOrder(order))return <span className="order-payment-badge payment-badge-unpaid">Untuk sendiri</span>;
  const remaining=outstanding(order),refund=refundedTotal(order);
  const state=order.status==="cancelled"?"cancelled":remaining===0?"paid":order.paid>0?"partial":"unpaid";
  const label={cancelled:"Dibatalkan",paid:"Lunas",partial:"Bayar sebagian",unpaid:"Belum dibayar"}[state];
  const detail=`${label} · Dibayar ${formatCurrency(order.paid)} · Sisa ${formatCurrency(remaining)}`;
  return <span className="order-payment-badges"><span className={`order-payment-badge payment-badge-${state}`} title={detail} aria-label={detail}>{label}</span>{refund>0&&<span className="order-payment-badge payment-badge-refund">Refund {formatCurrency(refund)}</span>}</span>;
}

export function OrdersTable({ data, invoiceSettings, orders, onEdit, onStatus, onRefund, compact = false, readOnly = false }: OrdersTableProps) {
  const [detailOrderId,setDetailOrderId]=useState<string|null>(null);
  const detailOrder=data.orders.find(order=>order.id===detailOrderId);
  const detailContent=(order:Order)=><MobileOrderDetail order={order} data={data}/>;
  const detailFooter=(order:Order)=>readOnly?undefined:<OrderDetailActions order={order} onEdit={()=>onEdit(order)} onStatus={()=>setStatusOrderId(order.id)} onInvoice={()=>setInvoiceOrderId(order.id)} onRefund={()=>setRefundId(order.id)}/>;
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
    <><MobileDataList entries={orders.map(order=>({id:order.id,dialogClassName:"order-data-dialog",footer:detailFooter(order),title:isPersonalOrder(order)?"Belanja pribadi":data.customers.find(c=>c.id===order.customerId)?.name||"Pelanggan",subtitle:<>{order.items.slice(0,2).map(item=><span className="order-preview-product" key={item.id}>{itemLabel(item)} × {item.quantity}</span>)}{order.items.length>2&&<span className="order-more-products">+{order.items.length-2} produk lainnya</span>}</>,meta:<span className="order-mobile-payment"><strong>{formatCurrency(isPersonalOrder(order)?personalExpense(order):orderRevenue(order))}</strong><OrderPaymentBadges order={order}/></span>,status:statuses.find(s=>s.value===visibleOrderStatus(order.status))?.label,statusClassName:`status-tag order-status-${visibleOrderStatus(order.status)}`,details:detailContent(order)}))}/><div className="table-wrap desktop-data-table">
      <table className={`orders-table ${readOnly ? "orders-readonly" : ""}`}>
        <caption className="sr-only">Daftar pesanan jastip dan open PO</caption>
        <thead>
          <tr>
            <th scope="col"><span className="customer-column-title">Pelanggan & produk</span></th>
            <th scope="col">Batch</th>
            <th scope="col" className="numeric-cell">Total</th>
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
            const hpp = isPersonalOrder(order) ? personalExpense(order) : orderHpp(order, data.orders, data.batches);
            const revenue = isPersonalOrder(order)?personalExpense(order):orderRevenue(order);
            const customerName=isPersonalOrder(order)?"Belanja pribadi":customer?.name??"Pelanggan";
            const color = avatarColors[Math.max(0, data.customers.findIndex((entry) => entry.id === order.customerId)) % avatarColors.length];
            const label = orderLabel(order);
            return (
              <tr key={order.id} className="order-detail-row" tabIndex={0} aria-label={`Detail ${customerName}`} onClick={event=>{if(!(event.target as HTMLElement).closest("button,a,input,select,textarea,[role=button]"))setDetailOrderId(order.id);}} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==="Enter"||event.key===" ")){event.preventDefault();setDetailOrderId(order.id);}}}>
                <td>
                  <div className="customer-cell">
                    <span className={`avatar avatar-${color}`} aria-hidden="true">{initials(customerName)}</span>
                    <div>
                      <div className="row-title">{customerName}</div>
                      {order.items.slice(0,2).map((item) => <div className="row-subtitle" key={item.id} title={itemLabel(item)} style={{ maxWidth: 270, overflow: "hidden", textOverflow: "ellipsis" }}>{itemLabel(item)} <span className="muted">× {item.quantity}</span></div>)}
                      {order.items.length>2&&<div className="row-subtitle order-more-products">+{order.items.length-2} produk lainnya</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="row-title" style={{ fontWeight: 500 }}>{batch?.name ?? "Batch tidak ditemukan"}</div>
                  <span className="row-subtitle">{batch?.type === "jastip" ? "Jastip" : "Open PO"}</span>
                </td>
                <td className="numeric-cell"><span className="row-title" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatCurrency(revenue)}</span>{compact&&isPersonalOrder(order)&&<small className="row-subtitle order-hpp-note">Belanja sendiri</small>}</td>
                {!compact && <td className="numeric-cell"><span className={hpp === null ? "row-subtitle" : "row-title"} style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{hpp === null ? "Belum lengkap" : formatCurrency(hpp)}</span>{isPersonalOrder(order)&&<small className="row-subtitle order-hpp-note">Belanja sendiri</small>}{hasEstimatedCost(order)&&<small className="fx-estimate">Kurs estimasi</small>}</td>}
                <td><OrderPaymentBadges order={order}/></td>
                <td className="center-cell">
                  <span className={`status-tag order-status-${visibleOrderStatus(order.status)}`}>{statuses.find(s=>s.value===visibleOrderStatus(order.status))?.label}</span>
                </td>
                {!readOnly && <td className="actions-cell"><div className="order-actions"><button className="icon-button" type="button" aria-label={`Ubah status pesanan ${label} untuk ${customer?.name ?? "pelanggan"}`} title="Ubah status" onClick={()=>setStatusOrderId(order.id)}><ArrowLeftRight size={16}/></button>{!isPersonalOrder(order)&&<button className="icon-button" type="button" onClick={() => setInvoiceOrderId(order.id)} aria-label={`Invoice ${label}`} title="Invoice WhatsApp"><FileText size={16} /></button>}<button className="icon-button" type="button" onClick={() => onEdit(order)} aria-label={`Edit pesanan ${label}`}><Pencil size={16} /></button>{!isPersonalOrder(order)&&<button className="icon-button" type="button" aria-label={`Refund ${label}`} title="Refund pesanan" disabled={order.paid===0 && !order.refunds?.length} onClick={()=>setRefundId(order.id)}><RotateCcw size={16}/></button>}</div></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>{detailOrder&&<DataDetailDialog entry={{id:detailOrder.id,dialogClassName:"order-data-dialog",footer:detailFooter(detailOrder),title:isPersonalOrder(detailOrder)?"Belanja pribadi":data.customers.find(customer=>customer.id===detailOrder.customerId)?.name||"Pelanggan",meta:"",details:detailContent(detailOrder)}} onClose={()=>setDetailOrderId(null)}/ >}{statusOrder && !readOnly && <OrderStatusDialog order={statusOrder} onSave={onStatus} onClose={()=>setStatusOrderId(null)}/ >}{refundOrder && <RefundDialog order={refundOrder} onRefund={onRefund} onClose={()=>setRefundId(null)}/ >}{invoiceOrder && !isPersonalOrder(invoiceOrder) && <InvoiceDialog settings={invoiceSettings} order={invoiceOrder} data={data} onClose={() => setInvoiceOrderId(null)} />}</>
  );
}


function MobileOrderDetail({order,data}:{order:Order;data:AppData}) {
  const hpp = orderHpp(order, data.orders, data.batches);
  const [search,setSearch]=useState("");
  const list=useRef<HTMLDivElement>(null);
  const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase("id").trim();
  const tokens=normalize(search).split(/\s+/).filter(Boolean);
  const products=order.items.filter(item=>tokens.every(token=>normalize([itemLabel(item),item.store].filter(Boolean).join(" ")).includes(token)));
  const [scrollbar,setScrollbar]=useState({visible:false,height:0,top:0});
  useLayoutEffect(()=>{
    const area=list.current;if(!area||products.length<=5)return;
    function sync(){
      if(!area)return;
      const track=Math.max(0,area.clientHeight-8),distance=area.scrollHeight-area.clientHeight;
      const height=Math.min(track,Math.max(20,track*area.clientHeight/Math.max(1,area.scrollHeight)));
      const top=distance>0?Math.max(0,Math.min(1,area.scrollTop/distance))*(track-height):0;
      setScrollbar(previous=>previous.visible===(distance>1)&&previous.height===height&&previous.top===top?previous:{visible:distance>1,height,top});
    }
    sync();const observer=new ResizeObserver(sync);observer.observe(area);if(area.firstElementChild)observer.observe(area.firstElementChild);
    area.addEventListener("scroll",sync,{passive:true});
    return()=>{observer.disconnect();area.removeEventListener("scroll",sync);};
  },[products.length,search]);
  return <div className="order-mobile-detail">
    <p className="order-detail-batch"><span>Batch</span><strong>{data.batches.find(batch => batch.id === order.batchId)?.name || "Belum diisi"}</strong></p>
    <section className="order-detail-product-section" aria-label="Rincian produk pesanan">
      <div className="order-detail-product-heading"><h3>Produk</h3><span aria-live="polite">{tokens.length?`${products.length} dari ${order.items.length} produk`:`${order.items.length} produk · ${orderQuantity(order)} unit`}</span></div>
      {order.items.length>5&&<div className="search-field order-detail-search"><Search size={17} aria-hidden="true"/><input aria-label="Cari produk di detail pesanan" placeholder="Cari produk, varian, atau toko…" value={search} onChange={event=>{setSearch(event.target.value);if(list.current)list.current.scrollTop=0;}}/></div>}
      <div className={`order-detail-products-frame ${products.length>5?"has-scroll-indicator":""}`}><div ref={list} className="order-detail-products-scroll" role="region" aria-label="Daftar produk pesanan" tabIndex={0}>
        <ul className="order-detail-products" aria-label="Produk pesanan">{products.map(item => <li key={item.id}><div><strong>{item.product}</strong>{[item.variant, item.color, item.size, item.store].filter(Boolean).length > 0 && <small>{[item.variant, item.color, item.size, item.store].filter(Boolean).join(" · ")}</small>}</div><span>× {item.quantity}</span></li>)}</ul>
        {!products.length&&<p className="order-detail-products-empty" role="status">Produk tidak ditemukan.</p>}
      </div>
      {products.length>5&&scrollbar.visible&&<span className="order-detail-scrollbar" aria-hidden="true"><span style={{height:scrollbar.height,transform:`translateY(${scrollbar.top}px)`}}/></span>}
      </div>
    </section>
    {isPersonalOrder(order)?<dl className="order-detail-payment"><div className="order-detail-total"><dt>{hasEstimatedCost(order)?"HPP belanja sendiri · Estimasi":"HPP belanja sendiri"}</dt><dd>{formatCurrency(personalExpense(order))}</dd></div><div><dt>Margin usaha</dt><dd>Di luar perhitungan</dd></div></dl>:<dl className="order-detail-payment"><div className="order-detail-total"><dt>Total tagihan</dt><dd>{formatCurrency(isPersonalOrder(order)?personalExpense(order):orderRevenue(order))}</dd></div><div><dt>Sudah dibayar</dt><dd>{formatCurrency(order.paid)}</dd></div><div><dt>Sisa tagihan</dt><dd>{formatCurrency(outstanding(order))}</dd></div><div><dt>{hasEstimatedCost(order)?"HPP · Estimasi":"HPP"}</dt><dd>{isPersonalOrder(order)?"—":hpp === null ? "Belum lengkap" : formatCurrency(hpp)}</dd></div></dl>}

  </div>;
}

function OrderDetailActions({order,onEdit,onStatus,onInvoice,onRefund}:{order:Order;onEdit:()=>void;onStatus:()=>void;onInvoice:()=>void;onRefund:()=>void}) {
 return <div className="order-detail-actions"><button data-close-detail className="btn btn-primary" onClick={onEdit}><Pencil size={16} aria-hidden="true"/>Edit</button>{!isPersonalOrder(order)&&<button data-close-detail className="btn btn-secondary" onClick={onInvoice}><FileText size={16} aria-hidden="true"/>Invoice</button>}<button data-close-detail className="btn btn-secondary" aria-label="Ubah status" onClick={onStatus}><ArrowLeftRight size={16} aria-hidden="true"/>Status</button>{!isPersonalOrder(order)&&<button data-close-detail className="btn btn-secondary" disabled={order.paid === 0 && !order.refunds?.length} onClick={onRefund}><RotateCcw size={16} aria-hidden="true"/>Refund</button>}</div>;
}

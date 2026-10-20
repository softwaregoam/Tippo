"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Search, X } from "lucide-react";
import { PurchaseCostFields } from "@/components/purchase-cost-fields";
import { draftFromFx, fxFromDraft, fxDraftError, hasEstimatedCost, type FxDraft } from "@/lib/purchase-fx";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { allocatedBatchCosts, formatCurrency, itemLabel, orderHpp, orderQuantity, orderNetSales, isPersonalOrder, personalExpense } from "@/lib/finance";
import { formatCalendarDate } from "@/lib/calendar-date";
import { isAppData } from "@/lib/validation";
import type { AppData, Batch, Order } from "@/lib/types";

type SaveHpp = (next: AppData) => boolean | Promise<boolean>;
function purchaseCost(value: string): number | null {
  const parsed = Number(value);
  return value.trim() && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
function HppOrderDialog({order,batch,data,onSave,onClose}:{order:Order;batch:Batch;data:AppData;onSave:SaveHpp;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [costs,setCosts]=useState(()=>Object.fromEntries(order.items.map(item=>[item.id,item.unitCost===null?"":String(item.unitCost)])));
  const [fx,setFx]=useState<Record<string,FxDraft|undefined>>(()=>Object.fromEntries(order.items.map(item=>[item.id,draftFromFx(item.purchaseFx)])));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{const trigger=document.activeElement;dialog.current?.showModal();return()=>{if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};},[]);
  const updated={...order,items:order.items.map(item=>({...item,purchaseFx:fx[item.id]?fxFromDraft(fx[item.id]!):undefined,unitCost:purchaseCost(costs[item.id]??"")}))};
  const next={...data,orders:data.orders.map(entry=>entry.id===order.id?updated:entry)};
  const personal=isPersonalOrder(order);
  const cost=personal?(updated.items.some(item=>item.unitCost===null)?null:personalExpense(updated)):orderHpp(updated,next.orders,data.batches);
  const margin=personal||cost===null?null:orderNetSales(updated)-cost;
  const customer=personal?"Untuk sendiri":data.customers.find(entry=>entry.id===order.customerId)?.name||"Pelanggan";
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;
    const invalidFx=Object.values(fx).map(value=>fxDraftError(value)).find(Boolean);if(invalidFx){setError(invalidFx);return;}
    if(Object.values(costs).some(value=>value!==""&&purchaseCost(value)===null)){setError("Harga beli harus berupa rupiah bulat, minimal nol.");return;}
    if(personal&&updated.items.some(item=>item.unitCost===null)){setError("Isi harga beli semua produk untuk belanja sendiri.");return;}
    if(!isAppData(next)){setError("Total biaya terlalu besar. Periksa harga beli produk.");return;}
    setBusy(true);setError("");
    try{if(await onSave(next))onClose();else setError("HPP belum tersimpan. Periksa koneksi, lalu coba lagi.");}
    catch{setError("HPP belum tersimpan. Periksa koneksi, lalu coba lagi.");}
    finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="native-dialog hpp-edit-dialog" aria-label={personal?"Biaya belanja sendiri":`HPP pesanan ${customer}`} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <div className="modal-header"><div><h2>{personal?"Biaya belanja sendiri":"HPP pesanan"}</h2><p>{customer} · {formatCalendarDate(order.date)}</p></div><button type="button" className="icon-button" aria-label="Tutup HPP" disabled={busy} onClick={onClose}><X size={20}/></button></div>
    <form onSubmit={submit}><div className="modal-body">
      <div className="hpp-edit-products">{order.items.map(item=><div className="hpp-edit-product" key={item.id}><div><strong>{itemLabel(item)}</strong><span>{item.quantity} unit</span></div><PurchaseCostFields required={personal} allowForeign={batch.type==="jastip"} id={`hpp-cost-${item.id}`} label="Harga beli/unit" ariaLabel={`Harga beli ${itemLabel(item)}`} cost={costs[item.id]??""} fx={fx[item.id]} disabled={busy} onChange={(cost,value)=>{setCosts(previous=>({...previous,[item.id]:cost}));setFx(previous=>({...previous,[item.id]:value}));}}/></div>)}</div>
      <dl className="hpp-dialog-summary">{!personal&&batch.directCosts>0&&<div><dt>Biaya lama</dt><dd>{formatCurrency(allocatedBatchCosts(batch,next.orders)[order.id]??0)}</dd></div>}<div><dt>{personal?(hasEstimatedCost(updated)?"Belanja sendiri · Estimasi":"Belanja sendiri"):hasEstimatedCost(updated)?"HPP pelanggan · Estimasi":"HPP pelanggan"}</dt><dd>{cost===null?<span className="status-tag status-new">Belum lengkap</span>:formatCurrency(cost)}</dd></div><div><dt>{hasEstimatedCost(updated)?"Margin usaha · Estimasi":"Margin usaha"}</dt><dd className={margin===null?"muted":margin<0?"negative":"positive"}>{personal?"—":margin===null?"Belum lengkap":formatCurrency(margin)}</dd></div></dl>
      {personal&&<p className="field-hint">Di luar margin usaha.</p>}
      {error&&<p className="error-message" role="alert">{error}</p>}
    </div><div className="modal-footer"><Button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Batal</Button><Button type="submit" className="btn btn-primary" disabled={busy}><Check size={17}/>{busy?"Menyimpan…":personal?"Simpan biaya":"Simpan HPP"}</Button></div></form>
  </dialog>;
}

export function HppPanel({ batch, data, onSave }: { batch: Batch; data: AppData; onSave: SaveHpp }) {
  const orders=data.orders.filter(order=>order.batchId===batch.id&&order.status!=="cancelled");
  const customerOrders=orders.filter(order=>!isPersonalOrder(order));
  const personalOrders=orders.filter(isPersonalOrder);
  const personalTotal=personalOrders.reduce((sum,order)=>sum+personalExpense(order),0);
  const totals=customerOrders.reduce((sum,order)=>{
    const cost=orderHpp(order,data.orders,data.batches);
    if(cost===null)sum.incomplete+=1;
    else{sum.hpp+=cost;sum.margin+=orderNetSales(order)-cost;sum.complete+=1;}
    return sum;
  },{hpp:0,margin:0,incomplete:0,complete:0});
  const totalsKnown=customerOrders.length===0||totals.complete>0;
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [requestedPage,setPage]=useState(1);
  const [editing,setEditing]=useState<string|null>(null);
  const details=useRef<HTMLElement>(null);
  const customerName=(order:Order)=>isPersonalOrder(order)?"Untuk sendiri":data.customers.find(customer=>customer.id===order.customerId)?.name||"Pelanggan";
  const normalize=(text:string)=>text.normalize("NFKC").toLocaleLowerCase("id").trim();
  const tokens=normalize(search).split(/\s+/).filter(Boolean);
  const filtered=orders.filter(order=>{
    const complete=orderHpp(order,data.orders,data.batches)!==null;
    const text=normalize([customerName(order),...order.items.map(item=>[itemLabel(item),item.store??""].join(" "))].join(" "));
    return(status==="all"||(status==="complete"?complete:!complete))&&tokens.every(token=>text.includes(token));
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const pageCount=Math.max(1,Math.ceil(filtered.length/10));
  const page=Math.min(requestedPage,pageCount);
  const visible=filtered.slice((page-1)*10,page*10);
  const selected=orders.find(order=>order.id===editing);
  const costLabel=(order:Order)=>{const cost=isPersonalOrder(order)?personalExpense(order):orderHpp(order,data.orders,data.batches);return cost===null?<span className="status-tag status-new">Belum lengkap</span>:<>{formatCurrency(cost)}{hasEstimatedCost(order)&&<small className="fx-estimate">Kurs estimasi</small>}</>;};
  const marginLabel=(order:Order)=>{if(isPersonalOrder(order))return <span className="muted">—<small className="hpp-personal-note">Di luar margin usaha</small></span>;const cost=orderHpp(order,data.orders,data.batches);return cost===null?<span className="muted">—</span>:<span className={orderNetSales(order)-cost<0?"negative":"positive"}>{formatCurrency(orderNetSales(order)-cost)}{hasEstimatedCost(order)&&<small className="fx-estimate">Estimasi</small>}</span>;};
  const actionLabel=(order:Order)=>isPersonalOrder(order)?"Edit biaya":orderHpp(order,data.orders,data.batches)===null?"Isi HPP":"Edit HPP";
  function changePage(next:number){setPage(next);details.current?.scrollIntoView({block:"start"});}
  return <div className="reports-layout">
    {orders.some(hasEstimatedCost)&&<p className="fx-estimate-note" role="status">{customerOrders.some(hasEstimatedCost)?"HPP pelanggan dan margin mencakup kurs estimasi. ":""}{personalOrders.some(hasEstimatedCost)?"Belanja sendiri mencakup kurs estimasi. ":""}Finalkan kurs setelah biaya pembayaran pasti.</p>}
    <section className="report-stats hpp-summary-cards" aria-label="Total HPP dan margin batch">{[
      [totals.incomplete?"HPP pelanggan diketahui":"HPP pelanggan",totalsKnown?formatCurrency(totals.hpp):"Belum lengkap",`${totals.complete} dari ${customerOrders.length} pesanan pelanggan lengkap`],
      ["Belanja sendiri",formatCurrency(personalTotal),`${personalOrders.length} pesanan Untuk sendiri${personalOrders.some(hasEstimatedCost)?" · kurs estimasi":""}`],
      ["Total biaya belanja",totals.incomplete?"Belum lengkap":formatCurrency(totals.hpp+personalTotal),"HPP pelanggan + belanja sendiri"],
      [totals.incomplete?"Margin usaha diketahui":"Margin usaha",totalsKnown?formatCurrency(totals.margin):"Belum lengkap",totals.incomplete?"Dari pesanan dengan HPP lengkap":"Tanpa ongkir · sebelum biaya umum"],
    ].map(([label,value,note],index)=><div className="card stat-card" key={index}><p className="muted">{label}</p><strong className={`report-stat-value${index===3&&totalsKnown&&totals.margin<0?" negative":""}`}>{value}</strong><p className="field-hint">{note}</p></div>)}</section>
    <p className="field-hint hpp-margin-explanation">Penjualan tanpa ongkir − HPP pelanggan. Belanja sendiri tidak mengurangi margin.</p>
    <section ref={details} className="card hpp-detail-card" aria-label="HPP per pesanan">
      <div className="card-header"><div><h2>Biaya per pesanan</h2><p>{orders.length} pesanan · {orders.reduce((sum,order)=>sum+orderQuantity(order),0)} unit{totals.incomplete>0?` · ${totals.incomplete} HPP pelanggan belum lengkap`:""}</p></div></div>
      <div className="list-toolbar hpp-list-toolbar" role="group" aria-label="Pencarian dan filter HPP">
        <div className="search-field"><Search size={18}/><input aria-label="Cari produk atau pelanggan HPP" placeholder="Cari produk atau pelanggan…" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/></div>
        <Select className="input" aria-label="Filter kelengkapan HPP" value={status} onValueChange={value=>{setStatus(value);setPage(1);}}><SelectOption value="all">Semua</SelectOption><SelectOption value="incomplete">Belum lengkap</SelectOption><SelectOption value="complete">Lengkap</SelectOption></Select>
      </div>
      {visible.length>0&&<>
        <div className="table-wrap desktop-data-table"><table className="orders-table hpp-orders-table" aria-label="Rincian HPP"><thead><tr>{["Pelanggan / tujuan","Jumlah produk","Biaya","Margin usaha","Aksi"].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map(order=><tr key={order.id}><td><strong className="row-title">{customerName(order)}</strong><div className="row-subtitle">{formatCalendarDate(order.date)}</div></td><td>{order.items.length} produk<div className="row-subtitle">{orderQuantity(order)} unit</div></td><td>{costLabel(order)}</td><td>{marginLabel(order)}</td><td><button type="button" className="icon-button" title={actionLabel(order)} aria-label={`${actionLabel(order)} ${customerName(order)}`} onClick={()=>setEditing(order.id)}><Pencil size={16} aria-hidden="true"/></button></td></tr>)}</tbody></table></div>
        <div className="mobile-data-list hpp-order-cards">{visible.map(order=><div className="mobile-data-row" key={order.id}><div className="mobile-row-heading"><strong>{customerName(order)}</strong><button type="button" className="icon-button" title={actionLabel(order)} aria-label={`${actionLabel(order)} ${customerName(order)}`} onClick={()=>setEditing(order.id)}><Pencil size={16} aria-hidden="true"/></button></div><span className="mobile-row-subtitle">{formatCalendarDate(order.date)} · {order.items.length} produk · {orderQuantity(order)} unit</span><span className="hpp-card-totals"><span><small>{isPersonalOrder(order)?"Belanja sendiri":"HPP pelanggan"}</small>{costLabel(order)}</span><span><small>Margin usaha</small>{marginLabel(order)}</span></span></div>)}</div>
      </>}
      {!visible.length&&<div className="empty-state compact"><p>{orders.length?"Tidak ada pesanan yang sesuai.":"Belum ada pesanan aktif."}</p>{orders.length>0&&<Button type="button" className="btn btn-secondary" onClick={()=>{setSearch("");setStatus("all");setPage(1);}}>Reset filter</Button>}</div>}
      {filtered.length>0&&<div className="table-footer report-pagination"><span>{(page-1)*10+1}–{Math.min(page*10,filtered.length)} dari {filtered.length} pesanan</span>{pageCount>1&&<nav aria-label="Halaman HPP"><span>{page} / {pageCount}</span><Button type="button" className="btn btn-secondary" disabled={page===1} onClick={()=>changePage(page-1)}>Sebelumnya</Button><Button type="button" className="btn btn-secondary" disabled={page===pageCount} onClick={()=>changePage(page+1)}>Berikutnya</Button></nav>}</div>}
    </section>
    {selected&&<HppOrderDialog key={selected.id} order={selected} batch={batch} data={data} onSave={onSave} onClose={()=>setEditing(null)}/>}
  </div>;
}

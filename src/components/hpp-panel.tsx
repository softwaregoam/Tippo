"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Search, X } from "lucide-react";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { allocatedBatchCosts, formatCurrency, itemLabel, orderHpp, orderQuantity, orderRevenue } from "@/lib/finance";
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
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{const trigger=document.activeElement;dialog.current?.showModal();return()=>{if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};},[]);
  const updated={...order,items:order.items.map(item=>({...item,unitCost:purchaseCost(costs[item.id]??"")}))};
  const next={...data,orders:data.orders.map(entry=>entry.id===order.id?updated:entry)};
  const cost=orderHpp(updated,next.orders,data.batches);
  const margin=cost===null?null:orderRevenue(updated)-cost;
  const customer=data.customers.find(entry=>entry.id===order.customerId)?.name||"Pelanggan";
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;
    if(Object.values(costs).some(value=>value!==""&&purchaseCost(value)===null)){setError("Harga beli harus berupa rupiah bulat, minimal nol.");return;}
    if(!isAppData(next)){setError("Total biaya terlalu besar. Periksa harga beli produk.");return;}
    setBusy(true);setError("");
    try{if(await onSave(next))onClose();else setError("HPP belum tersimpan. Periksa koneksi, lalu coba lagi.");}
    catch{setError("HPP belum tersimpan. Periksa koneksi, lalu coba lagi.");}
    finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="native-dialog hpp-edit-dialog" aria-label={`HPP pesanan ${customer}`} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <div className="modal-header"><div><h2>HPP pesanan</h2><p>{customer} · {formatCalendarDate(order.date)}</p></div><button type="button" className="icon-button" aria-label="Tutup HPP" disabled={busy} onClick={onClose}><X size={20}/></button></div>
    <form onSubmit={submit}><div className="modal-body">
      <div className="hpp-edit-products">{order.items.map(item=><div className="hpp-edit-product" key={item.id}><div><strong>{itemLabel(item)}</strong><span>{item.quantity} unit</span></div><label className="field"><span className="field-label">Harga beli/unit</span><div className="cost-input"><span>Rp</span><NumberInput className="input" aria-label={`Harga beli ${itemLabel(item)}`} min="0" step="1" placeholder="Belum diisi" value={costs[item.id]??""} disabled={busy} onValueChange={value=>setCosts(previous=>({...previous,[item.id]:value}))}/></div></label></div>)}</div>
      <dl className="hpp-dialog-summary">{batch.directCosts>0&&<div><dt>Biaya lama</dt><dd>{formatCurrency(allocatedBatchCosts(batch,next.orders)[order.id]??0)}</dd></div>}<div><dt>Total HPP</dt><dd>{cost===null?<span className="status-tag status-new">Belum lengkap</span>:formatCurrency(cost)}</dd></div><div><dt>Margin pesanan</dt><dd className={margin===null?"muted":margin<0?"negative":"positive"}>{margin===null?"Belum lengkap":formatCurrency(margin)}</dd></div></dl>
      {error&&<p className="error-message" role="alert">{error}</p>}
    </div><div className="modal-footer"><Button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Batal</Button><Button type="submit" className="btn btn-primary" disabled={busy}><Check size={17}/>{busy?"Menyimpan…":"Simpan HPP"}</Button></div></form>
  </dialog>;
}

export function HppPanel({ batch, data, onSave }: { batch: Batch; data: AppData; onSave: SaveHpp }) {
  const orders=data.orders.filter(order=>order.batchId===batch.id&&order.status!=="cancelled");
  const totals=orders.reduce((sum,order)=>{
    const cost=orderHpp(order,data.orders,data.batches);
    if(cost===null)sum.incomplete+=1;
    else{sum.hpp+=cost;sum.margin+=orderRevenue(order)-cost;sum.complete+=1;}
    return sum;
  },{hpp:0,margin:0,incomplete:0,complete:0});
  const totalsKnown=orders.length===0||totals.complete>0;
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [requestedPage,setPage]=useState(1);
  const [editing,setEditing]=useState<string|null>(null);
  const details=useRef<HTMLElement>(null);
  const customerName=(order:Order)=>data.customers.find(customer=>customer.id===order.customerId)?.name||"Pelanggan";
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
  const costLabel=(order:Order)=>{const cost=orderHpp(order,data.orders,data.batches);return cost===null?<span className="status-tag status-new">Belum lengkap</span>:formatCurrency(cost);};
  const marginLabel=(order:Order)=>{const cost=orderHpp(order,data.orders,data.batches);return cost===null?<span className="muted">—</span>:<span className={orderRevenue(order)-cost<0?"negative":"positive"}>{formatCurrency(orderRevenue(order)-cost)}</span>;};
  const actionLabel=(order:Order)=>orderHpp(order,data.orders,data.batches)===null?"Isi HPP":"Edit HPP";
  function changePage(next:number){setPage(next);details.current?.scrollIntoView({block:"start"});}
  return <div className="reports-layout">
    <section className="report-stats hpp-summary-cards" aria-label="Total HPP dan margin batch">{[
      [totals.incomplete?"HPP diketahui":"Total HPP",totalsKnown?formatCurrency(totals.hpp):"Belum lengkap",`${totals.complete} dari ${orders.length} pesanan lengkap`],
      [totals.incomplete?"Margin diketahui":"Total margin",totalsKnown?formatCurrency(totals.margin):"Belum lengkap","Laba kotor sebelum biaya umum"],
      ["Total pesanan",String(orders.length),`${orders.reduce((sum,order)=>sum+orderQuantity(order),0)} unit produk`],
      ["HPP belum lengkap",String(totals.incomplete),totals.incomplete?"Pesanan perlu dilengkapi":"Semua HPP lengkap"],
    ].map(([label,value,note],index)=><div className="card stat-card" key={index}><p className="muted">{label}</p><strong className={`report-stat-value${index===1&&totalsKnown&&totals.margin<0?" negative":""}`}>{value}</strong><p className="field-hint">{note}</p></div>)}</section>
    <section ref={details} className="card hpp-detail-card" aria-label="HPP per pesanan">
      <div className="card-header"><h2>HPP per pesanan</h2><span className="type-badge">{orders.length} PESANAN</span></div>
      <div className="list-toolbar hpp-list-toolbar" role="group" aria-label="Pencarian dan filter HPP">
        <div className="search-field"><Search size={18}/><input aria-label="Cari produk atau pelanggan HPP" placeholder="Cari produk atau pelanggan…" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/></div>
        <Select className="input" aria-label="Filter kelengkapan HPP" value={status} onValueChange={value=>{setStatus(value);setPage(1);}}><SelectOption value="all">Semua</SelectOption><SelectOption value="incomplete">Belum lengkap</SelectOption><SelectOption value="complete">Lengkap</SelectOption></Select>
      </div>
      {visible.length>0&&<>
        <div className="table-wrap desktop-data-table"><table className="orders-table hpp-orders-table" aria-label="Rincian HPP"><thead><tr>{["Pelanggan","Jumlah produk","Total HPP","Margin","Aksi"].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map(order=><tr key={order.id}><td><strong className="row-title">{customerName(order)}</strong><div className="row-subtitle">{formatCalendarDate(order.date)}</div></td><td>{order.items.length} produk<div className="row-subtitle">{orderQuantity(order)} unit</div></td><td>{costLabel(order)}</td><td>{marginLabel(order)}</td><td><button type="button" className="icon-button" title={actionLabel(order)} aria-label={`${actionLabel(order)} ${customerName(order)}`} onClick={()=>setEditing(order.id)}><Pencil size={16} aria-hidden="true"/></button></td></tr>)}</tbody></table></div>
        <div className="mobile-data-list hpp-order-cards">{visible.map(order=><div className="mobile-data-row" key={order.id}><div className="mobile-row-heading"><strong>{customerName(order)}</strong><button type="button" className="icon-button" title={actionLabel(order)} aria-label={`${actionLabel(order)} ${customerName(order)}`} onClick={()=>setEditing(order.id)}><Pencil size={16} aria-hidden="true"/></button></div><span className="mobile-row-subtitle">{formatCalendarDate(order.date)} · {order.items.length} produk · {orderQuantity(order)} unit</span><span className="hpp-card-totals"><span><small>Total HPP</small>{costLabel(order)}</span><span><small>Margin</small>{marginLabel(order)}</span></span></div>)}</div>
      </>}
      {!visible.length&&<div className="empty-state compact"><p>{orders.length?"Tidak ada pesanan yang sesuai.":"Belum ada pesanan aktif."}</p>{orders.length>0&&<Button type="button" className="btn btn-secondary" onClick={()=>{setSearch("");setStatus("all");setPage(1);}}>Reset filter</Button>}</div>}
      {filtered.length>0&&<div className="table-footer report-pagination"><span>{(page-1)*10+1}–{Math.min(page*10,filtered.length)} dari {filtered.length} pesanan</span>{pageCount>1&&<nav aria-label="Halaman HPP"><span>{page} / {pageCount}</span><Button type="button" className="btn btn-secondary" disabled={page===1} onClick={()=>changePage(page-1)}>Sebelumnya</Button><Button type="button" className="btn btn-secondary" disabled={page===pageCount} onClick={()=>changePage(page+1)}>Berikutnya</Button></nav>}</div>}
    </section>
    {selected&&<HppOrderDialog key={selected.id} order={selected} batch={batch} data={data} onSave={onSave} onClose={()=>setEditing(null)}/>}
  </div>;
}

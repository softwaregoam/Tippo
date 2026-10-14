"use client";
import {useEffect,useRef} from "react";
import {ClipboardList,X} from "lucide-react";
import {shoppingRecap} from "@/lib/shopping-recap";
import type {AppData,Batch} from "@/lib/types";

export function ShoppingRecapDialog({batch,data,onClose}:{batch:Batch;data:AppData;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 const recap=shoppingRecap(data,batch.id);
 const title=batch.type==="po"?"Rekap kebutuhan produk":"Rekap belanja";
 useEffect(()=>{const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;const dialog=ref.current;dialog?.showModal();dialog?.querySelector<HTMLButtonElement>(".modal-header button")?.focus({preventScroll:true});return()=>{dialog?.close();if(opener?.isConnected)opener.focus();};},[]);
 return <dialog ref={ref} className="native-dialog shopping-recap-dialog" aria-labelledby="shopping-recap-title" onCancel={event=>{event.preventDefault();onClose();}}>
  <div className="modal-header"><div><h2 id="shopping-recap-title">{title}</h2><p>{batch.name}</p></div><button className="icon-button" onClick={onClose} aria-label="Tutup rekap"><X size={20}/></button></div>
  <div className="modal-body">
   <div className="shopping-recap-summary"><span><strong>{recap.orders}</strong> pesanan</span><span><strong>{recap.combinations}</strong> kombinasi produk</span><span><strong>{recap.quantity}</strong> unit</span></div>
   {recap.groups.length?recap.groups.map(group=><section className="shopping-recap-group" key={group.key} aria-label={`Toko / brand ${group.store}`}>
    <div className="shopping-recap-group-heading"><h3>{group.store}</h3><span>{group.quantity} unit</span></div>
    {group.key==="" && <p className="field-hint">Toko / brand belum diisi pada pesanan. Lengkapi melalui edit pesanan Jastip atau pilih produk yang sudah memiliki toko / brand untuk pesanan PO baru.</p>}
    <ul className="shopping-recap-lines">{group.lines.map(line=><li key={line.key}>
     <div className="shopping-recap-line-heading"><strong>{line.product}</strong><span>{line.quantity} unit</span></div>
     <dl className="shopping-recap-options">{[["Varian",line.variant],["Warna",line.color],["Ukuran",line.size]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value||"—"}</dd></div>)}</dl>
     <details className="shopping-recap-customers"><summary>Lihat pelanggan ({line.customers.length})</summary><ul>{line.customers.map(customer=><li key={customer.id}><span>{customer.name}{customer.orders>1 && <small> · {customer.orders} pesanan</small>}</span><strong>{customer.quantity} unit</strong></li>)}</ul></details>
    </li>)}</ul>
   </section>):<div className="empty-state compact"><ClipboardList size={28}/><h3>Belum ada produk untuk direkap</h3><p>Catat pesanan pada {batch.type==="po"?"batch":"perjalanan"} ini terlebih dahulu.</p></div>}
  </div>
 </dialog>;
}

"use client";
import {useEffect,useRef,useState} from "react";
import {ChevronDown,ClipboardList,Download,X} from "lucide-react";
import {Select,SelectOption} from "@/components/ui/select";
import {productDisplayName} from "@/lib/product-name";
import {shoppingRecap} from "@/lib/shopping-recap";
import type {AppData,Batch} from "@/lib/types";

export function ShoppingRecapDialog({batch,data,onClose}:{batch:Batch;data:AppData;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 const recap=shoppingRecap(data,batch.id);
 const [kind,setKind]=useState<"products"|"orders">("products");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function download(){
  if(busy||!recap.quantity)return;setBusy(true);setError("");
  try{
   const [{buildShoppingReport},{createShoppingReportExcel}]=await Promise.all([import("@/lib/shopping-report"),import("@/lib/shopping-report-excel")]);
   const bytes=await createShoppingReportExcel(buildShoppingReport(data,batch.id),kind);
   const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
   const link=document.createElement("a");link.href=url;link.download=`tippo-rekap-per-${kind==="products"?"produk":"pesanan"}-${batch.type}-${batch.name.replace(/[^a-zA-Z0-9-]+/g,"-").slice(0,80)||"batch"}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{setError("Rekap belum dapat diunduh. Coba lagi.");}finally{setBusy(false);}
 }
 const title=batch.type==="po"?"Rekap kebutuhan produk":"Rekap belanja";
 useEffect(()=>{const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;const dialog=ref.current;dialog?.showModal();dialog?.querySelector<HTMLButtonElement>(".modal-header button")?.focus({preventScroll:true});return()=>{dialog?.close();if(opener?.isConnected)opener.focus();};},[]);
 return <dialog ref={ref} className="native-dialog shopping-recap-dialog" aria-labelledby="shopping-recap-title" onCancel={event=>{event.preventDefault();onClose();}}>
  <div className="modal-header"><div><h2 id="shopping-recap-title">{title}</h2><p>{batch.name}</p></div><button className="icon-button" onClick={onClose} aria-label="Tutup rekap"><X size={20}/></button></div>
  <div className="modal-body">
   <div className="shopping-recap-summary"><span><strong>{recap.orders}</strong> pesanan</span><span><strong>{recap.quantity}</strong> unit</span><div className="shopping-recap-export-tools"><Select className="input" aria-label="Jenis rekap Excel" disabled={busy||!recap.quantity} value={kind} onValueChange={value=>setKind(value as "products"|"orders")}><SelectOption value="products">Per produk</SelectOption><SelectOption value="orders">Per pesanan</SelectOption></Select><button type="button" className="btn btn-secondary shopping-recap-export" disabled={busy||!recap.quantity} onClick={()=>void download()}><Download size={16} aria-hidden="true"/>{busy?"Menyiapkan…":"Unduh Excel"}</button></div></div>{error&&<p className="error-message" role="alert">{error}</p>}
   {recap.groups.length?recap.groups.map(group=><section className="shopping-recap-group" key={group.key} aria-label={`Toko / brand ${group.store}`}>
    <div className="shopping-recap-group-heading"><h3>{group.key === "" ? "Tanpa toko / brand" : group.store}</h3>{group.lines.length > 1 && <span>{group.quantity} unit</span>}</div>
    <ul className="shopping-recap-lines">{group.lines.map(line=><li key={line.key}>
     <div className="shopping-recap-line-heading"><strong>{[productDisplayName(line.product),line.variant].filter(Boolean).join(" ")}</strong><span className="shopping-recap-quantity">{line.quantity} unit</span></div>
     <dl className="shopping-recap-options">{[["Warna",line.color],["Ukuran",line.size]].filter(([,value])=>Boolean(value)).map(([name,value])=><div key={name}><dt>{name}:</dt><dd>{value}</dd></div>)}</dl>
     <details className="shopping-recap-customers"><summary><span>{line.customers.length} {line.customers.some(customer=>customer.id==="")?"penerima":"pelanggan"}</span><ChevronDown size={15} aria-hidden="true"/></summary><ul>{line.customers.map(customer=><li key={customer.id}><span>{customer.name}{customer.orders>1 && <small> · {customer.orders} pesanan</small>}</span><strong>{customer.quantity} unit</strong></li>)}</ul></details>
    </li>)}</ul>
   </section>):<div className="empty-state compact"><ClipboardList size={28}/><h3>Belum ada produk untuk direkap</h3><p>Catat pesanan pada {batch.type==="po"?"batch":"perjalanan"} ini terlebih dahulu.</p></div>}
  </div>
 </dialog>;
}

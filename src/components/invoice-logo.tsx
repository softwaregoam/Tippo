"use client";
import {useEffect,useState,useSyncExternalStore} from "react";
import {cachedInvoiceLogo,loadInvoiceLogo,subscribeInvoiceLogos} from "@/lib/invoice-logo-cache";

export function InvoiceLogo({src,alt="Logo toko"}:{src:string;alt?:string}) {
 const cached=useSyncExternalStore(subscribeInvoiceLogos,()=>cachedInvoiceLogo(src),()=>"");
 const [failed,setFailed]=useState(false),[attempt,retry]=useState(0);
 useEffect(()=>{
  if(cached)return;
  let active=true;
  void loadInvoiceLogo(src).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;};
 },[src,cached,attempt]);
 return <span className="invoice-logo" data-invoice-logo-url={src} aria-busy={!cached&&!failed}>
  {cached?
   // eslint-disable-next-line @next/next/no-img-element
   <img src={cached} alt={alt}/>
   :failed?<button type="button" className="invoice-logo-placeholder" aria-label="Muat ulang logo" onClick={()=>{setFailed(false);retry(value=>value+1);}}>Logo tidak termuat<br/>Coba lagi</button>:<span className="invoice-logo-placeholder" role="status">Memuat logo…</span>}
 </span>;
}

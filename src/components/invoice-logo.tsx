"use client";
import {useEffect,useState,useSyncExternalStore} from "react";
import {cachedInvoiceLogo,loadInvoiceLogo,subscribeInvoiceLogos} from "@/lib/invoice-logo-cache";

function InvoiceAsset({src,alt,type}:{src:string;alt:string;type:"logo"|"qris"}) {
 const cached=useSyncExternalStore(subscribeInvoiceLogos,()=>cachedInvoiceLogo(src),()=>"");
 const [failed,setFailed]=useState(false),[attempt,retry]=useState(0);
 useEffect(()=>{
  if(cached)return;
  let active=true;
  void loadInvoiceLogo(src).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;};
 },[src,cached,attempt]);
 const label=type==="qris"?"QRIS":"Logo";
 return <span className={type==="qris"?"invoice-qris-image":"invoice-logo"} {...(type==="qris"?{"data-invoice-qris-url":src}:{"data-invoice-logo-url":src})} aria-busy={!cached&&!failed}>
  {cached?
   // eslint-disable-next-line @next/next/no-img-element
   <img src={cached} alt={alt}/>
   :failed?<button type="button" className="invoice-logo-placeholder" aria-label={`Muat ulang ${type==="qris"?"QRIS":"logo"}`} onClick={()=>{setFailed(false);retry(value=>value+1);}}>{label} tidak termuat<br/>Coba lagi</button>:<span className="invoice-logo-placeholder" role="status">Memuat {type==="qris"?"QRIS":"logo"}…</span>}
 </span>;
}
export function InvoiceLogo({src,alt="Logo toko"}:{src:string;alt?:string}) {
 return <InvoiceAsset src={src} alt={alt} type="logo"/>;
}
export function InvoiceQris({src}:{src:string}) {
 return <InvoiceAsset src={src} alt="QRIS pembayaran invoice" type="qris"/>;
}

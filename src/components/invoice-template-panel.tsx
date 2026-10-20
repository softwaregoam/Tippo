"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectOption } from "@/components/ui/select";
import { InvoiceDocument } from "@/components/invoice-document";
import { InvoiceLogo } from "./invoice-logo";
import { prepareInvoiceLogo } from "@/lib/invoice-logo";
import { validateInvoiceTemplate, type InvoiceTemplate } from "@/lib/invoice-template";
import type { Batch, Order } from "@/lib/types";

const previewCss = `
@media(max-width:600px){
 .invoice-template-surface{position:relative;height:var(--template-preview-height,340px);overflow:hidden}
 .invoice-template-source{position:absolute;top:10px;left:10px;width:794px;transform:scale(var(--template-preview-scale,.33));transform-origin:top left}
}`;
const example:Order={id:"CONTOH-001",batchId:"sample",customerId:"sample",date:"2026-10-14",createdAt:"2026-10-14T00:00:00Z",status:"new",paid:0,shippingCharge:10000,serviceFee:0,notes:"",items:[{id:"sample-1",product:"Roti Susu",variant:"Coklat",color:"",size:"",quantity:2,unitPrice:25000,unitCost:null}]};
function LogoThumbnail({src}:{src:string}) {
 return <div className="invoice-logo-thumbnail">{src?<InvoiceLogo key={src} src={src} alt="Logo yang dipilih"/>:<ImageIcon size={26} aria-hidden="true"/>}</div>;
}
/** Match the 794px image renderer, then fit that layout into the phone preview. */
function TemplatePreview({children}:{children:ReactNode}) {
 const surface=useRef<HTMLDivElement>(null),source=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const area=surface.current,document=source.current;if(!area||!document)return;
  function resize(){
   if(!area||!document)return;
   const style=getComputedStyle(area),horizontal=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),vertical=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
   const scale=Math.min(1,Math.max(0,area.clientWidth-horizontal)/Math.max(1,document.offsetWidth));
   area.style.setProperty("--template-preview-scale",String(scale));
   area.style.setProperty("--template-preview-height",`${document.offsetHeight*scale+vertical}px`);
  }
  let frame=0;resize();
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(resize);});
  observer.observe(area);observer.observe(document);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[]);
 return <div ref={surface} className="invoice-preview-surface invoice-template-surface"><style>{previewCss}</style><div ref={source} className="invoice-template-source">{children}</div></div>;
}

export function InvoiceTemplatePanel({settings,onSave,onNotify,type}:{type:Batch["type"];settings:InvoiceTemplate;onSave:(template:InvoiceTemplate,logo:Blob|null)=>Promise<InvoiceTemplate>;onNotify:(message:string)=>void}) {
 const [template,setTemplate]=useState(settings),[logo,setLogo]=useState<Blob|null>(null),[preview,setPreview]=useState(""),[busy,setBusy]=useState(false),[processing,setProcessing]=useState(false),[error,setError]=useState("");
 const file=useRef<HTMLInputElement>(null),submitting=useRef(false);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 const appearance=template.appearance;
 const previewOrder={...example,serviceFee:type==="jastip"?15000:0,shippingDate:"2026-10-20",shippingTime:"14:30",shippingMethod:"Kurir instan",notes:"Tolong bungkus rapi."};
 const logoSource=preview||appearance.logoUrl;
 const logoStatus=preview?"Belum disimpan":appearance.logoUrl?"Logo tersimpan":settings.appearance.logoUrl?"Logo akan dihapus":"Belum ada logo";
 async function chooseLogo(input:HTMLInputElement){const selected=input.files?.[0];if(!selected)return;setProcessing(true);setError("");try{const blob=await prepareInvoiceLogo(selected);setLogo(blob);setPreview(URL.createObjectURL(blob));}catch(cause){setError(cause instanceof Error?cause.message:"Logo belum dapat dibaca.");}finally{input.value="";setProcessing(false);}}
 async function submit(event:React.FormEvent){event.preventDefault();if(submitting.current||processing)return;submitting.current=true;setBusy(true);setError("");try{const next=await onSave(validateInvoiceTemplate(template),logo);setTemplate(next);setLogo(null);setPreview("");onNotify("Template invoice disimpan");}catch(cause){setError(cause instanceof Error?cause.message:"Template belum tersimpan.");}finally{submitting.current=false;setBusy(false);}}
 return <div className="invoice-template-layout"><section className="card invoice-template-controls"><div className="card-header"><h2>Pengaturan invoice</h2></div><form onSubmit={submit} aria-busy={busy}><fieldset disabled={busy||processing}>
  <div className="field"><span className="field-label">Logo toko</span><div className="invoice-logo-picker"><LogoThumbnail key={logoSource} src={logoSource}/><div className="invoice-logo-options"><p className={`invoice-logo-status ${preview?"pending":""}`} role="status">{processing?"Memproses logo…":logoStatus}</p><div className="invoice-logo-controls"><Button type="button" className="btn btn-secondary" onClick={()=>file.current?.click()}><Upload size={16}/>{logoSource?"Ganti logo":"Unggah logo"}</Button>{logoSource&&<button type="button" className="invoice-logo-remove" aria-label="Hapus logo" onClick={()=>{setLogo(null);setPreview("");setTemplate({...template,appearance:{...appearance,logoUrl:""}});}}><X size={15}/>Hapus</button>}<input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>void chooseLogo(event.target)}/></div></div></div><p className="field-hint">PNG, JPG, WebP · maks. 2 MB</p></div>
  <div className="field"><label className="field-label" htmlFor="invoice-store-name">Nama toko (opsional)</label><input id="invoice-store-name" className="input" maxLength={120} value={template.invoiceStoreName} onChange={event=>setTemplate({...template,invoiceStoreName:event.target.value})} placeholder="Nama toko"/><p className="field-hint">Kosongkan untuk menyembunyikan nama toko.</p></div>
  <div className="field"><label className="field-label" htmlFor="invoice-prefix">Awalan nomor invoice</label><input id="invoice-prefix" className="input" required maxLength={20} value={template.invoicePrefix} onChange={event=>setTemplate({...template,invoicePrefix:event.target.value})}/></div>
  <div className="field"><label className="field-label" htmlFor="invoice-color">Warna invoice {type==="po"?"Open PO":"Jastip"}</label><div className="invoice-color-control"><input type="color" id="invoice-color" value={appearance.color} onChange={event=>setTemplate({...template,appearance:{...appearance,color:event.target.value,modeColors:{jastip:appearance.modeColors?.jastip??"#245C4E",po:appearance.modeColors?.po??"#94501F",[type]:event.target.value}}})}/><span>{appearance.color.toUpperCase()}</span></div></div>
  <div className="field"><label className="field-label" htmlFor="invoice-layout">Tampilan</label><Select id="invoice-layout" className="input" disabled={busy||processing} value={appearance.layout} onValueChange={layout=>setTemplate({...template,appearance:{...appearance,layout:layout as "classic"|"minimal"}})}><SelectOption value="classic">Klasik</SelectOption><SelectOption value="minimal">Minimal</SelectOption></Select></div>
  <div className="field"><label className="field-label" htmlFor="invoice-footer">Catatan penutup (opsional)</label><textarea id="invoice-footer" className="input" rows={2} maxLength={160} value={appearance.footer} onChange={event=>setTemplate({...template,appearance:{...appearance,footer:event.target.value}})}/></div>
 </fieldset>{error&&<p role="alert" className="error-message">{error}</p>}<Button type="submit" className="btn btn-primary" disabled={busy||processing}>{busy?"Menyimpan…":"Simpan template"}</Button></form></section>
 <section className="card invoice-template-preview" aria-label="Contoh invoice"><div className="card-header"><h2>Pratinjau</h2><span className="muted">Contoh</span></div><TemplatePreview><InvoiceDocument fixedLayout order={previewOrder} batch={{id:"sample",name:"Contoh",type,origin:"",closeDate:example.date,status:"open",directCosts:0}} customer={{id:"sample",name:"Nama pelanggan",phone:"081234567890",address:"Jalan Melati No. 10\nBandung"}} settings={template} logoPreviewUrl={preview}/></TemplatePreview></section></div>;
}

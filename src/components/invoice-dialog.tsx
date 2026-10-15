"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Copy, Download, FileImage, MessageSquare, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvoiceSettings } from "@/lib/business-profile";
import { InvoiceDocument, printInvoice } from "@/components/invoice-document";
import { InvoicePhoto } from "@/components/invoice-photo";
import { downloadInvoiceImage, prepareInvoiceImage } from "@/lib/invoice-image";
import { buildInvoice, invoiceNumber, invoiceWhatsAppUrl } from "@/lib/invoice";
import type { AppData, Order } from "@/lib/types";

const mobileQuery="(max-width:600px)";
const subscribeMobile=(listener:()=>void)=>{const media=window.matchMedia(mobileQuery);media.addEventListener("change",listener);return()=>media.removeEventListener("change",listener);};
const mobileSnapshot=()=>window.matchMedia(mobileQuery).matches;
const serverSnapshot=()=>false;

export function InvoiceDialog({ order, data, settings, onClose }: { order: Order; data: AppData; settings?: InvoiceSettings; onClose: () => void }) {
  const id = useId();
  const mobile=useSyncExternalStore(subscribeMobile,mobileSnapshot,serverSnapshot);
  const [photo,setPhoto]=useState<{key:string;url:string;error:string;width:number;height:number}|null>(null);
  const [previewAttempt,retryPreview]=useState(0);
  const [tab, setTab] = useState<"image" | "whatsapp">("image");
  function selectTab(next: "image" | "whatsapp") { setTab(next); setFeedback(""); }
  const body=useRef<HTMLDivElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const document = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [feedback, setFeedback] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [downloading,setDownloading]=useState(false);
  const downloadingRef=useRef(false);
  const customer=data.customers.find(customer=>customer.id===order.customerId);
  const message = buildInvoice(order, data.batches.find((batch) => batch.id === order.batchId), data.customers.find((customer) => customer.id === order.customerId), settings);

  const photoKey=JSON.stringify([order,data.batches.find(batch=>batch.id===order.batchId),customer,settings]);
  useEffect(()=>{
    if(tab!=="image"||!document.current)return;
    let active=true;
    void prepareInvoiceImage(document.current).then(image=>{if(active)setPhoto({key:photoKey,url:image.src,width:image.width,height:image.height,error:""});}).catch(error=>{if(active)setPhoto({key:photoKey,url:"",width:0,height:0,error:error instanceof Error?error.message:"Pratinjau belum dapat dimuat."});});
    return()=>{active=false;};
  },[photoKey,previewAttempt,tab]);

  const readyPhoto=photo?.key===photoKey&&photo.url?photo:null;
  const printError=photo?.key===photoKey?photo.error:"";

  useLayoutEffect(()=>{
    // Reset after the new panel is mounted, before the browser paints it.
    if(body.current)body.current.scrollTop=0;
    if(textarea.current)textarea.current.scrollTop=0;
    if(dialog.current)dialog.current.scrollTop=0;
  },[tab]);

  async function downloadImage() {
    if(downloadingRef.current||!document.current)return;
    downloadingRef.current=true;setDownloading(true);setFeedback("");setManualCopy(false);
    try {
      const filename=invoiceNumber(order, settings).replace(/[^A-Za-z0-9_-]/g,"-")+".png";
      await downloadInvoiceImage(document.current,filename);
    } catch(error){setManualCopy(true);setFeedback(error instanceof Error?error.message:"Invoice belum dapat diunduh.");}
    finally{downloadingRef.current=false;setDownloading(false);}
  }

  function printDocument() {
    setFeedback("");
    if(!readyPhoto){setPhoto(null);retryPreview(value=>value+1);return;}
    try {printInvoice({src:readyPhoto.url,width:readyPhoto.width,height:readyPhoto.height});}
    catch(error){setFeedback(error instanceof Error?error.message:"Invoice belum dapat dicetak.");}
  }

  async function copyInvoice() {
    setCopying(true);
    setFeedback("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message);
      setManualCopy(false);
      setFeedback("Invoice disalin. Tempelkan ke chat WhatsApp pelanggan.");
    } catch {
      setManualCopy(true);
      setFeedback("Pilih dan salin teks invoice di bawah, lalu tempelkan ke WhatsApp.");
      textarea.current?.focus();
      textarea.current?.select();
    } finally {
      setCopying(false);
    }
  }

  return (
    <dialog
      ref={(element) => { dialog.current=element; if (element && !element.open) element.showModal(); }}
      className="native-dialog order-invoice-dialog"
      aria-label="Invoice pesanan"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="modal-header">
        <div><h2>Invoice pesanan</h2></div>
        <button className="icon-button" type="button" aria-label="Tutup invoice" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="invoice-tabs" role="tablist" aria-label="Format invoice" onKeyDown={event=>{
        const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const current=tabs.indexOf(event.target as HTMLButtonElement);
        const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:event.key==="ArrowRight"?(current+1)%tabs.length:event.key==="ArrowLeft"?(current+tabs.length-1)%tabs.length:-1;
        if(next<0)return;event.preventDefault();selectTab(next===0?"image":"whatsapp");tabs[next].focus();
      }}>
        <button type="button" role="tab" id={`${id}-image-tab`} aria-controls={`${id}-image-panel`} aria-selected={tab==="image"} tabIndex={tab==="image"?0:-1} onClick={()=>selectTab("image")}><FileImage size={16}/>Invoice gambar</button>
        <button type="button" role="tab" id={`${id}-whatsapp-tab`} aria-controls={`${id}-whatsapp-panel`} aria-selected={tab==="whatsapp"} tabIndex={tab==="whatsapp"?0:-1} onClick={()=>selectTab("whatsapp")}><MessageSquare size={16}/>Teks WhatsApp</button>
      </div>
      <div key={tab} ref={body} className={`modal-body invoice-${tab}-body`}>
        <div role="tabpanel" id={`${id}-image-panel`} aria-labelledby={`${id}-image-tab`} hidden={tab!=="image"}>
        <div ref={document} className="invoice-preview-surface"><div className="invoice-preview-source"><InvoiceDocument order={order} batch={data.batches.find(batch=>batch.id===order.batchId)} customer={customer} settings={settings}/></div>
          {mobile&&(photo?.key===photoKey&&photo.url?<InvoicePhoto src={photo.url}/>:photo?.key===photoKey&&photo.error?<div className="invoice-photo-placeholder"><p role="alert">{photo.error}</p><Button type="button" className="btn btn-secondary" onClick={()=>{setPhoto(null);retryPreview(value=>value+1);}}>Coba lagi</Button></div>:<div className="invoice-photo-placeholder" role="status">Menyiapkan pratinjau…</div>)}
        </div>
        </div>
        <div role="tabpanel" id={`${id}-whatsapp-panel`} aria-labelledby={`${id}-whatsapp-tab`} hidden={tab!=="whatsapp"}>
        <label className="field-label" htmlFor="invoice-message">Isi invoice untuk WhatsApp</label>
        <textarea
          ref={textarea}
          id="invoice-message"
          className="input invoice-message"
          readOnly
          value={message}
          spellCheck={false}
        />
        </div>
        {!mobile&&printError&&<p role="alert">{printError}</p>}
        {feedback && <p role="status" style={{ color: manualCopy ? "var(--warning, #aa762c)" : "var(--primary, #24756b)" }}>{feedback}</p>}
      </div>
      <div className="modal-footer">
        {tab==="image"?<>
          <Button type="button" className="btn btn-secondary" disabled={!readyPhoto&&!printError} onClick={printDocument}><Printer size={16}/>{printError?"Coba siapkan PDF":!readyPhoto?"Menyiapkan PDF…":"Cetak / PDF"}</Button>
          <Button type="button" className="btn btn-primary" disabled={downloading} onClick={downloadImage}><Download size={16}/>{downloading?"Menyiapkan gambar…":"Unduh gambar"}</Button>
        </>:<>
          <Button type="button" className="btn btn-secondary" disabled={copying} onClick={copyInvoice}><Copy size={16} />{copying ? "Menyalin..." : "Salin invoice WhatsApp"}</Button>
          <a className="btn btn-primary" href={invoiceWhatsAppUrl(message,customer?.phone)} target="_blank" rel="noopener noreferrer"><MessageSquare size={16}/>Bagikan ke WhatsApp</a>
        </>}
      </div>
    </dialog>
  );
}

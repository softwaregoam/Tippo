"use client";

import { useId, useRef, useState } from "react";
import { Copy, FileImage, MessageSquare, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvoiceSettings } from "@/lib/business-profile";
import { InvoiceDocument, printInvoice } from "@/components/invoice-document";
import { buildInvoice } from "@/lib/invoice";
import type { AppData, Order } from "@/lib/types";

export function InvoiceDialog({ order, data, settings, onClose }: { order: Order; data: AppData; settings?: InvoiceSettings; onClose: () => void }) {
  const id = useId();
  const [tab, setTab] = useState<"image" | "whatsapp">("image");
  function selectTab(next: "image" | "whatsapp") { setTab(next); setFeedback(""); }
  const document = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [feedback, setFeedback] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [copying, setCopying] = useState(false);
  const message = buildInvoice(order, data.batches.find((batch) => batch.id === order.batchId), data.customers.find((customer) => customer.id === order.customerId), settings);

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
      ref={(element) => { if (element && !element.open) element.showModal(); }}
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
      <div className="modal-body">
        <div role="tabpanel" id={`${id}-image-panel`} aria-labelledby={`${id}-image-tab`} hidden={tab!=="image"}>
        <div ref={document} className="invoice-preview-surface"><InvoiceDocument order={order} batch={data.batches.find(batch=>batch.id===order.batchId)} customer={data.customers.find(customer=>customer.id===order.customerId)} settings={settings}/></div>
        </div>
        <div role="tabpanel" id={`${id}-whatsapp-panel`} aria-labelledby={`${id}-whatsapp-tab`} hidden={tab!=="whatsapp"}>
        <label className="field-label" htmlFor="invoice-message">Isi invoice untuk WhatsApp</label>
        <textarea
          ref={textarea}
          id="invoice-message"
          className="input"
          readOnly
          value={message}
          spellCheck={false}
          style={{ minHeight: 310, maxHeight: "45dvh", width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: 12, lineHeight: 1.7, marginTop: 8 }}
        />
        </div>
        {feedback && <p role="status" style={{ color: manualCopy ? "var(--warning, #aa762c)" : "var(--primary, #24756b)" }}>{feedback}</p>}
      </div>
      <div className="modal-footer">
        {tab==="image"?<Button type="button" className="btn btn-primary" onClick={()=>{if(document.current)void printInvoice(document.current).catch(error=>setFeedback(error instanceof Error?error.message:"Invoice belum dapat dicetak."));}}><Printer size={16}/>Cetak / PDF</Button>:
        <Button type="button" className="btn btn-primary" disabled={copying} onClick={copyInvoice}><Copy size={16} />{copying ? "Menyalin..." : "Salin invoice WhatsApp"}</Button>}
      </div>
    </dialog>
  );
}

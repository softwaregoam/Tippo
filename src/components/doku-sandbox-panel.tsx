"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";
import { parseSandboxBilling, type SandboxBilling } from "@/lib/doku-billing";
import { formatProInvoiceDate } from "@/lib/pro-invoice";

export function DokuSandboxPanel({account}:{account:{id:string}}) {
  const [billing,setBilling]=useState<SandboxBilling|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
  const [clock,setClock]=useState(()=>Date.now());
  const alive=useRef(false),lock=useRef(false);
  async function request(action:"checkout"|"status",signal?:AbortSignal) {
    const client=getSupabaseClient();const session=await client?.auth.getSession();
    if(!client || session?.data.session?.user.id!==account.id)throw new Error("Masuk kembali sebelum membuka pembayaran.");
    const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tippo-doku-sandbox/${action}`,{method:action==="checkout"?"POST":"GET",headers:{Authorization:`Bearer ${session.data.session.access_token}`,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,"Content-Type":"application/json"},...(action==="checkout"?{body:"{}"}:{}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error(response.status===401?"Sesi berakhir. Masuk kembali untuk melanjutkan.":"Pembayaran sandbox belum dapat dimuat. Coba lagi sebentar.");
    return parseSandboxBilling(await response.json());
  }
  useEffect(()=>{
    alive.current=true;lock.current=true;const controller=new AbortController();
    const timer=setInterval(()=>setClock(Date.now()),30000);
    request("status",controller.signal).then(value=>{if(alive.current)setBilling(value);}).catch(()=>{if(alive.current && !controller.signal.aborted)setError("Pembayaran sandbox belum dapat dimuat. Coba lagi sebentar.");}).finally(()=>{lock.current=false;if(alive.current)setBusy(false);});
    return()=>{alive.current=false;controller.abort();clearInterval(timer);};
    // The component is keyed by account ID; never reuses another owner's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[account.id]);
  async function load(action:"checkout"|"status") {
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try{const value=await request(action);if(alive.current)setBilling(value);}
    catch{if(alive.current)setError("Pembayaran sandbox belum dapat dimuat. Coba lagi sebentar.");}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  const invoice=billing?.invoice;
  const labels={creating:"Menyiapkan pembayaran",pending:"Menunggu pembayaran",paid:"Lunas (sandbox)",expired:"Kedaluwarsa",error:"Belum berhasil"};
  const payable=invoice?.status==="pending" && Date.parse(invoice.expiresAt)>clock;
  const displayedStatus=invoice && ["creating","pending"].includes(invoice.status) && Date.parse(invoice.expiresAt)<=clock?"expired":invoice?.status;
  return <section id="invoice-pro" className="card pro-invoice-panel" aria-label="Pembayaran Pro sandbox">
    <div className="card-header"><div><h2>Pembayaran Pro</h2><p>DOKU Checkout · <span className="status-tag order-status-new">Sandbox</span></p></div><ReceiptText size={22}/></div>
    <div className="pro-invoice-body"><p className="field-hint">Pengujian pembayaran Rp25.000 untuk satu bulan Pro. Gunakan simulator DOKU. Hasil uji tidak mengaktifkan langganan produksi.</p>
      {invoice && <dl className="pro-invoice-details"><dt>Nomor invoice</dt><dd>{invoice.number}</dd><dt>Tanggal dibuat</dt><dd>{formatProInvoiceDate(invoice.createdAt)}</dd><dt>Total</dt><dd><strong>Rp25.000</strong></dd><dt>Status</dt><dd><span className={`status-tag ${invoice.status==="paid"?"order-status-done":"order-status-new"}`}>{labels[displayedStatus!]}</span></dd><dt>Batas pembayaran</dt><dd>{formatProInvoiceDate(invoice.expiresAt)}</dd></dl>}
      {billing?.proUntil && <p className="field-hint">Simulasi masa Pro tercatat sampai {formatProInvoiceDate(billing.proUntil)}. Paket dan kuota akun produksi tetap terpisah.</p>}
      <div className="pro-invoice-actions">
        {payable && invoice?.checkoutUrl ? <a className="btn btn-primary" href={invoice.checkoutUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Buka pembayaran DOKU</a> : invoice?.status!=="paid" && <Button className="btn btn-primary" disabled={busy} onClick={()=>void load("checkout")}><ReceiptText size={16}/>{busy?"Menyiapkan…":invoice?.status==="creating"?"Coba siapkan pembayaran":"Buat pembayaran sandbox"}</Button>}
        <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("status")}><RefreshCw size={16}/>{busy?"Memuat…":"Cek status pembayaran"}</Button>
        {invoice?.status==="paid" && <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("checkout")}>Uji perpanjangan Pro</Button>}
      </div>{error&&<p className="error-message" role="alert">{error}</p>}
    </div>
  </section>;
}

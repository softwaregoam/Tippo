"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";
import { parseSandboxBilling, parseProductionTestBilling, type SandboxBilling } from "@/lib/doku-billing";
import { formatProInvoiceDate } from "@/lib/pro-invoice";

export function DokuSandboxPanel({account,mode="sandbox"}:{account:{id:string},mode?:"sandbox"|"production-test"}) {
  const production=mode==="production-test";
  const failure="Pembayaran belum dapat dimuat. Coba lagi sebentar.";
  const [billing,setBilling]=useState<SandboxBilling|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
  const [clock,setClock]=useState(()=>Date.now());
  const alive=useRef(false),lock=useRef(false);
  async function request(action:"checkout"|"status",signal?:AbortSignal) {
    const client=getSupabaseClient();const session=await client?.auth.getSession();
    if(!client || session?.data.session?.user.id!==account.id)throw new Error("Masuk kembali sebelum membuka pembayaran.");
    const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tippo-doku-${mode}/${action}`,{method:action==="checkout"?"POST":"GET",headers:{Authorization:`Bearer ${session.data.session.access_token}`,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,"Content-Type":"application/json"},...(action==="checkout"?{body:"{}"}:{}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
    if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error==="CHECKOUT_REJECTED"?"DOKU menolak pembayaran Rp10.000. Periksa batas nominal dan aktivasi metode pembayaran.":response.status===403?"Akun ini belum diizinkan melakukan uji produksi.":response.status===401?"Sesi berakhir. Masuk kembali untuk melanjutkan.":failure);}
    return (production?parseProductionTestBilling:parseSandboxBilling)(await response.json());
  }
  useEffect(()=>{
    alive.current=true;lock.current=true;const controller=new AbortController();
    const timer=setInterval(()=>setClock(Date.now()),30000);
    request("status",controller.signal).then(value=>{if(alive.current)setBilling(value);}).catch(reason=>{if(alive.current && !controller.signal.aborted)setError(reason instanceof Error?reason.message:failure);}).finally(()=>{lock.current=false;if(alive.current)setBusy(false);});
    return()=>{alive.current=false;controller.abort();clearInterval(timer);};
    // The component is keyed by account ID; never reuses another owner's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[account.id,mode]);
  async function load(action:"checkout"|"status") {
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try{const value=await request(action);if(alive.current)setBilling(value);}
    catch(reason){if(alive.current)setError(reason instanceof Error && !reason.message.startsWith("Invalid")?reason.message:failure);}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  const invoice=billing?.invoice;
  const labels={creating:"Menyiapkan pembayaran",pending:"Menunggu pembayaran",paid:production?"Lunas (uji produksi)":"Lunas (sandbox)",expired:"Kedaluwarsa",error:"Belum berhasil"};
  const payable=invoice?.status==="pending" && Date.parse(invoice.expiresAt)>clock && (!production || invoice.amount===10000);
  const displayedStatus=invoice && ["creating","pending"].includes(invoice.status) && Date.parse(invoice.expiresAt)<=clock?"expired":invoice?.status;
  return <section id={production?"production-test-payment":"invoice-pro"} className="card pro-invoice-panel" aria-label={production?"Uji pembayaran produksi":"Pembayaran Pro sandbox"}>
    <div className="card-header"><div><h2>{production?"Uji pembayaran produksi":"Pembayaran Pro"}</h2><p>DOKU Checkout · <span className="status-tag order-status-new">{production?"Produksi · Rp10.000":"Sandbox"}</span></p></div><ReceiptText size={22}/></div>
    <div className="pro-invoice-body"><p className="field-hint">{production?"Pembayaran nyata sebesar Rp10.000 untuk menguji DOKU Checkout. Tidak mengaktifkan Pro. DOKU atau aplikasi pembayaran dapat menolak nominal ini.":"Pengujian pembayaran Rp25.000 untuk satu bulan Pro. Gunakan simulator DOKU. Hasil uji tidak mengaktifkan langganan produksi."}</p>
      {invoice && <dl className="pro-invoice-details"><dt>Nomor invoice</dt><dd>{invoice.number}</dd><dt>Tanggal dibuat</dt><dd>{formatProInvoiceDate(invoice.createdAt)}</dd><dt>Total</dt><dd><strong>{"Rp"+invoice.amount.toLocaleString("id-ID")}</strong></dd><dt>Status</dt><dd><span className={`status-tag ${invoice.status==="paid"?"order-status-done":"order-status-new"}`}>{labels[displayedStatus!]}</span></dd><dt>Batas pembayaran</dt><dd>{formatProInvoiceDate(invoice.expiresAt)}</dd></dl>}
      {production && invoice && invoice.amount!==10000 && <p className="field-hint">Ini invoice uji lama {"Rp"+invoice.amount.toLocaleString("id-ID")}. Buat pembayaran baru untuk menggunakan nominal Rp10.000.</p>}
      {billing?.proUntil && <p className="field-hint">Simulasi masa Pro tercatat sampai {formatProInvoiceDate(billing.proUntil)}. Paket dan kuota akun produksi tetap terpisah.</p>}
      <div className="pro-invoice-actions">
        {payable && invoice?.checkoutUrl ? <a className="btn btn-primary" href={invoice.checkoutUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Buka pembayaran DOKU</a> : invoice?.status!=="paid" && <Button className="btn btn-primary" disabled={busy} onClick={()=>void load("checkout")}><ReceiptText size={16}/>{busy?"Menyiapkan…":invoice?.status==="creating"?"Coba siapkan pembayaran":production?"Siapkan pembayaran Rp10.000":"Buat pembayaran sandbox"}</Button>}
        <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("status")}><RefreshCw size={16}/>{busy?"Memuat…":"Cek status pembayaran"}</Button>
        {invoice?.status==="paid" && <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("checkout")}>{production?"Uji pembayaran lagi":"Uji perpanjangan Pro"}</Button>}
      </div>{error&&<p className="error-message" role="alert">{error}</p>}
    </div>
  </section>;
}

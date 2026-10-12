"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {Copy,ExternalLink,RefreshCw,ReceiptText} from "lucide-react";
import {Button} from "@/components/ui/button";
import {getSupabaseClient} from "@/lib/supabase";
import {parseSnapBilling,type SnapBilling} from "@/lib/doku-snap-billing";
import {formatProInvoiceDate} from "@/lib/pro-invoice";

const failure="Pembayaran SNAP belum dapat dimuat. Coba lagi sebentar.";
export function DokuSnapPanel({account}:{account:{id:string}}){
 const [billing,setBilling]=useState<SnapBilling|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(""),[copied,setCopied]=useState(false),[clock,setClock]=useState(()=>Date.now());
 const alive=useRef(false),lock=useRef(false);
 const request=useCallback(async(action:"checkout"|"status",signal?:AbortSignal)=>{
  const client=getSupabaseClient(),session=await client?.auth.getSession();
  if(!session?.data.session || session.data.session.user.id!==account.id)throw new Error("Masuk kembali sebelum membuka pembayaran.");
  const response=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+"/functions/v1/tippo-doku-snap-test/"+action,{method:action==="checkout"?"POST":"GET",headers:{Authorization:"Bearer "+session.data.session.access_token,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,"Content-Type":"application/json"},...(action==="checkout"?{body:"{}"}:{}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(40000)]):AbortSignal.timeout(40000)});
  if(!response.ok){
   const body=await response.json().catch(()=>({}));
   throw new Error(body.error==="SNAP_REJECTED"?"DOKU menolak pembuatan VA Rp10. Periksa aktivasi SNAP, BIN/prefix, dan batas nominal bank.":body.error==="SNAP_RECONCILIATION_REQUIRED"?"Permintaan VA sudah tercatat di DOKU. Nomor VA belum diterima; periksa transaksi di dashboard DOKU sebelum mencoba lagi.":response.status===403?"Akun ini belum diizinkan melakukan uji produksi.":response.status===401?"Sesi berakhir. Masuk kembali untuk melanjutkan.":failure);
  }
  try{return parseSnapBilling(await response.json());}catch{throw new Error(failure);}
 },[account.id]);
 useEffect(()=>{
  alive.current=true;lock.current=true;const controller=new AbortController(),timer=setInterval(()=>setClock(Date.now()),30000);
  request("status",controller.signal).then(value=>{if(alive.current)setBilling(value);}).catch(reason=>{if(alive.current && !controller.signal.aborted)setError(reason instanceof Error?reason.message:failure);}).finally(()=>{lock.current=false;if(alive.current)setBusy(false);});
  return()=>{alive.current=false;controller.abort();clearInterval(timer);};
 },[request]);
 async function load(action:"checkout"|"status"){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");setCopied(false);
  try{const value=await request(action);if(alive.current)setBilling(value);}
  catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:failure);}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function copy(){
  try{await navigator.clipboard.writeText(billing!.invoice!.vaNumber!);if(alive.current)setCopied(true);}
  catch{if(alive.current)setError("Nomor VA belum bisa disalin. Salin secara manual dari nomor yang tampil.");}
 }
 const invoice=billing?.invoice,pending=invoice?.status==="pending" && Date.parse(invoice.expiresAt)>clock;
 const status=invoice && ["creating","pending"].includes(invoice.status) && Date.parse(invoice.expiresAt)<=clock?"expired":invoice?.status;
 const labels={creating:"Menyiapkan VA",pending:"Menunggu pembayaran",paid:"Lunas (uji produksi)",expired:"Kedaluwarsa",error:"Belum berhasil"};
 return <section id="snap-test-payment" className="card pro-invoice-panel" aria-label="Uji pembayaran SNAP">
  <div className="card-header"><div><h2>Uji pembayaran VA BNI</h2><p>DOKU SNAP · <span className="status-tag order-status-new">Produksi · Rp10</span></p></div><ReceiptText size={22}/></div>
  <div className="pro-invoice-body">
   <p className="field-hint">Pembayaran nyata Rp10 melalui Virtual Account BNI. Pembayaran uji tidak mengaktifkan Pro. Nominal ini mungkin ditolak DOKU atau bank.</p>
   {invoice && <dl className="pro-invoice-details"><dt>Nomor invoice</dt><dd>{invoice.number}</dd><dt>Tanggal dibuat</dt><dd>{formatProInvoiceDate(invoice.createdAt)}</dd><dt>Total</dt><dd><strong>Rp10</strong></dd><dt>Status</dt><dd><span className={"status-tag "+(invoice.status==="paid"?"order-status-done":"order-status-new")}>{labels[status!]}</span></dd><dt>Batas pembayaran</dt><dd>{formatProInvoiceDate(invoice.expiresAt)}</dd>
    {invoice.vaNumber && <><dt>Bank tujuan</dt><dd>BNI</dd><dt>Nama VA</dt><dd>{invoice.vaName}</dd><dt>Nomor Virtual Account</dt><dd><strong>{invoice.vaNumber}</strong></dd></>}
   </dl>}
   {pending && <p className="field-hint">Bayar lewat menu Virtual Account di aplikasi bank. Pastikan penerima dan nominal Rp10 sesuai sebelum menyetujui pembayaran. Status diperbarui dari notifikasi DOKU; klik cek status setelah membayar.</p>}
   <div className="pro-invoice-actions">
    {pending && invoice?.vaNumber ? <Button className="btn btn-primary" onClick={()=>void copy()}><Copy size={16}/>{copied?"Nomor VA disalin":"Salin nomor VA"}</Button>:invoice?.status!=="paid" && <Button className="btn btn-primary" disabled={busy} onClick={()=>void load("checkout")}><ReceiptText size={16}/>{busy?"Menyiapkan…":status==="creating"?"Coba ambil nomor VA":"Buat VA BNI Rp10"}</Button>}
    {pending && invoice?.instructionsUrl && <a className="btn btn-secondary" href={invoice.instructionsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Panduan pembayaran</a>}
    <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("status")}><RefreshCw size={16}/>{busy?"Memuat…":"Cek status pembayaran"}</Button>
    {invoice?.status==="paid" && <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("checkout")}>Uji pembayaran lagi</Button>}
   </div>
   {copied && <p role="status" className="field-hint">Nomor VA berhasil disalin.</p>}
   {error && <p role="alert" className="error-message">{error}</p>}
  </div>
 </section>;
}

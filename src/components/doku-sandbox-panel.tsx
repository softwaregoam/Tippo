"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";
import { parseSandboxBilling, parseProductionTestBilling, parseProductionBilling, type SandboxBilling } from "@/lib/doku-billing";
import { formatProInvoiceDate } from "@/lib/pro-invoice";
import { prepareDokuCheckout, showDokuCheckout } from "@/lib/doku-checkout-popup";

class CheckoutFailure extends Error {
  billing:SandboxBilling|null;
  constructor(message:string,billing:SandboxBilling|null){super(message);this.billing=billing;}
}

export function DokuSandboxPanel({account,mode="sandbox",onSubscriptionChanged}:{account:{id:string},mode?:SandboxBilling["environment"],onSubscriptionChanged?:()=>Promise<void>}) {
  const production=mode!=="sandbox",livePro=mode==="production",testing=mode==="production-test";
  const parse=livePro?parseProductionBilling:testing?parseProductionTestBilling:parseSandboxBilling;
  const failure="Pembayaran belum dapat dimuat. Coba lagi sebentar.";
  const [billing,setBilling]=useState<SandboxBilling|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
  const [clock,setClock]=useState(()=>Date.now());
  const [cancelId,setCancelId]=useState<string|null>(null);
  const alive=useRef(false),lock=useRef(false);
  const popupCleanup=useRef<(()=>void)|null>(null);
  async function request(action:"checkout"|"status"|"cancel",signal?:AbortSignal,invoiceId?:string) {
    const client=getSupabaseClient();const session=await client?.auth.getSession();
    if(!client || session?.data.session?.user.id!==account.id)throw new Error("Masuk kembali sebelum membuka pembayaran.");
    const response=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tippo-doku-${livePro?"pro":mode}/${action}`,{method:action==="status"?"GET":"POST",headers:{Authorization:`Bearer ${session.data.session.access_token}`,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,"Content-Type":"application/json"},...(action!=="status"?{body:JSON.stringify(action==="cancel"?{invoiceId}:{})}:{}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
    if(!response.ok){const body=await response.json().catch(()=>({}));let rejectedBilling:SandboxBilling|null=null;if(production && body.billing){try{rejectedBilling=parse(body.billing);}catch{}}const providerCode=typeof body.providerCode==="string" && /^[A-Za-z0-9_-]{1,80}$/.test(body.providerCode)?body.providerCode:null;const providerMessage=typeof body.providerMessage==="string"?body.providerMessage.slice(0,300):null;const providerStatus=[400,401,403,422].includes(body.providerStatus)?body.providerStatus:null;const cancellationMessage=body.error==="CANCELLATION_REJECTED"?"DOKU menolak pembatalan"+(providerMessage?": "+providerMessage:". Aktifkan Order Cancellation dan periksa metode pembayaran."):body.error==="CANCELLATION_NOT_AVAILABLE"?"Invoice tidak dapat dibatalkan atau sedang diproses. Cek status pembayaran sebelum mencoba lagi.":body.error==="CANCELLATION_UNCONFIRMED"?"Pembatalan belum terkonfirmasi. Periksa DOKU dan cek status sebelum mencoba lagi.":null;const reviewMessage=body.error==="CHECKOUT_RECONCILIATION_REQUIRED"?"Request ID sudah tercatat di DOKU. Periksa invoice ini di dashboard DOKU; link pembayaran belum berhasil disimpan.":body.error==="CHECKOUT_RESPONSE_INVALID"?"Respons pembayaran DOKU belum dapat dipakai: "+(typeof body.providerIssue==="string"?body.providerIssue:"format tidak sesuai")+(typeof body.checkoutHost==="string"?" (host "+body.checkoutHost+")":"")+". Periksa invoice ini sebelum membuat pembayaran lain.":null;throw new CheckoutFailure(cancellationMessage??reviewMessage??(body.error==="CHECKOUT_REJECTED"?"Permintaan pembayaran ditolak DOKU"+(providerCode?" (kode "+providerCode+")":providerStatus?" (HTTP "+providerStatus+")":"")+(providerMessage?": "+providerMessage:". Periksa konfigurasi Checkout dan metode pembayaran."):response.status===403?"Akun ini belum diizinkan melakukan uji produksi.":response.status===401?"Sesi berakhir. Masuk kembali untuk melanjutkan.":failure),rejectedBilling);}
    return parse(await response.json());
  }
  useEffect(()=>{
    alive.current=true;lock.current=true;const controller=new AbortController();
    const timer=setInterval(()=>setClock(Date.now()),30000);
    request("status",controller.signal).then(async value=>{if(alive.current){setBilling(value);if(livePro && value.proUntil)await onSubscriptionChanged?.();}}).catch(reason=>{if(alive.current && !controller.signal.aborted)setError(reason instanceof Error?reason.message:failure);}).finally(()=>{lock.current=false;if(alive.current)setBusy(false);});
    return()=>{alive.current=false;controller.abort();clearInterval(timer);popupCleanup.current?.();popupCleanup.current=null;};
    // The component is keyed by account ID; never reuses another owner's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[account.id,mode]);
  async function load(action:"checkout"|"status"|"cancel",invoiceId?:string) {
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try{const value=await request(action,undefined,invoiceId);if(alive.current){setBilling(value);if(action==="cancel")setCancelId(null);if(livePro && value.proUntil)await onSubscriptionChanged?.();}}
    catch(reason){if(alive.current){if(reason instanceof CheckoutFailure && reason.billing)setBilling(reason.billing);setError(reason instanceof Error && !reason.message.startsWith("Invalid")?reason.message:failure);}}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  const invoice=billing?.invoice;
  const labels={creating:"Menyiapkan pembayaran",pending:"Menunggu pembayaran",paid:livePro?"Lunas":testing?"Lunas (uji produksi)":"Lunas (sandbox)",expired:"Kedaluwarsa",error:"Belum berhasil",cancelled:"Dibatalkan"};
  const payable=invoice?.status==="pending" && Date.parse(invoice.expiresAt)>clock && (!production || (invoice.amount===(livePro?25000:10000) && invoice.number.length<=30));
  const displayedStatus=invoice && ["creating","pending"].includes(invoice.status) && Date.parse(invoice.expiresAt)<=clock?"expired":invoice?.status;
  const needsReview=production && invoice?.recoveryRequired===true && displayedStatus!=="expired";
  async function openPayment(){
    if(lock.current || !payable || !invoice?.checkoutUrl)return;
    const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    lock.current=true;setBusy(true);setError("");
    try{
      await prepareDokuCheckout(mode);
      if(!alive.current || Date.parse(invoice.expiresAt)<=Date.now())return;
      popupCleanup.current=showDokuCheckout(invoice.checkoutUrl,mode,()=>{
        popupCleanup.current=null;if(alive.current)return load("status");
      },opener);
    }catch(reason){if(alive.current)setError(reason instanceof Error?reason.message:failure);}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  return <section id={testing?"production-test-payment":"invoice-pro"} className="card pro-invoice-panel" aria-label={livePro?"Invoice langganan Pro":testing?"Uji pembayaran produksi":"Pembayaran Pro sandbox"}>
    <div className="card-header"><div><h2>{livePro?"Invoice langganan Pro":testing?"Uji pembayaran produksi":"Pembayaran Pro"}</h2><p>DOKU Checkout · <span className="status-tag order-status-new">{livePro?"Pro · Rp25.000 / bulan":testing?"Produksi · Rp10.000":"Sandbox"}</span></p></div><ReceiptText size={22}/></div>
    <div className="pro-invoice-body"><p className="field-hint">{livePro?"Bayar Tippo Pro Rp25.000 untuk satu bulan. Pro aktif setelah pembayaran terverifikasi. Perpanjangan ditambahkan dari akhir masa Pro yang masih aktif.":testing?"Pembayaran nyata sebesar Rp10.000 untuk menguji DOKU Checkout. Tidak mengaktifkan Pro. DOKU atau aplikasi pembayaran dapat menolak nominal ini.":"Pengujian pembayaran Rp25.000 untuk satu bulan Pro. Gunakan simulator DOKU. Hasil uji tidak mengaktifkan langganan produksi."}</p>
      {invoice && <dl className="pro-invoice-details"><dt>Nomor invoice</dt><dd>{invoice.number}</dd><dt>Tanggal dibuat</dt><dd>{formatProInvoiceDate(invoice.createdAt)}</dd><dt>Total</dt><dd><strong>{"Rp"+invoice.amount.toLocaleString("id-ID")}</strong></dd><dt>Status</dt><dd><span className={`status-tag ${invoice.status==="paid"?"order-status-done":"order-status-new"}`}>{needsReview?"Perlu diperiksa":labels[displayedStatus!]}</span></dd><dt>Batas pembayaran</dt><dd>{formatProInvoiceDate(invoice.expiresAt)}</dd></dl>}
      {testing && invoice && invoice.amount!==10000 && <p className="field-hint">Ini invoice uji lama {"Rp"+invoice.amount.toLocaleString("id-ID")}. Buat pembayaran baru untuk menggunakan nominal Rp10.000.</p>}
      {testing && invoice?.amount===10000 && invoice.number.length>30 && <p className="field-hint">Format invoice lama perlu diperbarui. Buat pembayaran baru Rp10.000.</p>}
      {needsReview && <p className="field-hint">DOKU mungkin sudah membuat transaksi untuk invoice ini. Periksa nomor invoice di dashboard DOKU sebelum mencoba pembayaran lain. Pengiriman ulang dihentikan sampai invoice selesai atau kedaluwarsa.</p>}
      {production && invoice?.customerName && <p className="field-hint">Pelanggan: {invoice.customerName}{invoice.customerEmail?" · "+invoice.customerEmail:""}</p>}
      {billing?.proUntil && <p className="field-hint">{livePro?"Pro aktif sampai ":"Simulasi masa Pro tercatat sampai "}{formatProInvoiceDate(billing.proUntil)}.{!livePro && " Paket dan kuota akun produksi tetap terpisah."}</p>}
      {livePro && invoice?.periodStart && invoice.periodEnd && <p className="field-hint">Periode invoice: {formatProInvoiceDate(invoice.periodStart)} – {formatProInvoiceDate(invoice.periodEnd)}.</p>}
      <div className="pro-invoice-actions">
        {payable && invoice?.checkoutUrl ? <Button className="btn btn-primary" disabled={busy} onClick={()=>void openPayment()}><ReceiptText size={16}/>{busy?"Memuat…":"Buka pembayaran DOKU"}</Button> : invoice?.status!=="paid" && !needsReview && <Button className="btn btn-primary" disabled={busy} onClick={()=>void load("checkout")}><ReceiptText size={16}/>{busy?"Menyiapkan…":invoice?.status==="creating"?"Coba siapkan pembayaran":livePro?"Bayar Pro Rp25.000":testing?"Siapkan pembayaran Rp10.000":"Buat pembayaran sandbox"}</Button>}
        <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("status")}><RefreshCw size={16}/>{busy?"Memuat…":"Cek status pembayaran"}</Button>
        {invoice?.status==="paid" && <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("checkout")}>{livePro?"Perpanjang Pro":testing?"Uji pembayaran lagi":"Uji perpanjangan Pro"}</Button>}
      </div>{error&&<p className="error-message" role="alert">{error}</p>}
      {production && billing?.invoices && <section aria-label={livePro?"Riwayat berlangganan":"Daftar pembayaran uji"} style={{marginTop:24}}>
        <h3>{livePro?"Riwayat berlangganan":"Daftar pembayaran uji"}</h3>
        {billing.invoices.length===0 && <p className="field-hint">Belum ada invoice pembayaran.</p>}
        <p className="field-hint">{livePro?"20 invoice terbaru. Cek status atau batalkan pembayaran yang belum lunas. Pembatalan invoice tidak mengakhiri Pro yang masih aktif.":"20 invoice terbaru. Pembatalan membutuhkan Order Cancellation aktif di DOKU dan metode pembayaran yang didukung. Pembayaran lunas tidak dapat dibatalkan."}</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={livePro?"Invoice berlangganan":"Riwayat pembayaran uji"}><table className="orders-table"><thead><tr><th>Invoice / pelanggan</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{billing.invoices.map(item=>{
          const status=["creating","pending"].includes(item.status) && Date.parse(item.expiresAt)<=clock?"expired":item.status;
          return <tr key={item.id}><td style={{overflowWrap:"anywhere",whiteSpace:"normal"}}>{item.number}<div className="field-hint">{formatProInvoiceDate(item.createdAt)}</div>{item.customerName && <div>{item.customerName}</div>}{item.customerEmail && <div className="field-hint">{item.customerEmail}</div>}</td><td>{"Rp"+item.amount.toLocaleString("id-ID")}</td><td>{labels[status]}{livePro && item.periodStart && item.periodEnd && <div className="field-hint">{formatProInvoiceDate(item.periodStart)} – {formatProInvoiceDate(item.periodEnd)}</div>}</td><td>{["creating","pending"].includes(status)?<div className="pro-invoice-actions">{livePro && <Button className="btn btn-secondary" disabled={busy} onClick={()=>void load("status")}>Cek status</Button>}<Button className="btn btn-secondary" disabled={busy} onClick={()=>setCancelId(item.id)}>Batalkan</Button></div>:"—"}</td></tr>;
        })}</tbody></table></div>
        {cancelId && <div role="group" aria-label="Konfirmasi pembatalan" style={{marginTop:16}}><p>Batalkan invoice {billing.invoices.find(item=>item.id===cancelId)?.number}? Link pembayaran akan dinonaktifkan jika DOKU menerima pembatalan.</p><div className="pro-invoice-actions"><Button className="btn btn-primary" disabled={busy} onClick={()=>void load("cancel",cancelId)}>{busy?"Membatalkan…":"Ya, batalkan pembayaran"}</Button><Button className="btn btn-secondary" disabled={busy} onClick={()=>setCancelId(null)}>Kembali</Button></div></div>}
      </section>}
    </div>
  </section>;
}

"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatProInvoiceDate } from "@/lib/pro-invoice";
import type { SandboxInvoice } from "@/lib/doku-billing";

interface Props {
 invoices:SandboxInvoice[]; livePro:boolean; email?:string; busy:boolean; clock:number;
 cancelId:string|null; error?:string; onCheck:()=>void; onCancel:(id:string)=>void; onConfirm:()=>void; onDismiss:()=>void;
}
function CancellationDialog({invoice,busy,error,onConfirm,onDismiss}:{invoice:SandboxInvoice;busy:boolean;error?:string;onConfirm:()=>void;onDismiss:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),dismissRef=useRef<HTMLButtonElement>(null),titleId=useId(),descriptionId=useId();
 useEffect(()=>{
  const dialog=ref.current;
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const parent=opener?.closest("dialog");
  dialog?.showModal();
  dismissRef.current?.focus({preventScroll:true});
  return()=>{dialog?.close();if(opener?.isConnected)opener.focus({preventScroll:true});else if(parent?.isConnected)parent.focus({preventScroll:true});};
 },[]);
 return createPortal(<dialog ref={ref} className="native-dialog subscription-cancel-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event=>{event.preventDefault();event.stopPropagation();if(!busy)onDismiss();}}>
  <div className="modal-header"><h2 id={titleId}>Batalkan pembayaran?</h2><button className="icon-button" aria-label="Tutup konfirmasi pembatalan" disabled={busy} onClick={onDismiss}><X size={20}/></button></div>
  <div className="modal-body"><p>Invoice <strong>{invoice.number}</strong></p><p id={descriptionId}>Link pembayaran dinonaktifkan jika pembatalan disetujui DOKU.</p>{error && <p className="error-message" role="alert">{error}</p>}</div>
  <div className="modal-footer"><Button ref={dismissRef} className="btn btn-secondary" disabled={busy} onClick={onDismiss}>Kembali</Button><Button className="btn btn-primary" disabled={busy} onClick={onConfirm}>{busy?"Membatalkan…":"Ya, batalkan pembayaran"}</Button></div>
 </dialog>,document.body);
}
export function SubscriptionHistory({invoices,livePro,email,busy,clock,cancelId,error,onCheck,onCancel,onConfirm,onDismiss}:Props){
 const labels={creating:"Menyiapkan pembayaran",pending:"Menunggu pembayaran",paid:livePro?"Lunas":"Lunas (uji produksi)",expired:"Kedaluwarsa",error:"Belum berhasil",cancelled:"Dibatalkan"};
 const status=(item:SandboxInvoice)=>["creating","pending"].includes(item.status) && Date.parse(item.expiresAt)<=clock?"expired":item.status;
 const canCancel=(item:SandboxInvoice)=>["creating","pending"].includes(status(item));
 const money=(item:SandboxInvoice)=>"Rp"+item.amount.toLocaleString("id-ID");
 const badge=(item:SandboxInvoice)=><span className={`status-tag billing-status-${status(item)}`}>{labels[status(item)]}</span>;
 const shortDate=(value:string)=>new Date(value).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Jakarta"});
 const actions=(item:SandboxInvoice)=>canCancel(item)?<div className="pro-invoice-actions">{livePro && <Button className="btn btn-secondary" disabled={busy} onClick={onCheck}>Cek status</Button>}<Button className="btn btn-secondary" disabled={busy} onClick={()=>onCancel(item.id)}>Batalkan</Button></div>:"—";
 const selected=invoices.find(item=>item.id===cancelId);
 return <section aria-label={livePro?"Riwayat berlangganan":"Daftar pembayaran uji"} style={{marginTop:livePro?0:24}}>
  {!livePro && <h3>Daftar pembayaran uji</h3>}
  {livePro && <p className="field-hint pro-history-account">{email?"Riwayat akun "+email:"Riwayat akun yang sedang masuk"}</p>}
  {invoices.length===0?<p className="field-hint">Belum ada invoice pembayaran.</p>:<>
   <p className="field-hint">{livePro?"20 invoice terbaru milik akunmu. Pembatalan invoice tidak mengakhiri Pro yang masih aktif.":"20 invoice terbaru. Pembatalan membutuhkan Order Cancellation aktif di DOKU dan metode pembayaran yang didukung. Pembayaran lunas tidak dapat dibatalkan."}</p>
   {livePro && <ul className="pro-history-mobile" aria-label="Daftar invoice akunmu">{invoices.map(item=><li key={item.id}><details>
    <summary><span className="pro-history-summary"><strong>{money(item)} · 1 bulan</strong>{badge(item)}<span className="field-hint">{shortDate(item.createdAt)}</span><span className="pro-history-number">{item.number}</span></span><ChevronDown size={18} aria-hidden="true"/></summary>
    <div className="pro-history-details"><dl><dt>Tanggal invoice</dt><dd>{formatProInvoiceDate(item.createdAt)}</dd><dt>Status</dt><dd>{badge(item)}</dd>
     {item.paidAt && <><dt>Dibayar pada</dt><dd>{formatProInvoiceDate(item.paidAt)}</dd></>}
     {item.periodStart && item.periodEnd?<><dt>Mulai Pro</dt><dd>{formatProInvoiceDate(item.periodStart)}</dd><dt>Sampai</dt><dd>{formatProInvoiceDate(item.periodEnd)}</dd></>:canCancel(item)?<><dt>Batas bayar</dt><dd>{formatProInvoiceDate(item.expiresAt)}</dd></>:null}
    </dl>{canCancel(item) && actions(item)}</div>
   </details></li>)}</ul>}
   <div className={`table-wrap ${livePro?"pro-history-desktop":""}`} tabIndex={0} role="region" aria-label={livePro?"Invoice berlangganan":"Riwayat pembayaran uji"}><table className="orders-table pro-history-table"><thead><tr><th scope="col">{livePro?"Invoice":"Invoice / pelanggan"}</th><th scope="col">Total</th><th scope="col">Status</th>{livePro && <th scope="col">Periode Pro</th>}<th scope="col">Aksi</th></tr></thead><tbody>{invoices.map(item=><tr key={item.id}>
    <td className="pro-history-invoice">{item.number}<div className="field-hint">{formatProInvoiceDate(item.createdAt)}</div>{!livePro && <>{item.customerName && <div>{item.customerName}</div>}{item.customerEmail && <div className="field-hint">{item.customerEmail}</div>}</>}</td><td>{money(item)}</td><td>{badge(item)}</td>{livePro && <td className="pro-history-period">{item.periodStart && item.periodEnd?`${shortDate(item.periodStart)} – ${shortDate(item.periodEnd)}`:"—"}</td>}<td>{actions(item)}</td>
   </tr>)}</tbody></table></div>
  </>}
  {selected && canCancel(selected) && <CancellationDialog key={selected.id} invoice={selected} busy={busy} error={error} onConfirm={onConfirm} onDismiss={onDismiss}/>}
 </section>;
}

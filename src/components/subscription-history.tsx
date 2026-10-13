"use client";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatProInvoiceDate } from "@/lib/pro-invoice";
import type { SandboxInvoice } from "@/lib/doku-billing";

interface Props {
 invoices:SandboxInvoice[]; livePro:boolean; email?:string; busy:boolean; clock:number;
 cancelId:string|null; onCheck:()=>void; onCancel:(id:string)=>void; onConfirm:()=>void; onDismiss:()=>void;
}
export function SubscriptionHistory({invoices,livePro,email,busy,clock,cancelId,onCheck,onCancel,onConfirm,onDismiss}:Props){
 const labels={creating:"Menyiapkan pembayaran",pending:"Menunggu pembayaran",paid:livePro?"Lunas":"Lunas (uji produksi)",expired:"Kedaluwarsa",error:"Belum berhasil",cancelled:"Dibatalkan"};
 const status=(item:SandboxInvoice)=>["creating","pending"].includes(item.status) && Date.parse(item.expiresAt)<=clock?"expired":item.status;
 const canCancel=(item:SandboxInvoice)=>["creating","pending"].includes(status(item));
 const money=(item:SandboxInvoice)=>"Rp"+item.amount.toLocaleString("id-ID");
 const badge=(item:SandboxInvoice)=><span className={`status-tag billing-status-${status(item)}`}>{labels[status(item)]}</span>;
 const shortDate=(value:string)=>new Date(value).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Jakarta"});
 const actions=(item:SandboxInvoice)=>canCancel(item)?<div className="pro-invoice-actions">{livePro && <Button className="btn btn-secondary" disabled={busy} onClick={onCheck}>Cek status</Button>}<Button className="btn btn-secondary" disabled={busy} onClick={()=>onCancel(item.id)}>Batalkan</Button></div>:"—";
 const selected=invoices.find(item=>item.id===cancelId);
 const confirmation=selected && <div className="pro-history-confirmation" role="group" aria-label="Konfirmasi pembatalan"><p>Batalkan invoice {selected.number}? Link pembayaran akan dinonaktifkan jika DOKU menerima pembatalan.</p><div className="pro-invoice-actions"><Button className="btn btn-primary" disabled={busy} onClick={onConfirm}>{busy?"Membatalkan…":"Ya, batalkan pembayaran"}</Button><Button className="btn btn-secondary" disabled={busy} onClick={onDismiss}>Kembali</Button></div></div>;
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
    </dl>{canCancel(item) && actions(item)}{cancelId===item.id && confirmation}</div>
   </details></li>)}</ul>}
   <div className={`table-wrap ${livePro?"pro-history-desktop":""}`} tabIndex={0} role="region" aria-label={livePro?"Invoice berlangganan":"Riwayat pembayaran uji"}><table className="orders-table pro-history-table"><thead><tr><th scope="col">{livePro?"Invoice":"Invoice / pelanggan"}</th><th scope="col">Total</th><th scope="col">Status</th>{livePro && <th scope="col">Periode Pro</th>}<th scope="col">Aksi</th></tr></thead><tbody>{invoices.map(item=><tr key={item.id}>
    <td className="pro-history-invoice">{item.number}<div className="field-hint">{formatProInvoiceDate(item.createdAt)}</div>{!livePro && <>{item.customerName && <div>{item.customerName}</div>}{item.customerEmail && <div className="field-hint">{item.customerEmail}</div>}</>}</td><td>{money(item)}</td><td>{badge(item)}</td>{livePro && <td className="pro-history-period">{item.periodStart && item.periodEnd?`${shortDate(item.periodStart)} – ${shortDate(item.periodEnd)}`:"—"}</td>}<td>{actions(item)}</td>
   </tr>)}</tbody></table></div>
  </>}
  <div className={livePro?"pro-history-desktop":""}>{confirmation}</div>
 </section>;
}

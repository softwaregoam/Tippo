"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubscriptionHistoryDialog({children,busy,opener,onCheck,onClose}:{children:ReactNode;busy:boolean;opener:HTMLElement|null;onCheck:()=>void;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=ref.current;
  dialog?.showModal();
  return()=>{dialog?.close();if(opener?.isConnected)opener.focus();};
 },[opener]);
 return <dialog ref={ref} className="native-dialog subscription-history-dialog" aria-label="Riwayat langganan" onCancel={event=>{event.preventDefault();onClose();}}>
  <div className="modal-header"><h2>Riwayat langganan</h2><button className="icon-button" aria-label="Tutup riwayat langganan" onClick={onClose}><X size={20}/></button></div>
  <div className="modal-body">{children}</div>
  <div className="modal-footer"><Button className="btn btn-secondary" disabled={busy} onClick={onCheck}>{busy?"Memuat…":"Cek status pembayaran"}</Button><Button className="btn btn-primary" onClick={onClose}>Tutup</Button></div>
 </dialog>;
}

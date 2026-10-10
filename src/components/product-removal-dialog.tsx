"use client";
import {useEffect,useRef,useState} from "react";
import {Trash2,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import type {Product} from "@/lib/types";
export function ProductRemovalDialog({product,onClose,onConfirm}:{product:Product;onClose:()=>void;onConfirm:()=>boolean|Promise<boolean>}){
 const ref=useRef<HTMLDialogElement>(null),lock=useRef(false);const [busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";ref.current?.showModal();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
 return <dialog ref={ref} className="native-dialog" aria-labelledby="remove-product-title" onCancel={e=>{e.preventDefault();if(!lock.current)onClose();}}><div className="modal-header"><h2 id="remove-product-title">Hapus produk dari katalog aktif?</h2><button className="icon-button" aria-label="Tutup konfirmasi produk" disabled={busy} onClick={onClose}><X size={20}/></button></div><div className="modal-body"><p><strong>{product.name}</strong> akan diarsipkan dan tidak bisa dipilih untuk pesanan baru. Histori pesanan tetap tersimpan. Produk dapat diaktifkan kembali dari filter Diarsipkan.</p>{error&&<p className="error-message" role="alert">{error}</p>}</div><div className="modal-footer"><Button autoFocus className="btn btn-secondary" disabled={busy} onClick={onClose}>Batal</Button><Button className="btn btn-danger" disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError("");try{if(await onConfirm())onClose();else setError("Produk belum diarsipkan. Coba lagi.");}catch{setError("Produk belum diarsipkan. Coba lagi.");}finally{lock.current=false;setBusy(false);}}}><Trash2 size={16}/>{busy?"Menyimpan…":"Ya, arsipkan produk"}</Button></div></dialog>;
}

"use client";
import { useId, useRef, useState, type ComponentProps } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Customer } from "@/lib/types";

type Props = Omit<ComponentProps<"button">,"value"|"onChange"> & {customers:Customer[];value:string;onValueChange:(value:string)=>void};
const normalize=(text:string)=>text.normalize("NFKC").toLocaleLowerCase("id").trim();
export function CustomerPicker({customers,value,onValueChange,name,className="",...props}:Props) {
 const id=useId(),close=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const tokens=normalize(query).split(/\s+/).filter(Boolean);
 const filtered=customers.filter(customer=>tokens.every(token=>normalize(`${customer.name} ${customer.phone} ${customer.phone.replace(/\D/g,"")}`).includes(token)));
 const selected=customers.find(customer=>customer.id===value);
 function select(next:string){onValueChange(next);setOpen(false);}
 return <Popover.Root modal open={open} onOpenChange={next=>{setOpen(next);if(next)setQuery("");}}>
  <Popover.Trigger asChild><button {...props} type="button" name={name} role="combobox" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} data-value={value} data-placeholder={!value?"":undefined} className={`select-trigger ${className}`}><span>{value==="new"?"+ Pelanggan baru":selected?.name??"Pilih pelanggan"}</span><span><ChevronDown size={16} aria-hidden="true"/></span></button></Popover.Trigger>
  <Popover.Portal><div className="product-picker-portal">{open&&<div className="product-picker-scrim"/>}<Popover.Content id={id} className="product-picker" aria-label="Pilih pelanggan pesanan" aria-modal="true" sideOffset={6} collisionPadding={12} onOpenAutoFocus={event=>{event.preventDefault();close.current?.focus({preventScroll:true});}}>
   <div className="product-picker-heading"><h2>Pilih pelanggan</h2><Popover.Close ref={close} className="icon-button" aria-label="Tutup pilihan pelanggan"><X size={18}/></Popover.Close></div>
   <div className="product-picker-search"><Search size={18} aria-hidden="true"/><input ref={search} aria-label="Cari pelanggan pesanan" placeholder="Cari nama atau WhatsApp…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();list.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();}}}/>{query&&<button className="icon-button" type="button" aria-label="Hapus pencarian pelanggan" onClick={()=>{setQuery("");search.current?.focus();}}><X size={16}/></button>}</div>
   <div ref={list} className="product-picker-list" role="listbox" aria-label="Daftar pelanggan pesanan" onKeyDown={event=>{
    const buttons=Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(event.key==="ArrowDown"){event.preventDefault();buttons[Math.min(index+1,buttons.length-1)]?.focus();}
    if(event.key==="ArrowUp"){event.preventDefault();if(index<=0)search.current?.focus();else buttons[index-1]?.focus();}
    if(event.key==="Home"){event.preventDefault();buttons[0]?.focus();}
    if(event.key==="End"){event.preventDefault();buttons.at(-1)?.focus();}
   }}>
    {filtered.map(customer=><button key={customer.id} type="button" role="option" aria-label={customer.name} aria-selected={value===customer.id} data-value={customer.id} className="product-picker-option" onClick={()=>select(customer.id)}><span><strong>{customer.name}</strong>{customer.phone&&<small>{customer.phone}</small>}</span>{value===customer.id&&<Check size={16}/>}</button>)}
    {!filtered.length&&<p className="report-batch-empty" role="status">{query?"Pelanggan tidak ditemukan.":"Belum ada pelanggan."}</p>}
    <button type="button" role="option" aria-selected={value==="new"} data-value="new" className="product-picker-option" onClick={()=>select("new")}><strong>+ Pelanggan baru</strong>{value==="new"&&<Check size={16}/>}</button>
   </div>
  </Popover.Content></div></Popover.Portal>
  {name&&<input type="hidden" name={name} value={value}/>}
 </Popover.Root>;
}

"use client";
import { useId, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, Search, X } from "lucide-react";

export function CategoryFilter({categories,value,onValueChange}:{categories:string[];value:string;onValueChange:(value:string)=>void}) {
 const id=useId(),close=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const normalize=(text:string)=>text.normalize("NFKC").toLocaleLowerCase("id").trim();
 const tokens=normalize(query).split(/\s+/).filter(Boolean);
 const filtered=categories.filter(category=>tokens.every(token=>normalize(category).includes(token)));
 function select(next:string){onValueChange(next);setOpen(false);}
 return <Popover.Root modal open={open} onOpenChange={next=>{setOpen(next);if(next)setQuery("");}}>
  <Popover.Trigger asChild><button type="button" role="combobox" aria-label="Filter kategori produk" aria-haspopup="dialog" aria-controls={id} aria-expanded={open} data-value={value} className="select-trigger input filter-input"><span>{value==="all"?"Semua kategori":value}</span><ChevronDown size={16} aria-hidden="true"/></button></Popover.Trigger>
  <Popover.Portal><div className="product-picker-portal">{open&&<div className="product-picker-scrim"/>}<Popover.Content id={id} className="product-picker report-batch-picker" aria-label="Pilih kategori produk" aria-modal="true" sideOffset={6} collisionPadding={12} onOpenAutoFocus={event=>{event.preventDefault();close.current?.focus({preventScroll:true});}}>
   <div className="product-picker-heading"><h2>Pilih kategori</h2><Popover.Close ref={close} className="icon-button" aria-label="Tutup pilihan kategori"><X size={18}/></Popover.Close></div>
   <div className="product-picker-search"><Search size={18} aria-hidden="true"/><input ref={search} aria-label="Cari kategori produk" placeholder="Cari kategori…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();list.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();}}}/>{query&&<button type="button" className="icon-button" aria-label="Hapus pencarian kategori" onClick={()=>{setQuery("");search.current?.focus();}}><X size={16}/></button>}</div>
   <div ref={list} className="product-picker-list report-batch-options" role="listbox" aria-label="Daftar kategori produk" onKeyDown={event=>{
    const buttons=Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(event.key==="ArrowDown"){event.preventDefault();buttons[Math.min(index+1,buttons.length-1)]?.focus();}
    if(event.key==="ArrowUp"){event.preventDefault();if(index<=0)search.current?.focus();else buttons[index-1]?.focus();}
    if(event.key==="Home"){event.preventDefault();buttons[0]?.focus();}
    if(event.key==="End"){event.preventDefault();buttons.at(-1)?.focus();}
   }}>
    <button type="button" role="option" aria-selected={value==="all"} data-value="all" className="product-picker-option" onClick={()=>select("all")}><strong>Semua kategori</strong>{value==="all"&&<Check size={16}/>}</button>
    {filtered.map(category=><button key={category} type="button" role="option" aria-label={category} aria-selected={value===category} data-value={category} className="product-picker-option" onClick={()=>select(category)}><span><strong>{category}</strong></span>{value===category&&<Check size={16}/>}</button>)}
    {!filtered.length&&<p className="report-batch-empty" role="status">{query?"Kategori tidak ditemukan.":"Belum ada kategori."}</p>}
   </div>
  </Popover.Content></div></Popover.Portal>
 </Popover.Root>;
}

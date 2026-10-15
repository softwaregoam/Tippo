"use client";
import { useId, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { formatCalendarDate } from "@/lib/calendar-date";
import type { Batch } from "@/lib/types";

export function BatchPicker({ batches, type, value, onValueChange, purpose = "report" }: { purpose?: "report" | "hpp" | "orders"; batches: Batch[]; type: Batch["type"]; value: string; onValueChange: (value: string) => void }) {
  const id = useId(), close = useRef<HTMLButtonElement>(null), search = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  const [open,setOpen] = useState(false), [query,setQuery] = useState("");
  const allowAll = purpose !== "hpp";
  const label = type === "po" ? "batch PO" : "perjalanan";
  const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("id").trim();
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const filtered = batches.filter(batch=>tokens.every(token=>normalize(batch.name).includes(token))).sort((a,b)=>b.closeDate.localeCompare(a.closeDate) || a.name.localeCompare(b.name,"id"));
  const select = (next: string) => {onValueChange(next);setOpen(false);};
  return <Popover.Root modal open={open} onOpenChange={next=>{setOpen(next);if(next)setQuery("");}}>
    <Popover.Trigger asChild><button type="button" id={purpose === "orders" ? "orders-batch" : allowAll ? "report-batch" : "hpp-batch"} role="combobox" aria-label={purpose === "orders" ? "Filter batch" : allowAll ? "Filter batch laporan" : "Pilih batch untuk HPP"} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} data-value={value} className="select-trigger input"><span>{batches.find(batch=>batch.id===value)?.name ?? `${allowAll ? "Semua" : "Pilih"} ${label}`}</span><ChevronDown size={16}/></button></Popover.Trigger>
    <Popover.Portal><div className="product-picker-portal">{open&&<div className="product-picker-scrim"/>}<Popover.Content id={id} className="product-picker report-batch-picker" aria-label={`Pilih ${label} ${purpose === "orders" ? "pesanan" : allowAll ? "laporan" : "untuk HPP"}`} aria-modal="true" sideOffset={6} collisionPadding={12} onOpenAutoFocus={event=>{event.preventDefault();close.current?.focus({preventScroll:true});}}>
      <div className="product-picker-heading"><h2>Pilih {label}</h2><Popover.Close ref={close} className="icon-button" aria-label="Tutup pilihan batch"><X size={18}/></Popover.Close></div>
      <div className="product-picker-search"><Search size={18} aria-hidden="true"/><input ref={search} aria-label={`Cari ${label}`} placeholder={`Cari ${label}…`} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();list.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();}}}/>{query&&<button type="button" className="icon-button" aria-label="Hapus pencarian batch" onClick={()=>{setQuery("");search.current?.focus();}}><X size={16}/></button>}</div>
      <div ref={list} className="product-picker-list report-batch-options" role="listbox" aria-label={`Daftar ${label}`} onKeyDown={event=>{
        const buttons=Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')??[]), index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        if(event.key==="ArrowDown"){event.preventDefault();buttons[Math.min(index+1,buttons.length-1)]?.focus();}
        if(event.key==="ArrowUp"){event.preventDefault();if(index<=0)search.current?.focus();else buttons[index-1]?.focus();}
        if(event.key==="Home"){event.preventDefault();buttons[0]?.focus();}
        if(event.key==="End"){event.preventDefault();buttons.at(-1)?.focus();}
      }}>
        {allowAll&&<button type="button" role="option" aria-selected={!value} data-value="" className="product-picker-option" onClick={()=>select("")}><span><strong>Semua {label}</strong></span>{!value&&<Check size={16}/>}</button>}
        {filtered.map(batch=><button key={batch.id} type="button" role="option" aria-label={batch.name} aria-selected={value===batch.id} data-value={batch.id} className="product-picker-option" onClick={()=>select(batch.id)}><span><strong>{batch.name}</strong>{batch.closeDate&&<small>{formatCalendarDate(batch.closeDate)}</small>}</span>{value===batch.id&&<Check size={16}/>}</button>)}
        {!filtered.length&&<p className="report-batch-empty" role="status">{query?"Tidak ditemukan.":`Belum ada ${label}.`}</p>}
      </div>
    </Popover.Content></div></Popover.Portal>
  </Popover.Root>;
}

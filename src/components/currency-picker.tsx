"use client";
import { useId, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { currencyLabel, searchCurrencies } from "@/lib/currencies";

type Props={id?:string;"aria-label":string;value:string;onValueChange:(value:string)=>void;disabled?:boolean;includeRupiah?:boolean};
export function CurrencyPicker({id,"aria-label":label,value,onValueChange,disabled,includeRupiah=true}:Props){
 const contentId=useId(),search=useRef<HTMLInputElement>(null),close=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[container,setContainer]=useState<HTMLElement>();
 const choices=searchCurrencies(query,includeRupiah);
 const select=(code:string)=>{onValueChange(code);setOpen(false);};
 return <Popover.Root modal open={open} onOpenChange={next=>{if(next){setQuery("");setContainer(trigger.current?.closest("dialog")??undefined);}setOpen(next);}}>
  <Popover.Trigger asChild><button ref={trigger} id={id} type="button" disabled={disabled} className="select-trigger currency-picker-trigger" role="combobox" aria-label={label} aria-haspopup="dialog" aria-controls={contentId} aria-expanded={open} data-value={value} title={currencyLabel(value)}><span>{currencyLabel(value)}</span><ChevronDown size={16} aria-hidden="true"/></button></Popover.Trigger>
  <Popover.Portal container={container}><div className="product-picker-portal">{open&&<div className="product-picker-scrim"/>}<Popover.Content id={contentId} className="product-picker currency-picker" aria-label="Pilih mata uang" sideOffset={6} collisionPadding={12} onOpenAutoFocus={event=>{event.preventDefault();(window.matchMedia("(max-width:600px)").matches?close.current:search.current)?.focus({preventScroll:true});}} onEscapeKeyDown={event=>{event.preventDefault();event.stopPropagation();setOpen(false);}}>
   <div className="product-picker-heading"><h2>Mata uang</h2><Popover.Close ref={close} className="icon-button" aria-label="Tutup pilihan mata uang"><X size={18}/></Popover.Close></div>
   <div className="product-picker-search"><Search size={17} aria-hidden="true"/><input ref={search} aria-label="Cari mata uang" placeholder="Cari kode, mata uang, atau negara…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();if(choices[0])select(choices[0].code);}if(event.key==="ArrowDown"){event.preventDefault();list.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();}}}/>{query&&<button type="button" className="icon-button" aria-label="Hapus pencarian mata uang" onClick={()=>{setQuery("");search.current?.focus();}}><X size={15}/></button>}</div>
   <div ref={list} className="product-picker-list currency-picker-list" role="listbox" aria-label="Daftar mata uang" onKeyDown={event=>{
    const buttons=Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(event.key==="ArrowDown"){event.preventDefault();buttons[Math.min(index+1,buttons.length-1)]?.focus();}
    if(event.key==="ArrowUp"){event.preventDefault();if(index<=0)search.current?.focus();else buttons[index-1]?.focus();}
    if(event.key==="Home"){event.preventDefault();buttons[0]?.focus();}
    if(event.key==="End"){event.preventDefault();buttons.at(-1)?.focus();}
   }}>{choices.map(item=><button key={item.code} type="button" role="option" aria-selected={value===item.code} data-value={item.code} className="product-picker-option" onClick={()=>select(item.code)}><span><strong>{item.code} · {item.name}</strong><small>{item.country}</small></span>{value===item.code&&<Check size={16} aria-hidden="true"/>}</button>)}{!choices.length&&<p className="currency-picker-empty" role="status">Mata uang tidak ditemukan.</p>}</div>
  </Popover.Content></div></Popover.Portal>
 </Popover.Root>;
}

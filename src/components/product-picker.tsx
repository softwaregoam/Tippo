"use client";
import { useId, useRef, useState, type ComponentProps, type Ref } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { productDisplayName } from "@/lib/product-name";
import { formatCurrency } from "@/lib/finance";

export type ProductChoice = { value: string; name: string; variant?: string; size?: string; supplier?: string; detail: string; sku: string; category: string; price: number|null; searchText: string; note?: string };
type Props = Omit<ComponentProps<"button">, "value" | "onChange" | "ref"> & {
  value: string; options: ProductChoice[]; onValueChange: (value: string) => void; ref?: Ref<HTMLButtonElement>;
};
const choiceTitle = (product: ProductChoice) => [
  [productDisplayName(product.name), product.variant?.trim()].filter(Boolean).join(" "),
  product.size?.trim(),
].filter(Boolean).join(" — ");

const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("id").replace(/\s+/g, " ").trim();

export function ProductPicker({ value, options, onValueChange, ref, name, className = "", ...props }: Props) {
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const close = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);
  const tokens = normalize(query).split(" ").filter(Boolean);
  const filtered = options.filter(option => tokens.every(token => normalize(option.searchText).includes(token)));
  return <Popover.Root modal open={open} onOpenChange={next => { setOpen(next); if (next) setQuery(""); }}>
    <Popover.Trigger asChild><button {...props} type="button" ref={ref} name={name} role="combobox" aria-haspopup="dialog" aria-controls={contentId} aria-expanded={open} data-value={value} className={`select-trigger ${className}`}><span>{selected ? choiceTitle(selected) : "Pilih produk"}</span><span><ChevronDown size={16} aria-hidden="true" /></span></button></Popover.Trigger>
    <Popover.Portal><div className="product-picker-portal">
      {open && <div className="product-picker-scrim" />}
      <Popover.Content id={contentId} data-product-picker className="product-picker" sideOffset={6} collisionPadding={12} aria-label="Pilih produk pesanan" aria-modal="true" onOpenAutoFocus={event => { event.preventDefault(); close.current?.focus({ preventScroll: true }); }}>
        <div className="product-picker-heading"><h2>Pilih produk</h2><Popover.Close ref={close} className="icon-button" aria-label="Tutup pilihan produk"><X size={18} /></Popover.Close></div>
        <div className="product-picker-search"><Search size={18} aria-hidden="true" /><input ref={search} aria-label="Cari produk pesanan" placeholder="Nama, SKU, varian, atau kategori…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); list.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus(); } }} />{query && <button className="icon-button" type="button" aria-label="Hapus pencarian produk" onClick={() => { setQuery(""); search.current?.focus(); }}><X size={16} /></button>}</div>
        <p className="product-picker-count" role="status">{filtered.length} dari {options.length} produk</p>
        <div ref={list} className="product-picker-list" role="listbox" aria-label="Produk tersedia" onKeyDown={event => {
          const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (event.key === "ArrowDown") { event.preventDefault(); buttons[Math.min(index + 1, buttons.length - 1)]?.focus(); }
          if (event.key === "ArrowUp") { event.preventDefault(); if (index <= 0) search.current?.focus(); else buttons[index - 1]?.focus(); }
          if (event.key === "Home") { event.preventDefault(); buttons[0]?.focus(); }
          if (event.key === "End") { event.preventDefault(); buttons.at(-1)?.focus(); }
        }}>
          {filtered.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value} data-value={option.value} className="product-picker-option" onClick={() => { onValueChange(option.value); setOpen(false); }}><span><strong>{choiceTitle(option)}</strong>{option.category && <small>Kategori: {option.category}</small>}{option.supplier?.trim() && <small>Supplier: {option.supplier.trim()}</small>}{option.sku && <small>SKU: {option.sku}</small>}{option.detail && <small>{option.detail}</small>}{option.note && <small>{option.note}</small>}</span><span className="product-picker-price">{option.price===null?"Belum diisi":formatCurrency(option.price)}{option.value === value && <Check size={16} aria-hidden="true" />}</span></button>)}
        </div>
        {!filtered.length && <div className="empty-state compact"><strong>Produk tidak ditemukan</strong><p>Coba nama, SKU, varian, atau kategori lain.</p><button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); search.current?.focus(); }}>Reset pencarian</button></div>}
      </Popover.Content>
    </div></Popover.Portal>
    {name && <input type="hidden" name={name} value={value} />}
  </Popover.Root>;
}

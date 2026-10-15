"use client";

import { NumberInput } from "@/components/ui/number-input";

import { useRef, useState } from "react";
import { ArrowDownLeft, Check, Search, ShoppingBag, TrendingUp } from "lucide-react";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { allocatedBatchCosts, formatCurrency, itemLabel, orderHpp, orderQuantity, orderRevenue } from "@/lib/finance";
import { formatCalendarDate } from "@/lib/calendar-date";
import { isAppData } from "@/lib/validation";
import type { AppData, Batch, OrderItem } from "@/lib/types";

function fieldKey(orderId: string, itemId: string): string {
  return `${orderId}:${itemId}`;
}

function purchaseCost(value: string): number | null {
  const parsed = Number(value);
  return value.trim() && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function SummaryStat({ title, value, icon, tone, note, warning = false }: { title: string; value: string; icon: React.ReactNode; tone: string; note: string; warning?: boolean }) {
  return <section className="card stat-card"><div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><strong className="stat-value">{value}</strong><div className={`stat-note ${warning ? "warning" : ""}`}><span className={`stat-note-dot ${warning ? "gold" : "teal"}`} />{note}</div></section>;
}

export function HppPanel({ batch, data, onSave }: { batch: Batch; data: AppData; onSave: (next: AppData) => void }) {
  const orders = data.orders.filter((order) => order.batchId === batch.id && order.status !== "cancelled");
  const [costs, setCosts] = useState<Record<string, string>>(() => Object.fromEntries(orders.flatMap((order) => order.items.map((item) => [fieldKey(order.id, item.id), item.unitCost === null ? "" : String(item.unitCost)]))));
  const [search,setSearch] = useState("");
  const [status,setStatus] = useState("all");
  const [requestedPage,setPage] = useState(1);
  const details = useRef<HTMLElement>(null);
  const [error, setError] = useState("");
  const previewOrders = data.orders.map((order) => order.batchId === batch.id && order.status !== "cancelled" ? {
    ...order,
    items: order.items.map((item) => ({ ...item, unitCost: purchaseCost(costs[fieldKey(order.id, item.id)] ?? "") })),
  } : order);
  const hasLegacyCosts = batch.directCosts > 0;
  const allocated = allocatedBatchCosts(batch, previewOrders);
  const revenue = orders.reduce((sum, order) => sum + orderRevenue(order), 0);
  const activePreview = previewOrders.filter((order) => order.batchId === batch.id && order.status !== "cancelled");
  const knownOrders = activePreview.filter((order) => order.items.every((item) => item.unitCost !== null));
  const missing = activePreview.length - knownOrders.length;
  const hpp = knownOrders.reduce((sum, order) => sum + (orderHpp(order, previewOrders, data.batches) ?? 0), 0);
  const knownRevenue = knownOrders.reduce((sum, order) => sum + orderRevenue(order), 0);

  const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("id").trim();
  const tokens = normalize(search).split(/\s+/).filter(Boolean);
  const filtered = activePreview.filter(order=>{
    const complete = order.items.every(item=>item.unitCost!==null);
    const text = normalize([data.customers.find(customer=>customer.id===order.customerId)?.name ?? "",...order.items.map(item=>[itemLabel(item),item.store ?? ""].join(" "))].join(" "));
    return (status==="all" || (status==="complete" ? complete : !complete)) && tokens.every(token=>text.includes(token));
  }).sort((a,b)=>b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const pageCount = Math.max(1,Math.ceil(filtered.length/10));
  const page = Math.min(requestedPage,pageCount);
  const visibleOrders = filtered.slice((page-1)*10,page*10);
  function changePage(next: number) {
    setPage(next);
    details.current?.scrollIntoView({block:"start"});
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.values(costs).filter((value) => value !== "");
    if (values.some((value) => !value.trim() || !Number.isSafeInteger(Number(value)) || Number(value) < 0)) {
      setError("Biaya harus berupa rupiah bulat, minimal nol.");
      return;
    }
    const next = { ...data, orders: previewOrders };
    if (!isAppData(next)) {
      setError("Total biaya terlalu besar untuk dihitung dengan aman. Periksa harga beli produk.");
      return;
    }
    setError("");
    onSave(next);
  }

  function inputLabel(orderId: string, item: OrderItem, itemCount: number): string {
    return `Harga beli ${itemLabel(item)} ${orderId}${itemCount > 1 ? ` ${item.id}` : ""}`;
  }

  return <form onSubmit={submit}>
    <div className="hpp-summary-grid">
      <SummaryStat title="Total penjualan" value={formatCurrency(revenue)} icon={<ShoppingBag size={19} />} tone="mint" note={`${orders.length} pesanan`} />
      <SummaryStat title="HPP diketahui" value={missing && !knownOrders.length ? "Belum lengkap" : formatCurrency(hpp)} icon={<ArrowDownLeft size={19} />} tone="orange" note={missing ? `${missing} pesanan belum lengkap` : "Harga beli lengkap"} warning={missing > 0} />
      <SummaryStat title={missing ? "Margin diketahui" : "Estimasi margin"} value={missing && !knownOrders.length ? "Belum lengkap" : formatCurrency(knownRevenue - hpp)} icon={<TrendingUp size={19} />} tone="lavender" note="Laba kotor sebelum biaya umum" />
    </div>
    {hasLegacyCosts && <p className="field-hint" style={{ marginBottom: 20 }}>Biaya lama {formatCurrency(batch.directCosts)} termasuk dalam HPP.</p>}
    <section ref={details} className="card hpp-detail-card" aria-label="Harga beli produk">
      <div className="card-header"><div><h2>Harga beli produk</h2></div><span className="type-badge">{orders.reduce((sum, order) => sum + orderQuantity(order), 0)} UNIT</span></div>
      <div className="list-toolbar hpp-list-toolbar" role="group" aria-label="Pencarian dan filter harga beli">
        <div className="search-field"><Search size={18}/><input aria-label="Cari produk atau pelanggan HPP" placeholder="Cari produk atau pelanggan…" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}} onKeyDown={event=>{if(event.key==="Enter")event.preventDefault();}}/></div>
        <Select className="input" aria-label="Filter kelengkapan HPP" value={status} onValueChange={value=>{setStatus(value);setPage(1);}}><SelectOption value="all">Semua</SelectOption><SelectOption value="incomplete">Belum lengkap</SelectOption><SelectOption value="complete">Lengkap</SelectOption></Select>
      </div>
      {visibleOrders.length>0&&<div className="table-wrap"><table className="orders-table hpp-table" aria-label="Rincian HPP"><thead><tr><th scope="col">Produk</th><th scope="col" className="numeric-cell center-cell">Jumlah</th><th scope="col">Harga beli / unit</th>{hasLegacyCosts && <th scope="col" className="numeric-cell">Biaya lama</th>}<th scope="col" className="numeric-cell">HPP pesanan</th><th scope="col" className="numeric-cell">Margin pesanan</th></tr></thead>
        {visibleOrders.map((order) => {
          const preview = previewOrders.find((entry) => entry.id === order.id)!;
          const cost = orderHpp(preview, previewOrders, data.batches);
          const customerName = data.customers.find((customer) => customer.id === order.customerId)?.name || "Pelanggan";
          return <tbody key={order.id} aria-label={`Pesanan ${customerName}`}><tr className="hpp-order-header"><th scope="rowgroup" colSpan={hasLegacyCosts ? 6 : 5}><div className="hpp-order-heading"><strong>{customerName}</strong><span>{formatCalendarDate(order.date)} · {order.items.length} produk</span></div></th></tr>{order.items.map((item, index) => <tr key={fieldKey(order.id, item.id)}>
            <td className="hpp-product-cell"><div className="row-title">{itemLabel(item)}</div></td>
            <td className="numeric-cell center-cell hpp-quantity-cell">{item.quantity} unit</td>
            <td className="hpp-input-cell" data-label="Harga beli / unit"><div className="cost-input small"><span>Rp</span><NumberInput className="input" aria-label={inputLabel(order.id, item, order.items.length)} min="0" step="1" placeholder="Belum diisi" value={costs[fieldKey(order.id, item.id)] ?? ""} onValueChange={(value) => setCosts({ ...costs, [fieldKey(order.id, item.id)]: value })} /></div></td>
            {index === 0 && <>{hasLegacyCosts && <td className="numeric-cell hpp-legacy-cell" data-label="Biaya lama" rowSpan={order.items.length}>{formatCurrency(allocated[order.id] ?? 0)}</td>}<td className="numeric-cell hpp-total-cell" data-label="HPP pesanan" rowSpan={order.items.length}>{cost === null ? <span className="status-tag status-new">Belum lengkap</span> : formatCurrency(cost)}</td><td rowSpan={order.items.length} data-label="Margin pesanan" className={`numeric-cell hpp-total-cell ${cost !== null && orderRevenue(order) - cost < 0 ? "negative" : "positive"}`}>{cost === null ? "Belum lengkap" : formatCurrency(orderRevenue(order) - cost)}</td></>}
          </tr>)}</tbody>;
        })}
      </table></div>}
      {!visibleOrders.length&&<div className="empty-state compact"><p>{orders.length ? "Tidak ada pesanan yang sesuai." : "Belum ada pesanan aktif."}</p>{orders.length>0&&<Button type="button" className="btn btn-secondary" onClick={()=>{setSearch("");setStatus("all");setPage(1);}}>Reset filter</Button>}</div>}
      {filtered.length>0&&<div className="table-footer report-pagination"><span>{(page-1)*10+1}–{Math.min(page*10,filtered.length)} dari {filtered.length} pesanan</span>{pageCount>1&&<nav aria-label="Halaman harga beli"><span>{page} / {pageCount}</span><Button type="button" className="btn btn-secondary" disabled={page===1} onClick={()=>changePage(page-1)}>Sebelumnya</Button><Button type="button" className="btn btn-secondary" disabled={page===pageCount} onClick={()=>changePage(page+1)}>Berikutnya</Button></nav>}</div>}
      {orders.length > 0 && <div className="hpp-save-footer"><Button className="btn btn-primary" type="submit" style={{ marginLeft: "auto" }}><Check size={17} />Simpan harga beli</Button></div>}
    </section>
    {error && <p role="alert" className="error-message">{error}</p>}
  </form>;
}

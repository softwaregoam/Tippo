"use client";

import { NumberInput } from "@/components/ui/number-input";

import { useState } from "react";
import { ArrowDownLeft, Check, ShoppingBag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { allocatedBatchCosts, formatCurrency, itemLabel, orderHpp, orderQuantity, orderRevenue } from "@/lib/finance";
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
    <section className="card hpp-detail-card" aria-label="Harga beli produk">
      <div className="card-header"><div><h2>Harga beli produk</h2></div><span className="type-badge">{orders.reduce((sum, order) => sum + orderQuantity(order), 0)} UNIT</span></div>
      <div className="table-wrap"><table className="orders-table hpp-table" aria-label="Rincian HPP"><thead><tr><th scope="col">Produk</th><th scope="col" className="numeric-cell center-cell">Jumlah</th><th scope="col">Harga beli / unit</th>{hasLegacyCosts && <th scope="col" className="numeric-cell">Biaya lama</th>}<th scope="col" className="numeric-cell">HPP pesanan</th><th scope="col" className="numeric-cell">Margin pesanan</th></tr></thead>
        {orders.map((order) => {
          const preview = previewOrders.find((entry) => entry.id === order.id)!;
          const cost = orderHpp(preview, previewOrders, data.batches);
          return <tbody key={order.id}>{order.items.map((item, index) => <tr key={fieldKey(order.id, item.id)}>
            <td className="hpp-product-cell"><div className="row-title">{itemLabel(item)}</div><div className="row-subtitle">{data.customers.find((customer) => customer.id === order.customerId)?.name}{order.items.length > 1 ? ` · Produk ${index + 1}/${order.items.length}` : ""}</div></td>
            <td className="numeric-cell center-cell hpp-quantity-cell">{item.quantity} unit</td>
            <td className="hpp-input-cell" data-label="Harga beli / unit"><div className="cost-input small"><span>Rp</span><NumberInput className="input" aria-label={inputLabel(order.id, item, order.items.length)} min="0" step="1" placeholder="Belum diisi" value={costs[fieldKey(order.id, item.id)] ?? ""} onValueChange={(value) => setCosts({ ...costs, [fieldKey(order.id, item.id)]: value })} /></div></td>
            {index === 0 && <>{hasLegacyCosts && <td className="numeric-cell hpp-legacy-cell" data-label="Biaya lama" rowSpan={order.items.length}>{formatCurrency(allocated[order.id] ?? 0)}</td>}<td className="numeric-cell hpp-total-cell" data-label="HPP pesanan" rowSpan={order.items.length}>{cost === null ? <span className="status-tag status-new">Belum lengkap</span> : formatCurrency(cost)}</td><td rowSpan={order.items.length} data-label="Margin pesanan" className={`numeric-cell hpp-total-cell ${cost !== null && orderRevenue(order) - cost < 0 ? "negative" : "positive"}`}>{cost === null ? "Belum lengkap" : formatCurrency(orderRevenue(order) - cost)}</td></>}
          </tr>)}</tbody>;
        })}
      </table></div>
      {!orders.length && <div className="empty-state compact"><p>Belum ada pesanan aktif untuk dihitung.</p></div>}
      {orders.length > 0 && <div className="hpp-save-footer"><Button className="btn btn-primary" type="submit" style={{ marginLeft: "auto" }}><Check size={17} />Simpan harga beli</Button></div>}
    </section>
    {error && <p role="alert" className="error-message">{error}</p>}
  </form>;
}

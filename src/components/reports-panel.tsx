"use client";
import { useMemo, useState } from "react";
import { Download, FileBarChart2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { buildSalesReport, monthBounds, validReportDate } from "@/lib/sales-report";
import { jakartaMonth } from "@/lib/subscription";
import { formatCurrency } from "@/lib/finance";
import { formatCalendarDate } from "@/lib/calendar-date";
import type { AppData, Batch } from "@/lib/types";

export function ReportsPanel({ data, type, isPro, onUpgrade }: { data: AppData; type: Batch["type"]; isPro: boolean; onUpgrade: () => void }) {
  const current = monthBounds(jakartaMonth());
  const [from,setFrom] = useState(current.from);
  const [to,setTo] = useState(current.to);
  const [batchId,setBatchId] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const start = isPro ? from : current.from, end = isPro ? to : current.to;
  const valid = validReportDate(start) && validReportDate(end) && start <= end;
  const report = useMemo(()=>valid ? buildSalesReport(data,{type,from:start,to:end,batchId:batchId || undefined}) : null,[data,type,start,end,batchId,valid]);
  const batches = data.batches.filter(batch=>batch.type===type);
  async function download() {
    if (!isPro) {onUpgrade();return;}
    if (!report || busy) return;
    setBusy(true);setError("");
    try {
      const {createReportExcel} = await import("@/lib/report-excel");
      const buffer = await createReportExcel(report);
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
      const link = document.createElement("a");link.href=url;link.download=`tippo-laporan-${type}-${start}-${end}.xlsx`;document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch {setError("Laporan belum dapat diunduh. Coba lagi.");}
    finally {setBusy(false);}
  }
  const summary = report?.summary;
  const known = summary && (!summary.orders || summary.unknownCosts < summary.orders);
  return <div className="reports-layout">
    <section className="card" aria-label="Filter laporan"><div className="card-header list-import-header"><div><h2>Penjualan & laba</h2><p>Berdasarkan tanggal pesanan, tanpa pesanan dibatalkan.</p></div><Button className="btn btn-secondary report-export" disabled={!valid || busy} onClick={()=>void download()}><Download size={16}/>{busy?"Menyiapkan…":"Ekspor Excel"}{!isPro&&<span className="import-plan-badge">Pro</span>}</Button></div>
      <div className="report-filters"><div className="field"><label htmlFor="report-from" className="field-label">Dari tanggal</label><DatePicker id="report-from" value={start} onValueChange={setFrom} disabled={!isPro}/></div><div className="field"><label htmlFor="report-to" className="field-label">Sampai tanggal</label><DatePicker id="report-to" value={end} onValueChange={setTo} disabled={!isPro}/></div><div className="field"><label htmlFor="report-batch" className="field-label">{type==="po"?"Batch PO":"Perjalanan"}</label><Select id="report-batch" aria-label="Filter batch laporan" className="input" value={batchId} onValueChange={setBatchId}><SelectOption value="">Semua {type==="po"?"batch PO":"perjalanan"}</SelectOption>{batches.map(batch=><SelectOption key={batch.id} value={batch.id}>{batch.name}</SelectOption>)}</Select></div></div>
      {!isPro&&<p className="report-plan-note">Paket Gratis: bulan berjalan. Periode lain dan ekspor tersedia di Pro.</p>}
      {!valid&&<p className="error-message report-plan-note" role="alert">Pilih tanggal mulai dan akhir yang valid.</p>}
      {error&&<p className="error-message report-plan-note" role="alert">{error}</p>}
    </section>
    {report && summary && <>
      <section className="report-stats" aria-label="Ringkasan laporan">{[
        ["Total penjualan",formatCurrency(summary.revenue),"Setelah diskon, termasuk fee dan ongkir"],
        ["HPP diketahui",known?formatCurrency(summary.hpp):"Belum lengkap",`${summary.orders-summary.unknownCosts} dari ${summary.orders} pesanan lengkap`],
        [summary.unknownCosts?"Margin diketahui":"Estimasi margin",known?formatCurrency(summary.margin):"Belum lengkap","Laba kotor sebelum biaya umum"],
        ["Jumlah pesanan",String(summary.orders),`${summary.quantity} unit produk`],
      ].map(([label,value,note])=><div className="card stat-card" key={label}><p className="muted">{label}</p><strong className="report-stat-value">{value}</strong><p className="field-hint">{note}</p></div>)}</section>
      {summary.unknownCosts>0&&<p className="report-cost-note" role="status">Margin belum mencakup {summary.unknownCosts} pesanan dengan HPP belum lengkap.</p>}
      <section className="card workspace-list-card" aria-label="Rincian laporan"><div className="card-header"><div><h2>Rincian pesanan</h2></div></div>
        {report.rows.length ? <><div className="table-wrap report-desktop-table"><table className="orders-table"><thead><tr>{["Tanggal / pelanggan",type==="po"?"Batch PO":"Perjalanan","Penjualan","HPP","Margin"].map((label,index)=><th key={label} scope="col" className={index>1?"numeric-cell":undefined}>{label}</th>)}</tr></thead><tbody>{report.rows.map(row=><tr key={row.order.id}><td><strong>{row.customer}</strong><div className="field-hint">{formatCalendarDate(row.order.date)}</div></td><td>{row.batch}</td><td className="numeric-cell">{formatCurrency(row.revenue)}</td><td className="numeric-cell">{row.hpp===null?"Belum lengkap":formatCurrency(row.hpp)}</td><td className="numeric-cell">{row.margin===null?"—":formatCurrency(row.margin)}</td></tr>)}</tbody></table></div>
        <ul className="report-mobile-orders">{report.rows.map(row=><li key={row.order.id}><div className="report-mobile-heading"><strong>{row.customer}</strong><span>{formatCalendarDate(row.order.date,false)}</span></div><p className="field-hint">{row.batch}</p><dl>{[["Penjualan",formatCurrency(row.revenue)],["HPP",row.hpp===null?"Belum lengkap":formatCurrency(row.hpp)],["Margin",row.margin===null?"—":formatCurrency(row.margin)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></li>)}</ul></> : <div className="empty-state"><div className="empty-icon"><FileBarChart2 size={26}/></div><h3>Belum ada pesanan pada periode ini</h3><p>Sesuaikan periode atau pilihan batch/perjalanan.</p></div>}
        <div className="table-footer">{summary.orders} pesanan · {summary.quantity} unit</div>
      </section>
      <section className="card report-top-products" aria-label="Produk terlaris"><div className="card-header"><h2>Produk terlaris</h2></div>{report.products.length?<ol>{report.products.slice(0,10).map(product=><li key={product.key}><div><strong>{product.name}</strong>{product.detail&&<p className="field-hint">{product.detail}</p>}</div><span>{product.quantity} unit</span></li>)}</ol>:<p className="report-plan-note muted">Belum ada produk pada periode ini.</p>}</section>
    </>}
  </div>;
}

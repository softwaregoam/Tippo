"use client";
import { useMemo, useRef, useState } from "react";
import { Download, FileBarChart2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { BatchPicker } from "@/components/batch-picker";
import { Button } from "@/components/ui/button";
import { buildSalesReport, monthBounds, validReportDate } from "@/lib/sales-report";
import { hasEstimatedCost } from "@/lib/purchase-fx";
import { jakartaMonth } from "@/lib/subscription";
import { formatCurrency } from "@/lib/finance";
import { formatCalendarDate } from "@/lib/calendar-date";
import type { AppData, Batch } from "@/lib/types";

export function ReportsPanel({ data, type, isPro, onUpgrade }: { data: AppData; type: Batch["type"]; isPro: boolean; onUpgrade: () => void }) {
  const current = monthBounds(jakartaMonth());
  const [from,setFrom] = useState(current.from);
  const [to,setTo] = useState(current.to);
  const [batchId,setBatchId] = useState("");
  const [pagination,setPagination] = useState({filter:"",page:1});
  const details = useRef<HTMLElement>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const start = isPro ? from : current.from, end = isPro ? to : current.to;
  const valid = validReportDate(start) && validReportDate(end) && start <= end;
  const report = useMemo(()=>valid ? buildSalesReport(data,{type,from:start,to:end,batchId:batchId || undefined}) : null,[data,type,start,end,batchId,valid]);
  const filterKey = JSON.stringify([type,start,end,batchId]);
  const pageCount = Math.max(1,Math.ceil((report?.rows.length ?? 0)/10));
  const page = pagination.filter===filterKey ? Math.min(pagination.page,pageCount) : 1;
  const visibleRows = report?.rows.slice((page-1)*10,page*10) ?? [];
  function changePage(next: number) {
    setPagination({filter:filterKey,page:next});
    details.current?.scrollIntoView({block:"start"});
  }
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
      <div className="report-filters"><div className="field"><label htmlFor="report-from" className="field-label">Dari tanggal</label><DatePicker id="report-from" value={start} onValueChange={value=>{setFrom(value);setPagination({filter:"",page:1});}} disabled={!isPro}/></div><div className="field"><label htmlFor="report-to" className="field-label">Sampai tanggal</label><DatePicker id="report-to" value={end} onValueChange={value=>{setTo(value);setPagination({filter:"",page:1});}} disabled={!isPro}/></div><div className="field"><label htmlFor="report-batch" className="field-label">{type==="po"?"Batch PO":"Perjalanan"}</label><BatchPicker batches={batches} type={type} value={batchId} onValueChange={value=>{setBatchId(value);setPagination({filter:"",page:1});}}/></div></div>
      {!isPro&&<p className="report-plan-note">Paket Gratis: bulan berjalan. Periode lain dan ekspor tersedia di Pro.</p>}
      {!valid&&<p className="error-message report-plan-note" role="alert">Pilih tanggal mulai dan akhir yang valid.</p>}
      {error&&<p className="error-message report-plan-note" role="alert">{error}</p>}
    </section>
    {report && summary && <>
      {(report.rows.some(row=>hasEstimatedCost(row.order))||report.personalRows.some(hasEstimatedCost))&&<p className="fx-estimate-note" role="status">Biaya mencakup kurs estimasi.</p>}
    <section className="report-stats sales-report-summary" aria-label="Ringkasan laporan">{[
        ["Total penjualan",formatCurrency(summary.revenue),"Setelah diskon, termasuk fee dan ongkir"],
        [summary.unknownCosts?"HPP pelanggan diketahui":"HPP pelanggan",known?formatCurrency(summary.hpp):"Belum lengkap",`${summary.orders-summary.unknownCosts} dari ${summary.orders} pesanan lengkap`],
        [summary.unknownCosts?"Margin usaha diketahui":"Margin usaha",known?formatCurrency(summary.margin):"Belum lengkap","Tanpa ongkir · sebelum biaya umum"],
        ["Jumlah pesanan",String(summary.orders),`${summary.quantity} unit produk pelanggan`],
        ["Belanja sendiri",formatCurrency(report.personalExpenses),`${report.personalRows.length} pesanan Untuk sendiri`],
        ["Total biaya belanja",report.totalPurchaseCosts===null?"Belum lengkap":formatCurrency(report.totalPurchaseCosts),"HPP pelanggan + belanja sendiri"],
      ].map(([label,value,note])=><div className="card stat-card" key={label}><p className="muted">{label}</p><strong className="report-stat-value">{value}</strong><p className="field-hint">{note}</p></div>)}</section>
      <p className="field-hint">Penjualan tanpa ongkir − HPP pelanggan. Belanja sendiri tidak mengurangi margin.</p>
      {summary.unknownCosts>0&&<p className="report-cost-note" role="status">Margin belum mencakup {summary.unknownCosts} pesanan dengan HPP belum lengkap.</p>}
      <section ref={details} className="card workspace-list-card report-details" aria-label="Rincian laporan"><div className="card-header"><div><h2>Rincian pesanan</h2></div></div>
        {report.rows.length ? <><div className="table-wrap report-desktop-table"><table className="orders-table"><thead><tr>{["Tanggal / pelanggan",type==="po"?"Batch PO":"Perjalanan","Penjualan","HPP","Margin"].map((label,index)=><th key={label} scope="col" className={index>1?"numeric-cell":undefined}>{label}</th>)}</tr></thead><tbody>{visibleRows.map(row=><tr key={row.order.id}><td><strong>{row.customer}</strong><div className="field-hint">{formatCalendarDate(row.order.date)}</div></td><td>{row.batch}</td><td className="numeric-cell">{formatCurrency(row.revenue)}</td><td className="numeric-cell">{row.hpp===null?"Belum lengkap":formatCurrency(row.hpp)}{hasEstimatedCost(row.order)&&<small className="fx-estimate">Estimasi</small>}</td><td className="numeric-cell">{row.margin===null?"—":formatCurrency(row.margin)}{hasEstimatedCost(row.order)&&<small className="fx-estimate">Estimasi</small>}</td></tr>)}</tbody></table></div>
        <ul className="report-mobile-orders">{visibleRows.map(row=><li key={row.order.id}><div className="report-mobile-heading"><strong>{row.customer}</strong><span>{formatCalendarDate(row.order.date,false)}</span></div><p className="field-hint">{row.batch}</p><dl>{[["Penjualan",formatCurrency(row.revenue)],[hasEstimatedCost(row.order)?"HPP · Estimasi":"HPP",row.hpp===null?"Belum lengkap":formatCurrency(row.hpp)],[hasEstimatedCost(row.order)?"Margin · Estimasi":"Margin",row.margin===null?"—":formatCurrency(row.margin)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></li>)}</ul></> : <div className="empty-state"><div className="empty-icon"><FileBarChart2 size={26}/></div><h3>Belum ada pesanan pada periode ini</h3><p>Sesuaikan periode atau pilihan batch/perjalanan.</p></div>}
        <div className="table-footer report-pagination"><span>{summary.orders ? `${(page-1)*10+1}–${Math.min(page*10,summary.orders)} dari ${summary.orders} pesanan` : "0 pesanan"} · {summary.quantity} unit</span>{pageCount>1&&<nav aria-label="Halaman rincian pesanan"><span>{page} / {pageCount}</span><Button className="btn btn-secondary" disabled={page===1} onClick={()=>changePage(page-1)}>Sebelumnya</Button><Button className="btn btn-secondary" disabled={page===pageCount} onClick={()=>changePage(page+1)}>Berikutnya</Button></nav>}</div>
      </section>
      <section className="card report-top-products" aria-label="Produk terlaris"><div className="card-header"><h2>Produk terlaris</h2></div>{report.products.length?<ol>{report.products.slice(0,10).map(product=><li key={product.key}><div><strong>{product.name}</strong>{product.detail&&<p className="field-hint">{product.detail}</p>}</div><span>{product.quantity} unit</span></li>)}</ol>:<p className="report-plan-note muted">Belum ada produk pada periode ini.</p>}</section>
    </>}
  </div>;
}

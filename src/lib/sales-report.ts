import { orderHpp, orderQuantity, orderRevenue, orderNetSales, isPersonalOrder, personalExpense } from "./finance.ts";
import type { AppData, Batch } from "./types.ts";

export type ReportFilter = { type: Batch["type"]; from: string; to: string; batchId?: string };
export function validReportDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function monthBounds(month: string) {
  const from = `${month}-01`;
  if (!validReportDate(from)) throw new Error("Periode tidak valid.");
  const date = new Date(`${from}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { from, to: date.toISOString().slice(0,10) };
}

export function buildSalesReport(data: AppData, filter: ReportFilter) {
  if (!validReportDate(filter.from) || !validReportDate(filter.to) || filter.from > filter.to) throw new Error("Pilih rentang tanggal yang valid.");
  const batches = data.batches.filter(batch => batch.type === filter.type && (!filter.batchId || batch.id === filter.batchId));
  const batchIds = new Set(batches.map(batch => batch.id));
  const rows = data.orders.filter(order => batchIds.has(order.batchId) && !isPersonalOrder(order) && order.status !== "cancelled" && order.date >= filter.from && order.date <= filter.to).sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).map(order => {
    const revenue = orderRevenue(order);
    // Always allocate shared costs against the full batch, before date filtering.
    const hpp = orderHpp(order, data.orders, data.batches);
    return { order, customer: data.customers.find(customer => customer.id === order.customerId)?.name ?? "Pelanggan", batch: batches.find(batch => batch.id === order.batchId)!.name, revenue, hpp, margin: hpp === null ? null : orderNetSales(order) - hpp, quantity: orderQuantity(order) };
  });
  const summary = rows.reduce((sum,row) => ({ orders: sum.orders + 1, quantity: sum.quantity + row.quantity, revenue: sum.revenue + row.revenue, hpp: sum.hpp + (row.hpp ?? 0), margin: sum.margin + (row.margin ?? 0), unknownCosts: sum.unknownCosts + Number(row.hpp === null), knownRevenue: sum.knownRevenue + (row.hpp === null ? 0 : row.revenue) }), { orders:0, quantity:0, revenue:0, hpp:0, margin:0, unknownCosts:0, knownRevenue:0 });
  const products = new Map<string,{key:string;name:string;detail:string;quantity:number}>();
  const normalized = (value: string) => value.trim().toLocaleLowerCase("id");
  for (const row of rows) for (const item of row.order.items) {
    const parts = [item.product,item.variant,item.color,item.size,item.store ?? ""];
    const key = JSON.stringify(parts.map(normalized));
    const existing = products.get(key);
    if (existing) existing.quantity += item.quantity;
    else products.set(key,{key,name:item.product,detail:[item.variant,item.color,item.size,item.store].filter(Boolean).join(" · "),quantity:item.quantity});
  }
  const personalRows=data.orders.filter(order=>isPersonalOrder(order)&&order.status!=="cancelled"&&batchIds.has(order.batchId)&&order.date>=filter.from&&order.date<=filter.to).map(order=>({...order,batchName:batches.find(batch=>batch.id===order.batchId)!.name}));
  const personalExpenses=personalRows.reduce((sum,order)=>sum+personalExpense(order),0);
  const totalPurchaseCosts=summary.unknownCosts?null:summary.hpp+personalExpenses;
  return { totalPurchaseCosts, personalRows, personalExpenses, filter, batchLabel: filter.batchId ? batches[0]?.name ?? "Batch tidak ditemukan" : "Semua", summary, rows, products:[...products.values()].sort((a,b)=>b.quantity-a.quantity || a.name.localeCompare(b.name,"id")) };
}
export type SalesReport = ReturnType<typeof buildSalesReport>;

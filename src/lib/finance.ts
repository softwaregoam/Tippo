import type { AppData, Batch, MonthlyPoint, MonthSummary, Order, OrderItem } from "./types.ts";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  return rupiah.format(value);
}

export function itemLabel(item: OrderItem): string {
  return [item.product, item.variant, item.color, item.size].filter((value) => value.trim()).join(" · ");
}

export function orderLabel(order: Order): string {
  return order.items.map(itemLabel).join(", ");
}

export function orderQuantity(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function orderSubtotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) + order.serviceFee;
}

export function orderDiscount(order: Order): number {
  const base = orderSubtotal(order), discount = order.discount;
  if (!discount || !Number.isSafeInteger(base) || base < 0 || !Number.isSafeInteger(discount.value) || discount.value < 0) return 0;
  if (discount.type === "amount") return Math.min(base + order.shippingCharge, discount.value);
  if (discount.type !== "percent" || discount.value > 100) return 0;
  return Number((BigInt(base) * BigInt(discount.value) + BigInt(50)) / BigInt(100));
}

/** Product sales plus fee after discount; shipping is a pass-through, never profit.
 * Fixed discounts reduce products/fee first; any excess only discounts shipping.
 */
export function orderNetSales(order: Order): number {
  return Math.max(0, orderSubtotal(order) - orderDiscount(order));
}

export function orderRevenue(order: Order): number {
  return orderSubtotal(order) - orderDiscount(order) + order.shippingCharge;
}

/**
 * Share batch costs by item quantity, across all active orders in the batch.
 * Largest-remainder allocation preserves every rupiah. ID-based ties make the
 * result independent of input order, including after editing or sorting the UI.
 */
export function allocatedBatchCosts(batch: Batch, orders: Order[]): Record<string, number> {
  const activeOrders = orders.filter(
    (order) => order.batchId === batch.id && order.status !== "cancelled" && orderQuantity(order) > 0,
  );
  const totalQuantity = activeOrders.reduce((sum, order) => sum + orderQuantity(order), 0);
  if (!totalQuantity) return {};

  const cost = Math.max(0, Math.round(batch.directCosts));
  const allocations = activeOrders.map((order) => {
    const weightedCost = cost * orderQuantity(order);
    const base = Math.floor(weightedCost / totalQuantity);
    return { id: order.id, base, remainder: weightedCost % totalQuantity };
  });
  const remaining = cost - allocations.reduce((sum, allocation) => sum + allocation.base, 0);
  allocations.sort((a, b) => b.remainder - a.remainder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return Object.fromEntries(
    allocations.map((allocation, index) => [allocation.id, allocation.base + (index < remaining ? 1 : 0)]),
  );
}

export function orderHpp(order: Order, orders: Order[], batches: Batch[]): number | null {
  if (order.status === "cancelled") return 0;
  if (order.items.some((item) => item.unitCost === null)) return null;
  const batch = batches.find((candidate) => candidate.id === order.batchId);
  const batchCost = batch ? (allocatedBatchCosts(batch, orders)[order.id] ?? 0) : 0;
  return order.items.reduce((sum, item) => sum + item.quantity * (item.unitCost ?? 0), 0) + batchCost;
}

export function orderMargin(order: Order, orders: Order[], batches: Batch[]): number | null {
  if (order.status === "cancelled") return 0;
  const hpp = orderHpp(order, orders, batches);
  return hpp === null ? null : orderNetSales(order) - hpp;
}

export function outstanding(order: Order): number {
  return order.status === "cancelled" ? 0 : Math.max(0, orderRevenue(order) - order.paid);
}

export function getMonthSummary(data: AppData, month: string): MonthSummary {
  const summary: MonthSummary = {
    revenue: 0,
    hpp: 0,
    profit: 0,
    received: 0,
    outstanding: 0,
    ordersCount: 0,
    unknownCostCount: 0,
  };

  for (const order of data.orders) {
    if (order.status === "cancelled" || !order.date.startsWith(`${month}-`)) continue;
    const revenue = orderRevenue(order);
    const hpp = orderHpp(order, data.orders, data.batches);
    summary.revenue += revenue;
    summary.received += order.paid;
    summary.outstanding += outstanding(order);
    summary.ordersCount += 1;
    if (hpp === null) {
      summary.unknownCostCount += 1;
    } else {
      summary.hpp += hpp;
      summary.profit += orderNetSales(order) - hpp;
    }
  }
  return summary;
}

export function getMonthlySeries(data: AppData, year: number): MonthlyPoint[] {
  const labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return labels.map((label, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return { month, label, ...getMonthSummary(data, month) };
  });
}

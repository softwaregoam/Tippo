export type BatchType = "jastip" | "po";
export type BatchStatus = "open" | "closed" | "completed";
export type OrderStatus = "new" | "purchased" | "ready" | "shipped" | "done" | "cancelled";

export interface Batch {
  id: string;
  name: string;
  type: BatchType;
  origin: string;
  closeDate: string;
  status: BatchStatus;
  /** Shared purchase costs, in whole rupiah, excluding charges billed to customers. */
  directCosts: number;
  /** Default purchase currency and latest reference quote for new orders. */
  purchaseFx?: Omit<PurchaseFx, "amount" | "status">;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

/** Reusable Open PO catalogue entry. Orders retain their own price and label snapshots. */
export interface Product {
  id: string;
  name: string;
  variant: string;
  sku: string;
  category?: string;
  store?: string;
  color?: string;
  size?: string;
  unitPrice: number;
  /** null means that the purchase cost has not been recorded. */
  unitCost: number | null;
  active: boolean;
}

/** Purchase currency and rate are fixed snapshots; invoice amounts stay in IDR. */
export interface PurchaseFx {
  currency: string;
  amount: string | null;
  rate: string | null;
  status: "estimate" | "final";
  source: "manual" | "frankfurter";
  rateDate?: string;
}

/** One item and its options, recorded as a historical snapshot. */
export interface OrderItem {
  purchaseFx?: PurchaseFx;
  id: string;
  /** Optional link to an Open PO product; archived products remain valid for history. */
  productId?: string | null;
  /** Product label and amounts are snapshots, independent of subsequent catalogue edits. */
  product: string;
  store?: string;
  variant: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  /** null means the purchase cost has not been recorded; zero is a known free item. */
  unitCost: number | null;
}

export interface Order {
  id: string;
  batchId: string;
  customerId: string;
  /** Between one and 100 item snapshots belong to one customer order. */
  items: OrderItem[];
  /** Creation timestamp, separate from the editable transaction date. */
  createdAt: string;
  /** Total service fee for this order, not per unit. */
  serviceFee: number;
  /** Total delivery charge billed to this customer. */
  shippingCharge: number;
  /** Percent discounts exclude shipping; rupiah discounts may cover the entire gross bill. */
  discount?: { type: "amount" | "percent"; value: number };
  /** Net payment retained after recorded refunds. */
  paid: number;
  refunds?: { id: string; amount: number; date: string; reason: string; createdAt: string }[];
  /** Order date in local YYYY-MM-DD format. */
  date: string;
  status: OrderStatus;
  notes: string;
  shippingDate?: string;
  /** Local delivery time in 24-hour HH:mm format. */
  shippingTime?: string;
  shippingMethod?: string;
}

export interface AppData {
  batches: Batch[];
  customers: Customer[];
  products: Product[];
  orders: Order[];
}

export interface MonthSummary {
  /** Booked revenue of all noncancelled orders dated in this month. */
  revenue: number;
  /** HPP subtotal for orders whose purchase cost is known. */
  hpp: number;
  /** Profit subtotal for orders whose purchase cost is known. */
  profit: number;
  /** Payments on these orders; this is not a payment-date cash-flow report. */
  received: number;
  outstanding: number;
  ordersCount: number;
  unknownCostCount: number;
}

export interface MonthlyPoint extends MonthSummary {
  month: string;
  label: string;
}

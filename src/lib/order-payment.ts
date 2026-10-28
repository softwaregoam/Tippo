import { isPersonalOrder, outstanding } from "./finance.ts";
import type { Order } from "./types.ts";

export function addOrderPayment(order: Order, amount: number): Order {
  if (isPersonalOrder(order) || order.status === "cancelled") {
    throw new Error("Pembayaran tidak tersedia untuk pesanan ini.");
  }
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > outstanding(order)) {
    throw new Error("Isi pembayaran lebih dari nol dan tidak melebihi sisa tagihan.");
  }
  return { ...order, paid: order.paid + amount };
}

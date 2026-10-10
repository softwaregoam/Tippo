import type { OrderStatus } from "./types.ts";
/** Preserve legacy records while offering only four statuses. */
export function visibleOrderStatus(status: OrderStatus): "new" | "shipped" | "done" | "cancelled" {
 return status === "purchased" || status === "ready" ? "new" : status;
}

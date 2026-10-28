import type { OrderStatus } from "./types.ts";
/** Keep unfinished legacy statuses readable without rewriting saved records. */
export function visibleOrderStatus(status: OrderStatus): "new" | "done" | "cancelled" {
 return status === "done" || status === "cancelled" ? status : "new";
}

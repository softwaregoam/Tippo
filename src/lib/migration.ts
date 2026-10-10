import type { AppData, Product } from "./types.ts";
import { isAppData, isLegacyAppData, isScalarAppData, LEGACY_ITEM_PREFIX, LEGACY_PRODUCT_PREFIX, type ScalarAppData } from "./validation.ts";

/**
 * Restore the current workspace or its v1/v2 scalar formats without changing any
 * order label, price, cost, payment, date or status. No demo data is introduced.
 */
export function normalizeAppData(value: unknown): AppData | null {
  if (isAppData(value)) return value;
  if (isScalarAppData(value)) return convertScalarOrders(value);
  if (!isLegacyAppData(value)) return null;

  const legacy = structuredClone(value);
  const poBatchIds = new Set(legacy.batches.filter((batch) => batch.type === "po").map((batch) => batch.id));
  const productsByLabel = new Map<string, Product>();
  const orders = legacy.orders.map((order) => {
    if (!poBatchIds.has(order.batchId)) return order;
    let product = productsByLabel.get(order.product);
    if (!product) {
      product = {
        id: `${LEGACY_PRODUCT_PREFIX}${order.id}`,
        name: order.product,
        variant: "",
        sku: "",
        unitPrice: order.unitPrice,
        unitCost: order.unitCost,
        active: true,
      };
      productsByLabel.set(order.product, product);
    }
    return { ...order, productId: product.id };
  });
  return convertScalarOrders({ ...legacy, products: [...productsByLabel.values()], orders });
}

function convertScalarOrders(value: ScalarAppData): AppData | null {
  const scalar = structuredClone(value);
  const normalized: AppData = {
    ...scalar,
    orders: scalar.orders.map((order) => {
      const { productId, product, quantity, unitPrice, unitCost, ...header } = order;
      return {
        ...header,
        // Older versions did not store creation time. Local order midnight is an
        // explicit approximation; future orders retain their real creation time.
        createdAt: `${order.date}T00:00:00+07:00`,
        items: [{ id: `${LEGACY_ITEM_PREFIX}${order.id}`, product, variant: "", color: "", size: "", quantity, unitPrice, unitCost, ...(productId === undefined ? {} : { productId }) }],
      };
    }),
  };
  return isAppData(normalized) ? normalized : null;
}

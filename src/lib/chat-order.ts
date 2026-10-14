import type { AppData, Batch, Product } from "./types.ts";

export type ChatItem = {
  id: string; source: string; productId: string; product: string; quantity: string;
  store: string; variant: string; color: string; size: string; unitPrice: string;
  match: "matched" | "ambiguous" | "missing";
};
export type ChatOrderDraft = {
  customerId: string; customerName: string; customerPhone: string; customerAddress: string;
  items: ChatItem[];
};
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("id").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Deliberately conservative: uncertain matches stay blank for the seller to choose.
export function matchChatProduct(query: string, products: Product[]) {
  const tokens = normalize(query).split(" ").filter(Boolean);
  const candidates = products.filter(product => {
    if (!product.active || !tokens.length) return false;
    const label = normalize([product.name, product.variant, product.color, product.size, product.store, product.sku].filter(Boolean).join(" ")).split(" ");
    return tokens.every(token => label.includes(token));
  });
  return { product: candidates.length === 1 ? candidates[0] : undefined, ambiguous: candidates.length > 1 };
}

export function parseChatOrder(text: string, type: Batch["type"], data: Pick<AppData, "products" | "customers">): ChatOrderDraft {
  if (text.length > 10000) throw new Error("Chat maksimal 10.000 karakter. Pisahkan chat yang lebih panjang.");
  const draft: ChatOrderDraft = { customerId: "", customerName: "", customerPhone: "", customerAddress: "", items: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\[[^\]]+\]\s*[^:]+:\s*/, "").replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, "").trim();
    if (!line) continue;
    const metadata = /^(nama(?: pelanggan)?|pelanggan|wa|whatsapp|no\.?\s*(?:hp|wa)|alamat)\s*:\s*(.+)$/i.exec(line);
    if (metadata) {
      const field = normalize(metadata[1]);
      if (field === "alamat") draft.customerAddress = metadata[2].trim();
      else if (/^(wa|whatsapp|no)/.test(field)) draft.customerPhone = metadata[2].trim();
      else {
        if (draft.customerName && normalize(draft.customerName) !== normalize(metadata[2])) throw new Error("Gunakan satu pelanggan per chat. Pisahkan pesanan pelanggan yang berbeda.");
        draft.customerName = metadata[2].trim();
      }
      continue;
    }
    if (/^(?:(?:halo|hai|kak|terima kasih|makasih|pesanan|order|saya mau pesan|mau pesan)[!.,:\s]*)$/i.test(line)) continue;
    // Quantities must have an explicit marker: x2, 2x, 2 pcs, or jumlah: 2.
    let quantity = "";
    let body = line.replace(/(?:\b(?:jumlah|qty)\s*:\s*([+-]?\d+(?:[.,]\d+)?)\b|(?<![\p{L}\p{N}.,+-])[x×]\s*([+-]?\d+(?:[.,]\d+)?)\b|(?<![\p{L}\p{N}.,+-])([+-]?\d+(?:[.,]\d+)?)\s*[x×](?!\p{L})|(?<![\p{L}\p{N}.,+-])([+-]?\d+(?:[.,]\d+)?)\s*(?:pcs|pc|buah|unit)\b)/iu, (_, ...groups: unknown[]) => {
      const value = String(groups.slice(0, 4).find(value => value !== undefined) ?? "");
      quantity = /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? value : "";
      return "";
    }).trim();
    const fields = { store: "", variant: "", color: "", size: "", unitPrice: "" };
    body = body.replace(/\b(toko|brand|varian|warna|ukuran|harga)\s*:\s*([^;|]+)/gi, (_, key: string, value: string) => {
      const optionFields = { toko: "store", brand: "store", varian: "variant", warna: "color", ukuran: "size", harga: "unitPrice" } as const;
      const field = optionFields[key.toLowerCase() as keyof typeof optionFields];
      fields[field] = value.trim();
      return "";
    });
    if (fields.unitPrice) {
      const price = fields.unitPrice.replace(/^rp\.?\s*/i, "");
      fields.unitPrice = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(price) ? price.replaceAll(".", "") : "";
    }
    let product = body.replace(/^[\s;|,:-]+|[\s;|,:-]+$/g, "").replace(/^(?:(?:saya|aku|mau|tolong|kak)\s+)*(?:pesan|order|beli)\s+/i, "").trim();
    const queryFor = (name: string) => [name, fields.store, fields.variant, fields.color, fields.size].filter(Boolean).join(" ");
    let match = type === "po" ? matchChatProduct(queryFor(product), data.products) : undefined;
    // A bare number is only a quantity when the catalogue confirms the rest.
    // Names such as "Sepatu 42" remain intact when they already match a product.
    if (type === "po" && !quantity && !match?.product && !match?.ambiguous) {
      const bare = /^(.*?)\s+(\d+)$/.exec(product);
      if (bare && Number.isSafeInteger(Number(bare[2])) && Number(bare[2]) > 0) {
        const candidate = matchChatProduct(queryFor(bare[1]), data.products);
        if (candidate.product || candidate.ambiguous) { product = bare[1]; quantity = bare[2]; match = candidate; }
      }
    }
    draft.items.push({ id: crypto.randomUUID(), source: line, productId: match?.product?.id ?? "", product, quantity, ...fields, match: match?.product ? "matched" : match?.ambiguous ? "ambiguous" : "missing" });
  }
  if (!draft.items.length) throw new Error("Belum ada produk yang bisa dibaca. Tulis satu produk per baris, misalnya Roti susu coklat x2.");
  if (draft.items.length > 100) throw new Error("Maksimal 100 baris produk per pesanan. Pisahkan chat menjadi beberapa pesanan.");
  const customers = data.customers.filter(customer => normalize(customer.name) === normalize(draft.customerName));
  draft.customerId = draft.customerName ? (customers.length === 1 ? customers[0].id : "new") : "";
  return draft;
}

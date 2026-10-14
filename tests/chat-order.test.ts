import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChatOrder, matchChatProduct } from "../src/lib/chat-order.ts";
import type { Product } from "../src/lib/types.ts";
const products: Product[] = [
  { id: "choc", name: "Roti Susu", variant: "Coklat", sku: "RSC", active: true, unitPrice: 25000, unitCost: 12000 },
  { id: "cheese", name: "Roti Susu", variant: "Keju", sku: "RSK", active: true, unitPrice: 30000, unitCost: 15000 },
  { id: "old", name: "Kopi", variant: "", sku: "OLD", active: false, unitPrice: 5000, unitCost: null },
];
const data = { products, customers: [{ id: "aly", name: "Alya", phone: "" }] };

test("chat matches unique active catalogue choices and preserves uncertain lines without inventing quantity", () => {
  const draft = parseChatOrder("Nama: Alya\nWA: 08123456789\n1. Roti susu coklat x2\n- Roti susu 3 pcs\nKopi x1\nRSC", "po", data);
  assert.equal(draft.customerId, "aly");
  assert.equal(draft.customerPhone, "08123456789");
  assert.deepEqual(draft.items.map(item => [item.productId, item.quantity, item.match]), [["choc", "2", "matched"], ["", "3", "ambiguous"], ["", "1", "missing"], ["choc", "", "matched"]]);
  assert.equal(matchChatProduct("Roti susu stroberi", products).product, undefined);
  assert.equal(matchChatProduct("", products).product, undefined);
});

test("jastip extracts explicit options and rupiah price while keeping model numbers out of quantity", () => {
  const draft = parseChatOrder("Nama: Bima\nAlamat: Bandung\nKaos x2; toko: Uniqlo; warna: Hitam; ukuran: XL; varian: Airism; harga: Rp150.000\nSepatu 42\nKaos 2XL", "jastip", data);
  assert.equal(draft.customerId, "new");
  assert.equal(draft.customerAddress, "Bandung");
  assert.equal(draft.items[0].product, "Kaos");
  assert.equal(draft.items[0].store, "Uniqlo");
  assert.equal(draft.items[0].color, "Hitam");
  assert.equal(draft.items[0].size, "XL");
  assert.equal(draft.items[0].variant, "Airism");
  assert.equal(draft.items[0].unitPrice, "150000");
  assert.equal(draft.items[1].quantity, "");
  assert.equal(draft.items[2].quantity, "");
});

test("reader handles WA prefix, leaves unusual amounts for review, and never auto-selects duplicate customers", () => {
  const draft = parseChatOrder("[14/10/2026, 09:00] Alya: Nama: Alya\n2x Roti susu keju\nKaos jumlah: 1.5; harga: 20rb", "po", { ...data, customers: [...data.customers, { id: "other", name: "Alya", phone: "" }] });
  assert.equal(draft.customerId, "new");
  assert.equal(draft.items[0].productId, "cheese");
  assert.equal(draft.items[0].quantity, "2");
  assert.equal(draft.items[1].quantity, "");
  assert.equal(draft.items[1].unitPrice, "");
});

test("chat is bounded, rejects mixed customers and gives every draft globally unique item IDs", () => {
  assert.throws(() => parseChatOrder("Nama: Alya\nHalo", "po", data), /Belum ada produk/);
  assert.throws(() => parseChatOrder("a".repeat(10001), "po", data), /10.000/);
  assert.throws(() => parseChatOrder(Array(101).fill("RSC x1").join("\n"), "po", data), /100 baris/);
  assert.throws(() => parseChatOrder("Nama: Alya\nRSC x1\nNama: Bima\nRSK x1", "po", data), /satu pelanggan/);
  const ids = Array.from({ length: 2 }, () => parseChatOrder("RSC x1\nRSK x2", "po", data)).flatMap(draft => draft.items.map(item => item.id));
  assert.equal(new Set(ids).size, 4);
  assert.ok(ids.every(id => /^[0-9a-f-]{36}$/.test(id)));
});

test("ambiguous or signed quantity formats stay empty rather than silently changing the amount", () => {
  const draft = parseChatOrder("RSC -2 pcs\nRSC x-2\nRSC jumlah: 1.000\nRSC ×2", "po", data);
  assert.deepEqual(draft.items.map(item => item.quantity), ["", "", "", "2"]);
});


test("catalogue confirms a bare trailing quantity while numbered product names remain intact", () => {
  const workspace = { ...data, products: [...products, { ...products[0], id: "shoe", name: "Sepatu 42", variant: "", sku: "S42" }] };
  const draft = parseChatOrder("Aku mau pesan roti susu coklat 2\nSepatu 42", "po", workspace);
  assert.equal(draft.items[0].quantity, "2");
  assert.equal(draft.items[0].productId, "choc");
  assert.equal(draft.items[1].productId, "shoe");
  assert.equal(draft.items[1].quantity, "");
});

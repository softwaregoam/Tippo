import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildImport, createOrderTemplate, previewOrderImport } from "../src/lib/excel-import.ts";
import type { AppData } from "../src/lib/types.ts";

const JASTIP = ["nama_pelanggan", "telepon", "produk", "jumlah", "harga_jual", "harga_beli", "fee_jastip", "ongkir", "dp", "tanggal", "catatan"];
const PO = ["nama_pelanggan", "telepon", "sku_produk", "produk", "varian", "jumlah", "ongkir", "dp", "tanggal", "catatan"];
const MULTI_JASTIP = ["nomor_pesanan", "nama_pelanggan", "telepon", "produk", "varian", "warna", "ukuran", "toko_brand", "jumlah", "harga_jual", "harga_beli", "fee_jastip", "ongkir", "dp", "tanggal", "catatan"];
const MULTI_PO = ["nomor_pesanan", ...PO];

function workspace(): AppData {
  return {
    batches: [
      { id: "jastip", name: "Jastip Aktif", type: "jastip", origin: "Tokyo", closeDate: "2026-10-20", status: "open", directCosts: 100 },
      { id: "po", name: "PO Aktif", type: "po", origin: "Bandung", closeDate: "2026-10-20", status: "open", directCosts: 100 },
      { id: "closed", name: "PO Lama", type: "po", origin: "Bandung", closeDate: "2026-10-01", status: "closed", directCosts: 0 },
    ],
    customers: [{ id: "ayu", name: "Ayu", phone: "08123456789" }],
    products: [
      { id: "kaos", name: "Kaos", variant: "L", sku: "KAOS-L", unitPrice: 1000, unitCost: 600, active: true },
      { id: "tote", name: "Tote", variant: "", sku: "TOTE", unitPrice: 1500, unitCost: null, active: true },
      { id: "old", name: "Produk lama", variant: "", sku: "OLD", unitPrice: 1000, unitCost: 500, active: false },
    ],
    orders: [{ id: "history", batchId: "po", customerId: "ayu", items: [{ id: "history-item", productId: "kaos", product: "Kaos", variant: "L", color: "", size: "", quantity: 1, unitPrice: 900, unitCost: 500 }], createdAt: "2026-10-01T00:00:00.000Z", serviceFee: 0, shippingCharge: 0, paid: 900, date: "2026-10-01", status: "done", notes: "Harga lama" }],
  };
}

async function bytes(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
}

async function workbookBuffer(headers: string[], rows: ExcelJS.CellValue[][], date1904 = false) {
  const workbook = new ExcelJS.Workbook();
  workbook.properties.date1904 = date1904;
  const sheet = workbook.addWorksheet("Pesanan");
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return bytes(workbook);
}

function jastipRow(overrides: Record<string, ExcelJS.CellValue> = {}) {
  const values: Record<string, ExcelJS.CellValue> = { nama_pelanggan: "Ayu", telepon: "08123456789", produk: "Matcha", jumlah: 2, harga_jual: 1000, harga_beli: 500, fee_jastip: 100, ongkir: 200, dp: 500, tanggal: "2026-10-08", catatan: "Hijau" };
  return JASTIP.map((header) => header in overrides ? overrides[header] : values[header]);
}

function poRow(overrides: Record<string, ExcelJS.CellValue> = {}) {
  const values: Record<string, ExcelJS.CellValue> = { nama_pelanggan: "Ayu", telepon: "08123456789", sku_produk: "KAOS-L", produk: "", varian: "", jumlah: 2, ongkir: 200, dp: 1000, tanggal: "2026-10-08", catatan: "" };
  return PO.map((header) => header in overrides ? overrides[header] : values[header]);
}

function multiJastipRow(overrides: Record<string, ExcelJS.CellValue> = {}) {
  const values: Record<string, ExcelJS.CellValue> = { ...Object.fromEntries(JASTIP.map((header, index) => [header, jastipRow()[index]])), nomor_pesanan: "J-001", varian: "Original", warna: "Hijau", ukuran: "L", ...overrides };
  return MULTI_JASTIP.map((header) => values[header]);
}

test("same order number groups different Jastip items and counts fees, shipping and DP once", async () => {
  const data = workspace();
  const preview = await previewOrderImport(await workbookBuffer(MULTI_JASTIP, [
    multiJastipRow({ dp: 2500 }),
    multiJastipRow({ produk: "Kue", harga_jual: 500, varian: "Pedas", warna: "", ukuran: "", dp: 2500 }),
  ]), "jastip", "jastip", data);
  assert.equal(preview.rowCount, 1);
  assert.equal(preview.sourceRowCount, 2);
  assert.equal(preview.validCount, 1);
  assert.equal(preview.rows[0].total, 3300);
  assert.equal(preview.rows[0].quantity, 4);
  assert.deepEqual(preview.rows[0].rowNumbers, [2, 3]);
  const imported = buildImport(preview, data);
  assert.equal(imported.orders.length, 1);
  const order = imported.orders[0];
  assert.equal(order.items.length, 2);
  assert.equal(order.serviceFee, 100);
  assert.equal(order.shippingCharge, 200);
  assert.equal(order.paid, 2500);
  assert.deepEqual([order.items[0].variant, order.items[0].color, order.items[0].size], ["Original", "Hijau", "L"]);
  assert.equal(order.items[1].product, "Kue");
  assert.notEqual(order.items[0].id, order.items[1].id);
  assert.match(order.items[0].id, /^item-/);
});

test("continuation rows inherit order fields while blank numbers keep rows separate", async () => {
  const data = workspace();
  const blankShared = { nama_pelanggan: null, telepon: null, tanggal: null, fee_jastip: null, ongkir: null, dp: null, catatan: null };
  const preview = await previewOrderImport(await workbookBuffer(MULTI_JASTIP, [
    multiJastipRow(), multiJastipRow({ ...blankShared, produk: "Roti" }),
    multiJastipRow({ nomor_pesanan: null }), multiJastipRow({ nomor_pesanan: null }),
  ]), "jastip", "jastip", data);
  assert.equal(preview.rowCount, 3);
  assert.equal(preview.validCount, 3);
  const imported = buildImport(preview, data);
  assert.deepEqual(imported.orders.map((order) => order.items.length), [2, 1, 1]);
  assert.equal(imported.orders[0].serviceFee, 100);
  assert.equal(imported.orders[0].paid, 500);
});

test("grouped PO items take separate master snapshots and reject changes to any master", async () => {
  const data = workspace();
  const preview = await previewOrderImport(await workbookBuffer(MULTI_PO, [
    ["PO-1", ...poRow()], ["PO-1", ...poRow({ sku_produk: "TOTE", jumlah: 1 })],
  ]), "po", "po", data);
  assert.equal(preview.validCount, 1);
  assert.equal(preview.rows[0].total, 3700);
  const built = buildImport(preview, data);
  assert.deepEqual(built.orders[0].items.map((item) => item.productId), ["kaos", "tote"]);
  assert.deepEqual(built.orders[0].items.map((item) => item.unitCost), [600, null]);
  const changed = structuredClone(data);
  changed.products[1].unitPrice += 1;
  assert.throws(() => buildImport(preview, changed), /master produk berubah/);
});

test("conflicting shared values invalidate a grouped order and every error identifies its Excel row", async () => {
  const data = workspace();
  for (const [header, changed] of Object.entries({ nama_pelanggan: "Budi", telepon: "08111111111", tanggal: "2026-10-09", fee_jastip: 200, ongkir: 300, dp: 700, catatan: "Biru" })) {
    const preview = await previewOrderImport(await workbookBuffer(MULTI_JASTIP, [multiJastipRow(), multiJastipRow({ [header]: changed })]), "jastip", "jastip", data);
    assert.equal(preview.validCount, 0, header);
    assert.match(preview.rows[0].errors.join(" "), new RegExp(`Baris 3: ${header} berbeda`));
    assert.throws(() => buildImport(preview, data));
  }
  const overpaid = await previewOrderImport(await workbookBuffer(MULTI_JASTIP, [multiJastipRow({ dp: 5000 }), multiJastipRow({ dp: 5000 })]), "jastip", "jastip", data);
  assert.match(overpaid.rows[0].errors.join(" "), /dp tidak boleh melebihi total/);
});

test("100 item group limit and globally unique preview IDs protect atomic validation", async () => {
  const data = workspace();
  const tooMany = await previewOrderImport(await workbookBuffer(MULTI_JASTIP, Array.from({ length: 101 }, () => multiJastipRow())), "jastip", "jastip", data);
  assert.match(tooMany.rows[0].errors.join(" "), /100 produk/);
  assert.throws(() => buildImport(tooMany, data));
  data.orders[0].items[0].id = "excel-preview-item-2-0";
  const preview = await previewOrderImport(await workbookBuffer(MULTI_JASTIP, [multiJastipRow(), multiJastipRow()]), "jastip", "jastip", data);
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.validCount, 1);
  const ids = buildImport(preview, data).orders[0].items.map((item) => item.id);
  assert.equal(new Set(ids).size, 2);
  assert.ok(!ids.includes(data.orders[0].items[0].id));
});

test("downloaded Jastip and PO templates round-trip with explicit sample protection", async () => {
  for (const type of ["jastip", "po"] as const) {
    const data = workspace();
    const template = await createOrderTemplate(type, data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(template).buffer);
    const sheet = workbook.getWorksheet("Pesanan")!;
    const headerValues = sheet.getRow(1).values;
    assert.ok(Array.isArray(headerValues));
    assert.deepEqual(headerValues.slice(1), type === "po" ? MULTI_PO : MULTI_JASTIP);
    assert.ok(workbook.getWorksheet("Panduan"));
    if (type === "po") assert.equal(workbook.getWorksheet("Produk")!.rowCount, 3);
    const sample = await previewOrderImport(await bytes(workbook), type, type, data);
    assert.match(sample.rows[0].errors.join(" "), /baris contoh/);
    assert.throws(() => buildImport(sample, data));
    const customerColumn = (type === "po" ? MULTI_PO : MULTI_JASTIP).indexOf("nama_pelanggan") + 1;
    for (let row = 2; row <= sheet.rowCount; row += 1) sheet.getRow(row).getCell(customerColumn).value = "CONTOH \u2014 ganti nama pelanggan";
    const legacySample = await previewOrderImport(await bytes(workbook), type, type, data);
    assert.match(legacySample.rows[0].errors.join(" "), /baris contoh/);
    assert.throws(() => buildImport(legacySample, data));
    for (let row = 2; row <= sheet.rowCount; row += 1) sheet.getRow(row).getCell(customerColumn).value = "Pelanggan Baru";
    const preview = await previewOrderImport(await bytes(workbook), type, type, data);
    assert.equal(preview.validCount, 1);
    assert.deepEqual(preview.errors, []);
    const built = buildImport(preview, data);
    assert.equal(built.orders.length, 1);
    assert.equal(built.customers.length, 1);
    assert.equal(built.orders[0].customerId, built.customers[0].id);
    assert.equal(built.orders[0].status, "new");
    assert.equal(built.orders[0].items.length, 2);
    assert.ok(Number.isFinite(new Date(built.orders[0].createdAt).valueOf()));
  }
});

test("Jastip imports native rupiah and reuses customers without rewriting history", async () => {
  const data = workspace();
  const before = structuredClone(data);
  const buffer = await workbookBuffer(JASTIP, [jastipRow({ telepon: "+62 812-3456-789" }), jastipRow({ nama_pelanggan: "Nadia", telepon: "", harga_beli: null }), jastipRow({ nama_pelanggan: "Nadia", telepon: "", harga_beli: 0 })]);
  const preview = await previewOrderImport(buffer, "jastip", "jastip", data);
  assert.equal(preview.validCount, 3);
  assert.equal(preview.rows[0].total, 2300);
  const built = buildImport(preview, data);
  assert.equal(built.customers.length, 1);
  assert.equal(built.orders[0].customerId, "ayu");
  assert.equal(built.orders[1].customerId, built.orders[2].customerId);
  assert.equal(built.orders[1].items[0].unitCost, null);
  assert.equal(built.orders[2].items[0].unitCost, 0);
  assert.deepEqual(data, before);
});

test("PO uses current master snapshots via SKU or exact name and variant", async () => {
  const data = workspace();
  const preview = await previewOrderImport(await workbookBuffer(PO, [poRow(), poRow({ sku_produk: "", produk: "Tote", varian: "", jumlah: 1, dp: 1000 })]), "po", "po", data);
  assert.equal(preview.validCount, 2);
  const built = buildImport(preview, data);
  assert.equal(built.orders[0].items[0].productId, "kaos");
  assert.equal(built.orders[0].items[0].product, "Kaos");
  assert.equal(built.orders[0].items[0].variant, "L");
  assert.equal(built.orders[0].items[0].unitPrice, 1000);
  assert.equal(built.orders[0].items[0].unitCost, 600);
  assert.equal(built.orders[0].serviceFee, 0);
  assert.equal(built.orders[1].items[0].productId, "tote");
  assert.equal(built.orders[1].items[0].unitCost, null);
  assert.equal(data.orders[0].items[0].unitPrice, 900);
  const forbidden = await previewOrderImport(await workbookBuffer([...PO, "harga_jual"], [[...poRow(), 1]]), "po", "po", data);
  assert.match(forbidden.errors.join(" "), /harga_jual/);
  assert.throws(() => buildImport(forbidden, data));
});

test("unknown, archived, contradictory or ambiguous product matches reject atomically", async () => {
  const data = workspace();
  data.products.push({ ...data.products[0], id: "duplicate" });
  const preview = await previewOrderImport(await workbookBuffer(PO, [
    poRow(), poRow({ sku_produk: "OLD" }), poRow({ sku_produk: "missing" }),
    poRow({ sku_produk: "TOTE", produk: "Kaos" }), poRow({ sku_produk: "", produk: "Kaos", varian: "L" }),
  ]), "po", "po", data);
  assert.equal(preview.validCount, 0);
  assert.match(preview.rows[0].errors.join(" "), /ambigu/);
  assert.match(preview.rows[1].errors.join(" "), /master aktif/);
  assert.match(preview.rows[3].errors.join(" "), /berbeda/);
  assert.throws(() => buildImport(preview, data));
});

test("bad money, unsafe totals, formulas, invalid dates and excess DP never partially import", async () => {
  const data = workspace();
  const rows = [jastipRow(),
    jastipRow({ jumlah: 0 }), jastipRow({ harga_jual: 1.5 }), jastipRow({ harga_jual: "1.000" }),
    jastipRow({ dp: 9999 }), jastipRow({ tanggal: "2026-02-30" }),
    jastipRow({ harga_jual: { formula: "1+999", result: 1000 } }),
    jastipRow({ telepon: 8123456789 }),
    jastipRow({ jumlah: 2, harga_jual: Number.MAX_SAFE_INTEGER, dp: 0 }),
    jastipRow({ jumlah: 2, harga_jual: 0, harga_beli: Number.MAX_SAFE_INTEGER, dp: 0 }),
  ];
  const preview = await previewOrderImport(await workbookBuffer(JASTIP, rows), "jastip", "jastip", data);
  assert.equal(preview.validCount, 1);
  assert.equal(preview.rows.filter((row) => row.errors.length).length, rows.length - 1);
  assert.match(preview.rows[6].errors.join(" "), /formula/);
  assert.match(preview.rows[7].errors.join(" "), /teks/);
  const before = structuredClone(data);
  assert.throws(() => buildImport(preview, data));
  assert.deepEqual(data, before);
});

test("Excel date objects and both serial calendars are read correctly", async () => {
  const data = workspace();
  const preview = await previewOrderImport(await workbookBuffer(JASTIP, [jastipRow({ tanggal: new Date("2026-10-08T00:00:00Z") }), jastipRow({ tanggal: 61 }), jastipRow({ tanggal: 60 })]), "jastip", "jastip", data);
  assert.equal(preview.rows[0].normalized?.date, "2026-10-08");
  assert.equal(preview.rows[1].normalized?.date, "1900-03-01");
  assert.match(preview.rows[2].errors.join(" "), /nomor seri/);
  const older = await previewOrderImport(await workbookBuffer(JASTIP, [jastipRow({ tanggal: 0 })], true), "jastip", "jastip", data);
  assert.equal(older.rows[0].normalized?.date, "1904-01-01");
});

test("ambiguous customers and name/phone conflicts are shown per row", async () => {
  const data = workspace();
  data.customers.push({ id: "ayu-other", name: "Ayu", phone: "08222222222" });
  const preview = await previewOrderImport(await workbookBuffer(JASTIP, [
    jastipRow({ telepon: "" }), jastipRow({ nama_pelanggan: "Budi" }),
    jastipRow({ telepon: "08333333333" }), jastipRow(),
  ]), "jastip", "jastip", data);
  assert.equal(preview.validCount, 1);
  assert.match(preview.rows[0].errors.join(" "), /beberapa pelanggan/);
  assert.match(preview.rows[1].errors.join(" "), /nama berbeda/);
  assert.match(preview.rows[2].errors.join(" "), /telepon berbeda/);
  assert.throws(() => buildImport(preview, data));
});

test("confirmation revalidates closed batches, master changes and customer changes", async () => {
  const data = workspace();
  const preview = await previewOrderImport(await workbookBuffer(PO, [poRow()]), "po", "po", data);
  assert.equal(preview.validCount, 1);
  const priceChanged = structuredClone(data);
  priceChanged.products[0].unitPrice = 1200;
  assert.throws(() => buildImport(preview, priceChanged), /master produk berubah/);
  const archived = structuredClone(data);
  archived.products[0].active = false;
  assert.throws(() => buildImport(preview, archived), /master aktif/);
  const closed = structuredClone(data);
  closed.batches[1].status = "closed";
  assert.throws(() => buildImport(preview, closed), /ditutup/);
  const changedCustomer = structuredClone(data);
  changedCustomer.customers[0].name = "Nama berbeda";
  assert.throws(() => buildImport(preview, changedCustomer), /nama berbeda/);
});

test("combined financial overflow is rejected even when individual rows are safe", async () => {
  const data = workspace();
  data.batches[0].directCosts = Number.MAX_SAFE_INTEGER - 1000;
  const preview = await previewOrderImport(await workbookBuffer(JASTIP, [jastipRow({ jumlah: 2, harga_jual: 0, harga_beli: 0, dp: 0, fee_jastip: 0, ongkir: 0 })]), "jastip", "jastip", data);
  assert.match(preview.errors.join(" "), /Gabungan data/);
  assert.throws(() => buildImport(preview, data));
});

test("file, row, header and target batch limits produce readable blockers", async () => {
  const data = workspace();
  const corrupted = await previewOrderImport(new TextEncoder().encode("not an xlsx").buffer, "jastip", "jastip", data);
  assert.match(corrupted.errors.join(" "), /tidak dapat dibaca/);
  const large = await previewOrderImport(new ArrayBuffer(5 * 1024 * 1024 + 1), "jastip", "jastip", data);
  assert.match(large.errors.join(" "), /5 MB/);
  const many = await previewOrderImport(await workbookBuffer(JASTIP, Array.from({ length: 1001 }, () => jastipRow())), "jastip", "jastip", data);
  assert.match(many.errors.join(" "), /1.000/);
  const missing = await previewOrderImport(await workbookBuffer(["produk"], [["Matcha"]]), "jastip", "jastip", data);
  assert.match(missing.errors.join(" "), /Kolom wajib/);
  const duplicate = await previewOrderImport(await workbookBuffer([...JASTIP, "produk"], [[...jastipRow(), "Other"]]), "jastip", "jastip", data);
  assert.match(duplicate.errors.join(" "), /lebih dari sekali/);
  const wrongType = await previewOrderImport(await workbookBuffer(PO, [poRow()]), "po", "jastip", data);
  assert.match(wrongType.errors.join(" "), /sesuai/);
  const closed = await previewOrderImport(await workbookBuffer(PO, [poRow()]), "po", "closed", data);
  assert.match(closed.errors.join(" "), /ditutup/);
});

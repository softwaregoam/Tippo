import type { CellValue, Worksheet } from "exceljs";
import type { AppData, BatchType, Customer, Order, OrderItem, Product } from "./types.ts";
import { isAppData } from "./validation.ts";

const MAX_ROWS = 1000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ITEMS = 100;
const EXAMPLE_CUSTOMER = "CONTOH, ganti nama pelanggan";
const JASTIP_HEADERS = ["nomor_pesanan", "nama_pelanggan", "telepon", "produk", "varian", "warna", "ukuran", "jumlah", "harga_jual", "harga_beli", "fee_jastip", "ongkir", "dp", "tanggal", "catatan"];
const PO_HEADERS = ["nomor_pesanan", "nama_pelanggan", "telepon", "sku_produk", "produk", "varian", "jumlah", "ongkir", "dp", "tanggal", "catatan"];

export interface NormalizedImportItem {
  rowNumber: number;
  /** Original lookup fields are retained so confirmation can revalidate the current master. */
  sku: string;
  productName: string;
  variant: string;
  color: string;
  size: string;
  productId: string | null;
  product: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
}

export interface NormalizedImportRow {
  orderNumber: string;
  customerName: string;
  phone: string;
  items: NormalizedImportItem[];
  serviceFee: number;
  shippingCharge: number;
  paid: number;
  date: string;
  notes: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  rowNumbers: number[];
  orderNumber: string;
  customer: string;
  product: string;
  quantity: number | null;
  total: number | null;
  errors: string[];
  normalized?: NormalizedImportRow;
}

export interface ImportPreview {
  type: BatchType;
  batchId: string;
  rows: ImportPreviewRow[];
  errors: string[];
  rowCount: number;
  sourceRowCount: number;
  validCount: number;
}

type SourceRow = Record<string, string | number | null>;

function todayJakarta() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

/** Excel's 1900 calendar includes a fictitious leap day; serial 60 is not a valid date. */
function serialDate(value: number, date1904: boolean): string | null {
  if (!Number.isSafeInteger(value) || value < (date1904 ? 0 : 1) || value > 2958465) return null;
  if (!date1904 && value === 60) return null;
  const epoch = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31);
  const adjusted = value - (!date1904 && value > 60 ? 1 : 0);
  const date = new Date(epoch + adjusted * 86400000);
  const result = date.toISOString().slice(0, 10);
  return validDate(result) ? result : null;
}

function blank(value: CellValue) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function readCell(value: CellValue, header: string, date1904: boolean, errors: string[]): string | number | null {
  if (value == null || blank(value)) return null;
  if (value instanceof Date) {
    if (header === "tanggal" && Number.isFinite(value.valueOf())) return value.toISOString().slice(0, 10);
    errors.push(`${header}: gunakan teks atau angka biasa.`);
    return null;
  }
  if (typeof value === "object") {
    errors.push("formula" in value || "sharedFormula" in value
      ? `${header}: formula tidak boleh diimpor; tempel hasilnya sebagai nilai.`
      : `${header}: jenis sel tidak didukung; gunakan teks atau angka biasa.`);
    return null;
  }
  if (typeof value === "boolean") {
    errors.push(`${header}: gunakan teks atau angka biasa.`);
    return null;
  }
  if (header === "tanggal" && typeof value === "number") {
    const date = serialDate(value, date1904);
    if (!date) errors.push("tanggal: nomor seri Excel tidak valid; gunakan YYYY-MM-DD.");
    return date;
  }
  return typeof value === "string" ? value.trim() : value;
}

function stringField(source: SourceRow, header: string, errors: string[], required = false, max = 4000) {
  const value = source[header];
  if (value == null || value === "") {
    if (required) errors.push(`${header}: wajib diisi.`);
    return "";
  }
  if (typeof value !== "string") {
    errors.push(`${header}: harus berupa teks${header === "telepon" ? " agar angka 0 di depan tetap tersimpan" : ""}.`);
    return "";
  }
  if (value.length > max) errors.push(`${header}: maksimal ${max} karakter.`);
  return value.trim();
}

function integerField(source: SourceRow, header: string, errors: string[], required = false, nullable = false): number | null {
  const value = source[header];
  if (value == null || value === "") {
    if (required) errors.push(`${header}: wajib diisi.`);
    return nullable ? null : 0;
  }
  const number = typeof value === "number" ? value : /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 0) {
    errors.push(`${header}: gunakan angka bulat minimal 0, tanpa pemisah ribuan.`);
    return null;
  }
  return number;
}

function findProduct(sku: string, name: string, variant: string, data: AppData, errors: string[]) {
  const active = data.products.filter((product) => product.active);
  const matches = sku ? active.filter((product) => product.sku === sku) : active.filter((product) => product.name === name && product.variant === variant);
  if (!sku && !name) {
    errors.push("Isi sku_produk atau produk dan varian yang sesuai master.");
    return undefined;
  }
  if (!matches.length) {
    errors.push("Produk tidak ditemukan pada master aktif; cek SKU atau nama dan varian.");
    return undefined;
  }
  if (matches.length !== 1) {
    errors.push("Produk ambigu pada master; gunakan SKU atau nama dan varian yang unik.");
    return undefined;
  }
  const product = matches[0];
  if (sku && ((name && name !== product.name) || (variant && variant !== product.variant))) {
    errors.push("Nama atau varian produk berbeda dengan SKU pada master.");
    return undefined;
  }
  return product;
}

type SourceEntry = { source: SourceRow; rowNumber: number; errors: string[] };
const ORDER_FIELDS = ["nama_pelanggan", "telepon", "fee_jastip", "ongkir", "dp", "tanggal", "catatan"];

function orderNumber(source: SourceRow, errors: string[]) {
  const value = source.nomor_pesanan;
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && value >= 0) return String(value);
    errors.push("nomor_pesanan: gunakan teks atau angka bulat minimal 0.");
    return "";
  }
  if (value.length > 100) errors.push("nomor_pesanan: maksimal 100 karakter.");
  return value.trim();
}

function addRowErrors(target: string[], rowNumber: number, errors: string[]) {
  target.push(...errors.map((message) => `Baris ${rowNumber}: ${message}`));
}

function sameOrderField(header: string, first: string | number, next: string | number) {
  if (["fee_jastip", "ongkir", "dp"].includes(header)) {
    const parse = (value: string | number) => typeof value === "number" ? value : /^\d+$/.test(value) ? Number(value) : value;
    return parse(first) === parse(next);
  }
  if (header === "nama_pelanggan" && typeof first === "string" && typeof next === "string") return nameKey(first) === nameKey(next);
  if (header === "telepon" && typeof first === "string" && typeof next === "string") return phoneKey(first) === phoneKey(next);
  return first === next;
}

/** Shared order-level fields occur once; blank continuation cells inherit the first value. */
function validateGroup(entries: SourceEntry[], number: string, type: BatchType, data: AppData): ImportPreviewRow {
  const firstRow = entries[0].rowNumber;
  const errors: string[] = [];
  const common: SourceRow = {};
  for (const entry of entries) {
    addRowErrors(errors, entry.rowNumber, entry.errors);
    for (const header of ORDER_FIELDS) {
      const value = entry.source[header];
      if (value == null || value === "") continue;
      if (common[header] == null) common[header] = value;
      else if (!sameOrderField(header, common[header]!, value)) errors.push(`Baris ${entry.rowNumber}: ${header} berbeda untuk nomor_pesanan ${number}. Samakan nilainya atau kosongkan pada baris lanjutan.`);
    }
  }
  const commonErrors: string[] = [];
  const customerName = stringField(common, "nama_pelanggan", commonErrors, true, 120);
  const phone = stringField(common, "telepon", commonErrors, false, 30);
  const serviceFee = type === "po" ? 0 : integerField(common, "fee_jastip", commonErrors);
  const shippingCharge = integerField(common, "ongkir", commonErrors);
  const paid = integerField(common, "dp", commonErrors);
  const date = stringField(common, "tanggal", commonErrors, true);
  const notes = stringField(common, "catatan", commonErrors, false, 1000);
  if (date && !validDate(date)) commonErrors.push("tanggal: gunakan tanggal valid dengan format YYYY-MM-DD.");
  if (customerName === EXAMPLE_CUSTOMER || customerName === "CONTOH \u2014 ganti nama pelanggan") commonErrors.push("Ganti atau hapus baris contoh sebelum mengimpor.");
  if (entries.length > MAX_ITEMS) commonErrors.push("Maksimal 100 barang dalam satu pesanan.");
  addRowErrors(errors, firstRow, commonErrors);
  const items: NormalizedImportItem[] = [];
  const labels: string[] = [];
  let totalQuantity = 0, subtotal = 0;
  for (const { source, rowNumber } of entries) {
    const itemErrors: string[] = [];
    const productName = stringField(source, "produk", itemErrors, type === "jastip");
    const sku = type === "po" ? stringField(source, "sku_produk", itemErrors) : "";
    const variant = stringField(source, "varian", itemErrors, false, type === "po" ? 4000 : 80);
    const color = type === "jastip" ? stringField(source, "warna", itemErrors, false, 80) : "";
    const size = type === "jastip" ? stringField(source, "ukuran", itemErrors, false, 80) : "";
    const quantity = integerField(source, "jumlah", itemErrors, true);
    if (quantity !== null && quantity < 1) itemErrors.push("jumlah: minimal 1.");
    const master = type === "po" ? findProduct(sku, productName, variant, data, itemErrors) : undefined;
    const unitPrice = type === "po" ? master?.unitPrice ?? null : integerField(source, "harga_jual", itemErrors, true);
    const unitCost = type === "po" ? master?.unitCost ?? null : integerField(source, "harga_beli", itemErrors, false, true);
    const product = master ? master.name : productName;
    const snapshotVariant = master ? master.variant : variant;
    labels.push([product, snapshotVariant, color, size].filter(Boolean).join(" · "));
    if (quantity !== null && unitPrice !== null && !Number.isSafeInteger(quantity * unitPrice)) itemErrors.push("Total harga jual terlalu besar untuk dihitung dengan aman.");
    if (quantity !== null && unitCost !== null && !Number.isSafeInteger(quantity * unitCost)) itemErrors.push("Total harga beli terlalu besar untuk dihitung dengan aman.");
    addRowErrors(errors, rowNumber, itemErrors);
    if (quantity !== null) totalQuantity += quantity;
    if (quantity !== null && unitPrice !== null) subtotal += quantity * unitPrice;
    if (!itemErrors.length && quantity !== null && unitPrice !== null) items.push({ rowNumber, sku, productName, variant: snapshotVariant, color, size, productId: master?.id ?? null, product, quantity, unitPrice, unitCost });
  }
  const amount = serviceFee !== null && shippingCharge !== null ? subtotal + serviceFee + shippingCharge : null;
  const total = amount !== null && Number.isSafeInteger(amount) ? amount : null;
  if (total === null || !Number.isSafeInteger(totalQuantity)) errors.push(`Baris ${firstRow}: Total pesanan terlalu besar untuk dihitung dengan aman.`);
  if (total !== null && paid !== null && paid > total) errors.push(`Baris ${firstRow}: dp tidak boleh melebihi total tagihan.`);
  const row: ImportPreviewRow = { rowNumber: firstRow, rowNumbers: entries.map((entry) => entry.rowNumber), orderNumber: number, customer: customerName, product: labels.join("; "), quantity: Number.isSafeInteger(totalQuantity) ? totalQuantity : null, total, errors };
  if (!errors.length && serviceFee !== null && shippingCharge !== null && paid !== null) row.normalized = { orderNumber: number, customerName, phone, items, serviceFee, shippingCharge, paid, date, notes };
  return row;
}

function nameKey(name: string) { return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID"); }
function phoneKey(phone: string) {
  const digits = phone.replace(/[\s()+.\-]/g, "");
  return digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
}

/** Reuse IDs without overwriting a stored name or phone, and reject ambiguous matches. */
function resolveCustomer(input: NormalizedImportRow, customers: Customer[], newId: () => string): Customer {
  const byName = customers.filter((customer) => nameKey(customer.name) === nameKey(input.customerName));
  if (input.phone) {
    const byPhone = customers.filter((customer) => customer.phone && phoneKey(customer.phone) === phoneKey(input.phone));
    if (byPhone.length > 1) throw new Error("Nomor telepon cocok dengan beberapa pelanggan; rapikan data pelanggan dahulu.");
    if (byPhone.length === 1) {
      if (nameKey(byPhone[0].name) !== nameKey(input.customerName)) throw new Error("Nomor telepon sudah digunakan pelanggan dengan nama berbeda.");
      return byPhone[0];
    }
    if (byName.length) throw new Error("Nama pelanggan sudah ada dengan telepon berbeda atau kosong; samakan data atau kosongkan telepon untuk mencocokkan nama.");
  } else {
    if (byName.length > 1) throw new Error("Nama cocok dengan beberapa pelanggan; isi telepon untuk memilih pelanggan yang tepat.");
    if (byName.length === 1) return byName[0];
  }
  const customer: Customer = { id: newId(), name: input.customerName, phone: input.phone };
  customers.push(customer);
  return customer;
}

function batchError(type: BatchType, batchId: string, data: AppData): string | null {
  const batch = data.batches.find((candidate) => candidate.id === batchId);
  if (!batch || batch.type !== type) return "Pilih batch yang sesuai dengan jenis pesanan.";
  if (batch.status !== "open") return "Batch sudah ditutup. Pilih batch yang masih aktif.";
  return null;
}

function orderFromRow(row: NormalizedImportRow, batchId: string, customerId: string, id: string, createdAt: string, itemId: (index: number) => string): Order {
  const items: OrderItem[] = row.items.map((item, index) => ({ id: itemId(index), productId: item.productId, product: item.product, variant: item.variant, color: item.color, size: item.size, quantity: item.quantity, unitPrice: item.unitPrice, unitCost: item.unitCost }));
  return {
    id, batchId, customerId, items, createdAt,
    serviceFee: row.serviceFee, shippingCharge: row.shippingCharge, paid: row.paid,
    date: row.date, status: "new", notes: row.notes,
  };
}

function sourceFromNormalized(row: NormalizedImportRow): SourceEntry[] {
  return row.items.map((item) => ({
    rowNumber: item.rowNumber, errors: [], source: {
      nomor_pesanan: row.orderNumber, nama_pelanggan: row.customerName, telepon: row.phone, sku_produk: item.sku,
      produk: item.productName, varian: item.variant, warna: item.color, ukuran: item.size, jumlah: item.quantity,
      harga_jual: item.unitPrice, harga_beli: item.unitCost, fee_jastip: row.serviceFee,
      ongkir: row.shippingCharge, dp: row.paid, tanggal: row.date, catatan: row.notes,
    },
  }));
}

function transientId(prefix: string, existing: Set<string>, number: number) {
  let candidate = `${prefix}-${number}`;
  while (existing.has(candidate)) candidate += "-next";
  existing.add(candidate);
  return candidate;
}

function validateCombined(preview: ImportPreview, data: AppData) {
  const customers = structuredClone(data.customers);
  const ids = new Set(customers.map((customer) => customer.id));
  const orderIds = new Set(data.orders.map((order) => order.id));
  const itemIds = new Set(data.orders.flatMap((order) => order.items.map((item) => item.id)));
  const orders: Order[] = [];
  for (const row of preview.rows) {
    if (!row.normalized || row.errors.length) continue;
    try {
      const customer = resolveCustomer(row.normalized, customers, () => transientId("excel-preview-customer", ids, row.rowNumber));
      orders.push(orderFromRow(row.normalized, preview.batchId, customer.id, transientId("excel-preview-order", orderIds, row.rowNumber), "1970-01-01T00:00:00.000Z", (index) => transientId(`excel-preview-item-${row.rowNumber}`, itemIds, index)));
    } catch (error) {
      row.errors.push(`Baris ${row.rowNumber}: ${error instanceof Error ? error.message : "Pelanggan tidak dapat dicocokkan."}`);
      delete row.normalized;
    }
  }
  if (preview.rows.every((row) => !row.errors.length) && !isAppData({ ...data, customers, orders: [...data.orders, ...orders] })) {
    preview.errors.push("Gabungan data tidak valid atau terlalu besar; periksa nilai dan batas jumlah pelanggan/pesanan.");
  }
  preview.validCount = preview.rows.filter((row) => !row.errors.length && row.normalized).length;
}

function readHeaders(sheet: Worksheet, type: BatchType, errors: string[]) {
  const allowed = type === "po" ? PO_HEADERS : JASTIP_HEADERS;
  const required = ["nama_pelanggan", "jumlah", "tanggal", ...(type === "jastip" ? ["produk", "harga_jual"] : [])];
  const headers = new Map<number, string>();
  const seen = new Set<string>();
  if (sheet.columnCount > 50) errors.push("Terlalu banyak kolom. Gunakan template pesanan Tippo.");
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    if (blank(cell.value)) return;
    if (typeof cell.value !== "string") { errors.push("Judul kolom harus berupa teks biasa."); return; }
    const header = cell.value.trim().toLowerCase();
    if (!allowed.includes(header)) errors.push(`Kolom ${header || column} tidak didukung untuk ${type === "po" ? "Open PO" : "Jastip"}.`);
    if (seen.has(header)) errors.push(`Kolom ${header} muncul lebih dari sekali.`);
    seen.add(header);
    headers.set(column, header);
  });
  for (const header of required) if (!seen.has(header)) errors.push(`Kolom wajib ${header} tidak ditemukan.`);
  if (type === "po" && !seen.has("sku_produk") && !seen.has("produk")) errors.push("Tambahkan kolom sku_produk atau produk untuk mencocokkan master.");
  return headers;
}

/** Parse locally; no workbook, customer or order data is sent to a server. */
export async function previewOrderImport(buffer: ArrayBuffer, type: BatchType, batchId: string, data: AppData): Promise<ImportPreview> {
  const preview: ImportPreview = { type, batchId, rows: [], errors: [], rowCount: 0, sourceRowCount: 0, validCount: 0 };
  if (!isAppData(data)) { preview.errors.push("Data aplikasi tidak valid."); return preview; }
  const batchProblem = batchError(type, batchId, data);
  if (batchProblem) { preview.errors.push(batchProblem); return preview; }
  if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) { preview.errors.push("File harus berisi data dan berukuran maksimal 5 MB."); return preview; }
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Pesanan") ?? workbook.worksheets[0];
    if (!sheet) { preview.errors.push("File tidak memiliki lembar pesanan."); return preview; }
    if (sheet.rowCount > MAX_ROWS + 1) { preview.errors.push("Maksimal 1.000 baris barang, di luar baris judul. Hapus baris kosong tambahan jika ada."); return preview; }
    const headers = readHeaders(sheet, type, preview.errors);
    if (preview.errors.length) return preview;
    const groups = new Map<string, { number: string; entries: SourceEntry[] }>();
    sheet.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
      if (rowNumber === 1) return;
      const values: SourceRow = {};
      const errors: string[] = [];
      let hasValue = false;
      excelRow.eachCell({ includeEmpty: false }, (cell, column) => {
        if (blank(cell.value)) return;
        hasValue = true;
        const header = headers.get(column);
        if (!header) { errors.push("Ada isi pada kolom tanpa judul; gunakan kolom dari template."); return; }
        values[header] = readCell(cell.value, header, Boolean(workbook.properties.date1904), errors);
      });
      if (hasValue) {
        preview.sourceRowCount += 1;
        const number = orderNumber(values, errors);
        const key = number ? `group:${number}` : `row:${rowNumber}`;
        const group = groups.get(key) ?? { number, entries: [] };
        group.entries.push({ source: values, rowNumber, errors });
        groups.set(key, group);
      }
    });
    for (const group of groups.values()) preview.rows.push(validateGroup(group.entries, group.number, type, data));
    preview.rowCount = preview.rows.length;
    if (!preview.rowCount) preview.errors.push("Lembar pesanan belum berisi data.");
    validateCombined(preview, data);
  } catch {
    preview.errors.push("File Excel tidak dapat dibaca. Gunakan file .xlsx yang valid tanpa kata sandi.");
  }
  return preview;
}

/** Recheck every row against current customers, batch and product masters before an atomic save. */
export function buildImport(preview: ImportPreview, data: AppData): { orders: Order[]; customers: Customer[] } {
  if (!isAppData(data)) throw new Error("Data aplikasi tidak valid.");
  const batchProblem = batchError(preview.type, preview.batchId, data);
  if (batchProblem) throw new Error(batchProblem);
  if (preview.errors.length || !preview.rows.length || preview.sourceRowCount > MAX_ROWS || preview.rows.length > MAX_ROWS || preview.rows.some((row) => row.errors.length || !row.normalized)) throw new Error("Perbaiki semua kesalahan pada pratinjau sebelum mengimpor.");
  const customers = structuredClone(data.customers);
  const imported: Order[] = [];
  for (const row of preview.rows) {
    const old = row.normalized!;
    const checked = validateGroup(sourceFromNormalized(old), old.orderNumber, preview.type, data);
    if (!checked.normalized || checked.errors.length) throw new Error(`Baris ${row.rowNumber}: ${checked.errors.join(" ")}`);
    const next = checked.normalized;
    if (preview.type === "po" && old.items.some((item, index) => {
      const current = next.items[index];
      return !current || item.productId !== current.productId || item.product !== current.product || item.variant !== current.variant || item.unitPrice !== current.unitPrice || item.unitCost !== current.unitCost;
    })) throw new Error(`Baris ${row.rowNumber}: master produk berubah. Unggah ulang file untuk meninjau harga terbaru.`);
    let customer: Customer;
    try { customer = resolveCustomer(next, customers, () => `customer-${globalThis.crypto.randomUUID()}`); }
    catch (error) { throw new Error(`Baris ${row.rowNumber}: ${error instanceof Error ? error.message : "Pelanggan tidak dapat dicocokkan."}`); }
    imported.push(orderFromRow(next, preview.batchId, customer.id, `order-${globalThis.crypto.randomUUID()}`, new Date().toISOString(), () => `item-${globalThis.crypto.randomUUID()}`));
  }
  if (!isAppData({ ...data, customers, orders: [...data.orders, ...imported] })) throw new Error("Gabungan data tidak valid atau melampaui batas perhitungan aman. Tidak ada pesanan yang diimpor.");
  return { orders: imported, customers: customers.slice(data.customers.length) };
}

/** The example is intentionally rejected until its customer name is replaced. */
export async function createOrderTemplate(type: BatchType, data: AppData): Promise<ArrayBuffer | Uint8Array> {
  if (!isAppData(data)) throw new Error("Data aplikasi tidak valid.");
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Tippo";
  const sheet = workbook.addWorksheet("Pesanan");
  const headers = type === "po" ? PO_HEADERS : JASTIP_HEADERS;
  sheet.columns = headers.map((header) => ({ header, key: header, width: ["nama_pelanggan", "produk", "catatan"].includes(header) ? 30 : 19 }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  const active = data.products.filter((product) => product.active);
  const sampleProducts = active.filter((product) => (product.sku && active.filter((candidate) => candidate.sku === product.sku).length === 1) || active.filter((candidate) => candidate.name === product.name && candidate.variant === product.variant).length === 1).slice(0, 2);
  if (type === "jastip") {
    sheet.addRow({ nomor_pesanan: "CONTOH-001", nama_pelanggan: EXAMPLE_CUSTOMER, telepon: "", produk: "Contoh kaos", varian: "Oversize", warna: "Putih", ukuran: "L", jumlah: 1, harga_jual: 150000, harga_beli: 100000, fee_jastip: 10000, ongkir: 0, dp: 0, tanggal: todayJakarta(), catatan: "Hapus atau ganti kedua baris contoh ini." });
    sheet.addRow({ nomor_pesanan: "CONTOH-001", nama_pelanggan: EXAMPLE_CUSTOMER, produk: "Contoh makanan", varian: "Pedas", jumlah: 2, harga_jual: 25000, harga_beli: 15000 });
  } else {
    for (const [index, sampleProduct] of sampleProducts.entries()) {
      const uniqueSku = sampleProduct.sku && active.filter((product) => product.sku === sampleProduct.sku).length === 1;
      sheet.addRow({ nomor_pesanan: "CONTOH-001", nama_pelanggan: EXAMPLE_CUSTOMER, telepon: "", sku_produk: uniqueSku ? sampleProduct.sku : "", produk: sampleProduct.name, varian: sampleProduct.variant, jumlah: 1, ...(index === 0 ? { ongkir: 0, dp: 0, tanggal: todayJakarta(), catatan: "Hapus atau ganti seluruh baris contoh ini." } : {}) });
    }
  }
  if (sheet.rowCount > 1) for (let row = 2; row <= sheet.rowCount; row += 1) sheet.getRow(row).getCell("nama_pelanggan").note = "BARIS CONTOH: ganti nama dan data ini atau hapus sebelum impor. Baris contoh tidak dapat diimpor.";
  for (const header of ["nomor_pesanan", "telepon", "sku_produk", "tanggal"]) if (headers.includes(header)) sheet.getColumn(header).numFmt = "@";
  for (const header of ["harga_jual", "harga_beli", "fee_jastip", "ongkir", "dp"]) if (headers.includes(header)) sheet.getColumn(header).numFmt = '#,##0';
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF167B70" } };
  const guide = workbook.addWorksheet("Panduan");
  guide.getColumn(1).width = 110;
  const instructions = [
    "Template pesanan Tippo", "Isi lembar Pesanan saja. Ganti atau hapus baris CONTOH sebelum mengimpor.",
    "Pilih batch tujuan yang aktif di aplikasi. Maksimal 1.000 baris barang dan ukuran file 5 MB; maksimal 100 barang per pesanan.",
    "Satu baris untuk satu barang. Isi nomor_pesanan yang sama untuk menggabungkan beberapa barang menjadi satu pesanan.",
    "nomor_pesanan kosong berarti baris tersebut menjadi pesanan tersendiri. Nomor hanya untuk pengelompokan file; impor selalu menambah pesanan baru.",
    "nama_pelanggan dan tanggal wajib untuk setiap pesanan; jumlah wajib pada setiap baris barang. Tanggal: YYYY-MM-DD atau tanggal Excel.",
    "Baris lanjutan boleh mengosongkan pelanggan, telepon, tanggal, fee_jastip, ongkir, dp dan catatan untuk mewarisi nilai. Jika diisi ulang, nilainya harus sama.",
    "Fee, ongkir dan DP dihitung sekali per pesanan, bukan pada setiap barang.",
    "Simpan telepon sebagai teks agar angka 0 di depan tidak hilang. Telepon boleh kosong.",
    "Nilai uang dalam rupiah bulat tanpa pemisah ribuan. DP tidak boleh melebihi total tagihan.",
    "Kolom kosong: harga_beli berarti belum diketahui; ongkir, fee_jastip dan dp berarti 0.",
    "Formula tidak didukung. Tempel nilai biasa. Semua baris harus valid agar impor tersimpan sekaligus.",
    "Nama dan telepon pelanggan yang sudah ada harus cocok; impor tidak mengubah data pelanggan lama.",
    type === "po" ? "Open PO: isi SKU unik, atau nama produk dan varian persis seperti master aktif di lembar Produk. Harga/HPP otomatis dari master; jangan tambah kolom harga." : "Jastip: produk dan harga_jual wajib pada setiap barang. Varian, warna dan ukuran opsional; harga_beli boleh kosong, fee_jastip merupakan total fee untuk satu pesanan.",
    "Semua pesanan diimpor dengan status Baru. Periksa pratinjau sebelum menyimpan.",
  ];
  for (const instruction of instructions) guide.addRow([instruction]);
  guide.getRow(1).font = { bold: true, size: 16 };
  if (type === "po") {
    const products = workbook.addWorksheet("Produk");
    products.columns = [
      { header: "sku_produk", key: "sku", width: 22 }, { header: "produk", key: "name", width: 35 },
      { header: "varian", key: "variant", width: 25 }, { header: "harga_jual", key: "unitPrice", width: 20 },
      { header: "harga_beli", key: "unitCost", width: 20 },
    ];
    for (const product of active) products.addRow(product);
    products.getColumn("sku").numFmt = "@";
    products.getRow(1).font = { bold: true };
    products.views = [{ state: "frozen", ySplit: 1 }];
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

const PRODUCT_HEADERS = ["produk", "varian", "sku_produk", "harga_jual", "harga_beli", "kategori"];
const EXAMPLE_PRODUCT = "CONTOH, ganti nama produk";
export interface ProductImportRow {
  rowNumber: number;
  source: SourceRow;
  errors: string[];
  normalized?: Omit<Product, "id">;
}
export interface ProductImportPreview {
  rows: ProductImportRow[];
  errors: string[];
  validCount: number;
}

function validateProductRows(rows: Pick<ProductImportRow, "rowNumber" | "source" | "errors">[], data: AppData, productLimit?: number): ProductImportPreview {
  const preview: ProductImportPreview = { rows: [], errors: [], validCount: 0 };
  const skus = new Set(data.products.filter((product) => product.sku).map((product) => product.sku.toLowerCase()));
  const labels = new Set(data.products.map((product) => JSON.stringify([product.name.toLowerCase(), product.variant.toLowerCase()])));
  for (const row of rows) {
    const errors = [...row.errors];
    const name = stringField(row.source, "produk", errors, true, 120);
    const variant = stringField(row.source, "varian", errors, false, 80);
    const sku = stringField(row.source, "sku_produk", errors, false, 60);
    const category = stringField(row.source, "kategori", errors, false, 80);
    const unitPrice = integerField(row.source, "harga_jual", errors, true);
    const unitCost = integerField(row.source, "harga_beli", errors, false, true);
    if (name === EXAMPLE_PRODUCT) errors.push("Ganti atau hapus baris contoh sebelum import.");
    const label = JSON.stringify([name.toLowerCase(), variant.toLowerCase()]);
    if (name && labels.has(label)) errors.push("Produk dan varian sudah ada di katalog atau berulang dalam file. Data lama tidak ditimpa.");
    if (sku && skus.has(sku.toLowerCase())) errors.push("SKU sudah digunakan di katalog atau berulang dalam file, termasuk produk arsip.");
    if (name) labels.add(label);
    if (sku) skus.add(sku.toLowerCase());
    const normalized = errors.length ? undefined : { name, variant, sku, ...(category ? {category} : {}), unitPrice: unitPrice!, unitCost, active: true };
    preview.rows.push({ rowNumber: row.rowNumber, source: row.source, errors, normalized });
  }
  preview.validCount = preview.rows.filter((row) => row.normalized && !row.errors.length).length;
  if (!rows.length) preview.errors.push("Lembar Produk belum berisi data.");
  if (productLimit !== undefined && data.products.length + rows.length > productLimit) {
    preview.errors.push(`Paket Gratis maksimal ${productLimit} produk, termasuk arsip. Sisa slot ${Math.max(0, productLimit - data.products.length)}; file berisi ${rows.length} produk. Kurangi baris atau upgrade Pro.`);
  }
  const ids = new Set(data.products.map((product) => product.id));
  const products = preview.rows.flatMap((row) => row.normalized ? [{ ...row.normalized, id: transientId("excel-preview-product", ids, row.rowNumber) }] : []);
  if (preview.validCount === rows.length && !isAppData({ ...data, products: [...data.products, ...products] })) preview.errors.push("Gabungan katalog tidak valid atau melebihi batas data aplikasi.");
  return preview;
}

export async function previewProductImport(buffer: ArrayBuffer, data: AppData, productLimit?: number): Promise<ProductImportPreview> {
  const preview: ProductImportPreview = { rows: [], errors: [], validCount: 0 };
  if (!isAppData(data)) { preview.errors.push("Data aplikasi tidak valid."); return preview; }
  if (!buffer.byteLength || buffer.byteLength > MAX_BYTES) { preview.errors.push("File harus berisi data dan berukuran maksimal 5 MB."); return preview; }
  try {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Produk") ?? workbook.worksheets[0];
    if (!sheet) { preview.errors.push("File tidak memiliki lembar Produk."); return preview; }
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 50) { preview.errors.push("Maksimal 1.000 produk dan 50 kolom. Gunakan template produk Tippo."); return preview; }
    const headers = new Map<number, string>();
    const seen = new Set<string>();
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
      if (blank(cell.value)) return;
      if (typeof cell.value !== "string") { preview.errors.push("Judul kolom harus berupa teks biasa."); return; }
      const header = cell.value.trim().toLowerCase();
      if (!PRODUCT_HEADERS.includes(header)) preview.errors.push(`Kolom ${header || column} tidak didukung. Gunakan template Produk.`);
      if (seen.has(header)) preview.errors.push(`Kolom ${header} muncul lebih dari sekali.`);
      seen.add(header); headers.set(column, header);
    });
    for (const header of ["produk", "harga_jual"]) if (!seen.has(header)) preview.errors.push(`Kolom wajib ${header} tidak ditemukan.`);
    if (preview.errors.length) return preview;
    const rows: ProductImportRow[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const source: SourceRow = {}; const errors: string[] = []; let hasValue = false;
      row.eachCell({ includeEmpty: false }, (cell, column) => {
        if (blank(cell.value)) return;
        hasValue = true;
        const header = headers.get(column);
        if (!header) { errors.push("Ada isi pada kolom tanpa judul; gunakan kolom dari template."); return; }
        source[header] = readCell(cell.value, header, false, errors);
      });
      if (hasValue) rows.push({ rowNumber, source, errors });
    });
    return validateProductRows(rows, data, productLimit);
  } catch {
    preview.errors.push("File Excel tidak dapat dibaca. Gunakan file .xlsx yang valid tanpa kata sandi.");
    return preview;
  }
}

export function buildProductImport(preview: ProductImportPreview, data: AppData, productLimit?: number): Product[] {
  if (!isAppData(data) || preview.errors.length || !preview.rows.length || preview.rows.length > MAX_ROWS || preview.rows.some((row) => row.errors.length)) throw new Error("Perbaiki seluruh data sebelum import produk.");
  const checked = validateProductRows(preview.rows, data, productLimit);
  if (checked.errors.length || checked.validCount !== checked.rows.length) throw new Error(checked.errors[0] ?? "Katalog berubah atau ada produk duplikat. Periksa file dan unggah ulang.");
  const products = checked.rows.map((row) => ({ ...row.normalized!, id: crypto.randomUUID() }));
  if (!isAppData({ ...data, products: [...data.products, ...products] })) throw new Error("Gabungan katalog tidak valid.");
  return products;
}

export async function createProductTemplate(): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook(); workbook.creator = "Tippo";
  const sheet = workbook.addWorksheet("Produk");
  sheet.columns = PRODUCT_HEADERS.map((header) => ({ header, key: header, width: header === "produk" ? 35 : 22 }));
  sheet.addRow({ produk: EXAMPLE_PRODUCT, varian: "Ukuran M", sku_produk: "CONTOH-001", harga_jual: 150000, harga_beli: 100000 });
  sheet.getRow(2).getCell("produk").note = "Ganti nama dan data contoh atau hapus baris ini sebelum import.";
  sheet.getColumn("sku_produk").numFmt = "@";
  for (const header of ["harga_jual", "harga_beli"]) sheet.getColumn(header).numFmt = '#,##0';
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF245C4E" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: PRODUCT_HEADERS.length } };
  const guide = workbook.addWorksheet("Petunjuk"); guide.getColumn(1).width = 110;
  for (const instruction of ["Template produk Tippo", "1. Salin listing produk ke lembar Produk. Satu baris untuk satu produk atau varian.", "2. Produk dan harga_jual wajib. Varian, sku_produk, kategori, dan harga_beli boleh kosong.", "3. Ganti atau hapus baris contoh. Jangan ubah judul kolom.", "4. Harga berupa rupiah bulat. Gunakan angka biasa; formula tidak didukung, tempel sebagai nilai.", "5. SKU disimpan sebagai teks agar angka nol di depan tidak hilang. Produk baru akan aktif.", "6. Simpan sebagai .xlsx, lalu unggah di Open PO > Produk > Import produk Excel.", "7. Periksa pratinjau. Semua baris harus valid dan sesuai kuota agar tersimpan sekaligus.", "8. Import menambah produk; tidak menimpa produk lama. SKU atau nama + varian duplikat ditolak, termasuk arsip.", "9. Paket Gratis maksimal 5 produk, termasuk arsip. Maksimal file 5 MB dan 1.000 produk."]) guide.addRow([instruction]);
  guide.getRow(1).font = { bold: true, size: 16 };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

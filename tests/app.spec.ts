import { chooseOption, expectSelectOptions } from "./select-helper";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import type { AppData, Order, OrderItem } from "../src/lib/types";

type LegacyOrder = Omit<Order, "items" | "createdAt"> & Pick<OrderItem, "productId" | "product" | "quantity" | "unitPrice" | "unitCost">;
type LegacyData = Omit<AppData, "orders"> & { orders: LegacyOrder[] };

function currentData(legacy: LegacyData): AppData {
  return {
    ...legacy,
    orders: legacy.orders.map(({ productId, product, quantity, unitPrice, unitCost, ...order }) => ({
      ...order,
      createdAt: `${order.date}T12:00:00+07:00`,
      items: [{ id: `acceptance-item-${order.id}`, productId, product, quantity, unitPrice, unitCost, variant: "", color: "", size: "" }],
    })),
  };
}

function legacyOrder(order: Order): LegacyOrder {
  const { items, createdAt: _createdAt, ...details } = order;
  void _createdAt;
  const { productId, product, quantity, unitPrice, unitCost } = items[0];
  return { ...details, productId, product, quantity, unitPrice, unitCost };
}

/** Small independent acceptance fixture; expectations below use explicit rupiah totals. */
const legacyFixture: LegacyData = {
  batches: [{
    id: "acceptance-batch", name: "Batch Uji Korea", type: "jastip", origin: "Seoul",
    closeDate: "2026-10-20", status: "open", directCosts: 30000,
  }],
  customers: [{ id: "acceptance-customer", name: "Maya Demo", phone: "" }],
  products: [],
  orders: [
    { id: "acceptance-known", batchId: "acceptance-batch", customerId: "acceptance-customer", product: "Tote Acceptance", quantity: 2, unitPrice: 150000, unitCost: 90000, serviceFee: 20000, shippingCharge: 10000, paid: 100000, date: "2026-10-07", status: "purchased", notes: "Fixture fiktif" },
    { id: "acceptance-unknown", batchId: "acceptance-batch", customerId: "acceptance-customer", product: "Serum Acceptance", quantity: 1, unitPrice: 250000, unitCost: null, serviceFee: 25000, shippingCharge: 15000, paid: 150000, date: "2026-10-08", status: "new", notes: "" },
    { id: "acceptance-sep", batchId: "acceptance-batch", customerId: "acceptance-customer", product: "Matcha Acceptance", quantity: 1, unitPrice: 200000, unitCost: 120000, serviceFee: 15000, shippingCharge: 10000, paid: 225000, date: "2026-09-12", status: "done", notes: "" },
    { id: "acceptance-cancelled", batchId: "acceptance-batch", customerId: "acceptance-customer", product: "Canceled Acceptance", quantity: 1, unitPrice: 100000, unitCost: 50000, serviceFee: 10000, shippingCharge: 5000, paid: 0, date: "2026-10-06", status: "cancelled", notes: "" },
  ],
};

const fixture = currentData(legacyFixture);

const legacyPoFixture: LegacyData = {
  ...legacyFixture,
  batches: [...legacyFixture.batches, {
    id: "acceptance-po-batch", name: "PO Studio Oktober", type: "po", origin: "Bandung",
    closeDate: "2026-10-25", status: "open", directCosts: 0,
  }],
  products: [{
    id: "acceptance-product", name: "Kaos Studio", variant: "M · Navy", sku: "STUDIO-NAVY-M",
    unitPrice: 175000, unitCost: 105000, active: true,
  }],
  orders: [...legacyFixture.orders, {
    id: "acceptance-po-order", batchId: "acceptance-po-batch", customerId: "acceptance-customer",
    productId: "acceptance-product", product: "Kaos Studio · M · Navy", quantity: 2,
    unitPrice: 175000, unitCost: 105000, serviceFee: 0, shippingCharge: 0,
    paid: 200000, date: "2026-10-08", status: "new", notes: "",
  }],
};

const poFixture = currentData(legacyPoFixture);

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-08T05:00:00.000Z"));
  const pageErrors: string[] = [];
  errors.set(page, pageErrors);
  page.on("pageerror", (error) => pageErrors.push(`Uncaught: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(`Console: ${message.text()}`);
  });
  // Seed once per fresh browser context, retaining actual user edits through reloads.
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem("tippo.acceptance.initialized")) {
      localStorage.setItem("tippo.workspace.v1", JSON.stringify(data));
      localStorage.removeItem("tippo.usage.demo.v1");
      sessionStorage.setItem("tippo.acceptance.initialized", "1");
      localStorage.setItem("tippo.subscription.demo.v1", JSON.stringify({ tier: "pro", expiresAt: "2026-11-08T05:00:00.000Z", mode: "demo" }));
    }
  }, fixture);
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Ringkasan usaha." })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page), "No browser exceptions or console errors during the workflow").toEqual([]);
});

async function navigate(page: Page, name: string | RegExp) {
  const button = page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("button", { name, exact: typeof name === "string" });
  const mobileMenu = page.getByRole("button", { name: "Buka navigasi" });
  if (await mobileMenu.isVisible() && !await page.getByRole("button", { name: "Tutup navigasi", exact: true }).isVisible()) await mobileMenu.click();
  await button.click();
}

async function modeOrders(page: Page, mode: "Jastip" | "Open PO") {
  await navigate(page, mode);
  await page.getByRole("tab", { name: /^Pesanan/ }).click();
}

async function replaceWorkspace(page: Page, data: unknown) {
  await page.evaluate((value) => {
    localStorage.setItem("tippo.workspace.v1", JSON.stringify(value));
    localStorage.removeItem("tippo.usage.demo.v1");
  }, data);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ringkasan usaha." })).toBeVisible();
}

async function exportWorkspace(page: Page) {
  await navigate(page, "Pengaturan data");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor data", exact: true }).click();
  const download = await downloaded;
  const path = await download.path();
  expect(path).not.toBeNull();
  return JSON.parse(await readFile(path!, "utf8"));
}

async function excelTemplate(page: Page, mode: "jastip" | "PO") {
  await page.getByRole("button", { name: "Import Excel", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Import Excel ${mode}` });
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Template Excel", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`tippo-template-${mode === "PO" ? "po" : mode}.xlsx`);
  const path = await download.path();
  expect(path).not.toBeNull();
  return { dialog, bytes: await readFile(path!) };
}

async function workbookBytes(template: Buffer, rows: Record<string, string | number>[]) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(template).buffer);
  const sheet = workbook.getWorksheet("Pesanan")!;
  expect(sheet).toBeDefined();
  const headers = Array.from({ length: sheet.columnCount }, (_, i) => String(sheet.getRow(1).getCell(i + 1).value ?? ""));
  // ExcelJS spliceRows can retain the trailing styled example row after a full
  // tail deletion. Clear cells and replace explicit rows so the test workbook
  // contains precisely the supplied orders.
  for (let number = 2; number <= sheet.rowCount; number++) sheet.getRow(number).values = [];
  rows.forEach((row, index) => { sheet.getRow(index + 2).values = headers.map((header) => row[header] ?? ""); });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function workspaceOrderCount(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!).orders.length);
}

function stat(page: Page, title: string) {
  return page.locator(".stat-card").filter({ hasText: title });
}

test("customer search can recover from no matches without changing customer records", async ({ page }) => {
  await navigate(page, "Pelanggan");
  const search = page.getByRole("textbox", { name: "Cari pelanggan" });
  await search.fill("pelanggan-yang-tidak-ada");
  await expect(page.getByRole("heading", { name: "Pelanggan tidak ditemukan" })).toBeVisible();
  await expect(page.locator(".customer-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset pencarian", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Maya Demo", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!).customers)).toEqual(fixture.customers);
});

test("empty product search and archive filter can return to the existing catalogue", async ({ page }) => {
  await replaceWorkspace(page, poFixture);
  await navigate(page, "Open PO");
  const search = page.getByRole("textbox", { name: "Cari produk master" });
  await search.fill("produk-yang-tidak-ada");
  await expect(page.getByRole("heading", { name: "Produk tidak ditemukan" })).toBeVisible();
  await expect(page.locator(".product-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset filter produk", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Kaos Studio", exact: true })).toBeVisible();
  await chooseOption(page.getByLabel("Filter produk"), "archived");
  await expect(page.getByRole("heading", { name: "Produk tidak ditemukan" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filter produk", exact: true }).click();
  await expect(page.getByLabel("Filter produk")).toHaveAttribute("data-value", "all");
  await expect(page.locator(".product-row")).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!).products)).toEqual(poFixture.products);
});

test("monthly dashboard distinguishes booked revenue, incomplete HPP and payments", async ({ page }) => {
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*620\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText(/Rp\s*135\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText("1 pesanan belum lengkap HPP");
  await expect(stat(page, "Sisa tagihan")).toContainText(/Rp\s*370\.000/);
  await expect(page.getByRole("img", { name: /Grafik penjualan dan HPP diketahui/ })).toHaveAttribute("aria-label", /Okt, penjualan Rp\s*620\.000, HPP Rp\s*195\.000/);

  await chooseOption(page.getByLabel("Pilih bulan ringkasan"), "2026-09");
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*225\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText(/Rp\s*97\.500/);
  await expect(stat(page, "Sisa tagihan")).toContainText(/Rp\s*0/);
  await expect(page.getByRole("img", { name: /Grafik penjualan dan HPP diketahui/ })).toHaveAttribute("aria-label", /Sep, penjualan Rp\s*225\.000/);
});

test("create a PO master and batch, submit a compact order with automatic prices and retain it", async ({ page }) => {
  await navigate(page, "Open PO");
  await page.getByRole("button", { name: "Produk baru", exact: true }).click();
  const productForm = page.getByRole("dialog", { name: "Produk baru" });
  await productForm.getByLabel("Nama produk").fill("Kaos MVP Test");
  await productForm.getByLabel("Varian (opsional)").fill("M · Navy");
  await productForm.getByLabel("SKU (opsional)").fill("MVP-NAVY-M");
  await productForm.getByLabel("Harga jual / unit").fill("175000");
  await productForm.getByLabel("Harga beli / unit").fill("105000");
  await productForm.getByRole("button", { name: "Simpan produk" }).click();
  await expect(productForm).not.toBeVisible();
  await page.getByRole("tab", { name: /^Batch PO/ }).click();
  await page.getByRole("button", { name: "Batch PO baru", exact: true }).first().click();
  const batchForm = page.getByRole("dialog", { name: "Batch PO baru" });
  await batchForm.getByLabel("Nama batch").fill("PO Kaos MVP");
  await expect(batchForm.getByLabel("Jenis titipan")).toHaveValue("Open PO");
  await expect(batchForm.getByLabel("Jenis titipan")).toHaveCSS("background-color", "rgb(233, 234, 231)");
  await expect(batchForm.getByLabel("Jenis titipan")).not.toBeEditable();
  await batchForm.getByLabel("Tutup pesanan").fill("2026-10-25");
  await batchForm.getByLabel("Lokasi / supplier").fill("Bandung");
  await batchForm.getByRole("button", { name: "Simpan batch" }).click();
  await expect(page.getByRole("heading", { name: "PO Kaos MVP", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Pesanan PO baru", exact: true }).click();
  const orderForm = page.getByRole("dialog", { name: "Pesanan PO baru" });
  await chooseOption(orderForm.getByLabel("Batch PO"), { label: "PO Kaos MVP" });
  await expectSelectOptions(orderForm.getByLabel("Batch PO"), "Batch Uji Korea", 0);
  await chooseOption(orderForm.getByLabel("Produk", { exact: true }), { label: "Kaos MVP Test · M · Navy · MVP-NAVY-M" });
  await chooseOption(orderForm.getByLabel("Pelanggan", { exact: true }), "new");
  await orderForm.getByLabel("Nama pelanggan").fill("Maya Baru");
  await orderForm.getByLabel("Alamat (opsional)").fill("Jalan Anggrek 5, Jakarta");
  await expect(orderForm.getByLabel("Nama produk")).toHaveCount(0);
  await expect(orderForm.getByLabel("Harga jual / produk")).toHaveCount(0);
  await expect(orderForm.getByLabel("Harga beli / produk")).toHaveCount(0);
  await expect(orderForm.getByLabel("Tanggal pesanan")).toBeVisible();
  await expect(orderForm.locator("#po-product-prices")).toContainText(/Rp\s*175\.000/);
  await expect(orderForm.locator("#po-product-prices")).toContainText(/Rp\s*105\.000/);
  await orderForm.getByLabel("Jumlah produk").fill("2");
  await orderForm.getByLabel("Tanggal pesanan").fill("2026-10-08");
  await orderForm.getByLabel("Ongkir yang ditagihkan").fill("15000");
  await orderForm.getByLabel("Sudah dibayar (DP / lunas)").fill("1000000");
  await orderForm.getByRole("button", { name: "Simpan pesanan" }).click();
  await expect(orderForm.getByText("Pembayaran tidak boleh melebihi total tagihan.")).toBeVisible();
  await orderForm.getByLabel("Sudah dibayar (DP / lunas)").fill("200000");
  await orderForm.getByRole("button", { name: "Simpan pesanan" }).click();
  await expect(orderForm).not.toBeVisible();
  await modeOrders(page, "Open PO");
  await page.getByLabel("Cari pesanan").fill("Kaos MVP Test");
  const row = page.getByRole("row").filter({ hasText: "Kaos MVP Test" });
  await expect(row).toContainText("Maya Baru");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!).customers.find((c:{name:string})=>c.name==="Maya Baru").address)).toBe("Jalan Anggrek 5, Jakarta");
  await expect(row).toContainText(/Rp\s*365\.000/);
  await expect(row).toContainText(/Rp\s*210\.000/);
  await expect(row).toContainText(/Sisa Rp\s*165\.000/);
  await expect(page.getByRole("row").filter({ hasText: "Tote Acceptance" })).toHaveCount(0);

  await page.reload();
  await modeOrders(page, "Open PO");
  await page.getByLabel("Cari pesanan").fill("Kaos MVP Test");
  await expect(page.getByRole("row").filter({ hasText: "Kaos MVP Test" })).toContainText(/Sisa Rp\s*165\.000/);
  await modeOrders(page, "Jastip");
  await expect(page.getByRole("row").filter({ hasText: "Kaos MVP Test" })).toHaveCount(0);
});

test("additional DP lowers receivables without changing revenue and paid cancellation is blocked", async ({ page }) => {
  await modeOrders(page, "Jastip");
  await page.getByLabel("Cari pesanan").fill("Tote Acceptance");
  await page.getByRole("button", { name: "Edit pesanan Tote Acceptance" }).click();
  const form = page.getByRole("dialog", { name: "Edit pesanan jastip" });
  await form.getByLabel("Sudah dibayar (DP / lunas)").fill("200000");
  await form.getByRole("button", { name: "Simpan pesanan" }).click();
  const row = page.getByRole("row").filter({ hasText: "Tote Acceptance" });
  await expect(row).toContainText(/Rp\s*330\.000/);
  await expect(row).toContainText(/Sisa Rp\s*130\.000/);
  const status = page.getByLabel("Status pesanan Tote Acceptance untuk Maya Demo");
  await chooseOption(status, "cancelled");
  await expect(page.getByRole("status")).toContainText("Pesanan yang sudah dibayar belum dapat dibatalkan");
  await expect(status).toHaveAttribute("data-value", "new");
  await navigate(page, "Ringkasan");
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*620\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText(/Rp\s*135\.000/);
  await expect(stat(page, "Sisa tagihan")).toContainText(/Rp\s*270\.000/);
});

test("complete purchase prices preserves historical batch costs and updates estimated margin", async ({ page }) => {
  await navigate(page, "HPP & Margin");
  await chooseOption(page.getByLabel("Pilih batch untuk HPP"), "acceptance-batch");
  await expect(page.getByLabel("Biaya langsung batch")).toHaveCount(0);
  await expect(page.getByText(/Batch ini memiliki biaya lama/)).toBeVisible();
  await page.getByLabel("Harga beli Tote Acceptance acceptance-known").fill("95000");
  await page.getByLabel("Harga beli Serum Acceptance acceptance-unknown").fill("150000");
  await page.getByRole("button", { name: "Simpan harga beli" }).click();
  await expect(page.getByRole("status")).toContainText("HPP dan margin sudah diperbarui");
  await expect(stat(page, "HPP diketahui")).toContainText(/Rp\s*490\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText(/Rp\s*355\.000/);
  await modeOrders(page, "Jastip");
  const known = page.getByRole("row").filter({ hasText: "Tote Acceptance" });
  await expect(known).toContainText(/Rp\s*205\.000/);
  const formerlyUnknown = page.getByRole("row").filter({ hasText: "Serum Acceptance" });
  await expect(formerlyUnknown).toContainText(/Rp\s*157\.500/);
  await expect(formerlyUnknown).not.toContainText("Belum lengkap");
  await navigate(page, "Ringkasan");
  await expect(stat(page, "Estimasi margin")).toContainText(/Rp\s*257\.500/);
  await expect(stat(page, "Estimasi margin")).not.toContainText("belum lengkap HPP");
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*620\.000/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!));
  expect(saved.batches.find((batch: {id:string}) => batch.id === "acceptance-batch").directCosts).toBe(30000);
});

test("export a versioned backup, safely clear demo data and restore it", async ({ page }) => {
  const exported = await exportWorkspace(page);
  expect(exported.schemaVersion).toBe(3);
  expect(Number.isNaN(Date.parse(exported.exportedAt))).toBe(false);
  expect(exported.data).toEqual(fixture);

  const invalidBackup = structuredClone(exported);
  invalidBackup.data.orders[0].customerId = "missing-customer";
  await page.locator('input[type="file"]').setInputFiles({
    name: "invalid-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalidBackup)),
  });
  await expect(page.getByRole("status")).toContainText("Format data tidak sesuai");
  await navigate(page, "Ringkasan");
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*620\.000/);
  await navigate(page, "Pengaturan data");

  await page.getByRole("button", { name: "Hapus semua data" }).click();
  const confirmation = page.getByRole("dialog", { name: "Hapus semua data?" });
  await expect(confirmation).toContainText("Unduh cadangan");
  await confirmation.getByRole("button", { name: "Hapus data" }).click();
  await navigate(page, "Ringkasan");
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*0/);

  await navigate(page, "Pengaturan data");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({
    name: "tippo-restore.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByRole("status")).toContainText("Data berhasil dipulihkan");
  await navigate(page, "Ringkasan");
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*620\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText("1 pesanan belum lengkap HPP");
});

test("mobile navigation and quick input fit a 375px screen without document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Buka navigasi" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await modeOrders(page, "Jastip");
  await expect(page.getByRole("heading", { name: "Jastip." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Pesanan jastip baru", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Pesanan jastip baru" });
  await expect(form.getByLabel("Nama produk")).toBeVisible();
  await form.getByLabel("Nama produk").fill("Titipan mobile");
  await form.getByLabel("Harga jual / produk").fill("100000");
  await form.getByLabel("Harga beli / produk").fill("65000");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await form.getByRole("button", { name: "Simpan pesanan" }).click();
  await expect(form).not.toBeVisible();
  await page.getByLabel("Cari pesanan").fill("Titipan mobile");
  await expect(page.getByRole("row").filter({ hasText: "Titipan mobile" })).toContainText("Maya Demo");
});

test("PO master changes apply to future orders while existing labels, HPP and revenue stay fixed", async ({ page }) => {
  await replaceWorkspace(page, poFixture);
  await navigate(page, "Open PO");
  await page.getByRole("button", { name: "Edit produk Kaos Studio" }).click();
  const master = page.getByRole("dialog", { name: "Edit produk" });
  await master.getByLabel("Nama produk").fill("Kaos Studio Baru");
  await master.getByLabel("Harga jual / unit").fill("200000");
  await master.getByLabel("Harga beli / unit").fill("120000");
  await master.getByRole("button", { name: "Simpan produk" }).click();

  await page.getByRole("tab", { name: /^Pesanan/ }).click();
  const oldRow = page.getByRole("row").filter({ hasText: "Kaos Studio · M · Navy" });
  await expect(oldRow).toContainText(/Rp\s*350\.000/);
  await expect(oldRow).toContainText(/Rp\s*210\.000/);
  await expect(oldRow).toContainText(/Sisa Rp\s*150\.000/);
  await page.getByRole("button", { name: "Edit pesanan Kaos Studio · M · Navy", exact: true }).click();
  const oldForm = page.getByRole("dialog", { name: "Edit pesanan PO" });
  await expect(oldForm.getByText("Nama dan harga memakai data saat pesanan dibuat. Perubahan master tidak mengubah produk ini.")).toBeVisible();
  await expect(oldForm.locator("#po-product-prices")).toContainText(/Rp\s*175\.000/);
  await expect(oldForm.locator("#po-product-prices")).toContainText(/Rp\s*105\.000/);
  await oldForm.getByLabel("Sudah dibayar (DP / lunas)").fill("250000");
  await oldForm.getByRole("button", { name: "Simpan pesanan" }).click();
  await expect(oldRow).toContainText(/Sisa Rp\s*100\.000/);
  await expect(oldRow).toContainText(/Rp\s*350\.000/);

  await page.getByRole("button", { name: "Pesanan PO baru", exact: true }).click();
  const newForm = page.getByRole("dialog", { name: "Pesanan PO baru" });
  await expect(newForm.getByLabel("Produk", { exact: true })).toHaveAttribute("data-value", "");
  await chooseOption(newForm.getByLabel("Produk", { exact: true }), "acceptance-product");
  await expect(newForm.locator("#po-product-prices")).toContainText(/Rp\s*200\.000/);
  await expect(newForm.locator("#po-product-prices")).toContainText(/Rp\s*120\.000/);
  await newForm.getByRole("button", { name: "Batal", exact: true }).click();
  await navigate(page, "Ringkasan");
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*970\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText(/Rp\s*275\.000/);
});

test("archived PO products block new orders while old archived and closed-batch orders remain editable", async ({ page }) => {
  const data = structuredClone(poFixture);
  data.products.push({ ...data.products[0], id: "available-product", name: "Kaos Alternatif", variant: "L", sku: "ALT-L" });
  await replaceWorkspace(page, data);
  await navigate(page, "Open PO");
  await page.getByRole("button", { name: "Arsipkan produk Kaos Studio" }).click();
  await page.getByRole("dialog",{name:"Hapus produk dari katalog aktif?"}).getByRole("button",{name:"Batal",exact:true}).click();
  await expect(page.getByRole("button",{name:"Arsipkan produk Kaos Studio"})).toBeVisible();
  await page.getByRole("button", { name: "Arsipkan produk Kaos Studio" }).click();
  await page.getByRole("dialog",{name:"Hapus produk dari katalog aktif?"}).getByRole("button",{name:"Ya, arsipkan produk",exact:true}).click();
  await page.getByRole("button", { name: "Pesanan PO baru", exact: true }).click();
  const newForm = page.getByRole("dialog", { name: "Pesanan PO baru" });
  await expectSelectOptions(newForm.getByLabel("Produk", { exact: true }), /Kaos Studio/, 0);
  await expect(newForm.getByLabel("Produk", { exact: true })).toHaveAttribute("data-value", "");
  await newForm.getByRole("button", { name: "Batal", exact: true }).click();
  await page.getByRole("tab", { name: /^Batch PO/ }).click();
  await chooseOption(page.getByLabel("Status batch PO Studio Oktober"), "closed");
  await page.getByRole("tab", { name: /^Pesanan/ }).click();
  await page.getByRole("button", { name: "Edit pesanan Kaos Studio · M · Navy", exact: true }).click();
  const oldForm = page.getByRole("dialog", { name: "Edit pesanan PO" });
  await expect(oldForm.getByLabel("Produk", { exact: true })).toHaveAttribute("data-value", "acceptance-product");
  await expectSelectOptions(oldForm.getByLabel("Produk", { exact: true }), /diarsipkan/, 1);
  await expect(oldForm.getByLabel("Batch PO")).toHaveAttribute("data-value", "acceptance-po-batch");
  await oldForm.getByLabel("Sudah dibayar (DP / lunas)").fill("350000");
  await oldForm.getByRole("button", { name: "Simpan pesanan" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Kaos Studio · M · Navy" })).toContainText("Lunas");
  await page.getByRole("tab", { name: /^Produk/ }).click();
  await chooseOption(page.getByLabel("Filter produk"), "archived");
  await page.getByRole("button", { name: "Aktifkan produk Kaos Studio" }).click();
  await page.getByRole("tab", { name: /^Batch PO/ }).click();
  await chooseOption(page.getByLabel("Status batch PO Studio Oktober"), "open");
  await page.getByRole("button", { name: "Pesanan PO baru", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Pesanan PO baru" }).getByLabel("Produk", { exact: true })).toHaveAttribute("data-value", "");
});

test("legacy browser data and version-1 backups migrate PO catalogue without changing transaction amounts", async ({ page }) => {
  const legacy = {
    batches: poFixture.batches,
    customers: poFixture.customers,
    orders: poFixture.orders.map((order) => {
      const snapshot = legacyOrder(order);
      delete snapshot.productId;
      return snapshot;
    }),
  };
  legacy.orders.push({
    ...legacy.orders[legacy.orders.length - 1], id: "acceptance-po-second",
    quantity: 1, unitPrice: 190000, unitCost: 115000, paid: 0,
  });
  await replaceWorkspace(page, legacy);
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*1\.160\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText(/Rp\s*350\.000/);
  const migrated = await exportWorkspace(page);
  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.data.products).toEqual([{
    id: "legacy-product-acceptance-po-order", name: "Kaos Studio · M · Navy", variant: "", sku: "",
    unitPrice: 175000, unitCost: 105000, active: true,
  }]);
  expect(migrated.data.orders.map((order: AppData["orders"][number]) => {
    const snapshot = legacyOrder(order);
    delete snapshot.productId;
    return snapshot;
  })).toEqual(legacy.orders);
  expect(migrated.data.orders.filter((order: AppData["orders"][number]) => order.batchId === "acceptance-po-batch")
    .map((order: AppData["orders"][number]) => order.items[0].productId)).toEqual([
    "legacy-product-acceptance-po-order", "legacy-product-acceptance-po-order",
  ]);

  await page.getByRole("button", { name: "Hapus semua data" }).click();
  await page.getByRole("dialog", { name: "Hapus semua data?" }).getByRole("button", { name: "Hapus data" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({
    name: "tippo-v1-backup.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 1, exportedAt: "2026-10-08T00:00:00.000Z", data: legacy })),
  });
  await expect(page.getByRole("status")).toContainText("Data berhasil dipulihkan");
  await navigate(page, "Ringkasan");
  await expect(stat(page, "Total penjualan")).toContainText(/Rp\s*1\.160\.000/);
  await expect(stat(page, "Estimasi margin")).toContainText(/Rp\s*350\.000/);
});

test("dashboard links to Open PO and the compact PO form fits mobile", async ({ page }) => {
  await replaceWorkspace(page, poFixture);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Pesanan baru", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Kelola Open PO/ }).click();
  await page.getByRole("button", { name: "Pesanan PO baru", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Pesanan PO baru" });
  await expect(form.getByLabel("Produk", { exact: true })).toBeVisible();
  await expect(form.getByLabel("Tanggal pesanan")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await chooseOption(form.getByLabel("Batch PO"), "acceptance-po-batch");
  await chooseOption(form.getByLabel("Pelanggan", {exact:true}), poFixture.customers[0].id);
  await chooseOption(form.getByLabel("Produk", {exact:true}), "acceptance-product");
  await form.getByLabel("Tanggal pesanan").fill("2026-10-08");
  await form.getByLabel("Jumlah produk").fill("3");
  await form.getByLabel("Sudah dibayar (DP / lunas)").fill("100000");
  await form.getByRole("button", { name: "Simpan pesanan" }).click();
  await modeOrders(page, "Open PO");
  await expect(page.getByRole("row").filter({ hasText: "Kaos Studio · M · Navy" })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Excel jastip previews real workbooks, blocks partial imports and preserves validated prices and payments", async ({ page }) => {
  await modeOrders(page, "Jastip");
  const { dialog, bytes } = await excelTemplate(page, "jastip");
  await expect(dialog.getByLabel("Batch tujuan")).toHaveAttribute("data-value", "acceptance-batch");
  const validRow = {
    nama_pelanggan: "Maya Excel", telepon: "081234567890", produk: "Tas Excel Acceptance",
    jumlah: 2, harga_jual: 100000, harga_beli: "", fee_jastip: 10000, ongkir: 5000,
    dp: 40000, tanggal: "2026-10-08", catatan: "Dari workbook penerimaan",
  };
  await dialog.getByLabel("File Excel").setInputFiles({
    name: "pesanan-jastip-invalid.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await workbookBytes(bytes, [validRow, { ...validRow, produk: "Baris invalid", jumlah: 0 }]),
  });
  await expect(dialog.getByRole("heading", { name: "Pratinjau pesanan" })).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("2 pesanan · 1 valid · 1 perlu diperbaiki");
  await expect(dialog.getByRole("button", { name: "Import 1 pesanan", exact: true })).toBeDisabled();
  expect(await workspaceOrderCount(page)).toBe(fixture.orders.length);
  await dialog.getByRole("button", { name: "Batal", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Tas Excel Acceptance" })).toHaveCount(0);

  await page.getByRole("button", { name: "Import Excel", exact: true }).click();
  const corrected = page.getByRole("dialog", { name: "Import Excel jastip" });
  await corrected.getByLabel("File Excel").setInputFiles({
    name: "pesanan-jastip-valid.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await workbookBytes(bytes, [validRow]),
  });
  await expect(corrected.getByRole("status")).toContainText("1 pesanan · 1 valid · 0 perlu diperbaiki");
  expect(await workspaceOrderCount(page)).toBe(fixture.orders.length);
  await corrected.getByRole("button", { name: "Import 1 pesanan", exact: true }).click();
  await expect(corrected).not.toBeVisible();
  const imported = page.getByRole("row").filter({ hasText: "Tas Excel Acceptance" });
  await expect(imported).toContainText("Maya Excel");
  await expect(imported).toContainText(/Rp\s*215\.000/);
  await expect(imported).toContainText("Belum lengkap");
  await expect(imported).toContainText(/Sisa Rp\s*175\.000/);
  expect(await workspaceOrderCount(page)).toBe(fixture.orders.length + 1);
  const order = await page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!).orders
    .find((entry: Order) => entry.items.some((item) => item.product === "Tas Excel Acceptance")));
  expect(order).toMatchObject({ items: [{ quantity: 2, unitPrice: 100000, unitCost: null }], paid: 40000 });
  await page.reload();
  await modeOrders(page, "Jastip");
  await expect(page.getByRole("row").filter({ hasText: "Tas Excel Acceptance" })).toHaveCount(1);
});

test("Excel PO template includes master references and imports SKU or exact name/variant with master snapshots", async ({ page }) => {
  await replaceWorkspace(page, poFixture);
  await page.setViewportSize({ width: 375, height: 812 });
  await modeOrders(page, "Open PO");
  const { dialog, bytes } = await excelTemplate(page, "PO");
  await expect(dialog.getByLabel("Batch tujuan")).toHaveAttribute("data-value", "acceptance-po-batch");
  await expectSelectOptions(dialog.getByLabel("Batch tujuan"), "Batch Uji Korea", 0);
  const reference = new ExcelJS.Workbook();
  await reference.xlsx.load(Uint8Array.from(bytes).buffer);
  const products = reference.getWorksheet("Produk")!;
  expect(products).toBeDefined();
  expect(JSON.stringify(products.getSheetValues())).toContain("STUDIO-NAVY-M");
  const buffer = await workbookBytes(bytes, [
    { nama_pelanggan: "Nadia Excel", telepon: "081111111111", sku_produk: "STUDIO-NAVY-M", jumlah: 3, ongkir: 15000, dp: 250000, tanggal: "2026-10-08", catatan: "SKU master" },
    { nama_pelanggan: "Lana Excel", telepon: "", sku_produk: "", produk: "Kaos Studio", varian: "M · Navy", jumlah: 1, ongkir: 0, dp: 100000, tanggal: "2026-10-08", catatan: "Nama dan varian master" },
  ]);
  await dialog.getByLabel("File Excel").setInputFiles({
    name: "pesanan-po-valid.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer,
  });
  await expect(dialog.getByRole("status")).toContainText("2 pesanan · 2 valid · 0 perlu diperbaiki");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await workspaceOrderCount(page)).toBe(poFixture.orders.length);
  await dialog.getByRole("button", { name: "Import 2 pesanan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const imported = page.getByRole("row").filter({ hasText: "Nadia Excel" });
  await expect(imported).toContainText("Kaos Studio · M · Navy");
  await expect(imported).toContainText(/Rp\s*540\.000/);
  await expect(imported).toContainText(/Rp\s*315\.000/);
  await expect(imported).toContainText(/Sisa Rp\s*290\.000/);
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!)) as AppData;
  expect(data.orders).toHaveLength(poFixture.orders.length + 2);
  expect(data.products).toEqual(poFixture.products);
  expect(data.orders.slice(-2).map((order) => ({ productId: order.items[0].productId, unitPrice: order.items[0].unitPrice, unitCost: order.items[0].unitCost }))).toEqual([
    { productId: "acceptance-product", unitPrice: 175000, unitCost: 105000 },
    { productId: "acceptance-product", unitPrice: 175000, unitCost: 105000 },
  ]);
});

test("a multi-item jastip order retains each option and copies a customer invoice without internal costs", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await modeOrders(page, "Jastip");
  await page.getByRole("button", { name: "Pesanan jastip baru", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Pesanan jastip baru" });
  const first = form.getByRole("group", { name: "Produk 1", exact: true });
  await first.getByLabel("Nama produk").fill("Kaos multi item");
  await first.getByLabel("Varian (opsional)").fill("Oversized");
  await first.getByLabel("Warna (opsional)").fill("Navy");
  await first.getByLabel("Ukuran (opsional)").fill("M");
  await first.getByLabel("Jumlah produk").fill("2");
  await first.getByLabel("Harga jual / produk").fill("100000");
  await first.getByLabel("Harga beli / produk").fill("60000");
  await form.getByRole("button", { name: "Tambah produk", exact: true }).click();
  const second = form.getByRole("group", { name: "Produk 2", exact: true });
  await second.getByLabel("Nama produk").fill("Nasi ayam multi item");
  await second.getByLabel("Varian (opsional)").fill("Pedas");
  await second.getByLabel("Ukuran (opsional)").fill("Porsi besar");
  await second.getByLabel("Harga jual / produk").fill("50000");
  await second.getByLabel("Harga beli / produk").fill("30000");
  await form.getByLabel("Fee jastip / pesanan").fill("10000");
  await form.getByLabel("Ongkir yang ditagihkan").fill("5000");
  await form.getByLabel("Sudah dibayar (DP / lunas)").fill("100000");
  await form.getByLabel("Catatan invoice (opsional)").fill("Tolong bungkus rapi");
  await form.getByRole("button", { name: "Simpan pesanan" }).click();
  await expect(form).not.toBeVisible();
  expect(await workspaceOrderCount(page)).toBe(fixture.orders.length + 1);
  const row = page.getByRole("row").filter({ hasText: "Kaos multi item" });
  await expect(row).toContainText("Nasi ayam multi item");
  await expect(row).toContainText("Oversized · Navy · M");
  await expect(row).toContainText("Pedas · Porsi besar");
  await expect(row).toContainText(/Rp\s*265\.000/);
  await expect(row).toContainText(/Sisa Rp\s*165\.000/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!).orders.at(-1)) as Order;
  expect(saved.items).toHaveLength(2);
  expect(saved.items[0]).toMatchObject({ variant: "Oversized", color: "Navy", size: "M", quantity: 2 });
  expect(saved.items[1]).toMatchObject({ product: "Nasi ayam multi item", variant: "Pedas", size: "Porsi besar" });
  expect(saved).toMatchObject({ serviceFee: 10000, shippingCharge: 5000, paid: 100000, createdAt: "2026-10-08T05:00:00.000Z" });

  await row.getByRole("button", { name: /^Invoice / }).click();
  const invoice = page.getByRole("dialog", { name: "Invoice pesanan" });
  const text = await invoice.getByLabel("Isi invoice untuk WhatsApp").inputValue();
  expect(text).toContain("Kaos multi item · Oversized · Navy · M");
  expect(text).toContain("Nasi ayam multi item · Pedas · Porsi besar");
  expect(text).toMatch(/Total tagihan\*: Rp\s*265\.000/);
  expect(text).toMatch(/Sisa tagihan\*: Rp\s*165\.000/);
  expect(text).not.toMatch(/HPP|Harga beli|Margin|60\.000|30\.000/);
  await invoice.getByRole("button", { name: "Salin invoice WhatsApp", exact: true }).click();
  await expect(invoice.getByRole("status")).toContainText("Invoice disalin.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  await invoice.getByRole("button", { name: "Tutup invoice", exact: true }).click();
  await page.reload();
  await modeOrders(page, "Jastip");
  await expect(page.getByRole("row").filter({ hasText: "Kaos multi item" })).toContainText("Porsi besar");
});

test("one PO order contains multiple catalogue products with one payment and stable snapshots", async ({ page }) => {
  const data = structuredClone(poFixture);
  data.products.push({ id: "second-po-product", name: "Kue cokelat", variant: "Kotak 4", sku: "KUE-4", unitPrice: 50000, unitCost: 30000, active: true });
  await replaceWorkspace(page, data);
  await modeOrders(page, "Open PO");
  await page.getByRole("button", { name: "Pesanan PO baru", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Pesanan PO baru" });
  await chooseOption(form.getByLabel("Batch PO"), "acceptance-po-batch");
  await chooseOption(form.getByLabel("Pelanggan", {exact:true}), poFixture.customers[0].id);
  await form.getByLabel("Tanggal pesanan").fill("2026-10-08");
  await form.getByLabel("Jumlah produk").fill("1");
  await chooseOption(form.getByRole("group", { name: "Produk 1", exact: true }).getByLabel("Produk", { exact: true }), "acceptance-product");
  await form.getByRole("button", { name: "Tambah produk", exact: true }).click();
  const second = form.getByRole("group", { name: "Produk 2", exact: true });
  await chooseOption(second.getByLabel("Produk", { exact: true }), "second-po-product");
  await second.getByLabel("Jumlah produk").fill("2");
  await form.getByLabel("Sudah dibayar (DP / lunas)").fill("75000");
  await form.getByRole("button", { name: "Simpan pesanan" }).click();
  await expect(form).not.toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Kue cokelat" });
  await expect(row).toContainText("Kaos Studio");
  await expect(row).toContainText(/Rp\s*275\.000/);
  await expect(row).toContainText(/Rp\s*165\.000/);
  await expect(row).toContainText(/Sisa Rp\s*200\.000/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!).orders.at(-1)) as Order;
  expect(saved.items.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice }))).toEqual([
    { productId: "acceptance-product", quantity: 1, unitPrice: 175000 },
    { productId: "second-po-product", quantity: 2, unitPrice: 50000 },
  ]);
  await navigate(page, "Open PO");
  await page.getByRole("tab", { name: /^Produk/ }).click();
  await page.getByRole("button", { name: "Edit produk Kue cokelat" }).click();
  const master = page.getByRole("dialog", { name: "Edit produk" });
  await master.getByLabel("Harga jual / unit").fill("80000");
  await master.getByRole("button", { name: "Simpan produk" }).click();
  await page.getByRole("tab", { name: /^Pesanan/ }).click();
  await page.getByRole("row").filter({ hasText: "Kue cokelat" }).getByRole("button", { name: /^Edit pesanan/ }).click();
  const edit = page.getByRole("dialog", { name: "Edit pesanan PO" });
  await expect(edit.getByRole("group", { name: "Produk 2", exact: true })).toContainText(/Rp\s*50\.000/);
  await edit.getByLabel("Sudah dibayar (DP / lunas)").fill("100000");
  await edit.getByRole("button", { name: "Simpan pesanan" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Kue cokelat" })).toContainText(/Rp\s*275\.000/);
});

test("Excel groups item rows into one order and counts fee, shipping and payment only once", async ({ page }) => {
  await modeOrders(page, "Jastip");
  const { dialog, bytes } = await excelTemplate(page, "jastip");
  const grouped = await workbookBytes(bytes, [
    { nomor_pesanan: "MULTI-001", nama_pelanggan: "Maya Group Excel", telepon: "081234567891", produk: "Kaos grouped", varian: "Oversized", warna: "Navy", ukuran: "M", jumlah: 2, harga_jual: 100000, harga_beli: 60000, fee_jastip: 10000, ongkir: 5000, dp: 100000, tanggal: "2026-10-08", catatan: "Satu pembayaran" },
    { nomor_pesanan: "MULTI-001", produk: "Nasi grouped", varian: "Pedas", ukuran: "Besar", jumlah: 1, harga_jual: 50000, harga_beli: 30000 },
  ]);
  await dialog.getByLabel("File Excel").setInputFiles({ name: "multi-item-jastip.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: grouped });
  await expect(dialog.getByRole("status")).toContainText("1 pesanan · 1 valid · 0 perlu diperbaiki");
  await expect(dialog).toContainText("2 baris produk");
  await dialog.getByRole("button", { name: "Import 1 pesanan", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await workspaceOrderCount(page)).toBe(fixture.orders.length + 1);
  const row = page.getByRole("row").filter({ hasText: "Maya Group Excel" });
  await expect(row).toContainText("Kaos grouped");
  await expect(row).toContainText("Nasi grouped");
  await expect(row).toContainText(/Rp\s*265\.000/);
  await expect(row).toContainText(/Sisa Rp\s*165\.000/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tippo.workspace.v1")!).orders.at(-1)) as Order;
  expect(saved.items).toHaveLength(2);
  expect(saved).toMatchObject({ serviceFee: 10000, shippingCharge: 5000, paid: 100000 });
});

test("customers can be added and edited without creating an order, with toast at the top", async ({page}) => {
  await navigate(page,"Pelanggan");
  await expect(page.getByRole("button",{name:"Pesanan baru",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Tambah pelanggan",exact:true}).click();
  let form=page.getByRole("dialog",{name:"Tambah pelanggan",exact:true});
  await form.getByLabel("Nama pelanggan",{exact:true}).fill("   ");await form.getByRole("button",{name:"Simpan pelanggan",exact:true}).click();
  await expect(form.getByRole("alert")).toHaveText("Isi nama pelanggan.");
  await form.getByLabel("Nama pelanggan",{exact:true}).fill("  Sari Pelanggan Baru  ");await form.getByLabel("Nomor WhatsApp (opsional)").fill("081234567890");
  await form.getByLabel("Alamat (opsional)").fill("  Jalan Melati 12\nBandung 40111  ");
  await form.getByRole("button",{name:"Simpan pelanggan",exact:true}).click();await expect(form).not.toBeVisible();
  await expect(page.getByRole("heading",{name:"Sari Pelanggan Baru",exact:true})).toBeVisible();
  await expect(page.locator(".toast")).toContainText("Pelanggan berhasil ditambahkan");
  const box=await page.locator(".toast").boundingBox();expect(box!.y).toBeLessThan(50);
  expect(await workspaceOrderCount(page)).toBe(fixture.orders.length);
  await page.reload();await navigate(page,"Pelanggan");
  await page.getByRole("button",{name:/Sari Pelanggan Baru.*Edit pelanggan/}).click();
  form=page.getByRole("dialog",{name:"Edit pelanggan",exact:true});
  await expect(form.getByLabel("Alamat (opsional)")).toHaveValue("Jalan Melati 12\nBandung 40111");
  await form.getByLabel("Alamat (opsional)").fill("");
  await form.getByLabel("Nama pelanggan",{exact:true}).fill("Sari Baru");await form.getByRole("button",{name:"Simpan pelanggan",exact:true}).click();await expect(form).not.toBeVisible();
  await expect(page.getByRole("heading",{name:"Sari Baru",exact:true})).toBeVisible();
  for(const name of ["Ringkasan","HPP & Margin"]){await navigate(page,name);await expect(page.getByRole("button",{name:"Pesanan baru",exact:true})).toHaveCount(0);}
});

test("the first customer can be created from the empty customer page", async ({page}) => {
  await replaceWorkspace(page,{...fixture,customers:[],orders:[]});await navigate(page,"Pelanggan");
  await expect(page.getByRole("heading",{name:"Pelanggan pertamamu akan muncul di sini"})).toBeVisible();
  await page.getByRole("button",{name:"Tambah pelanggan",exact:true}).last().click();
  const form=page.getByRole("dialog",{name:"Tambah pelanggan",exact:true});await form.getByLabel("Nama pelanggan",{exact:true}).fill("Pelanggan Pertama");await form.getByRole("button",{name:"Simpan pelanggan",exact:true}).click();await expect(form).not.toBeVisible();
  await expect(page.getByRole("heading",{name:"Pelanggan Pertama",exact:true})).toBeVisible();
  const customers=await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!).customers);expect(customers).toHaveLength(1);expect(customers[0].phone).toBe("");expect(customers[0].address).toBe("");expect(await workspaceOrderCount(page)).toBe(0);
});

test("HPP save appears only for a selected batch with active orders", async ({page}) => {
  const data=structuredClone(fixture);
  data.batches.push({...data.batches[0],id:"empty-hpp",name:"Batch kosong",directCosts:0});
  data.batches.push({...data.batches[0],id:"cancelled-hpp",name:"Batch batal",directCosts:0});
  data.orders.find(order=>order.status==="cancelled")!.batchId="cancelled-hpp";
  await replaceWorkspace(page,data);
  await navigate(page,"HPP & Margin");
  await chooseOption(page.getByLabel("Pilih batch untuk HPP"),"empty-hpp");
  await expect(page.getByText("Belum ada pesanan aktif untuk dihitung.", {exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Simpan harga beli",exact:true})).toHaveCount(0);
  await expect(page.locator(".hpp-save-footer")).toHaveCount(0);
  await chooseOption(page.getByLabel("Pilih batch untuk HPP"),"cancelled-hpp");
  await expect(page.getByRole("button",{name:"Simpan harga beli",exact:true})).toHaveCount(0);
  await chooseOption(page.getByLabel("Pilih batch untuk HPP"),"acceptance-batch");
  await expect(page.getByRole("button",{name:"Simpan harga beli",exact:true})).toBeVisible();
  await expect(page.getByText(/Masukkan ongkir supplier atau kemasan/)).toHaveCount(0);
});

test("record partial refund then refund remaining payment and cancel without losing history",async({page})=>{
 await modeOrders(page,"Jastip");
 await page.getByRole("button",{name:"Refund Tote Acceptance",exact:true}).click();
 let dialog=page.getByRole("dialog",{name:"Refund pesanan",exact:true});
 await dialog.getByLabel("Nominal refund",{exact:true}).fill("999999999");await dialog.getByRole("button",{name:"Catat refund",exact:true}).click();await expect(dialog.getByRole("alert")).toContainText("tidak melebihi");
 await dialog.getByLabel("Nominal refund",{exact:true}).fill("50000");await dialog.getByRole("button",{name:"Catat refund",exact:true}).click();await expect(dialog).not.toBeVisible();
 await page.getByRole("button",{name:"Refund Tote Acceptance",exact:true}).click();dialog=page.getByRole("dialog",{name:"Refund pesanan",exact:true});await expect(dialog.getByRole("heading",{name:"Riwayat refund"})).toBeVisible();
 await dialog.getByRole("checkbox",{name:"Refund seluruh pembayaran dan batalkan pesanan"}).check();await dialog.getByRole("button",{name:"Catat refund",exact:true}).click();await expect(dialog).not.toBeVisible();
 await page.reload();await modeOrders(page,"Jastip");await expect(page.getByLabel("Status pesanan Tote Acceptance untuk Maya Demo")).toHaveAttribute("data-value","cancelled");
 const order=await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!).orders.find((o:{items:{product:string}[]})=>o.items[0].product==="Tote Acceptance"));expect(order.paid).toBe(0);expect(order.refunds).toHaveLength(2);expect(order.refunds.reduce((sum:number,r:{amount:number})=>sum+r.amount,0)).toBe(100000);
 await page.getByRole("button",{name:"Invoice Tote Acceptance",exact:true}).click();await expect(page.getByLabel("Isi invoice untuk WhatsApp")).toHaveValue(/Refund: Rp\s*100\.000/);
});

test("product category saves, persists and filters the catalogue",async({page})=>{
 await navigate(page,"Open PO");await page.getByRole("button",{name:"Produk baru",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Produk baru",exact:true});await dialog.getByLabel("Nama produk",{exact:true}).fill("Kategori Uji");await dialog.getByLabel("Kategori (opsional)").fill("Makanan");await dialog.getByLabel("Harga jual / unit",{exact:true}).fill("25000");await dialog.getByRole("button",{name:"Simpan produk",exact:true}).click();await expect(dialog).not.toBeVisible();
 await chooseOption(page.getByLabel("Filter kategori produk"),"Makanan");await expect(page.getByRole("heading",{name:"Kategori Uji",exact:true})).toBeVisible();await expect(page.locator(".product-row")).toHaveCount(1);
 await page.reload();await navigate(page,"Open PO");await page.getByRole("button",{name:"Edit produk Kategori Uji",exact:true}).click();await expect(page.getByLabel("Kategori (opsional)")).toHaveValue("Makanan");
});

 test("payment shortcuts and four status choices work", async ({page})=>{
 await modeOrders(page,"Jastip");
 const status=page.getByLabel("Status pesanan Tote Acceptance untuk Maya Demo");
 await expect(status).toHaveText(/Tercatat/);
 await status.click();await expect(page.getByRole("option")).toHaveCount(4);await page.keyboard.press("Escape");
 await page.getByRole("button",{name:"Edit pesanan Tote Acceptance",exact:true}).click();
 const form=page.getByRole("dialog",{name:"Edit pesanan jastip"});
 await form.getByRole("button",{name:"Lunas",exact:true}).click();await expect(form.getByLabel("Sudah dibayar (DP / lunas)")).toHaveValue("330.000");
 await form.getByRole("button",{name:"Bayar sebagian",exact:true}).click();await expect(form.getByLabel("Sudah dibayar (DP / lunas)")).toHaveValue("");await expect(form.getByLabel("Sudah dibayar (DP / lunas)")).toBeFocused();
 await form.getByRole("button",{name:"Batal",exact:true}).click();
 const data=structuredClone(poFixture);data.products[0].category="Pakaian";await replaceWorkspace(page,data);await navigate(page,"Open PO");
 await page.getByRole("button",{name:"Produk baru",exact:true}).click();await chooseOption(page.getByLabel("Pilih kategori tersimpan"),"Pakaian");await expect(page.getByLabel("Kategori (opsional)")).toHaveValue("Pakaian");await page.getByLabel("Kategori (opsional)").fill("Kategori baru");await expect(page.getByLabel("Kategori (opsional)")).toHaveValue("Kategori baru");
 await page.getByRole("dialog",{name:"Produk baru",exact:true}).getByRole("button",{name:"Batal",exact:true}).click();await modeOrders(page,"Open PO");await page.getByRole("button",{name:/Edit pesanan Kaos Studio/}).click();const po=page.getByRole("dialog",{name:"Edit pesanan PO"});await po.getByRole("button",{name:"Lunas",exact:true}).click();await expect(po.getByLabel("Sudah dibayar (DP / lunas)")).toHaveValue("350.000");await po.getByRole("button",{name:"Bayar sebagian",exact:true}).click();await expect(po.getByLabel("Sudah dibayar (DP / lunas)")).toBeFocused();

 });

test("single active batch is selected and delivery fields precede payment",async({page})=>{
 await replaceWorkspace(page,poFixture);await navigate(page,"Open PO");await page.getByRole("button",{name:"Pesanan PO baru",exact:true}).click();const d=page.getByRole("dialog",{name:"Pesanan PO baru",exact:true});await expect(d.getByLabel("Batch PO",{exact:true})).toHaveAttribute("data-value","acceptance-po-batch");await expect(d.getByLabel("Ongkir yang ditagihkan")).toBeVisible();await expect(d.getByLabel("Catatan invoice (opsional)",{exact:true})).toBeVisible();const positions=await d.evaluate(e=>['po-order-shippingCharge','po-order-notes','po-order-paid'].map(id=>e.querySelector('#'+id)!.getBoundingClientRect().top));expect(positions[0]).toBeLessThan(positions[1]);expect(positions[1]).toBeLessThan(positions[2]);const widths=await d.evaluate(e=>['po-order-productId','po-order-quantity'].map(id=>e.querySelector('#'+id)!.getBoundingClientRect().width));expect(Math.abs(widths[0]-widths[1])).toBeLessThan(1);
});

test("new PO batch choices exclude closed and completed batches",async({page})=>{
 const data=structuredClone(poFixture);data.batches.push({...data.batches.find(b=>b.type==="po")!,id:"closed-po",name:"PO Tutup",status:"closed"},{...data.batches.find(b=>b.type==="po")!,id:"done-po",name:"PO Selesai",status:"completed"});await replaceWorkspace(page,data);await navigate(page,"Open PO");await page.getByRole("button",{name:"Pesanan PO baru",exact:true}).click();const d=page.getByRole("dialog",{name:"Pesanan PO baru",exact:true});await d.getByLabel("Batch PO",{exact:true}).click();await expect(page.getByRole("option",{name:/PO Tutup|PO Selesai/})).toHaveCount(0);await expect(page.getByRole("option",{name:"PO Studio Oktober",exact:true})).toBeVisible();await page.keyboard.press("Escape");await expect(d.locator(".order-section-number")).toHaveText(["1","2","3","4"]);
});

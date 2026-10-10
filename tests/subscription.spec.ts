import { chooseOption } from "./select-helper";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { seedData } from "../src/lib/seed";
import type { AppData, BatchType, Order } from "../src/lib/types";

const NOW = "2026-10-08T05:00:00.000Z";
const WORKSPACE_KEY = "tippo.workspace.v1";
const USAGE_KEY = "tippo.usage.demo.v1";
const SUBSCRIPTION_KEY = "tippo.subscription.demo.v1";
const customer = seedData.customers[0];
const openBatches = seedData.batches.filter((batch) => batch.status === "open");

function order(key: string, type: BatchType = "jastip", overrides: Partial<Order> = {}): Order {
  return {
    id: `billing-${type}-${key}`, batchId: openBatches.find((batch) => batch.type === type)!.id,
    customerId: customer.id, createdAt: NOW, date: "2026-10-08", serviceFee: 0,
    shippingCharge: 0, paid: 0, status: "new", notes: "",
    items: [{
      id: `billing-item-${type}-${key}`, product: `Titipan ${key}`, quantity: 1,
      unitPrice: 50_000, unitCost: 25_000, variant: "", color: "", size: "",
      ...(type === "po" ? { productId: seedData.products[0].id } : {}),
    }],
    ...overrides,
  };
}

function workspace(orders: Order[] = []): AppData {
  return {
    batches: openBatches.map((batch) => ({ ...batch, directCosts: 0 })),
    customers: [{ ...customer }], products: seedData.products.map((product) => ({ ...product })), orders,
  };
}

const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), "No browser errors in subscription workflows").toEqual([]);
});

async function openWorkspace(page: Page, data: AppData) {
  await page.addInitScript(({ data, workspaceKey, usageKey, subscriptionKey }) => {
    if (!sessionStorage.getItem("tippo.billing.initialized")) {
      localStorage.setItem(workspaceKey, JSON.stringify(data));
      localStorage.removeItem(usageKey);
      localStorage.removeItem(subscriptionKey);
      sessionStorage.setItem("tippo.billing.initialized", "1");
    }
  }, { data, workspaceKey: WORKSPACE_KEY, usageKey: USAGE_KEY, subscriptionKey: SUBSCRIPTION_KEY });
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Ringkasan usaha." })).toBeVisible();
  await expect(page.locator(".plan-pill")).toHaveText("Gratis");
}

async function navigate(page: Page, label: string) {
  await page.locator(".sidebar").getByRole("button", { name: label, exact: true }).click();
}

async function modeOrders(page: Page, mode: "Jastip" | "Open PO") {
  await navigate(page, mode);
  await page.getByRole("tab", { name: /^Pesanan/ }).click();
}

async function savedData(page: Page): Promise<AppData> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), WORKSPACE_KEY);
}

async function usageLedger(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]") as { orderId: string; type: BatchType; month: string }[], USAGE_KEY);
}

async function fillJastipItem(group: Locator, name: string, price = "50000") {
  await group.getByLabel("Nama barang", { exact: true }).fill(name);
  await group.getByLabel("Jumlah barang", { exact: true }).fill("1");
  await group.getByLabel("Harga jual / barang", { exact: true }).fill(price);
  await group.getByLabel("Harga beli / barang", { exact: true }).fill("25000");
}

async function restoreBackup(page: Page, data: AppData) {
  await navigate(page, "Pengaturan data");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".settings-layout input[type=file]").setInputFiles({
    name: "billing-backup.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 3, data })),
  });
}

test("Free allows five customer orders per mode and multiple items consume one slot", async ({ page }) => {
  const initial = workspace([
    ...Array.from({ length: 4 }, (_, index) => order(String(index), "jastip")),
    ...Array.from({ length: 4 }, (_, index) => order(String(index), "po")),
  ]);
  await openWorkspace(page, initial);
  await navigate(page, "Jastip");
  await page.getByRole("button", { name: "Pesanan jastip baru", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Pesanan jastip baru" });
  await chooseOption(form.getByLabel("Pelanggan", { exact: true }), customer.id);
  const first = form.getByRole("group", { name: "Barang 1", exact: true });
  await fillJastipItem(first, "Nasi ayam kelima");
  await first.getByLabel("Varian (opsional)", { exact: true }).fill("Pedas");
  await form.getByRole("button", { name: "Tambah barang", exact: true }).click();
  const second = form.getByRole("group", { name: "Barang 2", exact: true });
  await fillJastipItem(second, "Kaos kelima", "75000");
  await second.getByLabel("Warna (opsional)", { exact: true }).fill("Navy");
  await second.getByLabel("Ukuran (opsional)", { exact: true }).fill("M");
  await form.getByRole("button", { name: "Simpan pesanan", exact: true }).click();
  await expect(form).not.toBeVisible();
  await expect(page.locator(".quota-banner")).toContainText("Jastip 5 / 5 · Open PO 4 / 5");
  expect((await savedData(page)).orders.find((entry) => entry.items[0].product === "Nasi ayam kelima")!.items).toHaveLength(2);

  await page.getByRole("button", { name: "Pesanan jastip baru", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Paket & langganan." })).toBeVisible();
  await expect(page.locator(".toast")).toContainText("Kuota Gratis Jastip tersisa 0");
  await expect(page.getByRole("dialog", { name: "Pesanan jastip baru" })).toHaveCount(0);

  await navigate(page, "Open PO");
  await page.getByRole("button", { name: "Pesanan PO baru", exact: true }).click();
  const poForm = page.getByRole("dialog", { name: "Pesanan PO baru" });
  await chooseOption(poForm.getByLabel("Batch PO"), initial.batches.find(batch=>batch.type==="po")!.id);
  await poForm.getByLabel("Tanggal pesanan").fill("2026-10-08");
  await chooseOption(poForm.getByLabel("Pelanggan", { exact: true }), customer.id);
  await chooseOption(poForm.getByLabel("Produk", { exact: true }), initial.products[0].id);
  await poForm.getByLabel("Jumlah barang", { exact: true }).fill("2");
  await poForm.getByRole("button", { name: "Tambah barang", exact: true }).click();
  await chooseOption(poForm.getByRole("group", { name: "Barang 2", exact: true }).getByLabel("Produk", { exact: true }), initial.products[1].id);
  await poForm.getByRole("group", {name:"Barang 2",exact:true}).getByLabel("Jumlah barang").fill("1");
  await poForm.getByRole("button", { name: "Simpan pesanan", exact: true }).click();
  await expect(poForm).not.toBeVisible();
  await expect(page.locator(".quota-banner")).toContainText("Jastip 5 / 5 · Open PO 5 / 5");
  expect((await savedData(page)).orders).toHaveLength(10);
  await page.getByRole("button", { name: "Pesanan PO baru", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Kuota Gratis Open PO tersisa 0");
  expect((await savedData(page)).orders).toHaveLength(10);
});

test("cancellation, backdating, clearing data and restoring the same backup preserve spent quota", async ({ page }) => {
  await openWorkspace(page, workspace(Array.from({ length: 5 }, (_, index) => order(String(index)))));
  await modeOrders(page, "Jastip");
  await chooseOption(page.getByLabel(`Status pesanan Titipan 0 untuk ${customer.name}`, { exact: true }), "cancelled");
  await page.getByRole("button", { name: "Edit pesanan Titipan 1", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit pesanan jastip" });
  await edit.getByLabel("Tanggal pesanan", { exact: true }).fill("2026-09-01");
  await edit.getByRole("button", { name: "Simpan pesanan", exact: true }).click();
  await expect(edit).not.toBeVisible();
  const backup = await savedData(page);
  expect(backup.orders.find((entry) => entry.id === "billing-jastip-1")!.createdAt).toBe(NOW);
  await expect(page.locator(".quota-banner")).toContainText("Jastip 5 / 5");

  await navigate(page, "Pengaturan data");
  await page.getByRole("button", { name: "Hapus semua & mulai kosong", exact: true }).click();
  await page.getByRole("dialog", { name: "Mulai tanpa data contoh?" }).getByRole("button", { name: "Ya, mulai kosong", exact: true }).click();
  await expect.poll(async () => (await savedData(page)).orders.length).toBe(0);
  expect(await usageLedger(page)).toHaveLength(5);
  await navigate(page, "Jastip");
  await page.getByRole("button", { name: "Pesanan jastip baru", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Kuota Gratis Jastip tersisa 0");

  await restoreBackup(page, backup);
  await expect(page.locator(".toast")).toContainText("Data berhasil dipulihkan");
  expect((await savedData(page)).orders).toHaveLength(5);
  expect(await usageLedger(page)).toHaveLength(5);
  await restoreBackup(page, backup);
  await expect(page.locator(".toast")).toContainText("Data berhasil dipulihkan");
  expect(await usageLedger(page)).toHaveLength(5);
  await restoreBackup(page, { ...backup, orders: [...backup.orders, order("extra")] });
  await expect(page.locator(".toast")).toContainText("Kuota Gratis Jastip tersisa 0");
  expect((await savedData(page)).orders).toHaveLength(5);
});

test("Free product cap includes archived masters while existing products remain editable", async ({ page }) => {
  const initial = workspace();
  initial.products.push(...Array.from({ length: 3 }, (_, index) => ({ ...initial.products[0], id: `billing-product-${index}`, name: `Produk tambahan ${index}`, sku: `BILLING-${index}` })));
  await openWorkspace(page, initial);
  await navigate(page, "Open PO");
  await page.getByRole("button", { name: `Arsipkan produk ${initial.products[0].name}`, exact: true }).click();
  expect((await savedData(page)).products).toHaveLength(5);
  await expect(page.locator(".catalog-note")).toContainText("5 / 5 produk Gratis (termasuk arsip)");
  await page.getByRole("button", { name: "Produk baru", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Paket & langganan." })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Produk baru", exact: true })).toHaveCount(0);

  await navigate(page, "Open PO");
  await page.getByRole("button", { name: `Edit produk ${initial.products[1].name}`, exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit produk", exact: true });
  await edit.getByLabel("Harga jual / unit", { exact: true }).fill("160000");
  await edit.getByRole("button", { name: "Simpan produk", exact: true }).click();
  await expect(edit).not.toBeVisible();
  expect((await savedData(page)).products.find((entry) => entry.id === initial.products[1].id)!.unitPrice).toBe(160000);
  expect((await savedData(page)).products).toHaveLength(5);
});

test("Free summaries reveal only the current month; explicit Pro demo unlocks history until exact expiry", async ({ page }) => {
  const past = order("past", "jastip", { date: "2026-09-01", createdAt: "2026-09-01T05:00:00.000Z" });
  past.items[0].unitPrice = 190000;
  const future = order("future", "jastip", { date: "2026-11-01", createdAt: "2026-11-01T05:00:00.000Z" });
  future.items[0].unitPrice = 30000;
  await openWorkspace(page, workspace([past, order("current"), future]));
  const monthSelect = page.getByLabel("Pilih bulan ringkasan", { exact: true });
  await expect(monthSelect).toBeDisabled();
  await expect(monthSelect).toHaveAttribute("data-value", "2026-10");
  await expect(monthSelect).toHaveText("Oktober 2026");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.locator(".chart-summary")).toContainText(/Rp\s*50\.000/);
  await expect(page.locator(".chart-summary")).not.toContainText("Total penjualan tahun ini");
  await expect(page.getByRole("img", { name: /^Grafik Oktober 2026/ })).toHaveAttribute("aria-label", /penjualan Rp\s*50\.000/);
  await expect(page.locator(".chart-card")).not.toContainText(/190\.000|270\.000/);

  await navigate(page, "Paket & langganan");
  await expect(page.getByRole("region", { name: "Paket Pro", exact: true })).toContainText("Rp25.000");
  await page.getByRole("button", { name: "Coba Pro (demo)", exact: true }).click();
  await expect(page.locator(".plan-pill")).toHaveText("Pro (demo)");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SUBSCRIPTION_KEY)).toEqual({ tier: "pro", expiresAt: "2026-11-08T05:00:00.000Z", mode: "demo" });
  await navigate(page, "Ringkasan");
  await expect(monthSelect).toBeEnabled();
  await chooseOption(monthSelect, "2026-09");
  await expect(page.locator(".stat-card").filter({ hasText: "Total penjualan" })).toContainText(/Rp\s*190\.000/);
  await expect(page.locator(".chart-summary")).toContainText(/Rp\s*270\.000/);

  await page.clock.setFixedTime(new Date("2026-11-08T04:59:59.999Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".plan-pill")).toHaveText("Pro (demo)");
  await page.clock.setFixedTime(new Date("2026-11-08T05:00:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".plan-pill")).toHaveText("Gratis");
  await expect(monthSelect).toBeDisabled();
  await expect(monthSelect).toHaveAttribute("data-value", "2026-11");
  await expect(page.locator(".chart-summary")).toContainText(/Rp\s*30\.000/);
  await expect(page.locator(".chart-summary")).not.toContainText(/190\.000|270\.000/);
  expect((await savedData(page)).orders).toHaveLength(3);
});

test("quota becomes available at Jakarta midnight on the first without deleting previous orders", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T16:59:59.999Z"));
  await openWorkspace(page, workspace(Array.from({ length: 5 }, (_, index) => order(String(index)))));
  await navigate(page, "Jastip");
  await page.getByRole("button", { name: "Pesanan jastip baru", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Kuota Gratis Jastip tersisa 0");
  await page.clock.setFixedTime(new Date("2026-10-31T17:00:00.000Z"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ringkasan usaha." })).toBeVisible();
  await expect(page.getByLabel("Pilih bulan ringkasan", { exact: true })).toHaveAttribute("data-value", "2026-11");
  await expect(page.locator(".quota-banner")).toContainText("Jastip 0 / 5");
  await navigate(page, "Jastip");
  await page.getByRole("button", { name: "Pesanan jastip baru", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Pesanan jastip baru" });
  await expect(form.getByLabel("Tanggal pesanan", { exact: true })).toHaveValue("2026-11-01");
  await chooseOption(form.getByLabel("Pelanggan", { exact: true }), customer.id);
  await fillJastipItem(form.getByRole("group", { name: "Barang 1", exact: true }), "Titipan bulan baru");
  await form.getByRole("button", { name: "Simpan pesanan", exact: true }).click();
  await expect(form).not.toBeVisible();
  await expect(page.locator(".quota-banner")).toContainText("Jastip 1 / 5");
  const saved = await savedData(page);
  expect(saved.orders).toHaveLength(6);
  expect(saved.orders.find((entry) => entry.items[0].product === "Titipan bulan baru")!.createdAt).toBe("2026-10-31T17:00:00.000Z");
});

test("Free cannot access product, Jastip or PO Excel templates and manual input remains available", async ({ page }) => {
  await openWorkspace(page, workspace([]));
  for (const mode of ["Jastip", "Open PO"] as const) {
    await modeOrders(page, mode);
    await expect(page.getByText("Isi pesanan secara manual. Import template Excel tersedia di Pro.")).toBeVisible();
    await page.getByRole("button", {name:"Import Excel",exact:true}).click();
    await expect(page.getByRole("region",{name:"Paket Pro"})).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await navigate(page,"Open PO");
  await page.getByRole("tab",{name:/Produk/}).click();
  await page.getByRole("button",{name:"Import produk Excel",exact:true}).click();
  await expect(page.getByRole("region",{name:"Paket Pro"})).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await savedData(page)).orders).toHaveLength(0);
  await navigate(page,"Open PO");
  await page.getByRole("tab",{name:/Produk/}).click();
  await page.getByRole("button",{name:"Produk baru",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Produk baru",exact:true})).toBeVisible();
});

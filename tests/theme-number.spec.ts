import { expect, test } from "@playwright/test";

test("theme is selectable from public header and account, and persists across pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", {name:"Mode gelap", exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/masuk");
  await expect(page.getByRole("button", {name:"Mode terang", exact:true})).toBeVisible();
  await page.goto("/demo");
  await page.getByRole("button", {name:"Menu akun", exact:true}).click();
  await page.getByRole("menuitem", {name:"Mode terang", exact:true}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("product entry groups rupiah and stores raw amounts, preserving unknown cost", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("navigation", {name:"Navigasi utama"}).getByRole("button",{name:"Open PO",exact:true}).click();
  await page.getByRole("button", {name:"Produk baru",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Produk baru",exact:true});
  await dialog.getByLabel("Nama produk",{exact:true}).fill("Uji nominal");
  const price=dialog.getByLabel("Harga jual / unit",{exact:true});
  await price.fill("150000");
  await expect(price).toHaveValue("150.000");
  await price.press("Home");
  await price.press("ArrowRight");
  await price.press("2");
  await expect(price).toHaveValue("1.250.000");
  await price.press("Backspace");
  await expect(price).toHaveValue("150.000");
  await price.fill("175.000");
  await expect(price).toHaveValue("175.000");
  await dialog.getByRole("button",{name:/Simpan produk/}).click();
  await expect(dialog).not.toBeVisible();
  const product=await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!).products.find((p:{name:string})=>p.name==="Uji nominal"));
  expect(product.unitPrice).toBe(175000);
  expect(product.unitCost).toBeNull();
});

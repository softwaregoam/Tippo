import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`required stars are red and backdrop preserves form drafts in ${theme}`, async ({ page }) => {
    await page.addInitScript(theme => { localStorage.setItem("tippo.theme.v1", theme); localStorage.setItem("tippo.subscription.demo.v1", JSON.stringify({tier:"pro",expiresAt:"2099-01-01T00:00:00Z",mode:"demo"})); }, theme);
    await page.goto("/demo");
    const navigate = async (name: string) => page.getByRole("navigation",{name:"Navigasi utama"}).getByRole("button",{name,exact:true}).click();
    const checkBackdrop = async (title: string, field?: string) => {
      const dialog=page.getByRole("dialog",{name:title,exact:true});
      if(field)await dialog.getByLabel(field,{exact:true}).fill("Isian tetap ada");
      await page.mouse.click(2,2);
      await expect(dialog).toBeVisible();
      if(field)await expect(dialog.getByLabel(field,{exact:true})).toHaveValue("Isian tetap ada");
      const marks=dialog.locator(".required-mark");
      expect(await marks.count()).toBeGreaterThan(0);
      const expected=theme==="dark"?"rgb(241, 162, 151)":"rgb(162, 57, 46)";
      for(const mark of await marks.all())await expect(mark).toHaveCSS("color",expected);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    };
    await navigate("Pelanggan");
    await page.getByRole("button",{name:"Tambah pelanggan",exact:true}).click();
    await checkBackdrop("Tambah pelanggan","Nama pelanggan");
    await navigate("Jastip");
    await page.getByRole("button",{name:"Batch jastip baru",exact:true}).first().click();
    await checkBackdrop("Batch jastip baru","Nama batch");
    await page.getByRole("button",{name:"Pesanan jastip baru",exact:true}).click();
    await checkBackdrop("Pesanan jastip baru","Nama produk");
    await navigate("Open PO");
    await page.getByRole("button",{name:"Produk baru",exact:true}).click();
    await checkBackdrop("Produk baru","Nama produk");
    await page.getByRole("button",{name:"Pesanan PO baru",exact:true}).click();
    await expect(page.getByText("Wajib diisi. Pembayaran dan ongkir boleh kosong jika belum ada.")).toHaveCount(0);
    await checkBackdrop("Pesanan PO baru");
    await page.getByRole("tab",{name:/^Pesanan/}).click();
    await page.getByRole("button",{name:"Import Excel",exact:true}).click();
    await checkBackdrop("Import Excel PO");
  });
}

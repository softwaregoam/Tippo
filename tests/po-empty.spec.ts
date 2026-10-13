import { expect, test } from "@playwright/test";
import { chooseOption } from "./select-helper";

test("new PO starts empty, marks required fields and rejects incomplete orders", async ({page}) => {
  await page.goto("/demo");
  await page.getByRole("navigation",{name:"Navigasi utama"}).getByRole("button",{name:"Open PO",exact:true}).click();
  await page.getByRole("button",{name:"Pesanan PO baru",exact:true}).click();
  const form=page.getByRole("dialog",{name:"Pesanan PO baru",exact:true});
  for(const label of ["Batch PO","Pelanggan","Produk"]) {
    await expect(form.getByLabel(label,{exact:true})).toHaveAttribute("data-value","");
    await expect(form.getByLabel(label,{exact:true})).toHaveAttribute("aria-required","true");
  }
  for(const label of ["Jumlah produk","Tanggal pesanan","Sudah dibayar (DP / lunas)"])await expect(form.getByLabel(label,{exact:true})).toHaveValue("");
  await expect(form.locator(".required-mark")).toHaveCount(5);
  await form.getByRole("button",{name:"Simpan pesanan",exact:true}).click();
  await expect(form.getByText("Pilih batch PO yang aktif.",{exact:true})).toBeVisible();
  await expect(form.getByText("Pilih pelanggan.",{exact:true})).toBeVisible();
  await expect(form.getByText("Jumlah harus berupa angka bulat minimal 1.",{exact:true})).toBeVisible();
  await chooseOption(form.getByLabel("Pelanggan",{exact:true}),"new");
  await expect(form.getByLabel("Nama pelanggan",{exact:true})).toHaveValue("");
  await expect(form.getByLabel("Nama pelanggan",{exact:true})).toHaveAttribute("required","");
  await form.getByRole("button",{name:"Tambah produk",exact:true}).click();
  const second=form.getByRole("group",{name:"Produk 2",exact:true});
  await expect(second.getByLabel("Produk",{exact:true})).toHaveAttribute("data-value","");
  await expect(second.getByLabel("Jumlah produk",{exact:true})).toHaveValue("");
});

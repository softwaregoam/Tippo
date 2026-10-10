import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import type { AppData } from "../src/lib/types";

const empty:AppData={products:[],orders:[],batches:[],customers:[]};
async function open(page:Page,data:AppData=empty){
  await page.addInitScript(()=>{if(!localStorage.getItem("tippo.subscription.demo.v1"))localStorage.setItem("tippo.subscription.demo.v1",JSON.stringify({tier:"pro",expiresAt:"2099-01-01T00:00:00Z",mode:"demo"}));});
  await page.addInitScript(data=>{if(!sessionStorage.getItem("product-test-seeded")){localStorage.setItem("tippo.workspace.v1",JSON.stringify(data));sessionStorage.setItem("product-test-seeded","1");}},data);
  await page.goto("/demo");
  await page.getByRole("navigation",{name:"Navigasi utama"}).getByRole("button",{name:"Open PO",exact:true}).click();
  await page.getByRole("button",{name:"Import produk Excel",exact:true}).click();
  return page.getByRole("dialog",{name:"Import produk Excel",exact:true});
}
async function file(rows:unknown[][]){
  const book=new ExcelJS.Workbook();const sheet=book.addWorksheet("Produk");sheet.addRow(["produk","varian","sku_produk","harga_jual","harga_beli"]);rows.forEach(row=>sheet.addRow(row));
  return {name:"listing-produk.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:Buffer.from(await book.xlsx.writeBuffer())};
}

test("download product template, move listing into it and import masters without orders",async({page})=>{
  const dialog=await open(page);
  const downloading=page.waitForEvent("download");await dialog.getByRole("button",{name:"Unduh template produk",exact:true}).click();
  const download=await downloading;expect(download.suggestedFilename()).toBe("tippo-template-produk.xlsx");
  const book=new ExcelJS.Workbook();await book.xlsx.readFile((await download.path())!);
  const sheet=book.getWorksheet("Produk")!;sheet.getRow(2).values=["Roti pengguna","Cokelat","0001",25000,null];sheet.addRow(["Kaos pengguna","L","0002",150000,100000]);
  await dialog.getByLabel("File Excel produk").setInputFiles({name:"template-diisi.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:Buffer.from(await book.xlsx.writeBuffer())});
  await expect(dialog.getByText(/2 dari 2 produk valid/)).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!));expect(before.products).toHaveLength(0);
  await dialog.getByRole("button",{name:"Import 2 produk",exact:true}).click();await expect(dialog).not.toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!));
  expect(saved.products).toHaveLength(2);expect(saved.orders).toHaveLength(0);expect(saved.products[0]).toMatchObject({name:"Roti pengguna",sku:"0001",unitCost:null,active:true});
  await page.reload();await page.getByRole("navigation",{name:"Navigasi utama"}).getByRole("button",{name:"Open PO",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Kaos pengguna",exact:true})).toBeVisible();
});

test("invalid and duplicate product rows block the entire import",async({page})=>{
  const dialog=await open(page);
  await dialog.getByLabel("File Excel produk").setInputFiles(await file([["A","","ONE",100,50],["B","","one",100,50],["C","","C",{formula:"1+1",result:2},0]]));
  await expect(dialog.getByText(/SKU sudah digunakan/)).toBeVisible();await expect(dialog.getByText(/formula tidak boleh/)).toBeVisible();
  await expect(dialog.getByRole("button",{name:/^Import \d+ produk$/})).toBeDisabled();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!).products.length)).toBe(0);
  await dialog.getByLabel("File Excel produk").setInputFiles(await file([["A","","ONE",100,50]]));
  await dialog.getByRole("button",{name:"Import 1 produk",exact:true}).click();await expect(dialog).not.toBeVisible();
});

test("Pro expiry before confirmation blocks import and preserves preview",async({page})=>{
  await page.clock.install({time:new Date("2026-10-09T05:00:00Z")});
  await page.addInitScript(()=>localStorage.setItem("tippo.subscription.demo.v1",JSON.stringify({tier:"pro",expiresAt:"2026-10-09T05:01:00Z",mode:"demo"})));
  const data={...empty,products:Array.from({length:4},(_,i)=>({id:`old-${i}`,name:`Lama ${i}`,variant:"",sku:`OLD${i}`,unitPrice:100,unitCost:50,active:true}))};
  const dialog=await open(page,data);
  await dialog.getByLabel("File Excel produk").setInputFiles(await file([["A","","A",100,0],["B","","B",100,0]]));
  await expect(dialog.getByRole("button",{name:"Import 2 produk",exact:true})).toBeEnabled();
  await page.clock.fastForward(61000);
  await expect(dialog.getByRole("button",{name:"Import 2 produk",exact:true})).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("hanya tersedia untuk paket Pro");
  await expect(dialog.getByRole("button",{name:"Unduh template produk",exact:true})).toBeDisabled();
  await expect(dialog.getByLabel("File Excel produk")).toBeDisabled();
  await expect(dialog.getByText(/2 dari 2 produk valid/)).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!).products.length)).toBe(4);
});

test("confirmation rechecks Pro expiry before the subscription refresh timer runs",async({page})=>{
  await page.clock.install({time:new Date("2026-10-09T05:00:00Z")});
  await page.addInitScript(()=>localStorage.setItem("tippo.subscription.demo.v1",JSON.stringify({tier:"pro",expiresAt:"2026-10-09T05:00:30Z",mode:"demo"})));
  const dialog=await open(page);
  await dialog.getByLabel("File Excel produk").setInputFiles(await file([["A","","A",100,0]]));
  await expect(dialog.getByRole("button",{name:"Import 1 produk",exact:true})).toBeEnabled();
  await page.clock.fastForward(31000);
  await dialog.getByRole("button",{name:"Import 1 produk",exact:true}).click();
  await expect(dialog.getByRole("alert")).toContainText("hanya tersedia untuk paket Pro");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!).products.length)).toBe(0);
});

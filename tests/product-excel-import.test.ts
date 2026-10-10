import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildProductImport, createProductTemplate, previewProductImport } from "../src/lib/excel-import.ts";
import type { AppData, Product } from "../src/lib/types.ts";

const empty: AppData={batches:[],customers:[],orders:[],products:[]};
async function workbook(rows: unknown[][], headers=["produk","varian","sku_produk","harga_jual","harga_beli"]): Promise<ArrayBuffer> {
  const book=new ExcelJS.Workbook(); const sheet=book.addWorksheet("Produk"); sheet.addRow(headers); rows.forEach(row=>sheet.addRow(row));
  const bytes=new Uint8Array(await book.xlsx.writeBuffer());return bytes.buffer;
}
const old: Product={id:"old",name:"Kaos",variant:"M",sku:"001",unitPrice:100000,unitCost:50000,active:false};

test("product template has required columns and instructions, blocks sample and round-trips completed listing",async()=>{
  const bytes=await createProductTemplate();const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(bytes).buffer);
  assert.ok(book.getWorksheet("Petunjuk"));
  const sheet=book.getWorksheet("Produk")!;
  assert.equal(sheet.getColumn(3).numFmt,"@");
  const sample=await previewProductImport(new Uint8Array(bytes).buffer,empty);
  assert.equal(sample.validCount,0);assert.match(sample.rows[0].errors.join(" "),/contoh/);
  sheet.getRow(2).getCell(1).value="Kaos pengguna";
  const filled=new Uint8Array(await book.xlsx.writeBuffer());
  const preview=await previewProductImport(filled.buffer,empty,5);
  assert.equal(preview.validCount,1);assert.deepEqual(preview.errors,[]);
  const products=buildProductImport(preview,empty,5);
  assert.equal(products[0].name,"Kaos pengguna");assert.equal(products[0].unitPrice,150000);assert.equal(products[0].active,true);assert.ok(products[0].id);
});

test("blank purchase cost remains unknown, zero stays known and leading SKU zeros survive",async()=>{
  const preview=await previewProductImport(await workbook([["Nasi","","0001",25000,null],["Es","","0002",10000,0]]),empty);
  const products=buildProductImport(preview,empty);
  assert.equal(products[0].sku,"0001");assert.equal(products[0].unitCost,null);assert.equal(products[1].unitCost,0);
  assert.deepEqual(empty.products,[]);
});

test("duplicate SKU and product variant reject the whole file, including archived catalogue entries",async()=>{
  for(const rows of [[["Kaos","M","002",100,50]],[["Lain","","001",100,50]],[["Baru","","AAA",100,50],["Lain","","aaa",200,100]],[["Baru","M","A",100,50],["baru","m","B",200,100]]]){
    const data={...empty,products:[old]};const preview=await previewProductImport(await workbook(rows),data);
    assert.ok(preview.rows.some(row=>row.errors.length));assert.throws(()=>buildProductImport(preview,data));assert.deepEqual(data.products,[old]);
  }
});

test("invalid numbers, formulas, numeric SKU and text limits block atomic import",async()=>{
  for(const row of [["X","","SKU",-1,0],["X","","SKU",1.5,0],["X","","SKU",Number.MAX_SAFE_INTEGER+1,0],["X","","SKU",{formula:"1+1",result:2},0],["X","",123,10,0],["x".repeat(121),"","SKU",10,0],["X","","SKU",null,0]]){
    const preview=await previewProductImport(await workbook([["Valid","","GOOD",100,50],row]),empty);
    assert.ok(preview.rows[1].errors.length);assert.throws(()=>buildProductImport(preview,empty));
  }
});

test("quota includes archives and current data is rechecked at confirmation",async()=>{
  const data={...empty,products:[old]};const buffer=await workbook([["Baru","","NEW",100,0],["Baru 2","","NEW2",100,0]]);
  const limited=await previewProductImport(buffer,data,2);
  assert.match(limited.errors.join(" "),/Sisa slot 1/);assert.throws(()=>buildProductImport(limited,data,2));
  const preview=await previewProductImport(buffer,data,5);
  const changed={...data,products:[old,{...old,id:"new",name:"Baru",variant:"",sku:"NEW",active:true}]};
  assert.throws(()=>buildProductImport(preview,changed,5));
  assert.throws(()=>buildProductImport(preview,data,2));
  assert.equal(buildProductImport(preview,data,5).length,2);
});

test("wrong headers, empty, malformed, oversized and excessive workbooks fail safely",async()=>{
  for(const buffer of [new ArrayBuffer(0),new Uint8Array([1,2,3]).buffer,new ArrayBuffer(5*1024*1024+1),await workbook([], ["nama_pelanggan","jumlah"]),await workbook([], ["produk","produk","harga_jual"]),await workbook([]),await workbook(Array.from({length:1001},(_,i)=>[`P${i}`,"",`S${i}`,10,0]))]){
    const preview=await previewProductImport(buffer,empty);assert.ok(preview.errors.length);assert.throws(()=>buildProductImport(preview,empty));
  }
});

test("optional category imports from new template while old five-column files remain valid",async()=>{
 const empty={batches:[],customers:[],products:[],orders:[]};
 const preview=await previewProductImport(await workbook([["Roti","","R1",25000,15000,"Makanan"]],["produk","varian","sku_produk","harga_jual","harga_beli","kategori"]),empty);
 assert.equal(preview.validCount,1);assert.equal(buildProductImport(preview,empty)[0].category,"Makanan");
 const old=await previewProductImport(await workbook([["Kaos","","K1",50000,25000]]),empty);assert.equal(old.validCount,1);
});

import assert from "node:assert/strict";
import {test} from "node:test";
import ExcelJS from "exceljs";
import {buildShoppingReport} from "../src/lib/shopping-report.ts";
import {createShoppingReportExcel} from "../src/lib/shopping-report-excel.ts";
import type {AppData,Order,OrderItem} from "../src/lib/types.ts";
const item=(extra:Partial<OrderItem>={}):OrderItem=>({id:"i",productId:"p",product:"Kaos",variant:"Airism",color:"Hitam",size:"L",store:"Toko",quantity:2,unitPrice:100,unitCost:40,...extra});
const order=(id:string,items:OrderItem[],extra:Partial<Order>={}):Order=>({id,batchId:"b",customerId:"a",date:"2026-10-15",createdAt:"2026-10-15T00:00:00Z",status:"new",paid:0,shippingCharge:9999,serviceFee:9999,discount:{type:"amount",value:2000},notes:"private note",items,...extra});
function data():AppData{return {batches:[{id:"b",name:"Belanja Oktober",type:"po",origin:"",closeDate:"2026-10-20",status:"closed",directCosts:999}],customers:[{id:"a",name:"=SUM(1,2)",phone:"secret phone",address:"Jalan Mawar 10\nBandung"}],products:[{id:"p",name:"Nama master berubah",variant:"",sku:"X",category:"Pakaian",unitPrice:50000,unitCost:80000,active:false}],orders:[order("1",[item(),item({id:"snack",productId:null,product:"Kue",variant:"",size:"",color:"",quantity:1,unitPrice:50,unitCost:null})]),order("2",[item({quantity:3,unitPrice:110,unitCost:50})]),order("cancelled",[item({quantity:999})],{status:"cancelled"}),order("foreign",[item({quantity:999})],{batchId:"other"})]};}

test("purchase report combines quantities but calculates each saved purchase price separately",()=>{
 const report=buildShoppingReport(data(),"b");assert.equal(report.orders.length,2);assert.equal(report.products.length,3);
 const product=report.products.find(p=>p.product==="Kaos")!;assert.equal(product.quantity,2);assert.equal(product.knownCost,80);assert.equal(product.cost,80);assert.equal(product.unitCost,40);assert.equal(report.products.filter(product=>product.product==="Kaos").length,2);assert.equal(product.category,"Pakaian");
 assert.deepEqual(report.totals,{quantity:6,value:580,knownCost:230,missingQuantity:1,cost:null});
 assert.equal(report.categories.find(c=>c.name==="Pakaian")!.totals.quantity,5);assert.equal(report.categories.find(c=>c.name==="Tanpa kategori")!.totals.cost,null);
 assert.equal(report.orders[0].totals.value,250);assert.equal(report.orders[1].totals.cost,150);assert.equal(report.products.some(p=>p.product==="Nama master berubah"),false);
});
test("purchase grouping separates options, categories and stores and never treats unknown costs as zero",()=>{
 const workspace=data();workspace.orders=[order("1",[item({unitCost:0}),item({id:"unknown",unitCost:null}),item({id:"size",size:"M"}),item({id:"store",store:"Other"}),item({id:"category",productId:null})])];const report=buildShoppingReport(workspace,"b");assert.equal(report.products.length,4);const product=report.products.find(p=>p.size==="L"&&p.store==="Toko"&&p.category==="Pakaian")!;assert.equal(product.quantity,4);assert.equal(product.knownCost,0);assert.equal(product.cost,null);assert.equal(product.unitCost,null);
 workspace.orders=[order("zero",[item({unitCost:0})])];assert.equal(buildShoppingReport(workspace,"b").totals.cost,0);
});
test("empty batches export zero totals and unknown batches are rejected",()=>{
 const workspace=data();workspace.orders=[];const report=buildShoppingReport(workspace,"b");assert.equal(report.totals.quantity,0);assert.equal(report.totals.cost,0);assert.equal(report.products.length,0);assert.throws(()=>buildShoppingReport(workspace,"missing"));
});
for(const mode of ["po","jastip"] as const)test(`workbook ${mode} uses mode-specific groups and keeps HPP only in order sheet`,async()=>{
 const workspace=data();workspace.batches[0].type=mode;const report=buildShoppingReport(workspace,"b"),book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await createShoppingReportExcel(report,"products")).buffer);
 assert.deepEqual(book.worksheets.map(s=>s.name),["Per produk"]);
 const orderBook=new ExcelJS.Workbook();await orderBook.xlsx.load(new Uint8Array(await createShoppingReportExcel(report,"orders")).buffer);assert.deepEqual(orderBook.worksheets.map(s=>s.name),["Per pesanan"]);
 const products=book.getWorksheet("Per produk")!,orders=orderBook.getWorksheet("Per pesanan")!;
 const cell=(sheet:ExcelJS.Worksheet,row:number,header:string)=>{let column=0;sheet.getRow(3).eachCell((cell,index)=>{if(cell.value===header)column=index;});assert.ok(column,header);return sheet.getCell(row,column).value;};
 assert.match(String(cell(products,4,"Produk")),/^Kaos Airism/);assert.equal(cell(products,4,"Qty"),2);assert.equal(cell(products,4,"Harga jual / unit"),100);assert.equal(cell(products,4,"Total"),200);assert.equal(cell(products,4,"Total qty grup"),mode==="po"?5:6);assert.equal(cell(products,4,"Total harga grup"),mode==="po"?530:580);assert.equal(cell(products,products.rowCount,"Total qty grup"),6);assert.equal(cell(products,products.rowCount,"Total harga grup"),580);
 assert.equal(products.getCell(`A${products.rowCount}`).value,"TOTAL KESELURUHAN");
 assert.equal(products.getCell("A3").value,mode==="po"?"Kategori":"Toko / brand");
 assert.equal(products.getCell("A4").value,mode==="po"?"Pakaian":"Toko");assert.ok(products.model.merges!.includes(mode==="po"?"A4:A5":"A4:A6"));assert.ok(products.model.merges!.includes(mode==="po"?"G4:G5":"G4:G6"));
 assert.doesNotMatch(JSON.stringify(products.getSheetValues()),/HPP|Harga beli|Bervariasi|Belum lengkap/);
 const text=JSON.stringify(orders.getSheetValues());assert.doesNotMatch(text,/Kategori mengikuti|Nilai jual hanya/);
 assert.deepEqual(orders.getCell("A4").value,{richText:[{text:"=SUM(1,2)",font:{bold:true,size:11}},{text:"\n15 Okt 2026",font:{size:10,color:{argb:"FF626862"}}}]});
 assert.equal(cell(orders,4,"Alamat kirim"),"Jalan Mawar 10\nBandung");assert.equal(cell(orders,4,"Harga jual / unit"),100);assert.equal(cell(orders,4,"Subtotal jual produk"),200);assert.equal(cell(orders,4,"Harga beli / unit"),40);assert.equal(cell(orders,4,"Subtotal beli"),80);assert.equal(cell(orders,4,"Total pesanan"),250);assert.equal(cell(orders,5,"Total HPP"),"Belum lengkap");assert.equal(cell(orders,4,"Margin"),"Belum lengkap");
 for(const merge of ["A4:A5","F4:F5","G4:G5","J4:J5","K4:K5"])assert.ok(orders.model.merges!.includes(merge));
 assert.equal(cell(orders,6,"Total HPP"),150);assert.equal(cell(orders,6,"Margin"),180);
 assert.equal(cell(orders,orders.rowCount,"Qty"),6);assert.equal(cell(orders,orders.rowCount,"Total pesanan"),580);assert.equal(cell(orders,orders.rowCount,"Total HPP"),"Belum lengkap");assert.equal(cell(orders,orders.rowCount,"Margin"),"Belum lengkap");
 assert.equal(String(cell(orders,4,"Produk")).includes("Kategori: Pakaian"),mode==="po");assert.equal(text.includes("secret phone"),false);assert.equal(text.includes("private note"),false);
});

test("order workbook margins support zero purchase prices and losses",async()=>{
 const workspace=data();workspace.orders=[order("zero",[item({unitCost:0})]),order("loss",[item({unitCost:150})])];const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await createShoppingReportExcel(buildShoppingReport(workspace,"b"),"orders")).buffer);const sheet=book.getWorksheet("Per pesanan")!;
 // Sorted by order id: loss first, then zero.
 assert.equal(sheet.getCell("K4").value,-100);assert.equal(sheet.getCell("K5").value,200);assert.equal(sheet.getCell("F6").value,400);assert.equal(sheet.getCell("J6").value,300);assert.equal(sheet.getCell("K6").value,100);
});

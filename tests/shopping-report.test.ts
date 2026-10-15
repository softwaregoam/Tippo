import assert from "node:assert/strict";
import {test} from "node:test";
import ExcelJS from "exceljs";
import {buildShoppingReport} from "../src/lib/shopping-report.ts";
import {createShoppingReportExcel} from "../src/lib/shopping-report-excel.ts";
import type {AppData,Order,OrderItem} from "../src/lib/types.ts";
const item=(extra:Partial<OrderItem>={}):OrderItem=>({id:"i",productId:"p",product:"Kaos",variant:"Airism",color:"Hitam",size:"L",store:"Toko",quantity:2,unitPrice:100,unitCost:40,...extra});
const order=(id:string,items:OrderItem[],extra:Partial<Order>={}):Order=>({id,batchId:"b",customerId:"a",date:"2026-10-15",createdAt:"2026-10-15T00:00:00Z",status:"new",paid:0,shippingCharge:9999,serviceFee:9999,discount:{type:"amount",value:2000},notes:"private note",items,...extra});
function data():AppData{return {batches:[{id:"b",name:"Belanja Oktober",type:"po",origin:"",closeDate:"2026-10-20",status:"closed",directCosts:999}],customers:[{id:"a",name:"=SUM(1,2)",phone:"secret phone"}],products:[{id:"p",name:"Nama master berubah",variant:"",sku:"X",category:"Pakaian",unitPrice:50000,unitCost:80000,active:false}],orders:[order("1",[item(),item({id:"snack",productId:null,product:"Kue",variant:"",size:"",color:"",quantity:1,unitPrice:50,unitCost:null})]),order("2",[item({quantity:3,unitPrice:110,unitCost:50})]),order("cancelled",[item({quantity:999})],{status:"cancelled"}),order("foreign",[item({quantity:999})],{batchId:"other"})]};}

test("purchase report combines quantities but calculates each saved purchase price separately",()=>{
 const report=buildShoppingReport(data(),"b");assert.equal(report.orders.length,2);assert.equal(report.products.length,2);
 const product=report.products.find(p=>p.product==="Kaos")!;assert.equal(product.quantity,5);assert.equal(product.knownCost,230);assert.equal(product.cost,230);assert.equal(product.unitCost,"Bervariasi");assert.equal(product.category,"Pakaian");
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
test("workbook has category and order subtotals, exact grand totals, numeric prices and literal customer text",async()=>{
 const report=buildShoppingReport(data(),"b"),book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await createShoppingReportExcel(report)).buffer);
 assert.deepEqual(book.worksheets.map(s=>s.name),["Per produk","Per pesanan"]);
 const products=book.getWorksheet("Per produk")!,orders=book.getWorksheet("Per pesanan")!;
 assert.equal(products.getCell("C6").value,"Kaos");assert.equal(products.getCell("G6").value,5);assert.equal(products.getCell("H6").value,"Bervariasi");assert.equal(products.getCell("J6").value,230);
 assert.equal(products.getCell("A7").value,"Subtotal Pakaian");assert.equal(products.getCell("G7").value,5);assert.equal(products.getCell(`A${products.rowCount}`).value,"TOTAL BATCH / PERJALANAN");assert.equal(products.getCell(`G${products.rowCount}`).value,6);assert.equal(products.getCell(`I${products.rowCount}`).value,230);assert.equal(products.getCell(`J${products.rowCount}`).value,"Belum lengkap");
 assert.equal(orders.getCell("A6").value,"1");assert.equal(orders.getCell("B6").value,"=SUM(1,2)");assert.equal(orders.getCell("K6").value,100);assert.equal(orders.getCell("L6").value,200);assert.equal(orders.getCell("M6").value,40);assert.equal(orders.getCell("O7").value,"Belum lengkap");assert.equal(orders.getCell("A8").value,"Subtotal 1");assert.equal(orders.getCell("L8").value,250);
 assert.equal(orders.getCell(`J${orders.rowCount}`).value,6);assert.equal(orders.getCell(`L${orders.rowCount}`).value,580);assert.equal(orders.getCell(`N${orders.rowCount}`).value,230);assert.equal(orders.getCell(`O${orders.rowCount}`).value,"Belum lengkap");
 assert.equal(JSON.stringify(orders.getSheetValues()).includes("secret phone"),false);assert.equal(JSON.stringify(orders.getSheetValues()).includes("private note"),false);
});

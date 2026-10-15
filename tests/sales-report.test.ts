import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {buildSalesReport,monthBounds} from "../src/lib/sales-report.ts";
import {createReportExcel} from "../src/lib/report-excel.ts";
import type {AppData,Order} from "../src/lib/types.ts";
const make=(id:string,extra:Partial<Order>={}):Order=>({id,batchId:"j",customerId:"c",date:"2026-10-14",createdAt:"2026-10-14T00:00:00Z",status:"new",notes:"private",paid:0,serviceFee:10,shippingCharge:5,discount:{type:"amount",value:15},items:[{id:"i-"+id,product:"Kaos",variant:"Airism",color:"Hitam",size:"L",store:"Uniqlo",quantity:1,unitPrice:100,unitCost:60}],...extra});
const data=(orders:Order[]):AppData=>({orders,customers:[{id:"c",name:"=SUM(1,2)",phone:""}],products:[],batches:[{id:"j",type:"jastip",name:"Jastip Seoul",origin:"",closeDate:"2026-10-30",status:"open",directCosts:9},{id:"p",type:"po",name:"PO Roti",origin:"",closeDate:"2026-10-30",status:"closed",directCosts:0}]});
const filter={type:"jastip" as const,from:"2026-10-14",to:"2026-10-14"};

test("report uses inclusive order dates, excludes cancellations and other businesses, and allocates costs before filtering",()=>{
 const workspace=data([make("inside"),make("outside",{date:"2026-10-13"}),make("po",{batchId:"p"}),make("cancelled",{status:"cancelled"})]);
 const report=buildSalesReport(workspace,filter);
 assert.equal(report.rows.length,1);assert.equal(report.summary.revenue,100);
 // Shared 9 rupiah split across two eligible orders, including the prior day.
 assert.equal(report.rows[0].hpp,65);assert.equal(report.summary.margin,35);
 const all=buildSalesReport(workspace,{...filter,from:"2026-10-01"});assert.equal(all.summary.hpp,129);assert.equal(all.summary.margin,71);
 assert.equal(buildSalesReport(workspace,{...filter,batchId:"p"}).rows.length,0);
 assert.equal(buildSalesReport(workspace,{...filter,type:"po"}).rows[0].order.id,"po");
});

test("incomplete HPP stays unknown and product ranking groups historical options",()=>{
 const a=make("known"),b=make("unknown");b.items=[{...b.items[0],unitCost:null,quantity:3}]; b.discount=undefined;
 const other=make("size");other.items=[{...other.items[0],size:"M"}];
 const report=buildSalesReport(data([a,b,other]),filter);
 assert.equal(report.summary.unknownCosts,1);assert.equal(report.rows.find(row=>row.order.id==="unknown")!.margin,null);
 assert.equal(report.summary.knownRevenue,200);assert.equal(report.summary.revenue,515);
 assert.equal(report.products.length,2);assert.equal(report.products[0].quantity,4);
 assert.equal(report.summary.quantity,5);
});

test("range validation and calendar months handle invalid and leap dates",()=>{
 assert.deepEqual(monthBounds("2024-02"),{from:"2024-02-01",to:"2024-02-29"});
 assert.deepEqual(monthBounds("2026-12"),{from:"2026-12-01",to:"2026-12-31"});
 for(const dates of [{from:"2026-02-30",to:"2026-03-01"},{from:"",to:"2026-10-14"},{from:"2026-10-15",to:"2026-10-14"}])assert.throws(()=>buildSalesReport(data([]),{type:"po",...dates}));
 const empty=buildSalesReport(data([]),{...filter,batchId:"j"});assert.equal(empty.summary.orders,0);assert.equal(empty.batchLabel,"Jastip Seoul");assert.deepEqual(empty.products,[]);
});

test("Excel export matches the filtered report, preserves numeric amounts and never turns customer names into formulas",async()=>{
 const known=make("a"),unknown=make("b");unknown.items[0].unitCost=null;
 const report=buildSalesReport(data([known,unknown,make("excluded",{batchId:"p"})]),filter);
 const bytes=await createReportExcel(report),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(new Uint8Array(bytes).buffer);
 assert.deepEqual(workbook.worksheets.map(sheet=>sheet.name),["Ringkasan","Pesanan","Rincian produk","Produk terlaris"]);
 const sheet=workbook.getWorksheet("Pesanan")!;assert.equal(sheet.rowCount,7);
 assert.equal(sheet.getCell("C5").value,"=SUM(1,2)");assert.equal(sheet.getCell("I5").value,100);
 assert.equal(sheet.getCell("J6").value,"Belum lengkap");assert.equal(sheet.getCell("K6").value,"Belum lengkap");
 assert.equal(workbook.getWorksheet("Produk terlaris")!.getCell("D5").value,2);
 assert.equal(sheet.getCell("I7").value,200);assert.equal(sheet.getCell("J7").value,65);assert.equal(sheet.getCell("K7").value,35);assert.match(String(sheet.getCell("A7").value),/HPP\/margin diketahui/);
 for(const worksheet of workbook.worksheets)for(const row of [1,2,3])assert.equal(worksheet.getCell(row,1).alignment.horizontal,"left");
 assert.equal(sheet.getCell("I5").alignment.horizontal,"right");
 assert.equal(sheet.getColumn("I").numFmt,'"Rp" #,##0;[Red]-"Rp" #,##0');assert.equal(sheet.autoFilter,"A4:L6");
 assert.equal(workbook.getWorksheet("Ringkasan")!.getCell("B5").value,200);assert.equal(workbook.getWorksheet("Produk terlaris")!.getCell("D6").value,2);
});

test("empty and incomplete report workbooks keep unknown costs explicit and grand totals valid",async()=>{
 for(const empty of [true,false]){
 const workspace=data(empty?[]:[make("unknown",{items:[{...make("x").items[0],unitCost:null}]})]);const report=buildSalesReport(workspace,filter),book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await createReportExcel(report)).buffer);const orders=book.getWorksheet("Pesanan")!;
 assert.equal(orders.getCell(`I${orders.rowCount}`).value,empty?0:100);assert.equal(orders.getCell(`J${orders.rowCount}`).value,empty?0:"Belum lengkap");assert.equal(orders.getCell(`K${orders.rowCount}`).value,empty?0:"Belum lengkap");
 }
});

test("product details link each item to its order without duplicating fees or losing variants",async()=>{
 const first=make("a");first.items.push({...first.items[0],id:"second-item",product:"Produk kedua",variant:"Vanila",quantity:3,unitPrice:200,unitCost:null});
 const report=buildSalesReport(data([first,make("b"),make("foreign",{batchId:"p"})]),filter),book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await createReportExcel(report)).buffer);const orders=book.getWorksheet("Pesanan")!,lines=book.getWorksheet("Rincian produk")!;
 assert.deepEqual(orders.getCell("L5").value,{text:"Lihat 2 produk",hyperlink:"#'Rincian produk'!A5"});assert.deepEqual(orders.getCell("L6").value,{text:"Lihat 1 produk",hyperlink:"#'Rincian produk'!A7"});
 assert.equal(lines.rowCount,8);assert.equal(lines.getCell("A5").value,"a");assert.equal(lines.getCell("A6").value,"a");assert.equal(lines.getCell("A7").value,"b");assert.equal(lines.getCell("C6").value,"=SUM(1,2)");assert.equal(lines.getCell("E6").value,"Produk kedua");assert.equal(lines.getCell("F6").value,"Vanila");assert.equal(lines.getCell("J6").value,3);assert.equal(lines.getCell("L6").value,600);assert.equal(lines.getCell("N6").value,"Belum lengkap");assert.equal(lines.getCell("J8").value,5);assert.equal(lines.getCell("L8").value,800);assert.equal(lines.getCell("N8").value,120);
});

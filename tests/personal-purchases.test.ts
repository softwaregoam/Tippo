import {test} from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {getMonthSummary,orderRevenue,orderMargin,orderHpp,personalExpense,preparePersonalOrder,allocatedBatchCosts,outstanding} from "../src/lib/finance.ts";
import {isAppData} from "../src/lib/validation.ts";
import {normalizeAppData} from "../src/lib/migration.ts";
import {buildSalesReport} from "../src/lib/sales-report.ts";
import {createReportExcel} from "../src/lib/report-excel.ts";
import {buildShoppingReport} from "../src/lib/shopping-report.ts";
import {createShoppingReportExcel} from "../src/lib/shopping-report-excel.ts";
import {shoppingRecap} from "../src/lib/shopping-recap.ts";
import {buildInvoice} from "../src/lib/invoice.ts";
import {showQris} from "../src/lib/qris.ts";
import type {AppData,Order} from "../src/lib/types.ts";
const customer:Order={id:"customer",batchId:"b",customerId:"c",date:"2026-10-20",createdAt:"2026-10-20T00:00:00Z",status:"new",serviceFee:0,shippingCharge:0,paid:0,notes:"",items:[{id:"i-customer",product:"Donut",variant:"Keju",color:"",size:"",quantity:10,unitPrice:10000,unitCost:7000}]};
const personal=preparePersonalOrder({...customer,id:"personal",items:[{...customer.items[0],id:"i-personal",quantity:2,unitCost:10000}]},true);
const workspace=(type:"jastip"|"po"="jastip"):AppData=>({batches:[{id:"b",name:"Batch uji",type,origin:"",closeDate:"2026-10-30",status:"open",directCosts:0}],customers:[{id:"c",name:"Alya",phone:""}],products:[],orders:[customer,personal]});
test("personal consumption stays outside business margin, sales, receivables and shared cost allocation",()=>{
 const data=workspace();assert.equal(isAppData(data),true);const summary=getMonthSummary(data,"2026-10");assert.equal(summary.revenue,100000);assert.equal(summary.hpp,70000);assert.equal(summary.profit,30000);assert.equal(summary.personalExpenses,20000);assert.equal(summary.ordersCount,1);assert.equal(summary.outstanding,100000);
 assert.equal(orderRevenue(personal),0);assert.equal(orderHpp(personal,data.orders,data.batches),0);assert.equal(orderMargin(personal,data.orders,data.batches),0);assert.equal(outstanding(personal),0);assert.equal(personalExpense(personal),20000);
 data.batches[0].directCosts=3000;assert.deepEqual(allocatedBatchCosts(data.batches[0],data.orders),{customer:3000});assert.equal(orderMargin(customer,data.orders,data.batches),27000);assert.equal(getMonthSummary(data,"2026-10").personalExpenses,20000);
 const cancelled={...personal,status:"cancelled" as const};assert.equal(personalExpense(cancelled),0);data.orders=[cancelled];assert.equal(getMonthSummary(data,"2026-10").personalExpenses,0);
});
test("personal purchases require known costs, no customer and no billing even after importing backups",()=>{
 const data=workspace();data.customers=[];data.orders=[personal];assert.equal(isAppData(data),true);assert.deepEqual(normalizeAppData(JSON.parse(JSON.stringify(data))),JSON.parse(JSON.stringify(data)));
 for(const patch of [{purpose:"unknown"},{purpose:null},{customerId:"c"},{paid:1},{serviceFee:1},{shippingCharge:1},{discount:{type:"amount",value:0}},{refunds:[{amount:1}]}]){const bad=structuredClone(data);Object.assign(bad.orders[0],patch);assert.equal(isAppData(bad),false);assert.equal(normalizeAppData(bad),null);}
 for(const patch of [{unitCost:null},{unitPrice:1},{unitCost:-1}]){const bad=structuredClone(data);Object.assign(bad.orders[0].items[0],patch);assert.equal(isAppData(bad),false);}
 assert.equal(buildInvoice(personal),"");assert.equal(showQris(personal,"https://example.test/q.png"),false);
});
for(const type of ["jastip","po"] as const)test(`shopping and sales Excel distinguish personal consumption for ${type}`,async()=>{
 const data=workspace(type);assert.equal(shoppingRecap(data,"b").quantity,12);assert.equal(shoppingRecap(data,"b").groups[0].lines[0].customers.some(c=>c.name==="Untuk sendiri"&&c.quantity===2),true);
 const shopping=buildShoppingReport(data,"b");assert.equal(shopping.totals.quantity,12);assert.equal(shopping.totals.cost,90000);assert.equal(shopping.orders.find(o=>o.personal)!.customer,"Untuk sendiri");
 for(const kind of ["products","orders"] as const){const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await createShoppingReportExcel(shopping,kind)).buffer);const values=JSON.stringify(book.worksheets[0].getSheetValues());assert.match(values,kind==="products"?/90000/:/BELANJA SENDIRI/);assert.doesNotMatch(values,/-20000/);}
 const report=buildSalesReport(data,{type,from:"2026-10-01",to:"2026-10-31"});assert.equal(report.rows.length,1);assert.equal(report.summary.margin,30000);assert.equal(report.summary.quantity,10);assert.equal(report.personalExpenses,20000);assert.equal(report.personalRows.length,1);
 const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await createReportExcel(report)).buffer);assert.match(JSON.stringify(book.getWorksheet("Belanja sendiri")!.getSheetValues()),/Batch uji/);assert.match(JSON.stringify(book.getWorksheet("Ringkasan")!.getSheetValues()),/20000/);assert.doesNotMatch(JSON.stringify(book.getWorksheet("Pesanan")!.getSheetValues()),/personal/);
});

for(const type of ["jastip","po"] as const)test(`cost breakdown for ${type} sums purchases without changing margin or concealing missing HPP`,async()=>{
 const data=structuredClone(workspace(type));data.batches[0].directCosts=3000;
 const report=()=>buildSalesReport(data,{type,from:"2026-10-01",to:"2026-10-31"});let result=report();assert.equal(result.summary.hpp,73000);assert.equal(result.personalExpenses,20000);assert.equal(result.totalPurchaseCosts,93000);assert.equal(result.summary.margin,27000);
 const read=async()=>{const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(await createReportExcel(report())).buffer);const values=new Map<string,unknown>();book.getWorksheet("Ringkasan")!.eachRow(row=>values.set(String(row.getCell(1).value),row.getCell(2).value));return values;};
 let values=await read();assert.equal(values.get("HPP pelanggan"),73000);assert.equal(values.get("Belanja sendiri"),20000);assert.equal(values.get("Total biaya belanja"),93000);assert.equal(values.get("Margin usaha"),27000);
 data.orders[0].items[0].unitCost=null;result=report();assert.equal(result.personalExpenses,20000);assert.equal(result.totalPurchaseCosts,null);values=await read();assert.equal(values.get("Total biaya belanja"),"Belum lengkap");assert.equal(values.get("Belanja sendiri"),20000);assert.equal(values.get("Margin usaha diketahui"),"Belum lengkap");
 data.orders=[personal];result=report();assert.equal(result.totalPurchaseCosts,20000);assert.equal(result.summary.hpp,0);assert.equal(result.summary.margin,0);
 data.orders=[{...personal,status:"cancelled"}];assert.equal(report().totalPurchaseCosts,0);data.orders=[{...personal,date:"2026-09-30"}];assert.equal(report().totalPurchaseCosts,0);
 data.orders=[preparePersonalOrder({...personal,items:personal.items.map(item=>({...item,unitCost:0}))},true)];assert.equal(report().personalExpenses,0);assert.equal(report().totalPurchaseCosts,0);
});

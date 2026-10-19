import { formatDecimalInput, editDecimalInput } from "../src/lib/decimal-input.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { limitMarkupPercent, validBatchPurchaseFx, batchFxDraft, canonicalDecimal, inputDecimal, convertedCost, draftFromFx, fxDraftError, fxFromDraft, readFrankfurterRate, suggestedPrice, validPurchaseFx } from "../src/lib/purchase-fx.ts";

test("currency conversion and markup use exact decimal rounding and reject overflow",()=>{
 assert.equal(inputDecimal("1.000,50"),"1000.5");assert.equal(inputDecimal("105.5"),null);assert.equal(inputDecimal("15.300,25"),"15300.25");
 assert.equal(convertedCost("1000","105.5"),105500);assert.equal(convertedCost("0.1","5"),1);assert.equal(convertedCost("0","105.5"),0);
 assert.equal(convertedCost("1","0"),null);assert.equal(convertedCost(null,"1"),null);assert.equal(convertedCost("999999999999","999999999999"),null);
 assert.equal(suggestedPrice(100000,"20"),120000);assert.equal(suggestedPrice(101,"0,5"),102);assert.equal(suggestedPrice(100000,"0"),100000);assert.equal(suggestedPrice(null,"20"),null);assert.equal(suggestedPrice(Number.MAX_SAFE_INTEGER,"100"),null);assert.equal(canonicalDecimal("00105,5000"),"105.5");
});
test("FX snapshots distinguish missing values, true zero costs and estimates from final rates",()=>{
 const draft={currency:"JPY",amount:"1000",rate:"105,5",status:"estimate" as const,source:"manual" as const};const fx=fxFromDraft(draft);
 assert.equal(validPurchaseFx(fx,105500),true);assert.equal(validPurchaseFx(fx,105499),false);assert.equal(fxDraftError(draft),null);assert.deepEqual(draftFromFx(fx),{...draft,rateDate:undefined});
 assert.equal(fxDraftError({...draft,rate:"",status:"final"}),"Isi harga beli dan kurs sebelum memilih Final.");assert.equal(validPurchaseFx({...fx,rate:null},null),true);assert.equal(validPurchaseFx({...fx,rate:null,status:"final"},null),false);
 assert.equal(validPurchaseFx({...fx,amount:"0"},0),true);assert.equal(validPurchaseFx({...fx,rate:"0"},0),false);assert.equal(validPurchaseFx({...fx,source:"frankfurter"},105500),false);
 assert.equal(validPurchaseFx({...fx,source:"frankfurter",rateDate:"2026-02-30"},105500),false);
});
test("Frankfurter responses must match the pair and contain a recent valid daily quote",()=>{
 const now=new Date("2026-10-18T03:00:00Z"),quote={base:"JPY",amount:1,date:"2026-10-16",rates:{IDR:114.1}};
 assert.deepEqual(readFrankfurterRate(quote,"JPY",now),{rate:"114.1",date:"2026-10-16"});
 for(const invalid of [{...quote,base:"USD"},{...quote,amount:100},{...quote,rates:{IDR:0}},{...quote,date:"2026-02-30"},{...quote,date:"2026-10-19"},{...quote,date:"2026-09-01"}])assert.throws(()=>readFrankfurterRate(invalid,"JPY",now));
});

test("JSON backup and Excel reports retain conversion snapshots and mark estimates",async()=>{
 const {seedData}=await import("../src/lib/seed.ts");const {normalizeAppData}=await import("../src/lib/migration.ts");const {buildSalesReport}=await import("../src/lib/sales-report.ts");const {createReportExcel}=await import("../src/lib/report-excel.ts");const {buildShoppingReport}=await import("../src/lib/shopping-report.ts");const {createShoppingReportExcel}=await import("../src/lib/shopping-report-excel.ts");const ExcelJS=(await import("exceljs")).default;
 const data=structuredClone(seedData);data.orders=[data.orders[0]];const item=data.orders[0].items[0];item.purchaseFx={currency:"JPY",amount:"1000",rate:"105.5",source:"manual",status:"estimate"};item.unitCost=105500;
 const restored=normalizeAppData(JSON.parse(JSON.stringify(data)));assert.deepEqual(restored,data);
 const invalid=structuredClone(data);invalid.orders[0].items[0].unitCost=1;assert.equal(normalizeAppData(invalid),null);
 const date=data.orders[0].date,report=buildSalesReport(data,{type:"jastip",from:date,to:date});const bytes=await createReportExcel(report),book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(bytes).buffer);
 assert.match(JSON.stringify(book.getWorksheet("Ringkasan")!.getSheetValues()),/kurs estimasi/);assert.match(JSON.stringify(book.getWorksheet("Pesanan")!.getSheetValues()),/Kurs estimasi/);
 const shopping=await createShoppingReportExcel(buildShoppingReport(data,data.orders[0].batchId),"orders"),shoppingBook=new ExcelJS.Workbook();await shoppingBook.xlsx.load(new Uint8Array(shopping).buffer);assert.match(JSON.stringify(shoppingBook.worksheets[0].getSheetValues()),/estimasi/);
});

test("batch quotes validate separately from immutable order snapshots",()=>{
 const quote={currency:"JPY",rate:"105.5",source:"frankfurter",rateDate:"2026-10-16"};
 assert.equal(validBatchPurchaseFx(quote),true);
 assert.deepEqual(batchFxDraft(quote as Parameters<typeof batchFxDraft>[0]),{...quote,rate:"105,5",amount:"",status:"estimate"});
 for(const invalid of [null,[],{}, {...quote,currency:"IDR"},{...quote,rate:"0"},{...quote,rateDate:"2026-02-30"},{...quote,rateDate:undefined}]) assert.equal(validBatchPurchaseFx(invalid),false);
 assert.equal(validBatchPurchaseFx({currency:"SGD",rate:null,source:"manual"}),true);
});

test("localized decimal display groups thousands without changing precision or malformed pasted values",()=>{
 for (const [value,expected] of [["12000,50","12.000,50"],["12000,","12.000,"],["1000","1.000"],["1.000,000001","1.000,000001"],["0,000001","0,000001"],["105.5","105.5"],["",""]]) assert.equal(formatDecimalInput(value),expected);
 assert.equal(editDecimalInput("1234","1.2345","insertText","5"),"12345");
 assert.equal(editDecimalInput("12345","12.34","deleteContentBackward"),"1234");
 assert.equal(editDecimalInput("1234","105.5","insertFromPaste"),"105.5");
 assert.equal(inputDecimal(formatDecimalInput("12000,50")),"12000.5");
});
test("markup permits 0 through 100 percent and caps typed or pasted excess",()=>{
 assert.equal(suggestedPrice(100000,"100"),200000);assert.equal(suggestedPrice(100000,"100,01"),null);assert.equal(suggestedPrice(100000,"101"),null);
 for(const value of ["101","100,000001","999999999999999999","1000,","1.000"])assert.equal(limitMarkupPercent(value),"100");
 for(const value of ["0","99,99","100","100,","","-1"])assert.equal(limitMarkupPercent(value),value);
});

import {test} from "node:test";
import assert from "node:assert/strict";
import {seedData} from "../src/lib/seed.ts";
import {applyRefund,refundedTotal} from "../src/lib/refund.ts";
import {isAppData} from "../src/lib/validation.ts";
import {orderRevenue,outstanding} from "../src/lib/finance.ts";
import {buildInvoice} from "../src/lib/invoice.ts";
const paid=seedData.orders.find(order=>order.paid>0)!;
test("partial refund retains bill, reduces net receipts and preserves its history",()=>{
 const next=applyRefund(paid,1,"2026-10-09"," Test refund ",false);
 assert.equal(next.paid,paid.paid-1);assert.equal(orderRevenue(next),orderRevenue(paid));assert.equal(outstanding(next),outstanding(paid)+1);assert.equal(refundedTotal(next),1);assert.equal(next.refunds![0].reason,"Test refund");
 const data={...seedData,orders:seedData.orders.map(o=>o.id===next.id?next:o)};assert.equal(isAppData(data),true);
});
test("full remaining refund can cancel without losing payments or original creation date",()=>{
 const next=applyRefund(paid,paid.paid,"2026-10-09","internal supplier note",true);
 const invoice=buildInvoice(next);assert.match(invoice,/Refund:/);assert.doesNotMatch(invoice,/internal supplier note/);
 assert.equal(next.paid,0);assert.equal(next.status,"cancelled");assert.equal(next.createdAt,paid.createdAt);assert.equal(outstanding(next),0);
 assert.equal(isAppData({...seedData,orders:seedData.orders.map(o=>o.id===next.id?next:o)}),true);
});
test("invalid or excessive refunds cannot mutate an order",()=>{
 for(const amount of [0,-1,1.5,paid.paid+1,NaN])assert.throws(()=>applyRefund(paid,amount,"2026-10-09","",false));
 assert.throws(()=>applyRefund(paid,1,"2026-02-30","",false));assert.throws(()=>applyRefund(paid,1,"2026-10-09","",true));
 const bad=structuredClone(seedData);bad.orders[0].refunds=[{id:"r",amount:-1,date:"2026-10-09",createdAt:new Date().toISOString(),reason:""}];assert.equal(isAppData(bad),false);
});

test("refund aggregates in restored data cannot overflow monthly totals",()=>{
 const data=structuredClone(seedData);data.orders=data.orders.slice(0,2);
 data.orders.forEach((order,index)=>{order.paid=0;order.refunds=[{id:`refund-${index}`,amount:Number.MAX_SAFE_INTEGER-1,date:"2026-10-09",createdAt:"2026-10-09T00:00:00Z",reason:""}];});
 assert.equal(isAppData(data),false);
});

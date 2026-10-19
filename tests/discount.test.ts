import test from "node:test";
import assert from "node:assert/strict";
import { orderDiscount, orderRevenue, orderHpp, orderMargin, outstanding, getMonthSummary } from "../src/lib/finance.ts";
import { isAppData } from "../src/lib/validation.ts";
import { buildInvoice } from "../src/lib/invoice.ts";
import type { AppData, Order } from "../src/lib/types.ts";
const order: Order = { id:"discount-order", batchId:"batch", customerId:"customer", date:"2026-10-11", createdAt:"2026-10-11T00:00:00Z", status:"new", notes:"", serviceFee:10000, shippingCharge:5000, paid:20000, items:[{id:"discount-item",product:"Roti",variant:"",color:"",size:"",quantity:2,unitPrice:25000,unitCost:12000}] };
function workspace(o: Order): AppData { return {batches:[{id:"batch",name:"Batch",type:"jastip",origin:"",status:"open",closeDate:"2026-10-31",directCosts:0}],customers:[{id:"customer",name:"Alya",phone:""}],products:[],orders:[o]}; }
test("discounts reduce totals, balances, margin and monthly sales without reducing shipping or HPP", () => {
  assert.equal(orderRevenue(order),65000);
  for (const discount of [{type:"amount",value:6000},{type:"percent",value:10}] as const) {
    const o={...order,discount}, d=workspace(o);
    assert.equal(orderDiscount(o),6000); assert.equal(orderRevenue(o),59000);
    assert.equal(outstanding(o),39000); assert.equal(orderHpp(o,d.orders,d.batches),24000);
    assert.equal(orderMargin(o,d.orders,d.batches),30000);
    assert.equal(getMonthSummary(d,"2026-10").revenue,59000); assert.equal(isAppData(d),true);
    assert.match(buildInvoice(o),/Diskon.*6\.000/); assert.match(buildInvoice(o),/Total tagihan.*59\.000/);
  }
});
test("percent discounts round half up, allow free items and remain exact at safe integer limits", () => {
  const small={...order,serviceFee:0,items:[{...order.items[0],quantity:1,unitPrice:101}],discount:{type:"percent" as const,value:50}};
  assert.equal(orderDiscount(small),51);
  assert.equal(orderRevenue({...small,discount:{type:"percent",value:100}}),5000);
  assert.equal(orderDiscount({...small,items:[{...small.items[0],unitPrice:Number.MAX_SAFE_INTEGER}],discount:{type:"percent",value:100}}),Number.MAX_SAFE_INTEGER);
});
test("discount validation rejects invalid types, excessive discounts and payment above net bill", () => {
  for (const discount of [{type:"percent",value:101},{type:"amount",value:65001},{type:"amount",value:-1},{type:"percent",value:1.5},{type:"other",value:1},null]) {
    assert.equal(isAppData(workspace({...order,discount} as Order)),false);
  }
  assert.equal(isAppData(workspace({...order,discount:{type:"percent",value:100},paid:5001})),false);
  assert.equal(isAppData(workspace({...order,discount:{type:"percent",value:100},paid:5000})),true);
  const free={...order,discount:{type:"amount" as const,value:65000},paid:0};
  assert.equal(isAppData(workspace(free)),true); assert.equal(orderRevenue(free),0);
  assert.equal(isAppData(workspace({...free,paid:1})),false);
});

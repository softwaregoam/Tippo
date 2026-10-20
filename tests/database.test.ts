import { FX_CURRENCIES } from "../src/lib/currency-catalog.ts";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { AppData, Order } from "../src/lib/types.ts";
const db = new PGlite();
const userA = "00000000-0000-0000-0000-000000000001", userB = "00000000-0000-0000-0000-000000000002";
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${userA}'),('${userB}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(await readFile(new URL("../supabase/migrations/202610080001_tippo_workspace.sql", import.meta.url), "utf8"));
  const discountSql=await readFile(new URL("../supabase/migrations/202610110004_order_discount.sql", import.meta.url),"utf8");
  await db.exec(discountSql); await db.exec(discountSql);
  const limitsSql=await readFile(new URL("../supabase/migrations/202610110005_discount_limits.sql", import.meta.url),"utf8");
  await db.exec(limitsSql); await db.exec(limitsSql);
  const recapSql=await readFile(new URL("../supabase/migrations/202610130012_shopping_recap.sql",import.meta.url),"utf8");await db.exec(recapSql);await db.exec(recapSql);
  const exchangeSql=await readFile(new URL("../supabase/migrations/202610190001_exchange_api.sql",import.meta.url),"utf8");await db.exec(exchangeSql);await db.exec(exchangeSql);
  const probe=workspace([order("exchange-probe","jastip")]);probe.batches[0].purchaseFx={currency:"JPY",rate:"105.5",source:"exchange-api",rateDate:"2026-10-18"};probe.orders[0].items[0].purchaseFx={...probe.batches[0].purchaseFx,amount:"1000",status:"estimate"};probe.orders[0].items[0].unitCost=105500;
  assert.equal((await db.query<{valid:boolean}>("select public.tippo_valid_workspace($1::jsonb) valid",[JSON.stringify(probe)])).rows[0].valid,true);
  const fxSql=await readFile(new URL("../supabase/migrations/202610180001_purchase_fx.sql",import.meta.url),"utf8");await db.exec(fxSql);await db.exec(fxSql);
  const batchFxSql=await readFile(new URL("../supabase/migrations/202610180002_batch_purchase_fx.sql",import.meta.url),"utf8");await db.exec(batchFxSql);await db.exec(batchFxSql);
  await db.exec(exchangeSql);await db.exec(exchangeSql);
  const currenciesSql=await readFile(new URL("../supabase/migrations/202610190002_all_currencies.sql",import.meta.url),"utf8");await db.exec(currenciesSql);await db.exec(currenciesSql);
  const personalSql=await readFile(new URL("../supabase/migrations/202610200001_personal_purchases.sql",import.meta.url),"utf8");await db.exec(personalSql);await db.exec(personalSql);
});
after(async () => { await db.close(); });
async function login(user: string) { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`); }
async function get() { const result = await db.query<{ value: { data: AppData; version: number; usage: unknown[] } }>("select public.get_tippo_workspace() as value"); return result.rows[0].value; }
async function save(data: AppData, version: number) { const result = await db.query<{ value: { data: AppData; version: number; usage: unknown[] } }>("select public.save_tippo_workspace($1::jsonb,$2::bigint) as value", [JSON.stringify(data), version]); return result.rows[0].value; }
function order(id: string, type: string): Order { return { id, batchId: type, customerId: "customer", items: [{ id: `item-${id}`, product: "Roti", variant: "Cokelat", color: "", size: "", quantity: 2, unitPrice: 20000, unitCost: 12000 }], serviceFee: 1000, shippingCharge: 0, paid: 0, status: "new", date: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", notes: "" }; }
function workspace(orders: Order[]): AppData { return { batches: ["jastip", "po"].map(type => ({ id:type,name:type,type:type as "jastip"|"po",origin:"",closeDate:"2026-10-31",status:"open",directCosts:0 })), customers:[{id:"customer",name:"Alya",phone:""}],products:[],orders }; }

test("database RPC enforces independent quotas, atomic rollback, reset retention and immutable server time", async () => {
  await login(userA); const initial = await get(); assert.equal(initial.version, 0);
  const first = await save(workspace([order("j1","jastip")]), initial.version);
  assert.notEqual(first.data.orders[0].createdAt, "2026-01-01T00:00:00Z");
  const full = workspace([...Array.from({length:5},(_,i)=>order(`j${i+1}`,"jastip")), ...Array.from({length:5},(_,i)=>order(`p${i+1}`,"po"))]);
  const saved = await save(full, first.version); assert.equal(saved.usage.length, 10);
  await assert.rejects(save({...full,orders:[...full.orders,order("j6","jastip")]},saved.version), /TIPPO_ORDER_LIMIT/);
  assert.equal((await get()).version,saved.version); assert.equal((await get()).usage.length,10);
  const reset = await save({batches:[],customers:[],products:[],orders:[]},saved.version); assert.equal(reset.usage.length,10);
  await assert.rejects(save(workspace([order("j-new","jastip")]),reset.version),/TIPPO_ORDER_LIMIT/);
  const restored = await save(full,reset.version); assert.equal(restored.usage.length,10);
  await assert.rejects(save(full,reset.version),/TIPPO_CONFLICT/);
  const wrongType = structuredClone(restored.data); wrongType.orders[0].batchId="po";
  await assert.rejects(save(wrongType,restored.version),/TIPPO_INVALID_ORDER_TYPE/);
});
test("database RLS isolates accounts and blocks direct entitlement, ledger and RPC access", async () => {
  await login(userB); const own = await get(); assert.equal(own.data.orders.length,0);
  const rows = await db.query("select owner_id from public.tippo_workspaces"); assert.equal(rows.rows.length,1);
  await assert.rejects(db.exec("update public.tippo_workspaces set pro_until=now()+interval '1 month'"),/permission denied/);
  await assert.rejects(db.exec("delete from public.tippo_order_usage"),/permission denied/);
  await assert.rejects(db.query("select public.tippo_workspace_result($1::uuid)",[userA]),/permission denied/);
  await db.exec("reset role; set role anon;"); await assert.rejects(db.exec("select public.get_tippo_workspace()"),/permission denied/);
});
test("database validates multi-item finances and limits archived products", async () => {
  await login(userB); let own = await get();
  const input=workspace([order("b1","jastip")]); input.orders[0].items.push({...input.orders[0].items[0],id:"b-second",quantity:1}); input.orders[0].paid=61001;
  await assert.rejects(save(input,own.version),/TIPPO_INVALID/);
  input.orders[0].paid=61000; input.batches[0].status="completed"; own=await save(input,own.version); assert.equal(own.data.batches[0].status,"completed");
  const products=Array.from({length:6},(_,i)=>({id:`product-${i}`,name:"Roti",variant:"",sku:`R${i}`,unitPrice:20000,unitCost:12000,active:i!==0}));
  await assert.rejects(save({...own.data,products},own.version),/TIPPO_PRODUCT_LIMIT/);
  await assert.rejects(save({...own.data,orders:[{...own.data.orders[0],items:[{...own.data.orders[0].items[0],unitCost:undefined}]}]} as unknown as AppData,own.version),/TIPPO_INVALID/);
});
test("expired Pro keeps existing data editable without allowing new quota slots", async () => {
  await db.exec(`reset role; update public.tippo_workspaces set pro_until=now()+interval '1 month' where owner_id='${userB}';`);
  await login(userB); let own=await get(); own=await save(workspace(Array.from({length:7},(_,i)=>order(`pro-${i}`,"po"))),own.version);
  await db.exec(`reset role; update public.tippo_workspaces set pro_until=now()-interval '1 day' where owner_id='${userB}';`);
  await login(userB); const edit=structuredClone(own.data); edit.orders[0].notes="Diubah"; own=await save(edit,own.version);
  await assert.rejects(save({...own.data,orders:[...own.data.orders,order("pro-new","po")]},own.version),/TIPPO_ORDER_LIMIT/);
});
test("server month rollover grants new slots without deleting historical orders", async () => {
  await db.exec(`reset role; update public.tippo_order_usage set created_at=date_trunc('month',now())-interval '1 day' where owner_id='${userA}';`);
  await login(userA);let own=await get();own=await save({...own.data,orders:[...own.data.orders,order("new-month","jastip")]},own.version);
  assert.equal(own.usage.length,11);assert.equal(own.data.orders.length,11);
  const cancel=structuredClone(own.data);cancel.orders.find(o=>o.id==="new-month")!.status="cancelled";own=await save(cancel,own.version);
  const more=[...own.data.orders,...Array.from({length:5},(_,i)=>order(`month-${i}`,"jastip"))];
  await assert.rejects(save({...own.data,orders:more},own.version),/TIPPO_ORDER_LIMIT/);
});
test("discount RPC saves net payment, rejects invalid discounts and preserves quota on edit", async () => {
  await login(userB); let own=await get(); const data=structuredClone(own.data);
  data.orders[0].discount={type:"percent",value:10}; data.orders[0].paid=36900;
  own=await save(data,own.version); assert.deepEqual(own.data.orders[0].discount,{type:"percent",value:10});
  const count=own.usage.length;
  const excessive=structuredClone(own.data); excessive.orders[0].paid=41000;
  await assert.rejects(save(excessive,own.version),/TIPPO_INVALID/);
  excessive.orders[0].paid=0; excessive.orders[0].discount={type:"percent",value:101};
  await assert.rejects(save(excessive,own.version),/TIPPO_INVALID/);
  excessive.orders[0].discount={type:"amount",value:41001}; await assert.rejects(save(excessive,own.version),/TIPPO_INVALID/);
  excessive.orders[0].discount={type:"amount",value:1000}; excessive.orders[0].paid=40000;
  own=await save(excessive,own.version); assert.equal(own.usage.length,count); assert.equal(own.data.orders[0].paid,40000);
  const fullDiscount=structuredClone(own.data); fullDiscount.orders[0].shippingCharge=5000;
  fullDiscount.orders[0].discount={type:"amount",value:46000}; fullDiscount.orders[0].paid=0;
  own=await save(fullDiscount,own.version); assert.equal(own.data.orders[0].discount?.value,46000);
  fullDiscount.orders[0].discount.value=46001;
  await assert.rejects(save(fullDiscount,own.version),/TIPPO_INVALID/);
});


test("recap fields are optional and server rejects malformed shop snapshots without weakening discount validation",async()=>{
 await db.exec("reset role");
 const d=workspace([order("recap-fields","jastip")]);d.orders[0].items[0].store="Uniqlo";
 const validate=async(value:AppData)=>(await db.query<{valid:boolean}>("select public.tippo_valid_workspace($1::jsonb) as valid",[JSON.stringify(value)])).rows[0].valid;
 assert.equal(await validate(d),true);
 d.orders[0].items[0].store="x".repeat(81);assert.equal(await validate(d),false);
 delete d.orders[0].items[0].store;assert.equal(await validate(d),true);
 d.products=[{id:"master",name:"Produk",variant:"",sku:"",store:"Supplier",color:"Hitam",size:"L",unitPrice:10000,unitCost:null,active:true}];assert.equal(await validate(d),true);
 d.products[0].store=null as unknown as string;assert.equal(await validate(d),false);
 d.products[0].store="Supplier";d.orders[0].discount={type:"percent",value:101};assert.equal(await validate(d),false);
});

test("FX snapshots validate conversion and final status without weakening server quotas",async()=>{
 await db.exec("reset role");
 const id="00000000-0000-0000-0000-000000000099";await db.exec(`insert into auth.users values('${id}');`);await login(id);const initial=await get();
 const data=workspace([order("fx-item","jastip")]);data.orders[0].items[0].purchaseFx={currency:"JPY",amount:"1000",rate:"105.5",status:"estimate",source:"frankfurter",rateDate:"2026-10-16"};data.orders[0].items[0].unitCost=105500;
 let saved=await save(data,initial.version);assert.deepEqual(saved.data.orders[0].items[0].purchaseFx,data.orders[0].items[0].purchaseFx);
 for(const mutate of [
  (d:AppData)=>{d.orders[0].items[0].unitCost=1;},
  (d:AppData)=>{d.orders[0].items[0].purchaseFx!.rate="-1";},
  (d:AppData)=>{d.orders[0].items[0].purchaseFx!.currency="IDR";},
  (d:AppData)=>{d.orders[0].items[0].purchaseFx!.rateDate="2026-02-30";},
  (d:AppData)=>{d.orders[0].items[0].purchaseFx!.amount=null;d.orders[0].items[0].purchaseFx!.status="final";d.orders[0].items[0].unitCost=null;},
  (d:AppData)=>{d.orders[0].batchId="po";},
 ]) {const invalid=structuredClone(data);mutate(invalid);await assert.rejects(save(invalid,saved.version),/TIPPO_INVALID/);}
 const incomplete=structuredClone(data);incomplete.orders[0].items[0].purchaseFx!.rate=null;incomplete.orders[0].items[0].purchaseFx!.source="manual";delete incomplete.orders[0].items[0].purchaseFx!.rateDate;incomplete.orders[0].items[0].unitCost=null;
 saved=await save(incomplete,saved.version);assert.equal(saved.data.orders[0].items[0].unitCost,null);
 const final=structuredClone(data);final.orders[0].items[0].purchaseFx!.status="final";saved=await save(final,saved.version);assert.equal(saved.usage.length,1);
 const mixed=structuredClone(final);mixed.batches[0].purchaseFx={currency:"JPY",rate:"105.5",source:"exchange-api",rateDate:"2026-10-18"};mixed.orders[0].items.push({...mixed.orders[0].items[0],id:"exchange-item",purchaseFx:{...mixed.orders[0].items[0].purchaseFx!,source:"exchange-api",rateDate:"2026-10-18"}});
 saved=await save(mixed,saved.version);assert.equal(saved.data.orders[0].items[0].purchaseFx!.source,"frankfurter");assert.equal(saved.data.orders[0].items[1].purchaseFx!.source,"exchange-api");assert.equal(saved.usage.length,1);
 const missingDate=structuredClone(mixed);delete missingDate.orders[0].items[1].purchaseFx!.rateDate;await assert.rejects(save(missingDate,saved.version),/TIPPO_INVALID/);
 const full=workspace(Array.from({length:5},(_,i)=>order(i===0?"fx-item":`fx-${i}`,"jastip")));saved=await save(full,saved.version);
 await assert.rejects(save({...full,orders:[...full.orders,order("fx-sixth","jastip")]},saved.version),/TIPPO_ORDER_LIMIT/);
});

test("batch FX defaults reject malformed imports and never rewrite stored item rates",async()=>{
 await login(userB);const own=await get();const input=structuredClone(own.data);
 input.batches[0].purchaseFx={currency:"JPY",rate:"105.5",source:"frankfurter",rateDate:"2026-10-16"};
 // Existing owner may have a PO batch first; reference quotes are Jastip-only.
 const jastip=input.batches.find(b=>b.type==="jastip");
 if(!jastip)input.batches.push({id:"fx-batch",name:"Japan",type:"jastip",origin:"",closeDate:"2026-10-18",status:"open",directCosts:0});
 delete input.batches[0].purchaseFx;
 const batch=input.batches.find(b=>b.type==="jastip")!;
 batch.purchaseFx={currency:"JPY",rate:"105.5",source:"frankfurter",rateDate:"2026-10-16"};
 const orders=structuredClone(input.orders);const saved=await save(input,own.version);assert.deepEqual(saved.data.orders,orders);
 for(const invalid of [{...batch.purchaseFx,rate:"0"},{...batch.purchaseFx,rate:"-1"},{...batch.purchaseFx,currency:"INVALID"},{...batch.purchaseFx,rateDate:"2026-02-30"},{...batch.purchaseFx,rate:null}]) {
  const bad=structuredClone(saved.data);bad.batches.find(b=>b.id===batch.id)!.purchaseFx=invalid;
  await assert.rejects(save(bad,saved.version),/TIPPO_INVALID/);
 }
});

test("exchange-api snapshots save with provenance checks and retain legacy reference quotes",async()=>{
 await login(userB);const own=await get(),data=structuredClone(own.data),batch=data.batches.find(b=>b.type==="jastip")!;
 batch.purchaseFx={currency:"JPY",rate:"114.236406",source:"exchange-api",rateDate:"2026-10-18"};
 const saved=await save(data,own.version);assert.equal(saved.data.batches.find(b=>b.id===batch.id)!.purchaseFx!.source,"exchange-api");assert.deepEqual(saved.data.orders,own.data.orders);assert.deepEqual(saved.usage,own.usage);
 for(const bad of [{...batch.purchaseFx,source:"unknown"},{...batch.purchaseFx,rateDate:undefined},{...batch.purchaseFx,rate:null}]) {
  const invalid=structuredClone(saved.data);invalid.batches.find(b=>b.id===batch.id)!.purchaseFx=bad as typeof batch.purchaseFx;
  await assert.rejects(save(invalid,saved.version),/TIPPO_INVALID/);
 }
});


test("all supported national currencies pass database item and batch validation, unknown codes remain blocked",async()=>{
 await db.exec("reset role");
 for(const code of [...FX_CURRENCIES,"BTC","XAU","DEM","INVALID","IDR"]){
  const data=workspace([order("all-currencies","jastip")]);
  const fx={currency:code,rate:"1.123456",source:"exchange-api" as const,rateDate:"2026-10-18"};
  data.batches[0].purchaseFx=fx;data.orders[0].items[0].purchaseFx={...fx,amount:"100",status:"estimate"};data.orders[0].items[0].unitCost=112;
  const result=await db.query<{valid:boolean}>("select public.tippo_valid_workspace($1::jsonb) valid",[JSON.stringify(data)]);
  assert.equal(result.rows[0].valid,FX_CURRENCIES.includes(code),code);
 }
});

test("personal purchase validation requires zero billing, known costs and never changes quota or stored customers",async()=>{
 await db.exec("reset role");const personal={...order("personal-check","jastip"),purpose:"personal" as const,customerId:"",serviceFee:0,shippingCharge:0,paid:0,items:order("personal-check","jastip").items.map(item=>({...item,unitPrice:0,unitCost:12000}))};
 const data=workspace([personal]);data.customers=[];
 const valid=async(value:AppData)=>(await db.query<{valid:boolean}>("select public.tippo_valid_workspace($1::jsonb) valid",[JSON.stringify(value)])).rows[0].valid;
 assert.equal(await valid(data),true);
 for(const patch of [{purpose:"customer"},{purpose:null},{customerId:"a"},{paid:1},{shippingCharge:1},{serviceFee:1},{discount:{type:"amount",value:0}},{refunds:[{amount:1}]}]){const invalid=structuredClone(data);Object.assign(invalid.orders[0],patch);assert.equal(await valid(invalid),false);}
 for(const patch of [{unitPrice:1},{unitCost:null},{unitCost:-1}]){const invalid=structuredClone(data);Object.assign(invalid.orders[0].items[0],patch);assert.equal(await valid(invalid),false);}
 const fresh="00000000-0000-0000-0000-000000000009";await db.exec(`insert into auth.users values('${fresh}') on conflict do nothing`);await login(fresh);const first=await get();const saved=await save(data,first.version);assert.deepEqual(saved.data.customers,[]);assert.equal(saved.data.orders[0].purpose,"personal");assert.equal(saved.data.orders[0].customerId,"");assert.equal(saved.usage.length,1);
 const full=structuredClone(data);full.orders=Array.from({length:6},(_,i)=>({...personal,id:`personal-quota-${i}`,items:personal.items.map(item=>({...item,id:`personal-item-${i}`}))}));await assert.rejects(save(full,saved.version),/TIPPO_ORDER_LIMIT/);assert.equal((await get()).version,saved.version);
});

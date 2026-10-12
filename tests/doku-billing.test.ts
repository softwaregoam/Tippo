import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash,createHmac} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {billingHandler,productionTestHandler} from "../supabase/functions/_shared/billing-handler.ts";
import {readCheckoutRejection,signDoku,verifyDoku,parseDokuExpiry,safeCheckoutUrl,createDokuCheckout,type DokuInvoice} from "../supabase/functions/_shared/doku.ts";
import {parseSandboxBilling,parseProductionTestBilling} from "../src/lib/doku-billing.ts";

const db=new PGlite();

test("Checkout diagnostics read alternate JSON/text errors and redact secrets without returning HTML",async()=>{
 const secrets=["private-test-secret","merchant-test-id","signature-test-value"];
 const flat=await readCheckoutRejection(Response.json({message:"order.amount is invalid",error_code:"INVALID_AMOUNT"},{status:400}),secrets);
 assert.equal(flat.providerCode,"INVALID_AMOUNT");assert.equal(flat.providerMessage,"order.amount is invalid");assert.equal(flat.providerFormat,"json");
 const nested=await readCheckoutRejection(Response.json({error:{message:["override_notification_url is invalid","secret: private-test-secret merchant-test-id signature-test-value Bearer bearer-test-value"]}},{status:400}),secrets);
 assert.equal(nested.providerCode,null);assert.match(nested.providerMessage!,/override_notification_url/);
 for(const secret of [...secrets,"bearer-test-value"])assert.equal(nested.providerMessage!.includes(secret),false);
 const plain=await readCheckoutRejection(new Response("Client-Id is not registered",{status:400}),secrets);
 assert.equal(plain.providerMessage,"Client-Id is not registered");assert.equal(plain.providerFormat,"text");
 const html=await readCheckoutRejection(new Response("<html>private-test-secret</html>",{status:400}),secrets);
 assert.equal(html.providerFormat,"html");assert.equal(html.providerMessage,null);
 const large=await readCheckoutRejection(new Response("x".repeat(9000),{status:400}),secrets);
 assert.equal(large.providerFormat,"truncated");assert.equal(large.providerMessage,null);
});
let legacyCheckout:DokuInvoice;
const a="00000000-0000-0000-0000-000000000001",b="00000000-0000-0000-0000-000000000002",c="00000000-0000-0000-0000-000000000003";
const config={environment:"sandbox",clientId:"test-merchant",secretKey:"test-secret-not-a-credential",siteUrl:"https://preview.tippo.test",notificationUrl:"https://billing.supabase.test/functions/v1/tippo-doku-sandbox/webhook"};
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}'),('${c}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;create table public.tippo_workspaces(owner_id uuid primary key,pro_until timestamptz);insert into public.tippo_workspaces values('${a}',null),('${b}',null),('${c}',null);`);
 const migration=await readFile(new URL("../supabase/migrations/202610120001_doku_sandbox.sql",import.meta.url),"utf8");await db.exec(migration);await db.exec(migration);
 const production=await readFile(new URL("../supabase/migrations/202610120002_doku_production_test.sql",import.meta.url),"utf8");await db.exec(production);await db.exec(production);
 legacyCheckout=(await db.query<{value:DokuInvoice}>("select public.tippo_begin_production_test_checkout($1,$2,$3,$4) as value",[c,config.clientId,config.siteUrl+"/app",config.notificationUrl])).rows[0].value;
 const methods=await readFile(new URL("../supabase/migrations/202610120004_doku_checkout_methods.sql",import.meta.url),"utf8");await db.exec(methods);await db.exec(methods);
 const thousand=await readFile(new URL("../supabase/migrations/202610120005_doku_checkout_test_1000.sql",import.meta.url),"utf8");await db.exec(thousand);await db.exec(thousand);
 const tenThousand=await readFile(new URL("../supabase/migrations/202610120006_doku_checkout_test_10000.sql",import.meta.url),"utf8");await db.exec(tenThousand);await db.exec(tenThousand);
 const format=await readFile(new URL("../supabase/migrations/202610120007_doku_checkout_invoice_format.sql",import.meta.url),"utf8");await db.exec(format);await db.exec(format);
});
after(()=>db.close());
async function rpc(name:string,args:Record<string,unknown>){
 const allowed=["tippo_begin_sandbox_checkout","tippo_attach_sandbox_checkout","tippo_get_sandbox_billing","tippo_accept_sandbox_notification"];
 assert.ok([...allowed,...allowed.map(name=>name.replace("sandbox","production_test")),"tippo_fail_production_test_checkout"].includes(name));
 await db.exec("reset role;set role service_role;");
 const entries=Object.entries(args);return (await db.query<{value:unknown}>(`select public.${name}(${entries.map(([key],i)=>`${key}=>$${i+1}`).join(",")}) as value`,entries.map(([,value])=>value))).rows[0].value;
}
async function begin(owner:string){return await rpc("tippo_begin_sandbox_checkout",{p_owner:owner,p_client_id:config.clientId,p_callback:config.siteUrl+"/app",p_notification:config.notificationUrl}) as DokuInvoice;}
async function notify(invoice:DokuInvoice,id:string,status="SUCCESS",amount=25000,digest="test-digest"){
 return rpc("tippo_accept_sandbox_notification",{p_invoice:invoice.invoice_number,p_client_id:config.clientId,p_amount:amount,p_request_id:id,p_digest:digest,p_status:status});
}

test("DOKU signature matches an independent HMAC calculation and binds raw body, path and headers",async()=>{
 const raw='{"order":{"amount":25000}}',timestamp="2026-10-12T01:00:00Z",request="event-1",target="/functions/v1/tippo-doku-sandbox/webhook";
 const digest=createHash("sha256").update(raw).digest("base64");
 const canonical=`Client-Id:${config.clientId}\nRequest-Id:${request}\nRequest-Timestamp:${timestamp}\nRequest-Target:${target}\nDigest:${digest}`;
 const signature="HMACSHA256="+createHmac("sha256",config.secretKey).update(canonical).digest("base64");
 assert.equal(await signDoku(config.secretKey,config.clientId,request,timestamp,target,raw),signature);
 const headers=new Headers({"Client-Id":config.clientId,"Request-Id":request,"Request-Timestamp":timestamp,Signature:signature});
 assert.equal(await verifyDoku(config.secretKey,config.clientId,target,headers,raw),true);
 assert.equal(await verifyDoku(config.secretKey,config.clientId,target,headers,raw+" "),false);
 assert.equal(await verifyDoku(config.secretKey,config.clientId,target+"/fake",headers,raw),false);
 headers.set("Client-Id","other");assert.equal(await verifyDoku(config.secretKey,config.clientId,target,headers,raw),false);
});

test("sandbox database retains checkout identity and grants once, without modifying production Pro",async()=>{
 const invoice=await begin(a);assert.deepEqual(await begin(a),invoice);
 const body=JSON.parse(invoice.request_body);assert.equal(body.order.amount,25000);assert.deepEqual(body.payment.payment_method_types,["QRIS"]);
 await assert.rejects(notify(invoice,"wrong-amount","SUCCESS",1),/PAYMENT_MISMATCH/);
 await notify(invoice,"failed-attempt","FAILED");let state=await rpc("tippo_get_sandbox_billing",{p_owner:a}) as {proUntil:string|null};assert.equal(state.proUntil,null);
 await notify(invoice,"payment-1");state=await rpc("tippo_get_sandbox_billing",{p_owner:a}) as {proUntil:string};const expires=state.proUntil;assert.ok(expires);
 await notify(invoice,"payment-1");await notify(invoice,"payment-2");await notify(invoice,"late-expiry","EXPIRED");assert.equal((await rpc("tippo_get_sandbox_billing",{p_owner:a}) as {proUntil:string}).proUntil,expires);
 await assert.rejects(notify(invoice,"payment-1","SUCCESS",25000,"changed-body"),/REPLAY_MISMATCH/);
 const second=await begin(a);assert.notEqual(second.id,invoice.id);await notify(second,"renewal");assert.ok(Date.parse((await rpc("tippo_get_sandbox_billing",{p_owner:a}) as {proUntil:string}).proUntil)>Date.parse(expires));
 await db.exec("reset role;");assert.equal((await db.query<{count:number}>("select count(*)::int as count from public.tippo_workspaces where pro_until is not null")).rows[0].count,0);
});

test("billing RLS and service-only RPCs reject browser grants, mutations and foreign invoices",async()=>{
 await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${b}',false);`);
 assert.equal((await db.query("select id from public.tippo_sandbox_invoices")).rows.length,0);
 await assert.rejects(db.exec("select client_id,request_body from public.tippo_sandbox_invoices"),/permission denied/);
 await assert.rejects(db.exec("update public.tippo_sandbox_invoices set status='paid'"),/permission denied/);
 await assert.rejects(db.exec("insert into public.tippo_sandbox_pro_access values('"+b+"',now())"),/permission denied/);
 await assert.rejects(db.query("select public.tippo_get_sandbox_billing($1::uuid)",[a]),/permission denied/);
 await assert.rejects(db.exec("select * from public.tippo_sandbox_notifications"),/permission denied/);
 await db.exec("reset role;set role anon;");await assert.rejects(db.exec("select * from public.tippo_sandbox_invoices"),/permission denied/);
});

test("sandbox HTTP checkout ignores manipulated owner/price and webhook verifies before atomic grant",async()=>{
 let sendCount=0;let issued:DokuInvoice|undefined;
 const send:typeof fetch=async(input,init)=>{
  sendCount++;assert.equal(String(input),"https://api-sandbox.doku.com/checkout/v1/payment");
  const body=JSON.parse(init!.body as string);assert.equal(body.order.amount,25000);
  return Response.json({response:{order:body.order,payment:{url:"https://sandbox.doku.com/checkout/test",expired_date:"20501012120000"}}});
 };
 const handler=billingHandler(config,{authenticate:async token=>token==="owner-c"?c:null,rpc:async(name,args)=>{const result=await rpc(name,args);if(name==="tippo_begin_sandbox_checkout")issued=result as DokuInvoice;return result;},send});
 const url="https://billing.supabase.test/functions/v1/tippo-doku-sandbox/";
 assert.equal((await handler(new Request(url+"checkout",{method:"POST"}))).status,401);
 const response=await handler(new Request(url+"checkout",{method:"POST",headers:{Authorization:"Bearer owner-c",Origin:config.siteUrl},body:JSON.stringify({ownerId:a,amount:1,environment:"production"})}));assert.equal(response.status,200);const state=parseSandboxBilling(await response.json());assert.equal(state.invoice!.amount,25000);
 await handler(new Request(url+"checkout",{method:"POST",headers:{Authorization:"Bearer owner-c"}}));assert.equal(sendCount,1);
 const payload=JSON.stringify({service:{id:"QRIS"},order:{invoice_number:issued!.invoice_number,amount:25000},transaction:{status:"SUCCESS"},extra:"compatible"});
 const headers=new Headers({"Client-Id":config.clientId,"Request-Id":"http-notification","Request-Timestamp":"2026-10-12T01:00:00Z",Signature:"fake"});
 assert.equal((await handler(new Request(url+"webhook",{method:"POST",headers,body:payload}))).status,401);
 headers.set("Signature",await signDoku(config.secretKey,config.clientId,"http-notification","2026-10-12T01:00:00Z",new URL(config.notificationUrl).pathname,payload));
 assert.equal((await handler(new Request(url+"webhook",{method:"POST",headers,body:payload}))).status,200);
 assert.equal((await handler(new Request(url+"webhook",{method:"POST",headers,body:payload}))).status,200);
 const status=await handler(new Request(url+"status",{headers:{Authorization:"Bearer owner-c"}}));const paid=parseSandboxBilling(await status.json());assert.equal(paid.invoice!.status,"paid");assert.ok(paid.proUntil);
 const origin=await handler(new Request(url+"status",{headers:{Origin:"https://evil.test",Authorization:"Bearer owner-c"}}));assert.equal(origin.status,403);
});

test("timeout retry uses unchanged DOKU body and Request-Id, accepts documented 409 and rejects unsafe response",async()=>{
 const invoice=await begin(b);let calls=0;const sent:{body:unknown;id:string|null}[]=[];
 const send:typeof fetch=async(_url,init)=>{calls++;sent.push({body:init?.body,id:new Headers(init?.headers).get("Request-Id")});if(calls===1)throw new Error("timeout");return Response.json({response:{order:{invoice_number:invoice.invoice_number,amount:25000},payment:{url:"https://sandbox.doku.com/checkout/retry",expired_date:"20501012120000"}}},{status:409});};
 await assert.rejects(createDokuCheckout(invoice,config.clientId,config.secretKey,send),/timeout/);await createDokuCheckout(invoice,config.clientId,config.secretKey,send);assert.deepEqual(sent[0],sent[1]);
 assert.throws(()=>safeCheckoutUrl("https://sandbox.doku.com.evil.test/pay"));assert.throws(()=>safeCheckoutUrl("https://api.doku.com/pay"));assert.throws(()=>safeCheckoutUrl("javascript:alert(1)"));assert.throws(()=>parseDokuExpiry("20260230120000"));assert.equal(parseDokuExpiry("20261012120000"),"2026-10-12T05:00:00.000Z");
 assert.throws(()=>parseSandboxBilling({environment:"production",invoice:null,proUntil:null}));
 assert.throws(()=>billingHandler({...config,environment:"production"},{authenticate:async()=>null,rpc:async()=>null}));
});

test("failed database notification is not acknowledged and signed expiry permits a new invoice",async()=>{
 const payload=JSON.stringify({service:{id:"QRIS"},order:{invoice_number:"TSBX-"+"F".repeat(32),amount:25000},transaction:{status:"SUCCESS"}});
 const timestamp="2026-10-12T01:00:00Z",request="database-retry";
 const headers=new Headers({"Client-Id":config.clientId,"Request-Id":request,"Request-Timestamp":timestamp,Signature:await signDoku(config.secretKey,config.clientId,request,timestamp,new URL(config.notificationUrl).pathname,payload)});
 const handler=billingHandler(config,{authenticate:async()=>null,rpc:async()=>{throw new Error("database unavailable");}});
 assert.equal((await handler(new Request(config.notificationUrl,{method:"POST",headers,body:payload}))).status,503);
 const invoice=await begin(c);await notify(invoice,"expired-before-payment","EXPIRED");const state=await rpc("tippo_get_sandbox_billing",{p_owner:c}) as {invoice:{status:string}};assert.equal(state.invoice.status,"expired");assert.notEqual((await begin(c)).id,invoice.id);
});

test("public webhook health checks never mutate billing and POST still requires a valid signature",async()=>{
 let calls=0;const handler=billingHandler(config,{authenticate:async()=>{calls++;return null;},rpc:async()=>{calls++;return null;}});
 for(const method of ["GET","HEAD"]){const response=await handler(new Request(config.notificationUrl,{method}));assert.equal(response.status,200);if(method==="HEAD")assert.equal(await response.text(),"");}
 assert.equal((await handler(new Request(config.notificationUrl,{method:"POST",body:"{}"}))).status,401);
 assert.equal(calls,0);
});

test("production Rp10,000 is restricted, signed, idempotent and never grants Pro",async()=>{
 const cfg={...config,environment:"production",allowedUsers:[a],notificationUrl:"https://billing.supabase.test/functions/v1/tippo-doku-production-test/webhook"};
 let calls=0;let issued:DokuInvoice;
 const handle=productionTestHandler(cfg,{authenticate:async token=>token==="tester"?a:b,rpc:async(name,args)=>{const value=await rpc(name,args);if(name==="tippo_begin_production_test_checkout")issued=value as DokuInvoice;return value;},send:async(input,init)=>{calls++;assert.equal(String(input),"https://api.doku.com/checkout/v1/payment");const body=JSON.parse(init!.body as string);assert.equal(body.order.amount,10000);assert.match(body.order.invoice_number,/^TPT[A-F0-9]{24}$/);assert.ok(body.order.invoice_number.length<=30);assert.equal(body.payment.payment_method_types,undefined);return Response.json({response:{order:body.order,payment:{url:"https://jokul.doku.com/checkout/link/test",expired_date:"20501012120000"}}});}});
 const base="https://billing.supabase.test/functions/v1/tippo-doku-production-test/";
 assert.equal((await handle(new Request(base+"checkout",{method:"POST",headers:{Authorization:"Bearer other"}}))).status,403);assert.equal(calls,0);
 const response=await handle(new Request(base+"checkout",{method:"POST",headers:{Authorization:"Bearer tester"},body:JSON.stringify({amount:25000,ownerId:b})}));
 assert.equal(response.status,200);const state=parseProductionTestBilling(await response.json());assert.equal(state.invoice!.amount,10000);assert.equal(state.proUntil,null);
 await handle(new Request(base+"checkout",{method:"POST",headers:{Authorization:"Bearer tester"}}));assert.equal(calls,1);
 const payload=JSON.stringify({service:{id:"VIRTUAL_ACCOUNT"},channel:{id:"VIRTUAL_ACCOUNT_BNI"},order:{invoice_number:issued!.invoice_number,amount:10000},transaction:{status:"SUCCESS"}});
 const timestamp="2026-10-12T01:00:00Z",id="production-test-event";
 const headers={"Client-Id":cfg.clientId,"Request-Id":id,"Request-Timestamp":timestamp,Signature:await signDoku(cfg.secretKey,cfg.clientId,id,timestamp,new URL(cfg.notificationUrl).pathname,payload)};
 const underpaid=payload.replace('"amount":10000','"amount":1000');
 const lowHeaders={...headers,"Request-Id":"underpaid-event",Signature:await signDoku(cfg.secretKey,cfg.clientId,"underpaid-event",timestamp,new URL(cfg.notificationUrl).pathname,underpaid)};
 assert.equal((await handle(new Request(base+"webhook",{method:"POST",headers:lowHeaders,body:underpaid}))).status,503);
 assert.equal(parseProductionTestBilling(await rpc("tippo_get_production_test_billing",{p_owner:a})).invoice!.status,"pending");
 assert.equal((await handle(new Request(base+"webhook",{method:"POST",headers,body:payload}))).status,200);
 assert.equal((await handle(new Request(base+"webhook",{method:"POST",headers,body:payload}))).status,200);
 const paid=parseProductionTestBilling(await (await handle(new Request(base+"status",{headers:{Authorization:"Bearer tester"}}))).json());assert.equal(paid.invoice!.status,"paid");assert.equal(paid.proUntil,null);
 await db.exec("reset role;");assert.equal((await db.query<{count:number}>("select count(*)::int as count from public.tippo_workspaces where pro_until is not null")).rows[0].count,0);
 assert.throws(()=>parseSandboxBilling(paid));assert.throws(()=>safeCheckoutUrl("https://sandbox.doku.com/pay","production-test"));
 await db.exec("set role authenticated;");await assert.rejects(db.exec("update public.tippo_production_test_invoices set status='paid'"),/permission denied/);
});
test("production provider rejection closes invoice without raising the Rp10,000 amount",async()=>{
 const handle=productionTestHandler({...config,environment:"production",allowedUsers:[b]},{authenticate:async()=>b,rpc,send:async()=>Response.json({error:{code:"INVALID_PARAMETER",message:config.secretKey,headers:{Signature:"must-not-leak"}}},{status:400})});
 const response=await handle(new Request("https://billing.supabase.test/checkout",{method:"POST",headers:{Authorization:"Bearer tester"}}));
 assert.equal(response.status,400);const rejection=await response.json();assert.equal(rejection.error,"CHECKOUT_REJECTED");assert.equal(rejection.providerCode,"INVALID_PARAMETER");assert.equal(rejection.providerStatus,400);assert.equal(parseProductionTestBilling(rejection.billing).invoice!.status,"error");assert.equal(JSON.stringify(rejection).includes(config.secretKey),false);assert.equal(JSON.stringify(rejection).includes("must-not-leak"),false);
 const state=parseProductionTestBilling(await rpc("tippo_get_production_test_billing",{p_owner:b}));assert.equal(state.invoice!.amount,10000);assert.equal(state.invoice!.status,"error");
});

test("Rp10,000 migration supersedes old Rp10 test, preserving its body and late reconciliation",async()=>{
 const invoice=await rpc("tippo_begin_production_test_checkout",{p_owner:c,p_client_id:config.clientId,p_callback:config.siteUrl+"/app",p_notification:config.notificationUrl}) as DokuInvoice;
 assert.notEqual(invoice.id,legacyCheckout.id);
 assert.equal(invoice.amount,10000);
 await db.exec("reset role;");
 const stored=(await db.query<DokuInvoice>("select * from public.tippo_production_test_invoices where id=$1",[legacyCheckout.id])).rows[0];
 assert.equal(stored.request_body,legacyCheckout.request_body);assert.equal(stored.amount,10);assert.equal(stored.status,"expired");
 await rpc("tippo_accept_production_test_notification",{p_invoice:legacyCheckout.invoice_number,p_client_id:config.clientId,p_amount:10,p_request_id:"late-old-payment",p_digest:"old-digest",p_status:"SUCCESS"});
 await db.exec("reset role;");
 assert.equal((await db.query<{amount:number}>("select amount from public.tippo_production_test_invoices where id=$1",[legacyCheckout.id])).rows[0].amount,10);
});

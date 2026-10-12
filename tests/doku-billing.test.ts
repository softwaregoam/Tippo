import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash,createHmac} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {billingHandler,productionTestHandler,productionBillingHandler} from "../supabase/functions/_shared/billing-handler.ts";
import {readCheckoutRejection,signDoku,verifyDoku,parseDokuExpiry,safeCheckoutUrl,createDokuCheckout,cancelDokuTestCheckout,type DokuInvoice} from "../supabase/functions/_shared/doku.ts";
import {parseSandboxBilling,parseProductionTestBilling,parseProductionBilling} from "../src/lib/doku-billing.ts";

import {productionNotifications} from "../supabase/functions/_shared/production-notifications.ts";

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
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);insert into auth.users(id) values('${a}'),('${b}'),('${c}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;create table public.tippo_workspaces(owner_id uuid primary key,pro_until timestamptz);insert into public.tippo_workspaces values('${a}',null),('${b}',null),('${c}',null);`);
 const migration=await readFile(new URL("../supabase/migrations/202610120001_doku_sandbox.sql",import.meta.url),"utf8");await db.exec(migration);await db.exec(migration);
 const production=await readFile(new URL("../supabase/migrations/202610120002_doku_production_test.sql",import.meta.url),"utf8");await db.exec(production);await db.exec(production);
 legacyCheckout=(await db.query<{value:DokuInvoice}>("select public.tippo_begin_production_test_checkout($1,$2,$3,$4) as value",[c,config.clientId,config.siteUrl+"/app",config.notificationUrl])).rows[0].value;
 const methods=await readFile(new URL("../supabase/migrations/202610120004_doku_checkout_methods.sql",import.meta.url),"utf8");await db.exec(methods);await db.exec(methods);
 const thousand=await readFile(new URL("../supabase/migrations/202610120005_doku_checkout_test_1000.sql",import.meta.url),"utf8");await db.exec(thousand);await db.exec(thousand);
 const tenThousand=await readFile(new URL("../supabase/migrations/202610120006_doku_checkout_test_10000.sql",import.meta.url),"utf8");await db.exec(tenThousand);await db.exec(tenThousand);
 const format=await readFile(new URL("../supabase/migrations/202610120007_doku_checkout_invoice_format.sql",import.meta.url),"utf8");await db.exec(format);await db.exec(format);
 const delivery=await readFile(new URL("../supabase/migrations/202610120008_doku_checkout_delivery.sql",import.meta.url),"utf8");await db.exec(delivery);await db.exec(delivery);
 const customers=await readFile(new URL("../supabase/migrations/202610120009_doku_test_customers_cancellation.sql",import.meta.url),"utf8");await db.exec(customers);await db.exec(customers);
  const pro=await readFile(new URL("../supabase/migrations/202610120010_doku_pro_billing.sql",import.meta.url),"utf8");await db.exec(pro);await db.exec(pro);
 await db.query("update auth.users set email=$1,raw_user_meta_data=$2 where id=$3",["tester@example.test",JSON.stringify({full_name:"Pelanggan Tes"}),c]);
});
after(()=>db.close());
async function rpc(name:string,args:Record<string,unknown>){
 const allowed=["tippo_begin_sandbox_checkout","tippo_attach_sandbox_checkout","tippo_get_sandbox_billing","tippo_accept_sandbox_notification"];
 assert.ok([...allowed,...allowed.map(name=>name.replace("sandbox","production_test")),"tippo_fail_production_test_checkout","tippo_claim_production_test_checkout","tippo_review_production_test_checkout","tippo_claim_production_test_cancellation","tippo_finish_production_test_cancellation",...["begin_pro_checkout","attach_pro_checkout","get_pro_billing","accept_pro_notification","fail_pro_checkout","claim_pro_checkout","review_pro_checkout","claim_pro_cancellation","finish_pro_cancellation"].map(name=>"tippo_"+name)].includes(name));
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

test("parallel Checkout calls send once and accept a flat response with exact decimal amount",{timeout:10000},async()=>{
 let calls=0,release!:()=>void,ready!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{ready=resolve;});
 const handle=productionTestHandler({...config,environment:"production",allowedUsers:[b]},{authenticate:async()=>b,rpc,send:async(_input,init)=>{
  calls++;ready();await gate;const body=JSON.parse(init!.body as string);
  return Response.json({order:{...body.order,amount:"10000.00"},payment:{url:"https://checkout.doku.com/checkout/link/flat",expired_date:"20501012120000"}});
 }});
 const req=()=>new Request("https://billing.test/checkout",{method:"POST",headers:{Authorization:"Bearer tester"}});
 const first=handle(req());await started;
 try{const second=await handle(req());assert.equal(second.status,200);assert.equal(calls,1);assert.equal(parseProductionTestBilling(await second.json()).invoice!.status,"creating");}finally{release();}
 const complete=parseProductionTestBilling(await (await first).json());assert.equal(complete.invoice!.status,"pending");
 await handle(req());assert.equal(calls,1);
});

test("DOKU used Request ID enters reconciliation without changing identity or sending again",async()=>{
 let calls=0,codeOnly=false;
 const handle=productionTestHandler({...config,environment:"production",allowedUsers:[a]},{authenticate:async()=>a,rpc,send:async()=>{
  calls++;return Response.json(codeOnly?{error:{code:"REQUEST_ID_ALREADY_USED",message:"Duplicate operation"}}:{message:"REQUEST ID ALREADY USED"},{status:400});
 }});
 const req=()=>new Request("https://billing.test/checkout",{method:"POST",headers:{Authorization:"Bearer tester"}});
 const response=await handle(req());assert.equal(response.status,409);
 const result=await response.json();assert.equal(result.error,"CHECKOUT_RECONCILIATION_REQUIRED");
 const state=parseProductionTestBilling(result.billing);assert.equal(state.invoice!.status,"creating");assert.equal(state.invoice!.recoveryRequired,true);
 const before=await rpc("tippo_begin_production_test_checkout",{p_owner:a,p_client_id:config.clientId,p_callback:config.siteUrl+"/app",p_notification:config.notificationUrl}) as DokuInvoice;
 await handle(req());assert.equal(calls,1);
 const after=await rpc("tippo_begin_production_test_checkout",{p_owner:a,p_client_id:config.clientId,p_callback:config.siteUrl+"/app",p_notification:config.notificationUrl}) as DokuInvoice;
 assert.equal(after.id,before.id);assert.equal(after.request_id,before.request_id);assert.equal(after.request_body,before.request_body);
 const payload=JSON.stringify({service:{id:"VIRTUAL_ACCOUNT"},order:{invoice_number:before.invoice_number,amount:10000},transaction:{status:"SUCCESS",original_request_id:before.request_id}});
 const timestamp="2026-10-12T01:00:00Z",event="review-resolved";
 const headers={"Client-Id":config.clientId,"Request-Id":event,"Request-Timestamp":timestamp,Signature:await signDoku(config.secretKey,config.clientId,event,timestamp,new URL(config.notificationUrl).pathname,payload)};
 assert.equal((await handle(new Request(config.notificationUrl,{method:"POST",headers,body:payload}))).status,200);
 const resolved=parseProductionTestBilling(await rpc("tippo_get_production_test_billing",{p_owner:a}));assert.equal(resolved.invoice!.status,"paid");assert.equal(resolved.invoice!.recoveryRequired,false);assert.equal(resolved.proUntil,null);
 codeOnly=true;const codeResponse=await handle(req());assert.equal(codeResponse.status,409);assert.equal((await codeResponse.json()).error,"CHECKOUT_RECONCILIATION_REQUIRED");assert.equal(calls,2);
});

test("an unusable successful DOKU response preserves the order and reports the failing field",async()=>{
 let calls=0;
 const handle=productionTestHandler({...config,environment:"production",allowedUsers:[c]},{authenticate:async()=>c,rpc,send:async(_input,init)=>{
  calls++;const body=JSON.parse(init!.body as string);
  return Response.json({response:{order:body.order,payment:{url:"https://unrecognized-provider.test/pay",expired_date:"20501012120000"}}});
 }});
 const req=()=>new Request("https://billing.test/checkout",{method:"POST",headers:{Authorization:"Bearer tester"}});
 const response=await handle(req());assert.equal(response.status,409);
 const result=await response.json();assert.equal(result.error,"CHECKOUT_RESPONSE_INVALID");assert.equal(result.providerIssue,"CHECKOUT_URL_INVALID");assert.equal(result.checkoutHost,"unrecognized-provider.test");assert.equal(result.billing.invoice.recoveryRequired,true);
 await handle(req());assert.equal(calls,1);
});

 test("production Checkout URLs accept exact DOKU hosts and reject unsafe alternatives",()=>{
 const invoice={id:"test",number:"TPT"+"A".repeat(24),amount:10000,currency:"IDR",status:"pending",checkoutUrl:null,createdAt:"2026-10-12T00:00:00Z",expiresAt:"2050-10-12T00:00:00Z",paidAt:null};
 for(const host of ["checkout.doku.com","jokul.doku.com"]){
  const url="https://"+host+"/checkout/link/test";
  assert.equal(safeCheckoutUrl(url,"production-test"),url);
  assert.equal(parseProductionTestBilling({environment:"production-test",proUntil:null,invoice:{...invoice,checkoutUrl:url}}).invoice!.checkoutUrl,url);
  assert.throws(()=>safeCheckoutUrl(url,"sandbox"));
 }
 for(const url of ["https://checkout.doku.com.evil.test/pay","http://checkout.doku.com/pay","https://user@checkout.doku.com/pay","https://checkout.doku.com:444/pay","https://sandbox.doku.com/pay"]){
  assert.throws(()=>safeCheckoutUrl(url,"production-test"));
  assert.throws(()=>parseProductionTestBilling({environment:"production-test",proUntil:null,invoice:{...invoice,checkoutUrl:url}}));
 }
 });

 test("test customer snapshot and provider-confirmed cancellation retain owned history",async()=>{
 let cancelStatus=400,original:DokuInvoice|null=null,cancelCalls=0;
 await db.exec("reset role;");await db.query("update public.tippo_production_test_invoices set status='expired' where owner_id=$1 and status in ('creating','pending')",[c]);
 const cfg={...config,environment:"production",allowedUsers:[c]};
 const handle=productionTestHandler(cfg,{authenticate:async()=>c,rpc,send:async(input,init)=>{
  const body=JSON.parse(init!.body as string),headers=new Headers(init!.headers);
  if(String(input).endsWith("/payment")){
   assert.deepEqual(body.customer,{id:c,name:"Pelanggan Tes",email:"tester@example.test"});
   return Response.json({order:body.order,payment:{url:"https://checkout.doku.com/checkout/test",expired_date:"20501012120000"}});
  }
  cancelCalls++;assert.equal(String(input),"https://api.doku.com/checkout/v3/cancellations");
  assert.equal(body.order.invoice_number,original!.invoice_number);assert.equal(body.payment.original_request_id,original!.request_id);
  assert.equal(await verifyDoku(cfg.secretKey,cfg.clientId,"/checkout/v3/cancellations",headers,init!.body as string),true);
  return cancelStatus===400?Response.json({message:"Order Cancellation not activated"},{status:400}):Response.json({status:"CANCELLED"});
 }});
 const req=(action:string,body?:unknown)=>new Request("https://billing.test/"+action,{method:"POST",headers:{Authorization:"Bearer tester"},body:JSON.stringify(body??{})});
 const pending=parseProductionTestBilling(await (await handle(req("checkout"))).json());
 await db.exec("reset role;");original=(await db.query<{value:DokuInvoice}>("select to_jsonb(i) as value from public.tippo_production_test_invoices i where id=$1",[pending.invoice!.id])).rows[0].value;
 assert.equal(pending.invoice!.customerName,"Pelanggan Tes");assert.equal(pending.invoices![0].id,pending.invoice!.id);
 const foreign=await handle(req("cancel",{invoiceId:a}));assert.equal(foreign.status,409);assert.equal(cancelCalls,0);
 const rejected=await handle(req("cancel",{invoiceId:pending.invoice!.id}));assert.equal(rejected.status,400);
 assert.equal(parseProductionTestBilling((await rejected.json()).billing).invoice!.status,"pending");
 cancelStatus=200;
 const cancelled=await handle(req("cancel",{invoiceId:pending.invoice!.id}));assert.equal(cancelled.status,200);
 const billing=parseProductionTestBilling(await cancelled.json());assert.equal(billing.invoice!.status,"cancelled");assert.equal(billing.invoice!.checkoutUrl,null);assert.equal(billing.proUntil,null);
 assert.equal((await handle(req("cancel",{invoiceId:pending.invoice!.id}))).status,409);assert.equal(cancelCalls,2);
 const next=parseProductionTestBilling(await (await handle(req("checkout"))).json());assert.notEqual(next.invoice!.id,pending.invoice!.id);assert.equal(next.invoices![1].status,"cancelled");
 await db.exec("reset role;set role authenticated;");await assert.rejects(db.exec("select public.tippo_finish_production_test_cancellation('"+next.invoice!.id+"','"+c+"',true)"),/permission denied/);
 });
 test("cancellation cannot override payment arriving during provider request",async()=>{
 await db.exec("reset role;");
 const active=(await db.query<{id:string}>("select id from public.tippo_production_test_invoices where owner_id=$1 and status='pending'",[c])).rows[0];
 const handle=productionTestHandler({...config,environment:"production",allowedUsers:[c]},{authenticate:async()=>c,rpc,send:async()=>{
  await db.exec("reset role;");await db.query("update public.tippo_production_test_invoices set status='paid',paid_at=now() where id=$1",[active.id]);return Response.json({status:"CANCELLED"});
 }});
 const response=await handle(new Request("https://billing.test/cancel",{method:"POST",headers:{Authorization:"Bearer tester"},body:JSON.stringify({invoiceId:active.id})}));
 assert.equal(parseProductionTestBilling(await response.json()).invoice!.status,"paid");
 });

test("uncertain cancellation keeps invoice payable and prevents concurrent resend",async()=>{
 const invoice=await rpc("tippo_begin_production_test_checkout",{p_owner:c,p_client_id:config.clientId,p_callback:config.siteUrl+"/app",p_notification:config.notificationUrl}) as DokuInvoice;
 await rpc("tippo_attach_production_test_checkout",{p_id:invoice.id,p_owner:c,p_url:"https://checkout.doku.com/checkout/test",p_expires:"2050-10-12T00:00:00Z"});
 let calls=0;
 const handle=productionTestHandler({...config,environment:"production",allowedUsers:[c]},{authenticate:async()=>c,rpc,send:async()=>{calls++;throw new Error("timeout");}});
 const req=()=>new Request("https://billing.test/cancel",{method:"POST",headers:{Authorization:"Bearer tester"},body:JSON.stringify({invoiceId:invoice.id})});
 const failed=await handle(req());assert.equal(failed.status,503);assert.equal(parseProductionTestBilling((await failed.json()).billing).invoice!.status,"pending");
 assert.equal((await handle(req())).status,409);assert.equal(calls,1);
});

 test("cancellation does not accept HTML or explicit failure disguised as HTTP 200",async()=>{
 const invoice={id:a,owner_id:a,invoice_number:"TPT"+"A".repeat(24),amount:10000,request_id:b,request_body:"{}",status:"pending",checkout_url:null,cancellation_request_id:c};
 for(const body of ["<html>temporarily unavailable</html>",JSON.stringify({status:"FAILED"}),JSON.stringify({error:{message:"not activated"}})]){
  await assert.rejects(cancelDokuTestCheckout(invoice,config.clientId,config.secretKey,async()=>new Response(body)),/CANCELLATION_UNCONFIRMED/);
 }
 });
 test("cancelled history preserves cancellation on expiry and reconciles a late payment",async()=>{
 await db.exec("reset role;");
 const cancelled=(await db.query<{value:DokuInvoice}>("select to_jsonb(i) as value from public.tippo_production_test_invoices i where owner_id=$1 and status='cancelled' limit 1",[c])).rows[0].value;
 const args={p_invoice:cancelled.invoice_number,p_client_id:config.clientId,p_amount:10000,p_request_id:"cancelled-expiry",p_digest:"expiry",p_status:"EXPIRED",p_original_request:cancelled.request_id};
 await rpc("tippo_accept_production_test_notification",args);
 await db.exec("reset role;");assert.equal((await db.query<{status:string}>("select status from public.tippo_production_test_invoices where id=$1",[cancelled.id])).rows[0].status,"cancelled");
 await rpc("tippo_accept_production_test_notification",{...args,p_request_id:"cancelled-late-payment",p_digest:"payment",p_status:"SUCCESS"});
 await db.exec("reset role;");assert.equal((await db.query<{status:string}>("select status from public.tippo_production_test_invoices where id=$1",[cancelled.id])).rows[0].status,"paid");
 });

 test("real Pro grants one calendar month only after verified Rp25,000 payment and renews once",async()=>{
 const cfg={...config,environment:"production",notificationUrl:"https://billing.test/functions/v1/tippo-doku-pro/webhook"};
 const handle=productionBillingHandler(cfg,{authenticate:async token=>token==="user-a"?a:null,rpc,send:async(input,init)=>{
  assert.equal(String(input),"https://api.doku.com/checkout/v1/payment");const body=JSON.parse(init!.body as string);
  assert.equal(body.order.amount,25000);assert.match(body.order.invoice_number,/^TPR[A-F0-9]{24}$/);assert.equal(body.customer.id,a);
  return Response.json({order:body.order,payment:{url:"https://checkout.doku.com/checkout/pro",expired_date:"20501012120000"}});
 }});
 const checkout=()=>new Request("https://billing.test/checkout",{method:"POST",headers:{Authorization:"Bearer user-a"},body:JSON.stringify({amount:10000,owner:c,proUntil:"2050-01-01T00:00:00Z"})});
 assert.equal((await handle(new Request("https://billing.test/status"))).status,401);
 const first=parseProductionBilling(await (await handle(checkout())).json());assert.equal(first.invoice!.amount,25000);assert.equal(first.proUntil,null);
 assert.throws(()=>parseProductionTestBilling(first));
 const sendEvent=async(number:string,event:string,amount=25000,status="SUCCESS")=>{
  const raw=JSON.stringify({order:{invoice_number:number,amount,currency:"IDR"},service:{id:"VIRTUAL_ACCOUNT"},transaction:{status}});
  const timestamp="2026-10-12T12:00:00Z";
  const signature=await signDoku(cfg.secretKey,cfg.clientId,event,timestamp,new URL(cfg.notificationUrl).pathname,raw);
  return handle(new Request(cfg.notificationUrl,{method:"POST",headers:{"Client-Id":cfg.clientId,"Request-Id":event,"Request-Timestamp":timestamp,Signature:signature},body:raw}));
 };
 assert.equal((await sendEvent(first.invoice!.number,"underpaid-pro",10000)).status,400);
 assert.equal((await handle(new Request("https://billing.test/status",{headers:{Authorization:"Bearer user-a"}}))).status,200);
 assert.equal((await rpc("tippo_get_pro_billing",{p_owner:a}) as {proUntil:null}).proUntil,null);
 assert.equal((await sendEvent(first.invoice!.number,"pro-payment-1")).status,200);
 const paid=parseProductionBilling(await rpc("tippo_get_pro_billing",{p_owner:a}));assert.equal(paid.invoice!.status,"paid");assert.ok(paid.proUntil);assert.equal(paid.invoice!.periodEnd,paid.proUntil);assert.ok(paid.invoice!.periodStart);
 const expiry=paid.proUntil;
 await sendEvent(first.invoice!.number,"pro-payment-1");await sendEvent(first.invoice!.number,"pro-payment-1-repeat");await sendEvent(first.invoice!.number,"pro-late-expiry",25000,"EXPIRED");
 assert.equal(parseProductionBilling(await rpc("tippo_get_pro_billing",{p_owner:a})).proUntil,expiry);
 const renewal=parseProductionBilling(await (await handle(checkout())).json());assert.notEqual(renewal.invoice!.id,first.invoice!.id);
 assert.equal((await sendEvent(renewal.invoice!.number,"pro-payment-2")).status,200);
 const renewed=parseProductionBilling(await rpc("tippo_get_pro_billing",{p_owner:a}));assert.equal(renewed.invoice!.periodStart,expiry);assert.ok(Date.parse(renewed.proUntil!)>Date.parse(expiry!));assert.equal(renewed.invoices!.filter(i=>i.status==="paid").length,2);
 await db.exec("reset role;");assert.equal((await db.query<{pro_until:string|null}>("select pro_until from public.tippo_workspaces where owner_id=$1",[b])).rows[0].pro_until,null);
 await db.exec("set role authenticated;");await assert.rejects(db.exec("select public.tippo_accept_pro_notification('x','x',25000,'x','x','SUCCESS',null)"),/permission denied/);await assert.rejects(db.exec("update public.tippo_pro_invoices set status='paid'"),/permission denied/);
 });
 test("real Pro cancellation preserves active entitlement and history and checks ownership",async()=>{
 const cfg={...config,environment:"production"};let cancellations=0;
 const handle=productionBillingHandler(cfg,{authenticate:async()=>a,rpc,send:async(input,init)=>{
  const body=JSON.parse(init!.body as string);
  if(String(input).endsWith("/cancellations")){cancellations++;return Response.json({status:"CANCELLED"});}
  return Response.json({order:body.order,payment:{url:"https://checkout.doku.com/checkout/pro",expired_date:"20501012120000"}});
 }});
 const before=parseProductionBilling(await rpc("tippo_get_pro_billing",{p_owner:a}));
 const pending=parseProductionBilling(await (await handle(new Request("https://billing.test/checkout",{method:"POST",headers:{Authorization:"Bearer user-a"}}))).json());
 const cancel=(id:string)=>handle(new Request("https://billing.test/cancel",{method:"POST",headers:{Authorization:"Bearer user-a"},body:JSON.stringify({invoiceId:id})}));
 assert.equal((await cancel(b)).status,409);assert.equal((await cancel(before.invoice!.id)).status,409);assert.equal(cancellations,0);
 const result=parseProductionBilling(await (await cancel(pending.invoice!.id)).json());assert.equal(result.invoice!.status,"cancelled");assert.equal(result.proUntil,before.proUntil);assert.equal(cancellations,1);
 assert.equal(result.invoices!.filter(i=>i.status==="paid").length,2);
 });
 test("paid Pro cannot be granted by a test notification or a forged callback",async()=>{
 const handle=productionBillingHandler({...config,environment:"production"},{authenticate:async()=>b,rpc});
 const before=parseProductionBilling(await rpc("tippo_get_pro_billing",{p_owner:b}));assert.equal(before.proUntil,null);
 const response=await handle(new Request("https://billing.test/status",{headers:{Authorization:"Bearer any"}}));assert.equal(parseProductionBilling(await response.json()).proUntil,null);
 const raw=JSON.stringify({order:{invoice_number:"TPR"+"A".repeat(24),amount:25000},service:{id:"QRIS"},transaction:{status:"SUCCESS"}});
 assert.equal((await handle(new Request(config.notificationUrl,{method:"POST",headers:{Signature:"fake"},body:raw}))).status,401);
 assert.equal(parseProductionBilling(await rpc("tippo_get_pro_billing",{p_owner:b})).proUntil,null);
 });

 test("shared production notification preserves signatures and keeps test payments out of Pro",async()=>{
 const cfg={...config,environment:"production",notificationUrl:"https://billing.test/functions/v1/tippo-doku-pro/webhook"};
 const handle=productionNotifications(productionBillingHandler(cfg,{authenticate:async()=>b,rpc}),productionTestHandler({...cfg,allowedUsers:[b]},{authenticate:async()=>b,rpc}));
 const invoice=parseProductionTestBilling(await rpc("tippo_get_production_test_billing",{p_owner:b})).invoice!;
 const raw=JSON.stringify({order:{invoice_number:invoice.number,amount:invoice.amount},service:{id:"QRIS"},transaction:{status:"SUCCESS"}},null,2);
 const timestamp="2026-10-12T12:00:00Z",event="shared-test-paid";
 const Signature=await signDoku(cfg.secretKey,cfg.clientId,event,timestamp,new URL(cfg.notificationUrl).pathname,raw);
 assert.equal((await handle(new Request(cfg.notificationUrl,{method:"POST",headers:{"Client-Id":cfg.clientId,"Request-Id":event,"Request-Timestamp":timestamp,Signature},body:raw}))).status,200);
 assert.equal(parseProductionBilling(await rpc("tippo_get_pro_billing",{p_owner:b})).proUntil,null);
 assert.equal(parseProductionTestBilling(await rpc("tippo_get_production_test_billing",{p_owner:b})).invoice!.status,"paid");
 assert.equal((await handle(new Request(cfg.notificationUrl,{method:"POST",body:raw}))).status,401);
 assert.equal((await handle(new Request(cfg.notificationUrl,{method:"POST",body:"x".repeat(65537)}))).status,413);
 });

test("Pro period clamps a January renewal in Jakarta and browser cannot read foreign or private billing",async()=>{
 await db.exec("reset role;");await db.query("update public.tippo_workspaces set pro_until=$1 where owner_id=$2",["2099-01-31T05:30:00Z",b]);
 const invoice=await rpc("tippo_begin_pro_checkout",{p_owner:b,p_client_id:config.clientId,p_callback:config.siteUrl+"/app",p_notification:config.notificationUrl}) as DokuInvoice;
 await rpc("tippo_accept_pro_notification",{p_invoice:invoice.invoice_number,p_client_id:config.clientId,p_amount:25000,p_request_id:"pro-calendar-clamp",p_digest:"clamp",p_status:"SUCCESS",p_original_request:invoice.request_id});
 const billing=parseProductionBilling(await rpc("tippo_get_pro_billing",{p_owner:b}));assert.equal(billing.invoice!.periodStart,"2099-01-31T05:30:00+00:00");assert.equal(Date.parse(billing.proUntil!),Date.parse("2099-02-28T05:30:00Z"));
 await db.exec("reset role;set role authenticated;");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
 assert.equal((await db.query("select invoice_number from public.tippo_pro_invoices where owner_id=$1",[a])).rows.length,0);
 await assert.rejects(db.exec("select request_body from public.tippo_pro_invoices"),/permission denied/);
 await assert.rejects(db.query("select public.tippo_get_pro_billing($1)",[a]),/permission denied/);
});

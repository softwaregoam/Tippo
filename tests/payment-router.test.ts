import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { signDoku } from "../supabase/functions/_shared/doku.ts";
import { gatewayHeaders, verifyGatewayRequest, readGatewayBody, type GatewayEvent } from "../supabase/functions/_shared/gateway-protocol.ts";
import { paymentEventsHandler } from "../supabase/functions/_shared/payment-events-handler.ts";
import { productionBillingHandler } from "../supabase/functions/_shared/billing-handler.ts";
import { loadRouterConfig } from "../payment-router/config.mjs";
import { openStore } from "../payment-router/store.mjs";
import { routerHandler } from "../payment-router/handler.mjs";
import { deliveryWorker } from "../payment-router/worker.mjs";
import { startRouter } from "../payment-router/server.mjs";
import { installHelipod } from "../payment-router/helipod.mjs";

const key = "test-only-event-key-not-a-live-secret-123456789";
const callbackUrl = "https://abcdefghijklmnopqrst.supabase.co/functions/v1/tippo-payment-events";
const config = { publicUrl:"https://payments.example.test",webhookPath:"/webhooks/doku",clientId:"test-merchant",secretKey:"test-only-doku-secret",environment:"production",port:0,dbPath:":memory:",routes:[{appId:"tippo",prefix:"TPR",amounts:[25000],callbackUrl,eventKey:key}] };
const number = "TPR" + "A".repeat(24);
function payload(invoice = number, amount = 25000, status = "SUCCESS") {
  return { order:{invoice_number:invoice,amount,currency:"IDR"},service:{id:"QRIS"},transaction:{status} };
}
async function notification(data = payload(), id = randomUUID()) {
  const raw = JSON.stringify(data), timestamp = "2026-10-16T00:00:00Z";
  return new Request(config.publicUrl + config.webhookPath,{method:"POST",body:raw,headers:{"Client-Id":config.clientId,"Request-Id":id,"Request-Timestamp":timestamp,Signature:await signDoku(config.secretKey,config.clientId,id,timestamp,config.webhookPath,raw)}});
}
async function signedEvent(event: GatewayEvent, options: {key?:string;url?:string;now?:number} = {}) {
  const raw = JSON.stringify(event), url = options.url || callbackUrl;
  return new Request(url,{method:"POST",body:raw,headers:await gatewayHeaders(options.key || key,"tippo",url,raw,event.id,options.now)});
}
const event = (): GatewayEvent => ({version:1,id:randomUUID(),appId:"tippo",environment:"production",invoice:{number,amount:25000,currency:"IDR"},payment:{clientId:config.clientId,requestId:randomUUID(),originalRequestId:null,digest:"A".repeat(43)+"=",status:"SUCCESS"}});

test("router config requires private keys, a fixed HTTPS destination and a domain",() => {
  const env = {ROUTER_DOMAIN:"payments.example.test",DOKU_CLIENT_ID:config.clientId,DOKU_SECRET_KEY:config.secretKey,TIPPO_CALLBACK_URL:callbackUrl,TIPPO_ROUTER_EVENT_KEY:key};
  assert.equal(loadRouterConfig(env).routes[0].callbackUrl,callbackUrl);
  for (const change of [{TIPPO_ROUTER_EVENT_KEY:"short"},{TIPPO_CALLBACK_URL:"http://127.0.0.1/internal"},{TIPPO_CALLBACK_URL:"https://attacker.test/redirect"},{ROUTER_DOMAIN:"https://bad.test/path"}]) assert.throws(() => loadRouterConfig({...env,...change}));
});

test("internal signature binds method, path, app, body, ID and fresh timestamp",async () => {
  const data = event(), raw = JSON.stringify(data), headers = await gatewayHeaders(key,"tippo",callbackUrl,raw,data.id);
  assert.equal(await verifyGatewayRequest(new Request(callbackUrl,{method:"POST",headers,body:raw}),raw,key),true);
  assert.equal(await verifyGatewayRequest(new Request(callbackUrl+"-other",{method:"POST",headers,body:raw}),raw,key),false);
  assert.equal(await verifyGatewayRequest(new Request(callbackUrl,{method:"POST",headers,body:raw+" "}),raw+" ",key),false);
  assert.equal(await verifyGatewayRequest(new Request(callbackUrl,{method:"GET",headers}),raw,key),false);
  assert.equal(await verifyGatewayRequest(await signedEvent(data,{now:Date.now()-301000}),raw,key),false);
  const forged = new Headers(headers); forged.set("X-Payment-App","another-app");
  assert.equal(await verifyGatewayRequest(new Request(callbackUrl,{method:"POST",headers:forged,body:raw}),raw,key),false);
});

test("raw body cap works without Content-Length and rejects oversized streams",async () => {
  await assert.rejects(readGatewayBody(new Request(config.publicUrl,{method:"POST",body:"x".repeat(65537)})),/BODY_TOO_LARGE/);
  const stream = new ReadableStream({start(controller){controller.enqueue(new Uint8Array(40000));controller.enqueue(new Uint8Array(40000));controller.close();}});
  await assert.rejects(readGatewayBody(new Request(config.publicUrl,{method:"POST",body:stream,duplex:"half"} as RequestInit)),/BODY_TOO_LARGE/);
});

test("DOKU callbacks are verified before durable enqueue and replay conflicts do not overwrite",async () => {
  const store = openStore(":memory:");try {
    const handle = routerHandler(config,store), id = randomUUID();
    assert.equal((await handle(new Request(config.publicUrl+"/healthz"))).status,200);
    assert.deepEqual(store.stats(),[]);
    assert.equal((await handle(new Request(config.publicUrl+config.webhookPath,{method:"POST",body:JSON.stringify(payload())}))).status,401);
    const first = await (await handle(await notification(payload(),id))).json();
    assert.equal(first.received,true);
    assert.equal((await (await handle(await notification(payload(),id))).json()).eventId,first.eventId);
    assert.equal((await handle(await notification(payload(number,25000,"PENDING"),id))).status,409);
    assert.equal(store.stats()[0].count,1);
    assert.equal((await handle(await notification(payload("BCR"+"B".repeat(24))))).status,422);
    assert.equal((await handle(await notification(payload(number,1000)))).status,400);
    assert.equal((await handle(await notification({...payload(),service:{id:"UNKNOWN"}}))).status,400);
    assert.equal((await handle(new Request(config.publicUrl+config.webhookPath))).status,405);
    assert.equal(store.stats()[0].count,1);
  } finally { store.close(); }
});

test("router never acknowledges a failed durable write",async () => {
  const handle = routerHandler(config,{accept(){throw new Error("SQLITE_FULL");}});
  const result = await handle(await notification());assert.equal(result.status,503);assert.equal((await result.json()).received,undefined);
});

test("queue survives reopening and expired leases cannot let a stale worker acknowledge",async () => {
  const dir = await mkdtemp(join(tmpdir(),"tippo-router-")), path = join(dir,"queue.sqlite");let time = Date.now();
  let store = openStore(path,{now:()=>time});
  try {
    const e = event();store.accept(e.payment.requestId,e.payment.digest,e);
    const stale = store.claim()!;store.close();store = openStore(path,{now:()=>time});
    assert.equal(store.claim(),null);time+=60001;
    const next = store.claim()!;assert.equal(next.event.id,e.id);assert.notEqual(next.token,stale.token);
    assert.equal(store.finish(stale,true),false);assert.equal(store.finish(next,true),true);
    store.close();store = openStore(path);assert.equal(store.stats()[0].state,"delivered");
    const backup = await store.backup(join(dir,"backups")), restored = join(dir,"restored.sqlite");
    await writeFile(restored,gunzipSync(await readFile(backup)));
    const recovered = openStore(restored);try { assert.equal(recovered.stats()[0].state,"delivered"); }finally{recovered.close();}
  } finally { store.close();await rm(dir,{recursive:true,force:true}); }
});

test("worker signs events, ignores redirect destinations in payload and retries unconfirmed responses",async () => {
  let time = Date.now(), calls = 0;const store = openStore(":memory:",{now:()=>time});
  try {
    const e = event();store.accept(e.payment.requestId,e.payment.digest,e);
    const worker = deliveryWorker(config,store,{log:()=>{},send:async (url: string | URL | Request,init?:RequestInit) => {
      assert.equal(url,callbackUrl);assert.equal(init?.redirect,"error");
      const request = new Request(String(url),init), raw = await request.text();
      assert.equal(await verifyGatewayRequest(request,raw,key),true);calls++;
      return calls===1?Response.json({received:true,eventId:"wrong"}):Response.json({received:true,eventId:e.id});
    }});
    await worker.tick();assert.equal(store.stats()[0].state,"queued");assert.equal(calls,1);
    await worker.tick();assert.equal(calls,1);time+=15001;
    await worker.tick();assert.equal(calls,2);assert.equal(store.stats()[0].state,"delivered");await worker.stop();
  } finally { store.close(); }
});

test("exhausted delivery goes to dead queue and explicit retry recovers it",async () => {
  const store = openStore(":memory:",{maxAttempts:1});try {
    const e = event();store.accept(e.payment.requestId,e.payment.digest,e);
    const worker = deliveryWorker(config,store,{log:()=>{},send:async()=>{throw new Error("offline");}});
    await worker.tick();assert.equal(store.stats()[0].state,"dead");assert.equal(store.dead()[0].event_id,e.id);
    assert.equal(store.retry(e.id),1);assert.equal(store.stats()[0].state,"queued");await worker.stop();
  } finally { store.close(); }
});

test("Tippo receiver rejects unsigned, stale, wrong merchant, wrong price and unknown invoices",async () => {
  let calls = 0;const receive = paymentEventsHandler({eventKey:key,clientId:config.clientId},async()=>{calls++;return false;});
  assert.equal((await receive(new Request(callbackUrl,{method:"POST",body:"{}"}))).status,401);
  assert.equal((await receive(await signedEvent(event(),{key:"different-test-key-with-more-than-32-characters"}))).status,401);
  assert.equal((await receive(await signedEvent(event(),{now:Date.now()-301000}))).status,401);
  const wrong = event();wrong.invoice.amount = 1000;assert.equal((await receive(await signedEvent(wrong))).status,400);
  const merchant = event();merchant.payment.clientId = "other";assert.equal((await receive(await signedEvent(merchant))).status,400);
  assert.equal(calls,0);assert.equal((await receive(await signedEvent(event()))).status,409);assert.equal(calls,1);
});

test("HTTP server answers health, persists signed requests and shuts down cleanly",async () => {
  const dir = await mkdtemp(join(tmpdir(),"tippo-router-http-"));const running = await startRouter({...config,dbPath:join(dir,"queue.sqlite")});
  try {
    const address = running.server.address() as AddressInfo, url = `http://127.0.0.1:${address.port}`;
    const health = await fetch(url+"/healthz");assert.equal(health.status,200);assert.equal(health.headers.get("x-frame-options"),"DENY");
    const req = await notification();const result = await fetch(url+config.webhookPath,{method:"POST",headers:req.headers,body:await req.text()});assert.equal(result.status,200);
  } finally { await running.close();await rm(dir,{recursive:true,force:true}); }
});

test("end-to-end callback activates Tippo Pro once using the existing database ledger",async () => {
  const db = new PGlite(), store = openStore(":memory:");
  const owner = "00000000-0000-0000-0000-000000000001";
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);insert into auth.users(id,email) values('${owner}','audit@example.test');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.tippo_workspaces(owner_id uuid primary key,pro_until timestamptz);`);
    await db.exec(await readFile(new URL("../supabase/migrations/202610120010_doku_pro_billing.sql",import.meta.url),"utf8"));
    const invoice = (await db.query<{value:{invoice_number:string;request_id:string}}>("select public.tippo_begin_pro_checkout($1,$2,$3,$4) AS value",[owner,config.clientId,"https://tippo.example.test/app",config.publicUrl+config.webhookPath])).rows[0].value;
    const receive = paymentEventsHandler({eventKey:key,clientId:config.clientId},async(name,input)=>{
      assert.equal(name,"tippo_accept_pro_notification");const entries = Object.entries(input);
      return (await db.query<{value:boolean}>(`select public.tippo_accept_pro_notification(${entries.map(([key],index)=>`${key}=>$${index+1}`).join(",")}) AS value`,entries.map(([,value])=>value))).rows[0].value;
    });
    const router = routerHandler(config,store), id = randomUUID();
    const data = {...payload(invoice.invoice_number),transaction:{status:"SUCCESS",original_request_id:invoice.request_id}};
    assert.equal((await router(await notification(data,id))).status,200);
    const worker = deliveryWorker(config,store,{log:()=>{},send:async(url:string | URL | Request,init?:RequestInit)=>receive(new Request(String(url),init))});
    await worker.tick();assert.equal(store.stats()[0].state,"delivered");
    const first = (await db.query<{pro_until:Date}>("select pro_until from public.tippo_workspaces where owner_id=$1",[owner])).rows[0].pro_until;assert.ok(first);
    assert.equal((await router(await notification(data,id))).status,200);await worker.tick();
    assert.equal((await router(await notification(data,randomUUID()))).status,200);await worker.tick();
    assert.equal((await db.query<{pro_until:Date}>("select pro_until from public.tippo_workspaces where owner_id=$1",[owner])).rows[0].pro_until.getTime(),first.getTime());
    await worker.stop();
  } finally { store.close();await db.close(); }
});

test("checkout router override does not change verification of legacy DOKU notifications",async () => {
  const original = "https://abcdefghijklmnopqrst.supabase.co/functions/v1/tippo-doku-pro/webhook";
  const merchant = {environment:"production",clientId:config.clientId,secretKey:config.secretKey,siteUrl:"https://tippo.example.test",notificationUrl:original,checkoutNotificationUrl:config.publicUrl+config.webhookPath};
  let target = "", accepted = 0;
  const handle = productionBillingHandler(merchant,{authenticate:async()=>"owner",rpc:async(name,input)=>{
    if(name==="tippo_begin_pro_checkout"){target=String(input.p_notification);return {checkout_url:"https://checkout.doku.com/already",status:"pending"};}
    if(name==="tippo_accept_pro_notification"){accepted++;return true;}
    return {};
  }});
  assert.equal((await handle(new Request("https://tippo.example.test/checkout",{method:"POST",headers:{Authorization:"Bearer test-token"}}))).status,200);
  assert.equal(target,config.publicUrl+config.webhookPath);
  const raw = JSON.stringify(payload()), timestamp = "2026-10-16T00:00:00Z", id = randomUUID();
  const req = new Request(original,{method:"POST",body:raw,headers:{"Client-Id":config.clientId,"Request-Id":id,"Request-Timestamp":timestamp,Signature:await signDoku(config.secretKey,config.clientId,id,timestamp,new URL(original).pathname,raw)}});
  assert.equal((await handle(req)).status,200);assert.equal(accepted,1);
});

test("Helipod helper defaults to price-only and refuses an exceeded spending limit",async () => {
  const calls: string[] = [], logs: string[] = [];
  const env = {HELIPOD_API_KEY:"test-only-api-key",HELIPOD_ENVIRONMENT_ID:randomUUID(),ROUTER_IMAGE:"ghcr.io/example/router@sha256:"+"a".repeat(64),HELIPOD_MAX_DAILY_COST_IDR:"999"};
  const send = async(url:string|URL|Request) => {calls.push(String(url));return Response.json({success:true,data:{dryRun:true,currency:"IDR",dailyCost:1000}});};
  assert.equal((await installHelipod({env,send,log:value=>logs.push(value)})).dryRun,true);
  await assert.rejects(installHelipod({env,send,apply:true,log:value=>logs.push(value)}),/DAILY_COST_EXCEEDS_CONFIGURED_LIMIT/);
  assert.equal(calls.length,2);assert.ok(calls.every(url=>url.endsWith("?dryRun=true")));assert.ok(logs.every(line=>!line.includes(env.HELIPOD_API_KEY)));
});

test("Helipod initial install configures persistent storage, secret variables, and resumes without duplicating services",async () => {
  const dir = await mkdtemp(join(tmpdir(),"tippo-helipod-")), stateFile = join(dir,"state.json"), serviceId = randomUUID(), deploymentId = randomUUID();
  const calls: {path:string;method:string}[] = [], logs:string[] = [];
  const env = {HELIPOD_API_KEY:"test-only-api-key",HELIPOD_ENVIRONMENT_ID:randomUUID(),ROUTER_IMAGE:"ghcr.io/example/router@sha256:"+"a".repeat(64),HELIPOD_MAX_DAILY_COST_IDR:"1000",DOKU_CLIENT_ID:config.clientId,DOKU_SECRET_KEY:config.secretKey,TIPPO_CALLBACK_URL:callbackUrl,TIPPO_ROUTER_EVENT_KEY:key};
  const send = async(url:string|URL|Request,init?:RequestInit) => {
    const path = new URL(String(url)).pathname, method = init?.method || "GET";calls.push({path,method});let data;
    if (String(url).endsWith("?dryRun=true")) data = {dryRun:true,currency:"IDR",dailyCost:1000};
    else if (path.endsWith("/services") && method === "GET") data = [];
    else if (path.endsWith("/services") && method === "POST") {const input = JSON.parse(String(init?.body));assert.equal(input.deploy,false);assert.equal(input.ram,256);assert.equal(input.volumes[0].mountPath,"/data");data={service:{id:serviceId}};}
    else if (path.endsWith("/scale")) data = {replicas:1,autoscaling:{enabled:false}};
    else if (path.endsWith("/domains")) data = [{kind:"helipod",port:8080,domain:"router-test.helipod.app"}];
    else if (path.endsWith("/variables")) {const input=JSON.parse(String(init?.body));assert.equal(input.variables.TIPPO_ROUTER_EVENT_KEY,key);assert.ok(input.secrets.includes("DOKU_SECRET_KEY"));data={needsRedeploy:true};}
    else if (path.endsWith("/deployments")) data={deploymentId};else throw new Error("Unexpected API request");
    return Response.json({success:true,data});
  };
  try {
    const state = await installHelipod({env,send,apply:true,stateFile,log:value=>logs.push(value)});assert.equal(state.serviceId,serviceId);assert.equal(state.deploymentId,deploymentId);
    const before=calls.length;await installHelipod({env,send,apply:true,stateFile,log:value=>logs.push(value)});assert.equal(calls.length,before+1);
    assert.ok(logs.every(line=>!line.includes(key)&&!line.includes(config.secretKey)&&!line.includes(env.HELIPOD_API_KEY)));
  } finally {await rm(dir,{recursive:true,force:true});}
});

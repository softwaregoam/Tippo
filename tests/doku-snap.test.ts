import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {generateKeyPairSync,verify,createHash,createHmac} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {snapRsaSignature,snapSignature,verifySnap,snapClient,SNAP_TOKEN_PATH,SNAP_VA_PATH,SnapConflict,type SnapInvoice} from "../supabase/functions/_shared/doku-snap.ts";
import {snapHandler} from "../supabase/functions/_shared/snap-handler.ts";
import {parseSnapBilling} from "../src/lib/doku-snap-billing.ts";
const db=new PGlite(),a="00000000-0000-0000-0000-000000000001",b="00000000-0000-0000-0000-000000000002";
const keys=generateKeyPairSync("rsa",{modulusLength:2048});
const config={clientId:"test-merchant",secretKey:"test-only-not-a-real-secret",privateKey:keys.privateKey.export({type:"pkcs8",format:"pem"}).toString(),partnerServiceId:"98829172",customerPrefix:"3",siteUrl:"https://tippo.test",notificationUrl:"https://billing.test/functions/v1/tippo-doku-snap-test/webhook",allowedUsers:[a,b]};
before(async()=>{
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create table public.tippo_workspaces(owner_id uuid primary key,pro_until timestamptz);");
 await db.query("insert into auth.users values($1),($2)",[a,b]);await db.query("insert into public.tippo_workspaces values($1,null),($2,null)",[a,b]);
 const sql=await readFile(new URL("../supabase/migrations/202610120003_doku_snap_test.sql",import.meta.url),"utf8");await db.exec(sql);await db.exec(sql);
});
after(()=>db.close());
async function rpc(name:string,args:Record<string,unknown>){
 assert.ok(["tippo_begin_snap_test","tippo_attach_snap_test","tippo_get_snap_test","tippo_accept_snap_test","tippo_fail_snap_test"].includes(name));
 await db.exec("reset role;set role service_role;");
 const entries=Object.entries(args);return (await db.query<{value:unknown}>("select public."+name+"("+entries.map(([k],i)=>k+"=>$"+(i+1)).join(",")+") as value",entries.map(([,v])=>v))).rows[0].value;
}
async function begin(owner=a){return await rpc("tippo_begin_snap_test",{p_owner:owner,p_client_id:config.clientId,p_partner:config.partnerServiceId,p_prefix:config.customerPrefix}) as SnapInvoice;}
function va(invoice:SnapInvoice){
 const body=JSON.parse(invoice.request_body),customer="30000000000000000001";
 return {...body,customerNo:customer,virtualAccountNo:config.partnerServiceId+customer,additionalInfo:{channel:"VIRTUAL_ACCOUNT_BNI",howToPayPage:"https://app.doku.com/how-to-pay/virtual-account/bni/test"}};
}
const send:typeof fetch=async(input,init)=>{
 if(String(input).endsWith(SNAP_TOKEN_PATH)){
  const h=new Headers(init!.headers);assert.ok(verify("RSA-SHA256",Buffer.from(config.clientId+"|"+h.get("X-TIMESTAMP")),keys.publicKey,Buffer.from(h.get("X-SIGNATURE")!,"base64")));
  return Response.json({responseCode:"2007300",tokenType:"Bearer",expiresIn:900,accessToken:"test-token"});
 }
 assert.equal(String(input),"https://api.doku.com"+SNAP_VA_PATH);
 const body=JSON.parse(init!.body as string),headers=new Headers(init!.headers);
 assert.equal(body.totalAmount.value,"10.00");assert.equal(body.virtualAccountTrxType,"C");assert.match(headers.get("X-EXTERNAL-ID")!,/^\d{1,36}$/);
 const canonical="POST:"+SNAP_VA_PATH+":test-token:"+createHash("sha256").update(JSON.stringify(body)).digest("hex")+":"+headers.get("X-TIMESTAMP");
 assert.equal(headers.get("X-SIGNATURE"),createHmac("sha512",config.secretKey).update(canonical).digest("base64"));
 return Response.json({responseCode:"2002700",virtualAccountData:va({request_body:init!.body as string} as SnapInvoice)});
};
async function notification(payload:unknown,event="123456"){
 const raw=JSON.stringify(payload),time="2026-10-12T12:00:00+07:00";
 const headers=new Headers({Authorization:"Bearer incoming-test-token","X-TIMESTAMP":time,"X-EXTERNAL-ID":event,"X-PARTNER-ID":"doku-notification-client","CHANNEL-ID":"H2H","X-SIGNATURE":await snapSignature(config.secretKey,"POST",new URL(config.notificationUrl).pathname,"incoming-test-token",raw,time)});
 return new Request(config.notificationUrl,{method:"POST",headers,body:raw});
}
test("SNAP RSA and HMAC match independent cryptography, token/body/path are bound",async()=>{
 const time="2026-10-12T00:00:00Z",signature=await snapRsaSignature(config.privateKey,config.clientId,time);
 assert.ok(verify("RSA-SHA256",Buffer.from(config.clientId+"|"+time),keys.publicKey,Buffer.from(signature,"base64")));
 const req=await notification({paidAmount:{value:"10.00",currency:"IDR"}});
 const raw=await req.text();
 assert.equal(await verifySnap(config.secretKey,new URL(config.notificationUrl).pathname,req.headers,raw),true);
 assert.equal(await verifySnap(config.secretKey,"/other",req.headers,raw),false);
 assert.equal(await verifySnap(config.secretKey,new URL(config.notificationUrl).pathname,req.headers,raw.replace("10.00","1.00")),false);
 req.headers.set("Authorization","Bearer forged");assert.equal(await verifySnap(config.secretKey,new URL(config.notificationUrl).pathname,req.headers,raw),false);
});
test("SNAP checkout ignores browser amount/owner, persists VA and grants no Pro on repeated notification",async()=>{
 let calls=0;
 const handler=snapHandler(config,{authenticate:async token=>token==="tester"?a:null,rpc,send:async(...args)=>{calls++;return send(...args);}});
 const base="https://billing.test/functions/v1/tippo-doku-snap-test/";
 assert.equal((await handler(new Request(base+"checkout",{method:"POST"}))).status,401);
 const response=await handler(new Request(base+"checkout",{method:"POST",headers:{Authorization:"Bearer tester"},body:JSON.stringify({amount:25000,owner:b})}));
 assert.equal(response.status,200);const state=parseSnapBilling(await response.json());assert.equal(state.invoice!.vaNumber,config.partnerServiceId+"30000000000000000001");assert.equal(state.invoice!.amount,10);
 await handler(new Request(base+"checkout",{method:"POST",headers:{Authorization:"Bearer tester"}}));assert.equal(calls,2);
 const invoice=await begin(),data=va(invoice),payload={...data,paidAmount:data.totalAmount,paymentRequestId:"payment-1"};
 const fake=await notification(payload);fake.headers.set("X-SIGNATURE","forged");assert.equal((await handler(fake)).status,401);
 assert.equal((await handler(await notification({...payload,paidAmount:{value:"25000.00",currency:"IDR"}}))).status,400);
 assert.equal((await handler(await notification(payload))).status,200);
 const paid=parseSnapBilling(await rpc("tippo_get_snap_test",{p_owner:a}));assert.equal(paid.invoice!.status,"paid");assert.equal(paid.proUntil,null);
 assert.equal((await handler(await notification(payload,"987654"))).status,200);
 assert.equal(parseSnapBilling(await rpc("tippo_get_snap_test",{p_owner:a})).invoice!.paidAt,paid.invoice!.paidAt);
 await db.exec("reset role;");assert.equal((await db.query<{n:number}>("select count(*)::int n from tippo_workspaces where pro_until is not null")).rows[0].n,0);
});
test("SNAP early payment notification survives attach and mismatch/replay cannot overwrite invoice",async()=>{
 const invoice=await begin(b),data=va(invoice),payload={...data,paidAmount:data.totalAmount,paymentRequestId:"early-payment"};
 const handler=snapHandler(config,{authenticate:async()=>b,rpc,send});
 assert.equal((await handler(await notification(payload))).status,200);
 await rpc("tippo_attach_snap_test",{p_id:invoice.id,p_owner:b,p_va:data,p_url:null});
 assert.equal(parseSnapBilling(await rpc("tippo_get_snap_test",{p_owner:b})).invoice!.status,"paid");
 assert.equal((await handler(await notification({...payload,virtualAccountNo:"111"}))).status,503);
 assert.equal((await handler(await notification({...payload,trxDateTime:"changed"}))).status,503);
});
test("SNAP allowlist, RLS and safe instruction validation block unrelated users and browser grants",async()=>{
 let calls=0;const handler=snapHandler({...config,allowedUsers:[a]},{authenticate:async()=>b,rpc:async()=>{calls++;},send});
 assert.equal((await handler(new Request("https://billing.test/status",{headers:{Authorization:"Bearer tester"}}))).status,403);assert.equal(calls,0);
 await db.exec("reset role;set role authenticated;");
 await assert.rejects(db.exec("update tippo_snap_test_invoices set status='paid'"),/permission denied/);
 await assert.rejects(db.exec("select request_body,client_id from tippo_snap_test_invoices"),/permission denied/);
 await assert.rejects(db.query("select public.tippo_get_snap_test($1::uuid)",[a]),/permission denied/);
 await db.exec("reset role;");
 const state=parseSnapBilling(await rpc("tippo_get_snap_test",{p_owner:a}));
 assert.throws(()=>parseSnapBilling({...state,invoice:{...state.invoice,instructionsUrl:"https://app.doku.com.evil.test/how-to-pay/virtual-account/bni/test"}}));
 assert.throws(()=>parseSnapBilling({...state,proUntil:"2050-01-01"}));
});
test("SNAP timeout/conflict retains frozen request and provider rejection never increases price",async()=>{
 const invoice=await begin();let attempts=0;const sent:{id:string|null;raw:unknown}[]=[];
 const client=snapClient(config,async(input,init)=>{
  if(String(input).endsWith(SNAP_TOKEN_PATH))return send(input,init);
  sent.push({id:new Headers(init!.headers).get("X-EXTERNAL-ID"),raw:init!.body});attempts++;
  if(attempts===1)throw new Error("timeout");return Response.json({responseCode:"4092700"},{status:409});
 });
 await assert.rejects(client.create(invoice),/timeout/);await assert.rejects(client.create(invoice),SnapConflict);assert.deepEqual(sent[0],sent[1]);
 const handler=snapHandler(config,{authenticate:async()=>a,rpc,send:async(input,init)=>String(input).endsWith(SNAP_TOKEN_PATH)?send(input,init):Response.json({responseCode:"4002700"},{status:400})});
 assert.equal((await handler(new Request("https://billing.test/checkout",{method:"POST",headers:{Authorization:"Bearer tester"}}))).status,400);
 const state=parseSnapBilling(await rpc("tippo_get_snap_test",{p_owner:a}));assert.equal(state.invoice!.status,"error");assert.equal(state.invoice!.amount,10);
});
test("SNAP health does not contact DOKU and a failed notification database returns failure",async()=>{
 let calls=0;const handler=snapHandler(config,{authenticate:async()=>null,rpc:async()=>{calls++;throw new Error("db failure");},send:async()=>{calls++;throw new Error("unexpected");}});
 assert.equal((await handler(new Request(config.notificationUrl))).status,200);assert.equal(calls,0);
 const invoice=await begin(),data=va(invoice);
 assert.equal((await handler(await notification({...data,paidAmount:data.totalAmount,paymentRequestId:"db-failure"}))).status,503);
 assert.equal(calls,1);
});

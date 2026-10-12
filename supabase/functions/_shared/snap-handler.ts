import {snapClient,verifySnap,snapHash,minify,safeSnapInstructions,SnapRejected,SnapConflict,type SnapCredentials,type SnapInvoice} from "./doku-snap.ts";
import type {BillingPorts} from "./billing-handler.ts";
export interface SnapConfig extends SnapCredentials {siteUrl:string;notificationUrl:string;allowedUsers:string[];partnerServiceId:string;customerPrefix:string;}
export function snapHandler(config:SnapConfig,ports:BillingPorts){
 const site=new URL(config.siteUrl);
 if(site.protocol!=="https:" || site.username || site.password || !config.clientId || !config.secretKey || !config.privateKey || !config.allowedUsers.length || config.allowedUsers.some(id=>!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) || !/^ *\d{1,8}$/.test(config.partnerServiceId) || config.partnerServiceId.length!==8 || !/^\d{1,20}$/.test(config.customerPrefix))throw new Error("SNAP_CONFIG_REQUIRED");
 const client=snapClient(config,ports.send),target=new URL(config.notificationUrl).pathname;
 const json=(data:unknown,status=200,cors=false)=>Response.json(data,{status,headers:{"Cache-Control":"no-store",...(cors?{"Access-Control-Allow-Origin":site.origin,Vary:"Origin"}:{})}});
 const notifyError=(status:number,code:string,message:string)=>json({responseCode:code,responseMessage:message},status);
 return async(req:Request)=>{
  const path=new URL(req.url).pathname,action=path.split("/").at(-1);
  if(action==="webhook" && ["GET","HEAD"].includes(req.method))return new Response(req.method==="HEAD"?null:JSON.stringify({status:"ok",environment:"snap-production-test"}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  if(action==="webhook"){
   if(req.method!=="POST")return notifyError(405,"4052500","Method not allowed");
   try{
    if(Number(req.headers.get("Content-Length"))>65536)return notifyError(413,"4132500","Body too large");
    const reader=req.body?.getReader(),parts:Uint8Array[]=[];let count=0;
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>65536){await reader.cancel();return notifyError(413,"4132500","Body too large");}parts.push(value);}
    const bytes=new Uint8Array(count);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    let raw:string,payload;
    try{raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes);payload=JSON.parse(raw);}catch{return notifyError(400,"4002500","Invalid JSON");}
    if(!await verifySnap(config.secretKey,target,req.headers,raw))return notifyError(401,"4012500","Invalid signature");
    if(typeof payload?.trxId!=="string" || !/^TSNP-[A-F0-9]{32}$/.test(payload.trxId) || typeof payload.paymentRequestId!=="string" || payload.paymentRequestId.length<1 || payload.paymentRequestId.length>30 || payload.paidAmount?.value!=="10.00" || payload.paidAmount.currency!=="IDR" || payload.additionalInfo?.channel!=="VIRTUAL_ACCOUNT_BNI")return notifyError(400,"4002500","Invalid payment");
    const accepted=await ports.rpc("tippo_accept_snap_test",{p_payload:payload,p_event:req.headers.get("X-EXTERNAL-ID"),p_digest:await snapHash(minify(raw))});
    if(accepted!==true)return notifyError(404,"4042501","Transaction not found");
    const {partnerServiceId,customerNo,virtualAccountNo,virtualAccountName,paymentRequestId,paidAmount}=payload;
    return json({responseCode:"2002500",responseMessage:"Successful",virtualAccountData:{partnerServiceId,customerNo,virtualAccountNo,virtualAccountName,paymentRequestId,paidAmount}});
   }catch{return notifyError(503,"5032500","Notification not saved");}
  }
  if(req.headers.get("Origin") && req.headers.get("Origin")!==site.origin)return json({error:"ORIGIN_NOT_ALLOWED"},403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":site.origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS",Vary:"Origin"}});
  if(!["checkout","status"].includes(action??""))return json({error:"NOT_FOUND"},404,true);
  if(req.method!==(action==="checkout"?"POST":"GET"))return json({error:"METHOD_NOT_ALLOWED"},405,true);
  try{
   const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return json({error:"UNAUTHORIZED"},401,true);
   const owner=await ports.authenticate(auth.slice(7));if(!owner)return json({error:"UNAUTHORIZED"},401,true);
   if(!config.allowedUsers.includes(owner))return json({error:"TEST_ACCOUNT_REQUIRED"},403,true);
   if(action==="checkout"){
    const invoice=await ports.rpc("tippo_begin_snap_test",{p_owner:owner,p_client_id:config.clientId,p_partner:config.partnerServiceId,p_prefix:config.customerPrefix}) as SnapInvoice;
    if(invoice.status==="creating" && !invoice.va_number){
     try{
      const va=await client.create(invoice);
      await ports.rpc("tippo_attach_snap_test",{p_id:invoice.id,p_owner:owner,p_va:va,p_url:safeSnapInstructions(va.additionalInfo.howToPayPage)});
     }catch(error){
      if(error instanceof SnapRejected){await ports.rpc("tippo_fail_snap_test",{p_id:invoice.id,p_owner:owner});return json({error:"SNAP_REJECTED"},400,true);}
      if(error instanceof SnapConflict)return json({error:"SNAP_RECONCILIATION_REQUIRED"},409,true);
      throw error;
     }
    }
   }
   return json(await ports.rpc("tippo_get_snap_test",{p_owner:owner}),200,true);
  }catch{return json({error:"SNAP_UNAVAILABLE"},503,true);}
 };
}

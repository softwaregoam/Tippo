import { CheckoutResponseInvalid, CheckoutRejected, createDokuCheckout, cancelDokuTestCheckout, digest, verifyDoku, type DokuInvoice, type DokuMode } from "./doku.ts";

export interface BillingConfig { environment: string; clientId: string; secretKey: string; siteUrl: string; notificationUrl: string; checkoutNotificationUrl?: string; }
export interface BillingPorts {
  authenticate(token: string): Promise<string | null>;
  rpc(name: string, parameters: Record<string, unknown>): Promise<unknown>;
  send?: typeof fetch;
}
export function billingHandler(config: BillingConfig, ports: BillingPorts) {
  return handler(config,ports,"sandbox",[]);
}
export function productionBillingHandler(config:BillingConfig,ports:BillingPorts){return handler(config,ports,"production",[]);}
export function productionTestHandler(config: BillingConfig & {allowedUsers:string[]},ports:BillingPorts){
  if(!config.allowedUsers.length || config.allowedUsers.some(id=>!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)))throw new Error("TEST_ACCOUNTS_REQUIRED");
  return handler(config,ports,"production-test",config.allowedUsers);
}
function handler(config: BillingConfig, ports: BillingPorts, mode:DokuMode, allowedUsers:string[]) {
  const site = new URL(config.siteUrl);
  if (config.environment !== (mode==="sandbox"?"sandbox":"production") || !config.clientId || !config.secretKey || site.protocol !== "https:" || site.username || site.password) throw new Error("BILLING_CONFIG_REQUIRED");
  const prefix=mode==="sandbox"?"sandbox":mode==="production-test"?"production_test":"pro";
  const prices=mode==="production-test"?[10,1000,10000]:[25000];
  const numberPattern=mode==="sandbox"?/^TSBX-[A-F0-9]{32}$/:mode==="production-test"?/^(TPT-[A-F0-9]{32}|TPT[A-F0-9]{24})$/:/^TPR[A-F0-9]{24}$/;
  const target = new URL(config.notificationUrl).pathname;
  const checkoutNotification = config.checkoutNotificationUrl ? new URL(config.checkoutNotificationUrl) : new URL(config.notificationUrl);
  if (checkoutNotification.protocol !== "https:" || checkoutNotification.username || checkoutNotification.password || checkoutNotification.hash || checkoutNotification.search || (checkoutNotification.port && checkoutNotification.port !== "443")) throw new Error("INVALID_NOTIFICATION_URL");
  const json = (data: unknown, status = 200, cors = false) => new Response(JSON.stringify(data), { status, headers: {
    "Content-Type":"application/json", "Cache-Control":"no-store", ...(cors ? {"Access-Control-Allow-Origin":site.origin,"Vary":"Origin"} : {}),
  }});
  return async (req: Request) => {
    const action = new URL(req.url).pathname.split("/").at(-1);
    // Public reachability check only. GET/HEAD cannot process a notification,
    // call the database or grant any subscription entitlement.
    if (action === "webhook" && (req.method === "GET" || req.method === "HEAD")) {
      return new Response(req.method === "HEAD" ? null : JSON.stringify({status:"ok",environment:mode}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
    }
    const origin = req.headers.get("Origin");
    if (origin && origin !== site.origin) return json({ error:"ORIGIN_NOT_ALLOWED" },403);
    if (req.method === "OPTIONS") return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":site.origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin"}});
    try {
      if (action === "webhook") {
        if (req.method !== "POST") return json({error:"METHOD_NOT_ALLOWED"},405);
        if (Number(req.headers.get("Content-Length"))>65536) return json({error:"BODY_TOO_LARGE"},413);
        const reader=req.body?.getReader();const chunks:Uint8Array[]=[];let length=0;
        if(reader)while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536){await reader.cancel();return json({error:"BODY_TOO_LARGE"},413);}chunks.push(value);}
        const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        const raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
        if (!await verifyDoku(config.secretKey,config.clientId,target,req.headers,raw)) return json({error:"INVALID_SIGNATURE"},401);
        let payload;try{payload=JSON.parse(raw);}catch{return json({error:"INVALID_JSON"},400);}
        const invoice=payload?.order?.invoice_number, amount=payload?.order?.amount, status=payload?.transaction?.status;
        const original=payload?.transaction?.original_request_id;
        const currency=payload?.order?.currency;
        const validService=mode==="sandbox" ? payload?.service?.id==="QRIS" || payload?.channel?.id==="QRIS_DOKU" : ["VIRTUAL_ACCOUNT","CREDIT_CARD","EMONEY","ONLINE_TO_OFFLINE","DIRECT_DEBIT","PEER_TO_PEER","QRIS"].includes(payload?.service?.id);
        if (typeof invoice!=="string" || !numberPattern.test(invoice) || !Number.isSafeInteger(amount) || !prices.includes(amount) || (currency!==undefined && currency!=="IDR") || !["SUCCESS","FAILED","PENDING","EXPIRED"].includes(status) || (original!==undefined && typeof original!=="string") || !validService) return json({error:"INVALID_PAYMENT"},400);
        const accepted=await ports.rpc(`tippo_accept_${prefix}_notification`,{p_invoice:invoice,p_client_id:config.clientId,p_amount:amount,p_request_id:req.headers.get("Request-Id"),p_digest:await digest(raw),p_status:status,p_original_request:original??null});
        return json({received:true,matched:accepted===true});
      }
      if (action!=="checkout" && action!=="status" && !(mode!=="sandbox" && action==="cancel")) return json({error:"NOT_FOUND"},404,true);
      if ((action==="status" && req.method!=="GET") || (action!=="status" && req.method!=="POST")) return json({error:"METHOD_NOT_ALLOWED"},405,true);
      const authorization=req.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) return json({error:"UNAUTHORIZED"},401,true);
      const owner=await ports.authenticate(authorization.slice(7));
      if (!owner) return json({error:"UNAUTHORIZED"},401,true);
      if(mode==="production-test" && !allowedUsers.includes(owner))return json({error:"TEST_ACCOUNT_REQUIRED"},403,true);
      if(action==="cancel"){
        if(Number(req.headers.get("Content-Length"))>1024)return json({error:"BODY_TOO_LARGE"},413,true);
        const reader=req.body?.getReader();let raw="",size=0;
        if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>1024){await reader.cancel();return json({error:"BODY_TOO_LARGE"},413,true);}raw+=new TextDecoder().decode(chunk.value);}
        let input;try{input=JSON.parse(raw);}catch{return json({error:"INVALID_JSON"},400,true);}
        if(typeof input?.invoiceId!=="string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.invoiceId))return json({error:"INVALID_INVOICE"},400,true);
        const invoice=await ports.rpc(`tippo_claim_${prefix}_cancellation`,{p_id:input.invoiceId,p_owner:owner,p_client_id:config.clientId}) as (DokuInvoice & {cancellation_request_id:string})|null;
        if(!invoice)return json({error:"CANCELLATION_NOT_AVAILABLE",billing:await ports.rpc(`tippo_get_${prefix}_billing`,{p_owner:owner})},409,true);
        try{await cancelDokuTestCheckout(invoice,config.clientId,config.secretKey,ports.send);}
        catch(error){
          if(error instanceof CheckoutRejected){
            await ports.rpc(`tippo_finish_${prefix}_cancellation`,{p_id:invoice.id,p_owner:owner,p_success:false});
            return json({error:"CANCELLATION_REJECTED",providerMessage:error.providerMessage,billing:await ports.rpc(`tippo_get_${prefix}_billing`,{p_owner:owner})},400,true);
          }
          return json({error:"CANCELLATION_UNCONFIRMED",billing:await ports.rpc(`tippo_get_${prefix}_billing`,{p_owner:owner})},503,true);
        }
        await ports.rpc(`tippo_finish_${prefix}_cancellation`,{p_id:invoice.id,p_owner:owner,p_success:true});
      }
      if (action==="checkout") {
        // No owner, amount, duration, URL or environment is accepted from the browser.
        const invoice=await ports.rpc(`tippo_begin_${prefix}_checkout`,{p_owner:owner,p_client_id:config.clientId,p_callback:`${site.origin}/app?billing=${mode}`,p_notification:checkoutNotification.href}) as DokuInvoice;
        if (!invoice.checkout_url && invoice.status==="creating") {
          if(mode!=="sandbox" && await ports.rpc(`tippo_claim_${prefix}_checkout`,{p_id:invoice.id,p_owner:owner})!==true)return json(await ports.rpc(`tippo_get_${prefix}_billing`,{p_owner:owner}),200,true);
          let checkout;
          try{checkout=await createDokuCheckout(invoice,config.clientId,config.secretKey,ports.send,mode);}
          catch(error){
            if(mode!=="sandbox" && (error instanceof CheckoutResponseInvalid || error instanceof CheckoutRejected && /REQUEST[\s_-]+ID[\s_-]+ALREADY[\s_-]+USED/i.test((error.providerMessage??"")+" "+(error.providerCode??"")))){
              await ports.rpc(`tippo_review_${prefix}_checkout`,{p_id:invoice.id,p_owner:owner});
              return json({error:error instanceof CheckoutResponseInvalid?"CHECKOUT_RESPONSE_INVALID":"CHECKOUT_RECONCILIATION_REQUIRED",
                ...(error instanceof CheckoutResponseInvalid?{providerIssue:error.issue,checkoutHost:error.checkoutHost}:{providerMessage:error.providerMessage}),
                providerRequestId:invoice.request_id,billing:await ports.rpc(`tippo_get_${prefix}_billing`,{p_owner:owner})},409,true);
            }
            if(error instanceof CheckoutRejected && mode!=="sandbox"){await ports.rpc(`tippo_fail_${prefix}_checkout`,{p_id:invoice.id,p_owner:owner});return json({error:"CHECKOUT_REJECTED",providerStatus:error.providerStatus,providerCode:error.providerCode,providerMessage:error.providerMessage,providerFormat:error.providerFormat,billing:await ports.rpc(`tippo_get_${prefix}_billing`,{p_owner:owner})},400,true);}
            throw error;
          }
          await ports.rpc(`tippo_attach_${prefix}_checkout`,{p_id:invoice.id,p_owner:owner,p_url:checkout.url,p_expires:checkout.expiresAt});
        }
      }
      return json(await ports.rpc(`tippo_get_${prefix}_billing`,{p_owner:owner}),200,true);
    } catch {
      // Fail closed, retain creating invoices for a retry with the same DOKU Request-Id.
      // Never acknowledge a webhook when its DB transaction failed.
      return json({error:action==="webhook"?"NOTIFICATION_NOT_SAVED":"BILLING_UNAVAILABLE"},503,action!=="webhook");
    }
  };
}

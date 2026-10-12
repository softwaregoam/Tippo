import { createDokuCheckout, digest, verifyDoku, type DokuInvoice } from "./doku.ts";

export interface BillingConfig { environment: string; clientId: string; secretKey: string; siteUrl: string; notificationUrl: string; }
export interface BillingPorts {
  authenticate(token: string): Promise<string | null>;
  rpc(name: string, parameters: Record<string, unknown>): Promise<unknown>;
  send?: typeof fetch;
}
export function billingHandler(config: BillingConfig, ports: BillingPorts) {
  const site = new URL(config.siteUrl);
  if (config.environment !== "sandbox" || !config.clientId || !config.secretKey || site.protocol !== "https:" || site.username || site.password) throw new Error("SANDBOX_CONFIG_REQUIRED");
  const target = new URL(config.notificationUrl).pathname;
  const json = (data: unknown, status = 200, cors = false) => new Response(JSON.stringify(data), { status, headers: {
    "Content-Type":"application/json", "Cache-Control":"no-store", ...(cors ? {"Access-Control-Allow-Origin":site.origin,"Vary":"Origin"} : {}),
  }});
  return async (req: Request) => {
    const action = new URL(req.url).pathname.split("/").at(-1);
    // Public reachability check only. GET/HEAD cannot process a notification,
    // call the database or grant any subscription entitlement.
    if (action === "webhook" && (req.method === "GET" || req.method === "HEAD")) {
      return new Response(req.method === "HEAD" ? null : JSON.stringify({status:"ok",environment:"sandbox"}),{status:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
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
        if (typeof invoice!=="string" || !/^TSBX-[A-F0-9]{32}$/.test(invoice) || !Number.isSafeInteger(amount) || amount!==25000 || (currency!==undefined && currency!=="IDR") || !["SUCCESS","FAILED","PENDING","EXPIRED"].includes(status) || (original!==undefined && typeof original!=="string") || (payload?.service?.id!=="QRIS" && payload?.channel?.id!=="QRIS_DOKU")) return json({error:"INVALID_PAYMENT"},400);
        const accepted=await ports.rpc("tippo_accept_sandbox_notification",{p_invoice:invoice,p_client_id:config.clientId,p_amount:amount,p_request_id:req.headers.get("Request-Id"),p_digest:await digest(raw),p_status:status,p_original_request:original??null});
        return json({received:true,matched:accepted===true});
      }
      if (action!=="checkout" && action!=="status") return json({error:"NOT_FOUND"},404,true);
      if ((action==="status" && req.method!=="GET") || (action==="checkout" && req.method!=="POST")) return json({error:"METHOD_NOT_ALLOWED"},405,true);
      const authorization=req.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) return json({error:"UNAUTHORIZED"},401,true);
      const owner=await ports.authenticate(authorization.slice(7));
      if (!owner) return json({error:"UNAUTHORIZED"},401,true);
      if (action==="checkout") {
        // No owner, amount, duration, URL or environment is accepted from the browser.
        const invoice=await ports.rpc("tippo_begin_sandbox_checkout",{p_owner:owner,p_client_id:config.clientId,p_callback:`${site.origin}/app?billing=sandbox`,p_notification:config.notificationUrl}) as DokuInvoice;
        if (!invoice.checkout_url && invoice.status==="creating") {
          const checkout=await createDokuCheckout(invoice,config.clientId,config.secretKey,ports.send);
          await ports.rpc("tippo_attach_sandbox_checkout",{p_id:invoice.id,p_owner:owner,p_url:checkout.url,p_expires:checkout.expiresAt});
        }
      }
      return json(await ports.rpc("tippo_get_sandbox_billing",{p_owner:owner}),200,true);
    } catch {
      // Fail closed, retain creating invoices for a retry with the same DOKU Request-Id.
      // Never acknowledge a webhook when its DB transaction failed.
      return json({error:action==="webhook"?"NOTIFICATION_NOT_SAVED":"BILLING_UNAVAILABLE"},503,action!=="webhook");
    }
  };
}

import { randomUUID } from "node:crypto";
import { digest, verifyDoku } from "../supabase/functions/_shared/doku.ts";
import { gatewayJson, gatewayUuid, readGatewayBody } from "../supabase/functions/_shared/gateway-protocol.ts";

export function routerHandler(config, store) {
  return async req => {
    const path = new URL(req.url).pathname;
    if (path === "/healthz" && req.method === "GET") return gatewayJson({ status:"ok" });
    if (path !== config.webhookPath) return gatewayJson({ error:"NOT_FOUND" },404);
    if (req.method !== "POST") return gatewayJson({ error:"METHOD_NOT_ALLOWED" },405);
    try {
      const raw = await readGatewayBody(req);
      if (!await verifyDoku(config.secretKey, config.clientId, config.webhookPath, req.headers, raw)) return gatewayJson({ error:"INVALID_SIGNATURE" },401);
      let payload; try { payload = JSON.parse(raw); } catch { return gatewayJson({ error:"INVALID_JSON" },400); }
      const invoice = payload?.order?.invoice_number, amount = payload?.order?.amount, status = payload?.transaction?.status;
      const original = payload?.transaction?.original_request_id ?? null, requestId = req.headers.get("Request-Id");
      const route = typeof invoice === "string" ? config.routes.find(item => invoice.startsWith(item.prefix) && new RegExp(`^${item.prefix}[A-F0-9]{24}$`).test(invoice)) : null;
      if (!route) return gatewayJson({ error:"UNKNOWN_INVOICE_ROUTE" },422);
      if (!Number.isSafeInteger(amount) || !route.amounts.includes(amount) || (payload.order.currency !== undefined && payload.order.currency !== "IDR")
        || !["SUCCESS","FAILED","PENDING","EXPIRED"].includes(status) || !(original === null || gatewayUuid(original)) || !/^[A-Za-z0-9._:-]{1,128}$/.test(requestId || "")
        || !["VIRTUAL_ACCOUNT","CREDIT_CARD","EMONEY","ONLINE_TO_OFFLINE","DIRECT_DEBIT","PEER_TO_PEER","QRIS"].includes(payload?.service?.id)) return gatewayJson({ error:"INVALID_PAYMENT" },400);
      const hash = await digest(raw);
      const event = { version:1, id:randomUUID(), appId:route.appId, environment:config.environment,
        invoice:{ number:invoice, amount, currency:"IDR" },
        payment:{ clientId:config.clientId, requestId, originalRequestId:original, digest:hash, status },
      };
      const eventId = store.accept(requestId, hash, event);
      return gatewayJson({ received:true, eventId });
    } catch (error) {
      if (error?.message === "BODY_TOO_LARGE") return gatewayJson({ error:"BODY_TOO_LARGE" },413);
      if (error?.message === "REPLAY_MISMATCH") return gatewayJson({ error:"REPLAY_MISMATCH" },409);
      // A storage failure must result in DOKU retrying, not a false acknowledgement.
      return gatewayJson({ error:"NOTIFICATION_NOT_SAVED" },503);
    }
  };
}

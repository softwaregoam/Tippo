import { GATEWAY_APP, gatewayJson, gatewayUuid, readGatewayBody, verifyGatewayRequest, type GatewayEvent } from "./gateway-protocol.ts";

/** A separate internal endpoint; the old DOKU webhook continues validating DOKU signatures. */
export function paymentEventsHandler(config: { eventKey: string; clientId: string }, rpc: (name: string, input: Record<string, unknown>) => Promise<unknown>) {
  if (config.eventKey.length < 32 || !config.clientId) throw new Error("PAYMENT_ROUTER_CONFIG_REQUIRED");
  return async (req: Request) => {
    if (req.method !== "POST") return gatewayJson({ error: "METHOD_NOT_ALLOWED" }, 405);
    try {
      const raw = await readGatewayBody(req, 8192);
      if (!await verifyGatewayRequest(req, raw, config.eventKey)) return gatewayJson({ error: "UNAUTHORIZED" }, 401);
      let event: GatewayEvent; try { event = JSON.parse(raw); } catch { return gatewayJson({ error: "INVALID_EVENT" }, 400); }
      const invoice = event?.invoice, payment = event?.payment;
      if (event?.version !== 1 || !gatewayUuid(event.id) || event.id !== req.headers.get("X-Payment-Id") || event.appId !== GATEWAY_APP || event.environment !== "production"
        || !invoice || typeof invoice.number !== "string" || !/^TPR[A-F0-9]{24}$/.test(invoice.number) || invoice.amount !== 25000 || invoice.currency !== "IDR"
        || !payment || payment.clientId !== config.clientId || typeof payment.requestId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(payment.requestId)
        || typeof payment.digest !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(payment.digest)
        || !(payment.originalRequestId === null || gatewayUuid(payment.originalRequestId)) || !["SUCCESS", "FAILED", "PENDING", "EXPIRED"].includes(payment.status)) return gatewayJson({ error: "INVALID_EVENT" }, 400);
      const accepted = await rpc("tippo_accept_pro_notification", {
        p_invoice: invoice.number, p_client_id: config.clientId, p_amount: invoice.amount,
        p_request_id: payment.requestId, p_digest: payment.digest, p_status: payment.status, p_original_request: payment.originalRequestId,
      });
      // An unknown invoice must remain queued, never silently acknowledged.
      if (accepted !== true) return gatewayJson({ error: "INVOICE_NOT_FOUND" }, 409);
      return gatewayJson({ received: true, eventId: event.id });
    } catch (error) {
      return gatewayJson({ error: error instanceof Error && error.message === "BODY_TOO_LARGE" ? "BODY_TOO_LARGE" : "EVENT_NOT_SAVED" }, error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 503);
    }
  };
}

import { createClient } from "@supabase/supabase-js";
import { paymentEventsHandler } from "../_shared/payment-events-handler.ts";
const runtime = (globalThis as unknown as { Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void } }).Deno;
const required = (name: string) => { const value = runtime.env.get(name); if (!value) throw new Error("CONFIG_REQUIRED"); return value; };
let handler: (req: Request) => Promise<Response>;
try {
  const service = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  handler = paymentEventsHandler({ eventKey: required("TIPPO_ROUTER_EVENT_KEY"), clientId: required("DOKU_PRODUCTION_CLIENT_ID") }, async (name, input) => {
    const { data, error } = await service.rpc(name, input); if (error) throw new Error("DATABASE_UNAVAILABLE"); return data;
  });
} catch { handler = async () => Response.json({ error: "PAYMENT_ROUTER_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
runtime.serve(handler);

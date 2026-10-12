/** DOKU Checkout Non-SNAP. No credentials or production endpoint defaults. */
export const DOKU_SANDBOX_ENDPOINT = "https://api-sandbox.doku.com/checkout/v1/payment";
export type DokuMode = "sandbox" | "production-test";
export const DOKU_PRODUCTION_ENDPOINT = "https://api.doku.com/checkout/v1/payment";
export class CheckoutRejected extends Error {
 providerStatus:number;providerCode:string|null;
 constructor(status:number,code:string|null){super("CHECKOUT_REJECTED");this.providerStatus=status;this.providerCode=code;}
}
const encoder = new TextEncoder();
function base64(bytes: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
export async function digest(body: string) { return base64(await crypto.subtle.digest("SHA-256", encoder.encode(body))); }
export async function signDoku(secret: string, client: string, request: string, timestamp: string, target: string, body: string) {
  const data = [`Client-Id:${client}`, `Request-Id:${request}`, `Request-Timestamp:${timestamp}`, `Request-Target:${target}`, `Digest:${await digest(body)}`].join("\n");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `HMACSHA256=${base64(await crypto.subtle.sign("HMAC", key, encoder.encode(data)))}`;
}
export async function verifyDoku(secret: string, client: string, target: string, headers: Headers, body: string) {
  const request = headers.get("Request-Id"), timestamp = headers.get("Request-Timestamp"), supplied = headers.get("Signature");
  if (headers.get("Client-Id") !== client || !request || request.length > 128 || !timestamp || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp)) || !supplied) return false;
  const expected = await signDoku(secret, client, request, timestamp, target, body);
  // Fixed-length comparison; notifications may be retried later, so receipt time
  // is not an arbitrary rejection window. Replay control is in the DB transaction.
  let difference = supplied.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  return difference === 0;
}
export function safeCheckoutUrl(value: unknown, mode: DokuMode = "sandbox"): string {
  if (typeof value !== "string") throw new Error("INVALID_CHECKOUT_URL");
  const url = new URL(value);
  const hosts=mode==="sandbox"?["sandbox.doku.com"]:["jokul.doku.com"];
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || (url.port && url.port !== "443")) throw new Error("INVALID_CHECKOUT_URL");
  return url.href;
}
export function parseDokuExpiry(value: unknown): string {
  if (typeof value !== "string" || !/^\d{14}$/.test(value)) throw new Error("INVALID_EXPIRY");
  const date = new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(8,10)}:${value.slice(10,12)}:${value.slice(12,14)}+07:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime()+7*3600000).toISOString().slice(0,19).replace(/[-:T]/g, "") !== value) throw new Error("INVALID_EXPIRY");
  return date.toISOString();
}
export interface DokuInvoice { id: string; owner_id: string; invoice_number: string; amount: number; request_id: string; request_body: string; status: string; checkout_url: string | null; }
export async function createDokuCheckout(invoice: DokuInvoice, client: string, secret: string, send: typeof fetch = fetch, mode: DokuMode = "sandbox") {
  const timestamp = new Date().toISOString().slice(0,19)+"Z";
  const response = await send(mode==="sandbox"?DOKU_SANDBOX_ENDPOINT:DOKU_PRODUCTION_ENDPOINT, { method: "POST", headers: {
    "Content-Type":"application/json", "Client-Id":client, "Request-Id":invoice.request_id, "Request-Timestamp":timestamp,
    "Signature": await signDoku(secret,client,invoice.request_id,timestamp,"/checkout/v1/payment",invoice.request_body),
  }, body:invoice.request_body, signal:AbortSignal.timeout(15000), redirect:"error" });
  // DOKU documents 409 with the original response for an idempotent retry.
  if (response.status===400 || response.status===422) {
    const rejected=await response.json().catch(()=>null);
    const code=rejected?.error?.code??rejected?.code??rejected?.responseCode;
    // Never expose raw provider messages, headers or echoed request data.
    throw new CheckoutRejected(response.status,typeof code==="string" && /^[A-Za-z0-9_-]{1,80}$/.test(code)?code:null);
  }
  if (!response.ok && response.status !== 409) throw new Error("CHECKOUT_UNAVAILABLE");
  const body = await response.json();
  const payment = body?.response?.payment;
  if (body?.response?.order?.invoice_number !== invoice.invoice_number || body?.response?.order?.amount !== invoice.amount) throw new Error("CHECKOUT_MISMATCH");
  return { url: safeCheckoutUrl(payment?.url,mode), expiresAt: parseDokuExpiry(payment?.expired_date) };
}

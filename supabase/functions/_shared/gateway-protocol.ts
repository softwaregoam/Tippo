/** Server-to-server authentication. These keys must never enter browser bundles. */
const encoder = new TextEncoder();
export const GATEWAY_APP = "tippo";
export const gatewayUuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function secureEqual(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) difference |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return difference === 0;
}
export async function gatewaySignature(key: string, app: string, method: string, path: string, id: string, timestamp: string, raw: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(raw)));
  const digest = Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
  const canonical = ["tippo-payments-v1", app, method.toUpperCase(), path, id, timestamp, digest].join("\n");
  const secret = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", secret, encoder.encode(canonical)));
  return "v1=" + btoa(String.fromCharCode(...signature));
}
export async function gatewayHeaders(key: string, app: string, url: string, raw: string, id = crypto.randomUUID(), now = Date.now()) {
  const timestamp = String(Math.floor(now / 1000));
  return {
    "Content-Type": "application/json", "X-Payment-App": app, "X-Payment-Id": id, "X-Payment-Timestamp": timestamp,
    "X-Payment-Signature": await gatewaySignature(key, app, "POST", new URL(url).pathname, id, timestamp, raw),
  };
}
export async function verifyGatewayRequest(req: Request, raw: string, key: string, app = GATEWAY_APP, now = Date.now()) {
  const id = req.headers.get("X-Payment-Id"), timestamp = req.headers.get("X-Payment-Timestamp"), supplied = req.headers.get("X-Payment-Signature");
  if (req.method !== "POST" || req.headers.get("X-Payment-App") !== app || !gatewayUuid(id) || !timestamp || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !supplied || supplied.length > 100) return false;
  return secureEqual(supplied, await gatewaySignature(key, app, req.method, new URL(req.url).pathname, id, timestamp, raw));
}
export function trustedGatewayUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || (url.port && url.port !== "443") || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)) throw new Error("INVALID_GATEWAY_URL");
  if (!/^\/functions\/v1\/[a-z0-9-]+$/.test(url.pathname)) throw new Error("INVALID_GATEWAY_URL");
  return url.href.replace(/\/$/, "");
}
export async function readGatewayBody(req: Pick<Request, "headers" | "body">, limit = 65536) {
  if (Number(req.headers.get("Content-Length")) > limit) throw new Error("BODY_TOO_LARGE");
  const reader = req.body?.getReader(), parts: Uint8Array[] = []; let size = 0;
  if (reader) while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length; if (size > limit) { await reader.cancel(); throw new Error("BODY_TOO_LARGE"); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export const gatewayJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export type GatewayEvent = {
  version: 1; id: string; appId: "tippo"; environment: "production";
  invoice: { number: string; amount: number; currency: "IDR" };
  payment: { clientId: string; requestId: string; originalRequestId: string | null; digest: string; status: "SUCCESS" | "FAILED" | "PENDING" | "EXPIRED" };
};

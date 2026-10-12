/** DOKU Checkout Non-SNAP. No credentials or production endpoint defaults. */
export const DOKU_SANDBOX_ENDPOINT = "https://api-sandbox.doku.com/checkout/v1/payment";
export type DokuMode = "sandbox" | "production-test";
export const DOKU_PRODUCTION_ENDPOINT = "https://api.doku.com/checkout/v1/payment";
export class CheckoutRejected extends Error {
 providerStatus:number;providerCode:string|null;providerMessage:string|null;providerFormat:string;
 constructor(status:number,code:string|null,message:string|null=null,format="json"){super("CHECKOUT_REJECTED");this.providerStatus=status;this.providerCode=code;this.providerMessage=message;this.providerFormat=format;}
}
export class CheckoutResponseInvalid extends Error {
 issue:string;checkoutHost:string|null;
 constructor(issue:string,host:string|null=null){super("CHECKOUT_RESPONSE_INVALID");this.issue=issue;this.checkoutHost=host;}
}
export async function readCheckoutRejection(response:Response,sensitive:string[]){
 const reader=response.body?.getReader();const parts:Uint8Array[]=[];let size=0,truncated=false;
 if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){truncated=true;await reader.cancel();break;}parts.push(value);}
 if(truncated)return new CheckoutRejected(response.status,null,null,"truncated");
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 const raw=new TextDecoder().decode(bytes).trim();
 if(!raw)return new CheckoutRejected(response.status,null,null,"empty");
 if(/^\s*</.test(raw))return new CheckoutRejected(response.status,null,null,"html");
 let data;try{data=JSON.parse(raw);}catch{data=null;}
 const format=data!==null?"json":"text";
 const code=data?.error?.code??data?.code??data?.responseCode??data?.error_code??data?.errors?.[0]?.code??data?.response?.error?.code;
 const candidate=data?.error?.message??data?.message??data?.responseMessage??data?.error_description??data?.errors?.[0]?.message??data?.response?.error?.message??data?.response?.message??(typeof data?.error==="string" || Array.isArray(data?.error)?data.error:undefined)??(typeof data?.errors?.[0]==="string"?data.errors[0]:undefined)??(typeof data==="string"?data:undefined)??(format==="text"?raw:undefined);
 let message=typeof candidate==="string"?candidate:Array.isArray(candidate)?candidate.filter(value=>typeof value==="string").slice(0,3).join("; "):typeof candidate?.english==="string"?candidate.english:typeof candidate?.en==="string"?candidate.en:typeof candidate?.indonesia==="string"?candidate.indonesia:null;
 const redact=(text:string)=>{
  for(const secret of sensitive.filter(Boolean))for(const variant of new Set([secret,encodeURIComponent(secret),base64(encoder.encode(secret).buffer as ArrayBuffer)]))text=text.split(variant).join("[redacted]");
  return text.replace(/Bearer\s+\S+/gi,"Bearer [redacted]").replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,"[redacted]")
   .replace(/https?:\/\/[^\s"'<>]+/gi,"[URL]").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[email]")
   .replace(/((?:secret(?:[_ -]?key)?|api[_ -]?key|signature|token|password|authorization)\s*[:=]\s*)[^\s,;]+/gi,"$1[redacted]")
   .replace(/<[^>]*>/g,"").replace(/[\u0000-\u001f\u007f]+/g," ").trim().slice(0,300);
 };
 message=message?redact(message):null;
 const safeCode=typeof code==="string" && /^[A-Za-z0-9_-]{1,80}$/.test(code) && !sensitive.includes(code)?code:null;
 return new CheckoutRejected(response.status,safeCode,message||null,format);
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
  const hosts=mode==="sandbox"?["sandbox.doku.com"]:["jokul.doku.com","checkout.doku.com"];
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
export async function cancelDokuTestCheckout(invoice:DokuInvoice & {cancellation_request_id:string},client:string,secret:string,send:typeof fetch=fetch){
  const target="/checkout/v3/cancellations",timestamp=new Date().toISOString().slice(0,19)+"Z";
  const body=JSON.stringify({order:{invoice_number:invoice.invoice_number},payment:{original_request_id:invoice.request_id},note:"Pembatalan pembayaran uji Tippo"});
  const signature=await signDoku(secret,client,invoice.cancellation_request_id,timestamp,target,body);
  const response=await send("https://api.doku.com"+target,{method:"POST",headers:{"Content-Type":"application/json","Client-Id":client,"Request-Id":invoice.cancellation_request_id,"Request-Timestamp":timestamp,Signature:signature},body,signal:AbortSignal.timeout(15000),redirect:"error"});
  if([400,401,403,404,409,422].includes(response.status))throw await readCheckoutRejection(response,[secret,client,signature]);
  if(response.status!==200 && response.status!==204)throw new Error("CANCELLATION_UNCONFIRMED");
  if(response.status===200){
    const reader=response.body?.getReader();let raw="",size=0;
    if(reader)while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>8192){await reader.cancel();throw new Error("CANCELLATION_UNCONFIRMED");}raw+=new TextDecoder().decode(chunk.value);}
    if(raw.trim()){
      let result;try{result=JSON.parse(raw);}catch{throw new Error("CANCELLATION_UNCONFIRMED");}
      const data=result?.response??result;
      if(!data || typeof data!=="object" || data.error || data.errors || ["FAILED","ERROR","PENDING"].includes(data.status))throw new Error("CANCELLATION_UNCONFIRMED");
    }
  }
}
export async function createDokuCheckout(invoice: DokuInvoice, client: string, secret: string, send: typeof fetch = fetch, mode: DokuMode = "sandbox") {
  const timestamp = new Date().toISOString().slice(0,19)+"Z";
  const signature=await signDoku(secret,client,invoice.request_id,timestamp,"/checkout/v1/payment",invoice.request_body);
  const response = await send(mode==="sandbox"?DOKU_SANDBOX_ENDPOINT:DOKU_PRODUCTION_ENDPOINT, { method: "POST", headers: {
    "Content-Type":"application/json", "Client-Id":client, "Request-Id":invoice.request_id, "Request-Timestamp":timestamp,
    "Signature": signature,
  }, body:invoice.request_body, signal:AbortSignal.timeout(15000), redirect:"error" });
  // DOKU documents 409 with the original response for an idempotent retry.
  if ([400,401,403,422].includes(response.status)) {
    throw await readCheckoutRejection(response,[secret,client,signature,signature.slice("HMACSHA256=".length)]);
  }
  if (!response.ok && response.status !== 409) throw new Error("CHECKOUT_UNAVAILABLE");
  let body;try{body=await response.json();}catch{throw new CheckoutResponseInvalid("INVALID_JSON");}
  const result=body?.response??body,payment=result?.payment,order=result?.order;
  if(order?.invoice_number!==invoice.invoice_number)throw new CheckoutResponseInvalid("ORDER_INVOICE_MISMATCH");
  const amount=typeof order?.amount==="string" && /^\d{1,16}(\.0{1,2})?$/.test(order.amount)?Number(order.amount):order?.amount;
  if(amount!==invoice.amount || (order.currency!==undefined && order.currency!=="IDR"))throw new CheckoutResponseInvalid("ORDER_AMOUNT_MISMATCH");
  let url:string;try{url=safeCheckoutUrl(payment?.url,mode);}catch{
    let host:null|string=null;try{host=new URL(payment?.url).hostname;}catch{}
    throw new CheckoutResponseInvalid("CHECKOUT_URL_INVALID",host && /^[a-z0-9.-]{1,253}$/.test(host)?host:null);
  }
  let expiresAt:string;try{expiresAt=parseDokuExpiry(payment?.expired_date);}catch{throw new CheckoutResponseInvalid("CHECKOUT_EXPIRY_INVALID");}
  return {url,expiresAt};
}

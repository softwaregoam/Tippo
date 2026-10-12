/** DOKU SNAP BNI DGPC, production test only. Credentials remain on the server. */
export const SNAP_TOKEN_PATH="/authorization/v1/access-token/b2b";
export const SNAP_VA_PATH="/virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va";
const encoder=new TextEncoder();
const base64=(bytes:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const minify=(raw:string)=>JSON.stringify(JSON.parse(raw));
export async function snapHash(raw:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(raw)))).map(n=>n.toString(16).padStart(2,"0")).join("");}
export async function snapRsaSignature(pem:string,client:string,timestamp:string){
 const cleaned=pem.replaceAll("\\n","\n").trim();
 if(!cleaned.startsWith("-----BEGIN PRIVATE KEY-----"))throw new Error("SNAP_PRIVATE_KEY_PKCS8_REQUIRED");
 const der=Uint8Array.from(atob(cleaned.replace(/-----[^-]+-----/g,"").replace(/\s/g,"")),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",der,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 if((key.algorithm as RsaHashedKeyAlgorithm).modulusLength<2048)throw new Error("SNAP_RSA_KEY_TOO_SMALL");
 return base64(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,encoder.encode(client+"|"+timestamp)));
}
export async function snapSignature(secret:string,method:string,path:string,token:string,raw:string,timestamp:string){
 const canonical=[method.toUpperCase(),path,token,await snapHash(minify(raw)),timestamp].join(":");
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-512"},false,["sign"]);
 return base64(await crypto.subtle.sign("HMAC",key,encoder.encode(canonical)));
}
export async function verifySnap(secret:string,path:string,headers:Headers,raw:string){
 const auth=headers.get("Authorization"),time=headers.get("X-TIMESTAMP"),external=headers.get("X-EXTERNAL-ID"),signature=headers.get("X-SIGNATURE");
 if(!auth?.startsWith("Bearer ") || auth.length>8192 || !time || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(time) || !Number.isFinite(Date.parse(time)) || !external || !/^\d{1,36}$/.test(external) || !headers.get("X-PARTNER-ID") || headers.get("CHANNEL-ID")!=="H2H" || !signature)return false;
 const expected=await snapSignature(secret,"POST",path,auth.slice(7),raw,time);
 let different=expected.length^signature.length;for(let i=0;i<expected.length;i++)different|=expected.charCodeAt(i)^(signature.charCodeAt(i)||0);
 // The merchant-specific HMAC authenticates the whole request including its bearer
 // token. No unsigned/bearer-only notification is accepted. DB handles retries.
 return different===0;
}
export interface SnapCredentials {clientId:string;secretKey:string;privateKey:string;}
export interface SnapInvoice {id:string;invoice_number:string;request_id:string;request_body:string;status:string;va_number:string|null;}
export interface SnapVA {partnerServiceId:string;customerNo:string;virtualAccountNo:string;virtualAccountName:string;trxId:string;totalAmount:{value:string;currency:string};expiredDate:string;virtualAccountTrxType:string;additionalInfo:{channel:string;howToPayPage?:string};}
export class SnapRejected extends Error {constructor(){super("SNAP_REJECTED");}}
export class SnapConflict extends Error {constructor(){super("SNAP_CONFLICT");}}
export function safeSnapInstructions(value:unknown):string|null{
 if(value===undefined || value===null)return null;
 if(typeof value!=="string")throw new Error("INVALID_INSTRUCTIONS");
 const url=new URL(value);
 if(url.protocol!=="https:" || url.hostname!=="app.doku.com" || !url.pathname.startsWith("/how-to-pay/virtual-account/bni/") || url.username || url.password || (url.port && url.port!=="443"))throw new Error("INVALID_INSTRUCTIONS");
 return url.href;
}
export function validateVA(value:unknown,invoice:SnapInvoice):SnapVA{
 const va=value as SnapVA,body=JSON.parse(invoice.request_body);
 if(!va || va.trxId!==invoice.invoice_number || va.partnerServiceId!==body.partnerServiceId || !/^\d{1,20}$/.test(va.customerNo) || !va.customerNo.startsWith(body.customerNo) || !/^\d{1,28}$/.test(va.virtualAccountNo) || va.virtualAccountNo!==va.partnerServiceId.trim().padStart(8,"0")+va.customerNo || va.virtualAccountName!==body.virtualAccountName || va.totalAmount?.value!=="10.00" || va.totalAmount.currency!=="IDR" || va.virtualAccountTrxType!=="C" || va.additionalInfo?.channel!=="VIRTUAL_ACCOUNT_BNI" || !Number.isFinite(Date.parse(va.expiredDate)) || Date.parse(va.expiredDate)!==Date.parse(body.expiredDate))throw new Error("SNAP_VA_MISMATCH");
 safeSnapInstructions(va.additionalInfo.howToPayPage);return va;
}
export function snapClient(config:SnapCredentials,send:typeof fetch=fetch){
 let cached:{token:string;until:number}|null=null;let pending:Promise<string>|null=null;
 async function getToken(){
  if(cached && cached.until>Date.now()+30000)return cached.token;
  if(pending)return pending;
  pending=(async()=>{
   const timestamp=new Date().toISOString().slice(0,19)+"Z";
   const response=await send("https://api.doku.com"+SNAP_TOKEN_PATH,{method:"POST",headers:{"Content-Type":"application/json","X-CLIENT-KEY":config.clientId,"X-TIMESTAMP":timestamp,"X-SIGNATURE":await snapRsaSignature(config.privateKey,config.clientId,timestamp)},body:'{"grantType":"client_credentials"}',signal:AbortSignal.timeout(15000),redirect:"error"});
   if(!response.ok)throw new Error("SNAP_TOKEN_UNAVAILABLE");
   const data=await response.json();
   const expires=typeof data.expiresIn==="string" && /^\d+$/.test(data.expiresIn)?Number(data.expiresIn):data.expiresIn;
   if(data.responseCode!=="2007300" || data.tokenType!=="Bearer" || typeof data.accessToken!=="string" || !data.accessToken || data.accessToken.length>8192 || !Number.isSafeInteger(expires) || expires<=0)throw new Error("SNAP_TOKEN_INVALID");
   cached={token:data.accessToken,until:Date.now()+Math.min(expires,900)*1000};return data.accessToken as string;
  })();try{return await pending;}finally{pending=null;}
 }
 return {async create(invoice:SnapInvoice){
  const token=await getToken(),timestamp=new Date().toISOString().slice(0,19)+"Z",raw=minify(invoice.request_body);
  const response=await send("https://api.doku.com"+SNAP_VA_PATH,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,"X-PARTNER-ID":config.clientId,"X-EXTERNAL-ID":invoice.request_id,"CHANNEL-ID":"H2H","X-TIMESTAMP":timestamp,"X-SIGNATURE":await snapSignature(config.secretKey,"POST",SNAP_VA_PATH,token,raw,timestamp)},body:raw,signal:AbortSignal.timeout(15000),redirect:"error"});
  if(response.status===401){cached=null;throw new Error("SNAP_AUTH_FAILED");}
  if(response.status===409)throw new SnapConflict();
  if([400,403,404,422].includes(response.status))throw new SnapRejected();
  if(!response.ok)throw new Error("SNAP_VA_UNAVAILABLE");
  const data=await response.json();
  if(data.responseCode!=="2002700")throw new Error("SNAP_VA_UNAVAILABLE");
  return validateVA(data.virtualAccountData,invoice);
 }};
}

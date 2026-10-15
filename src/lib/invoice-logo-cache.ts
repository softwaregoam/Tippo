type Entry={promise:Promise<string>;data?:string};
const logos=new Map<string,Entry>();
const listeners=new Set<()=>void>();
const notify=()=>listeners.forEach(listener=>listener());
export function subscribeInvoiceLogos(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function cachedInvoiceLogo(url:string):string {
 return /^(data:image\/|blob:)/.test(url)?url:logos.get(url)?.data??"";
}
function dataUrl(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Logo belum dapat dibaca."));reader.readAsDataURL(blob);});
}
function remember(url:string,load:()=>Promise<string>):Promise<string>{
 const entry:Entry={promise:Promise.resolve("")};
 entry.promise=load().then(data=>{if(logos.get(url)===entry){entry.data=data;notify();}return data;}).catch(error=>{if(logos.get(url)===entry){logos.delete(url);notify();}throw error;});
 logos.set(url,entry);
 while(logos.size>8)logos.delete(logos.keys().next().value!);
 return entry.promise;
}
/** Uploads use unique URLs. Share successful loads and in-flight requests in this tab. */
export function loadInvoiceLogo(url:string):Promise<string>{
 if(url.startsWith("data:image/"))return Promise.resolve(url);
 const existing=logos.get(url);if(existing)return existing.promise;
 return remember(url,async()=>{
  const response=await fetch(url,{credentials:"omit",signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("Logo invoice belum dapat dimuat. Coba kembali.");
  return dataUrl(await response.blob());
 });
}
/** Seed from the uploaded bytes so a newly saved logo needs no extra download. */
export function cacheInvoiceLogo(url:string,blob:Blob):Promise<string>{return remember(url,()=>dataUrl(blob));}
export function invalidateInvoiceLogo(url?:string){if(url===undefined)logos.clear();else logos.delete(url);notify();}

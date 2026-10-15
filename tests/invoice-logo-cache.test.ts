import test from "node:test";
import assert from "node:assert/strict";
import {cachedInvoiceLogo,loadInvoiceLogo,cacheInvoiceLogo,invalidateInvoiceLogo} from "../src/lib/invoice-logo-cache.ts";

async function withBrowser(run:()=>Promise<void>){
 const originalFetch=globalThis.fetch,originalReader=globalThis.FileReader;
 class Reader {result="";onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
  readAsDataURL(blob:Blob){void blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;this.onload?.();}).catch(()=>this.onerror?.());}
 }
 globalThis.FileReader=Reader as unknown as typeof FileReader;
 invalidateInvoiceLogo();
 try{await run();}finally{globalThis.fetch=originalFetch;globalThis.FileReader=originalReader;invalidateInvoiceLogo();}
}
const image=(text:string)=>new Blob([text],{type:"image/png"});
test("invoice logo requests share one successful load across preview and exports",async()=>withBrowser(async()=>{
 let requests=0;globalThis.fetch=async()=>{requests++;return new Response(image("logo"));};
 const first=loadInvoiceLogo("https://example.test/logo-1.png"),second=loadInvoiceLogo("https://example.test/logo-1.png");
 assert.equal(first,second);assert.equal(await first,await second);assert.equal(requests,1);
 assert.equal(await loadInvoiceLogo("https://example.test/logo-1.png"),cachedInvoiceLogo("https://example.test/logo-1.png"));assert.equal(requests,1);
}));
test("failed logo requests are evicted so retry fetches a fresh image",async()=>withBrowser(async()=>{
 let requests=0;globalThis.fetch=async()=>new Response(image("logo"),{status:++requests===1?403:200});
 await assert.rejects(loadInvoiceLogo("https://example.test/logo.png"));assert.equal(cachedInvoiceLogo("https://example.test/logo.png"),"");
 assert.match(await loadInvoiceLogo("https://example.test/logo.png"),/^data:image\/png;base64,/);assert.equal(requests,2);
}));
test("replacement and deletion invalidate old logos and late requests cannot overwrite seeded uploads",async()=>withBrowser(async()=>{
 let complete!:(value:Response)=>void;globalThis.fetch=()=>new Promise(resolve=>{complete=resolve;});
 const url="https://example.test/old.png",pending=loadInvoiceLogo(url);invalidateInvoiceLogo(url);
 const replacement=await cacheInvoiceLogo(url,image("new upload"));complete(new Response(image("old response")));await pending;
 assert.equal(cachedInvoiceLogo(url),replacement);
 const newUrl="https://example.test/new-unique.png";await cacheInvoiceLogo(newUrl,image("different logo"));assert.notEqual(cachedInvoiceLogo(url),cachedInvoiceLogo(newUrl));
 invalidateInvoiceLogo(url);assert.equal(cachedInvoiceLogo(url),"");assert.ok(cachedInvoiceLogo(newUrl));invalidateInvoiceLogo(newUrl);assert.equal(cachedInvoiceLogo(newUrl),"");
}));

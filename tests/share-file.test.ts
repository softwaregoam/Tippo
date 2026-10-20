import test from "node:test";
import assert from "node:assert/strict";
import { imageFileFromDataUrl, shareOrDownloadFile } from "../src/lib/share-file.ts";
import { loadQrisFile } from "../src/lib/qris.ts";

const original=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64");
function navigatorWith(value:unknown){const previous=Object.getOwnPropertyDescriptor(globalThis,"navigator");Object.defineProperty(globalThis,"navigator",{value,configurable:true});return()=>{if(previous)Object.defineProperty(globalThis,"navigator",previous);else Reflect.deleteProperty(globalThis,"navigator");};}

test("invoice share preserves PNG bytes and sends only the file to the native chooser",async()=>{
 const file=imageFileFromDataUrl(`data:image/png;base64,${original.toString("base64")}`,"INV-1.png");
 assert.equal(file.name,"INV-1.png");assert.equal(file.type,"image/png");assert.deepEqual(Buffer.from(await file.arrayBuffer()),original);
 let called=false;const restore=navigatorWith({canShare:({files}:{files:File[]})=>files[0]===file,share:(data:ShareData)=>{called=true;assert.deepEqual(Object.keys(data),["files"]);assert.equal(data.files?.[0],file);return Promise.resolve();}});
 try{const sharing=shareOrDownloadFile(file);assert.equal(called,true,"share must run before any await loses user activation");assert.equal(await sharing,"shared");}finally{restore();}
});
test("cancelling native sharing does not download; other errors remain actionable",async()=>{
 for(const name of ["AbortError","NotAllowedError"]){const restore=navigatorWith({canShare:()=>true,share:()=>Promise.reject(new DOMException("Closed",name))});try{const result=shareOrDownloadFile(new File([original],"qris.png",{type:"image/png"}));if(name==="AbortError")assert.equal(await result,"cancelled");else await assert.rejects(result,/Gunakan tombol Unduh|gunakan tombol Unduh/);}finally{restore();}}
});
test("unsupported file sharing downloads the original file, never a URL-only share",async t=>{
 const file=new File([original],"QRIS-INV.png",{type:"image/png"});let clicked=0,removed=0;const link={href:"",download:"",click:()=>clicked++,remove:()=>removed++};
 t.mock.method(URL,"createObjectURL",(blob:Blob)=>{assert.equal(blob,file);return "blob:test";});t.mock.method(URL,"revokeObjectURL",()=>undefined);t.mock.method(globalThis,"setTimeout",((fn:()=>void)=>{fn();return 0;}) as typeof setTimeout);
 Object.defineProperty(globalThis,"document",{value:{createElement:()=>link,body:{append:()=>undefined}},configurable:true});t.after(()=>Reflect.deleteProperty(globalThis,"document"));
 for(const supported of [false,undefined]){const restore=navigatorWith(supported===false?{canShare:()=>false,share:()=>assert.fail("Cannot share files")}:{});try{assert.equal(await shareOrDownloadFile(file),"downloaded");assert.equal(link.download,file.name);}finally{restore();}}
 assert.equal(clicked,2);assert.equal(removed,2);
});
test("QRIS sharing preserves the original format and bytes and rejects failed loading",async t=>{
 t.mock.method(globalThis,"fetch",async()=>new Response(new Uint8Array(original),{headers:{"Content-Type":"image/png"}}));
 const file=await loadQrisFile("https://storage.example/qris.jpg","INV /1");assert.equal(file.name,"QRIS-INV--1.png");assert.equal(file.type,"image/png");assert.deepEqual(Buffer.from(await file.arrayBuffer()),original);
 t.mock.method(globalThis,"fetch",async()=>new Response("Forbidden",{status:403}));await assert.rejects(loadQrisFile("https://storage.example/qris.jpg","1"),/belum dapat dimuat/);
});

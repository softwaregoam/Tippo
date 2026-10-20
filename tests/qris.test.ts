import test from "node:test";
import assert from "node:assert/strict";
import { validQrisUrl, showQris, qrisExtension, validateQrisFile } from "../src/lib/qris.ts";
import { DEFAULT_INVOICE_APPEARANCE, readInvoiceAppearance, validateInvoiceTemplate } from "../src/lib/invoice-template.ts";
import { buildInvoice } from "../src/lib/invoice.ts";
import type { Order } from "../src/lib/types.ts";
const url="https://project.supabase.co/storage/v1/object/public/invoice-logos/owner/qris-1.png";
const order:Order={id:"o",batchId:"b",customerId:"c",date:"2026-10-20",createdAt:"2026-10-20T00:00:00Z",status:"new",notes:"",serviceFee:0,shippingCharge:5000,paid:10000,items:[{id:"i",product:"Roti",variant:"",color:"",size:"",quantity:1,unitPrice:25000,unitCost:12000}]};
test("QRIS is optional, requires a safe public URL, and never changes WhatsApp invoice content",()=>{
 for(const unsafe of [undefined,null,3,"http://site.test/q.png","javascript:alert(1)","data:image/png;base64,AAAA","https://user:pass@site.test/q.png"]){
  assert.equal(validQrisUrl(unsafe),false);assert.equal(readInvoiceAppearance({qrisUrl:unsafe}).qrisUrl,"");
 }
 assert.equal(validQrisUrl(""),true);assert.equal(validQrisUrl(url),true);
 const settings={invoiceStoreName:"Toko",invoicePrefix:"INV",appearance:{...DEFAULT_INVOICE_APPEARANCE,qrisUrl:url}};
 assert.equal(validateInvoiceTemplate(settings).appearance.qrisUrl,url);
 assert.equal(buildInvoice(order,undefined,undefined,settings),buildInvoice(order,undefined,undefined,{...settings,appearance:{...settings.appearance,qrisUrl:""}}));
 assert.throws(()=>validateInvoiceTemplate({...settings,appearance:{...settings.appearance,qrisUrl:"javascript:alert(1)"}}));
});
test("QRIS is available only for active orders with a remaining balance",()=>{
 assert.equal(showQris(order,url),true);assert.equal(showQris({...order,paid:30000},url),false);
 assert.equal(showQris({...order,status:"cancelled"},url),false);assert.equal(showQris(order,""),false);
 assert.equal(showQris({...order,paid:0,discount:{type:"amount",value:30000}},url),false);
 assert.equal(showQris({...order,paid:0,discount:{type:"percent",value:100}},url),true); // Shipping still outstanding.
 assert.equal(showQris({...order,status:"done",paid:10000},url),true); // Fulfilment is not payment.
});
test("QRIS rejects SVG, oversized and spoofed raster uploads before decoding",async()=>{
 assert.equal(qrisExtension("image/png"),"png");assert.equal(qrisExtension("image/jpeg"),"jpg");assert.equal(qrisExtension("image/webp"),"webp");
 for(const file of [new File(["<svg/>"],"q.svg",{type:"image/svg+xml"}),new File(["<svg/>"],"q.png",{type:"image/png"}),new File([new Uint8Array(1048577)],"q.png",{type:"image/png"}),new File([],"q.png",{type:"image/png"})])await assert.rejects(validateQrisFile(file));
});

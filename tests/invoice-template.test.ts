import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_INVOICE_APPEARANCE,readInvoiceAppearance,validateInvoiceTemplate,validLogoUrl} from "../src/lib/invoice-template.ts";
import {buildInvoice} from "../src/lib/invoice.ts";
import type {Order} from "../src/lib/types.ts";
test("invoice appearance accepts only safe image URLs and normalized settings",()=>{
 assert.deepEqual(readInvoiceAppearance({color:"red",layout:"x",logoUrl:"javascript:alert(1)",footer:1}),DEFAULT_INVOICE_APPEARANCE);
 for(const url of ["javascript:alert(1)","data:image/svg+xml;base64,PHN2Zz4=","http://site.test/logo.png","https://user:password@site.test/logo.png"])assert.equal(validLogoUrl(url),false);
 assert.equal(validLogoUrl("https://site.test/logo.png"),true);assert.equal(validLogoUrl("data:image/webp;base64,AAAA"),true);
 const next=validateInvoiceTemplate({invoiceStoreName:" toko ",invoicePrefix:" naya ",appearance:{...DEFAULT_INVOICE_APPEARANCE,color:"#aabbcc",layout:"minimal",footer:""}});assert.equal(next.invoiceStoreName,"toko");assert.equal(next.invoicePrefix,"NAYA");assert.equal(next.appearance.color,"#AABBCC");assert.equal(next.appearance.footer,"");
 assert.throws(()=>validateInvoiceTemplate({...next,appearance:{...next.appearance,logoUrl:"javascript:alert(1)"}}));assert.throws(()=>validateInvoiceTemplate({...next,appearance:{...next.appearance,color:"red"}}));
});
test("WhatsApp uses configured footer and keeps logo and color out of its text",()=>{
 const order:Order={id:"order",batchId:"batch",customerId:"c",date:"2026-10-14",createdAt:"2026-10-14T00:00:00Z",status:"new",paid:0,shippingCharge:0,serviceFee:0,notes:"Secret",items:[{id:"i",product:"Produk",variant:"",color:"",size:"",quantity:1,unitPrice:10000,unitCost:5000}]};
 const template={invoiceStoreName:"Toko",invoicePrefix:"INV",appearance:{...DEFAULT_INVOICE_APPEARANCE,logoUrl:"https://site.test/logo.png",footer:"Terima kasih, Naya"}};
 const text=buildInvoice(order,undefined,undefined,template);assert.ok(text.endsWith("Terima kasih, Naya"));assert.doesNotMatch(text,/logo.png|245C4E|Secret|5\.000/);assert.ok(!buildInvoice(order,undefined,undefined,{...template,appearance:{...template.appearance,footer:""}}).includes("Terima kasih"));
});

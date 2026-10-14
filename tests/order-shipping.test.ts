import test from "node:test";
import assert from "node:assert/strict";
import {shippingFieldErrors} from "../src/lib/order-shipping.ts";
import {isAppData} from "../src/lib/validation.ts";
import {normalizeAppData} from "../src/lib/migration.ts";
import {buildInvoice} from "../src/lib/invoice.ts";
import {seedData} from "../src/lib/seed.ts";

test("shipping fields are independently optional and use actual dates and 24-hour times",()=>{
 const blank={shippingDate:"",shippingTime:"",shippingMethod:""};assert.deepEqual(shippingFieldErrors(blank),{});
 for(const shippingTime of ["00:00","13:05","23:59"])assert.deepEqual(shippingFieldErrors({...blank,shippingTime}),{});
 for(const shippingTime of ["24:00","12:60","7:05","11:00 PM"])assert.ok(shippingFieldErrors({...blank,shippingTime}).shippingTime);
 assert.deepEqual(shippingFieldErrors({...blank,shippingDate:"2028-02-29"}),{});assert.ok(shippingFieldErrors({...blank,shippingDate:"2026-02-29"}).shippingDate);
 assert.deepEqual(shippingFieldErrors({...blank,shippingMethod:"Ambil sendiri"}),{});
 const data=structuredClone(seedData);assert.ok(isAppData(data));data.orders[0].shippingDate="2026-10-20";data.orders[0].shippingTime="23:15";data.orders[0].shippingMethod="Kurir instan";assert.ok(isAppData(data));assert.deepEqual(normalizeAppData(JSON.parse(JSON.stringify(data))),data);
 assert.equal(isAppData({...data,orders:[{...data.orders[0],shippingTime:"24:30"}]}),false);assert.equal(isAppData({...data,orders:[{...data.orders[0],shippingDate:null}]}),false);
});
test("invoice includes only provided shipping fields, customer address and public order notes",()=>{
 const order={...seedData.orders[0],notes:""},batch=seedData.batches.find(batch=>batch.id===order.batchId),customer={id:"c",name:"Naya",phone:"",address:"Jalan Melati 10\nBandung"};
 const empty=buildInvoice(order,batch,{...customer,address:""});assert.doesNotMatch(empty,/\*Pengiriman\*|Tanggal :|Jam :|Metode Kirim :|\*Catatan\*|Alamat:/);
 const text=buildInvoice({...order,shippingDate:"2026-10-20",shippingTime:"23:15",shippingMethod:"Kurir instan",notes:"Tolong bungkus rapi"},batch,customer);assert.match(text,/Alamat: Jalan Melati 10 Bandung/);assert.match(text,/Tanggal : 20 Oktober 2026\nJam : 23:15\nMetode Kirim : Kurir instan/);assert.match(text,/\*Catatan\*\nTolong bungkus rapi/);
 const timeOnly=buildInvoice({...order,shippingTime:"00:00"},batch);assert.match(timeOnly,/\*Pengiriman\*\nJam : 00:00/);assert.doesNotMatch(timeOnly,/Tanggal :|Metode Kirim :/);
});

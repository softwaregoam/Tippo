import {test} from "node:test";
import assert from "node:assert/strict";
import {shoppingRecap} from "../src/lib/shopping-recap.ts";
import type {AppData,OrderItem,Order} from "../src/lib/types.ts";
const item=(quantity:number,extra:Partial<OrderItem>={}):OrderItem=>({id:"item",product:"Kaos",store:"Uniqlo",variant:"Airism",color:"Hitam",size:"L",quantity,unitPrice:25000,unitCost:12000,...extra});
const order=(id:string,customerId:string,items:OrderItem[],extra:Partial<Order>={}):Order=>({id,customerId,items,batchId:"trip",serviceFee:0,shippingCharge:0,paid:0,date:"2026-10-13",createdAt:"2026-10-13T00:00:00Z",status:"new",notes:"",...extra});
const data=(orders:Order[]):AppData=>({batches:[{id:"trip",name:"Belanja",type:"jastip",origin:"",closeDate:"2026-10-20",status:"open",directCosts:0}],products:[],customers:[{id:"a",name:"Alya",phone:""},{id:"b",name:"Bima",phone:""}],orders});
test("recap merges options and combines customer quantities without counting repeated lines as extra orders",()=>{
 const recap=shoppingRecap(data([order("1","a",[item(2),item(1)]),order("2","b",[item(2,{store:" uniqlo ",color:"hitam",size:"l"})]),order("3","a",[item(1)])]),"trip");
 assert.equal(recap.quantity,6);assert.equal(recap.orders,3);assert.equal(recap.combinations,1);
 assert.deepEqual(recap.groups[0].lines[0].customers,[{id:"a",name:"Alya",quantity:4,orders:2},{id:"b",name:"Bima",quantity:2,orders:1}]);
});
test("recap separates stores, sizes, colors and variants and excludes cancelled and foreign batches",()=>{
 const recap=shoppingRecap(data([order("1","a",[item(1),item(1,{size:"M"}),item(1,{color:"Putih"}),item(1,{variant:"Oversize"}),item(1,{store:"Muji"})]),order("2","b",[item(100)],{status:"cancelled"}),order("3","b",[item(100)],{batchId:"other"})]),"trip");
 assert.equal(recap.quantity,5);assert.equal(recap.combinations,5);assert.equal(recap.groups.length,2);assert.equal(recap.orders,1);
});
test("old order snapshots never fall back to edited masters and missing stores remain undetermined",()=>{
 const workspace=data([order("1","a",[item(2,{store:undefined,productId:"master"})])]);
 workspace.products=[{id:"master",name:"Nama berubah",variant:"Baru",store:"Toko baru",color:"Biru",size:"XL",sku:"",unitPrice:90000,unitCost:60000,active:false}];
 const recap=shoppingRecap(workspace,"trip");assert.equal(recap.groups[0].store,"Belum ditentukan");assert.equal(recap.groups[0].lines[0].product,"Kaos");assert.equal(recap.groups[0].lines[0].color,"Hitam");assert.equal(recap.groups[0].lines[0].size,"L");
});
test("empty or cancelled-only batches have no purchase requirements",()=>{
 assert.deepEqual(shoppingRecap(data([order("1","a",[item(2)],{status:"cancelled"})]),"trip"),{groups:[],orders:0,combinations:0,quantity:0});
});

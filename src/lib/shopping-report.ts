import type { AppData, OrderItem } from "./types.ts";

export interface PurchaseTotals { quantity:number; value:number; knownCost:number; missingQuantity:number; cost:number|null; shippingCharge?:number; }
export interface PurchaseProduct extends PurchaseTotals { category:string;store:string;product:string;variant:string;color:string;size:string;unitCost:number|null; }
export interface PurchasePackageProduct extends PurchaseTotals { category:string;packageName:string;product:string;variant:string;color:string;size:string;unitCost:number|null; }
export interface PurchaseShipment { id:string;recipient:string;phone:string;address:string;shippingCharge:number;packages:{packageId:string;quantity:number}[];products:{productId:string;quantity:number}[]; }
export interface PurchaseOrder { id:string;personal:boolean;customer:string;recipient:string;phone:string;address:string;date:string;items:(OrderItem & {category:string;packageName:string;recipient:string;phone:string;shipmentAddress:string})[];shipments:PurchaseShipment[];totals:PurchaseTotals; shippingCharge:number; }
const clean=(value:string|undefined)=>(value??"").trim().replace(/\s+/g," ");
const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase("id-ID");
export function purchaseTotals(items:Pick<OrderItem,"quantity"|"unitPrice"|"unitCost">[]):PurchaseTotals {
 const quantity=items.reduce((sum,item)=>sum+item.quantity,0),value=items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0);
 const knownCost=items.reduce((sum,item)=>sum+item.quantity*(item.unitCost??0),0),missingQuantity=items.reduce((sum,item)=>sum+(item.unitCost===null?item.quantity:0),0);
 if(![quantity,value,knownCost,missingQuantity].every(Number.isSafeInteger))throw new Error("Total rekap terlalu besar untuk dihitung dengan aman.");
 return {quantity,value,knownCost,missingQuantity,cost:missingQuantity?null:knownCost};
}
export function buildShoppingReport(data:AppData,batchId:string) {
 const batch=data.batches.find(batch=>batch.id===batchId);
 if(!batch)throw new Error("Batch tidak ditemukan.");
 const categories=new Map(data.products.map(product=>[product.id,clean(product.category)]));
 const catalogProducts=new Map(data.products.map(product=>[product.id,product]));
 const packageCatalog=data.packages??[];
 const customers=new Map(data.customers.map(customer=>[customer.id,customer]));
  const orders:PurchaseOrder[]=data.orders.filter(order=>order.batchId===batchId&&order.status!=="cancelled").sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(order=>{const customer=customers.get(order.customerId);const shipment=order.shipments?.[0];const customerName=order.purpose==="personal"?"Untuk sendiri":customer?.name||"Pelanggan";const recipient=shipment?.recipientName?.trim()||customerName;const phone=shipment?.phone?.trim()||customer?.phone?.trim()||"";const address=shipment?.address?.trim()||customer?.address?.trim()||"";const shipments=(order.shipments??[]).map(entry=>({id:entry.id,recipient:entry.recipientName.trim(),phone:entry.phone.trim(),address:entry.address.trim(),shippingCharge:entry.shippingCharge,packages:entry.packages,products:entry.products??[]}));return {id:order.id,personal:order.purpose==="personal",customer:customerName,recipient,phone,address,date:order.date,items:order.items.map(item=>({...item,category:batch.type==="po"?(categories.get(item.productId??"")||"Tanpa kategori"):"Tanpa kategori",packageName:item.packageId?packageCatalog.find(pack=>pack.id===item.packageId)?.name||"Paket tidak tersedia":"",recipient,phone,shipmentAddress:address})),shipments,totals:purchaseTotals(order.items),shippingCharge:order.shippingCharge??0};});
 const groups=new Map<string,{labels:string[];items:OrderItem[]}>();
 // Per produk is reserved for ordinary product items. Package items are kept
 // in orders/totals so they can be classified separately in a package recap.
 for(const order of orders)for(const item of order.items){
  if(item.packageId)continue;
  const labels=[item.category,clean(item.store)||"Tanpa toko / brand",clean(item.product),clean(item.variant),clean(item.color),clean(item.size)];
  const key=JSON.stringify([...labels.map(normalize),item.unitCost]);let group=groups.get(key);if(!group){group={labels,items:[]};groups.set(key,group);}group.items.push(item);
 }
 const products:PurchaseProduct[]=[...groups.values()].map<PurchaseProduct>(({labels,items})=>{const totals=purchaseTotals(items);return {...totals,category:labels[0],store:labels[1],product:labels[2],variant:labels[3],color:labels[4],size:labels[5],unitCost:items[0].unitCost};}).sort((a,b)=>[a.category,a.store,a.product,a.variant,a.color,a.size].join(" ").localeCompare([b.category,b.store,b.product,b.variant,b.color,b.size].join(" "),"id"));
 const packageGroups=new Map<string,{category:string;packageName:string;product:string;variant:string;color:string;size:string;unitCost:number|null;items:OrderItem[]}>();
 for(const order of orders)for(const item of order.items){
  if(!item.packageId)continue;
  const pack=packageCatalog.find(entry=>entry.id===item.packageId);if(!pack)continue;
  for(const member of pack.products){
   const product=catalogProducts.get(member.id);if(!product)continue;
   const expanded={...item,product:product.name,variant:product.variant??"",color:product.color??"",size:product.size??"",productId:product.id,quantity:item.quantity*member.quantity,unitCost:product.unitCost};
   const labels=[clean(pack.category)||"Tanpa kategori",clean(pack.name),clean(product.name),clean(product.variant),clean(product.color),clean(product.size)];
   const key=JSON.stringify([...labels.map(normalize),expanded.unitCost]);let group=packageGroups.get(key);
   if(!group){group={category:labels[0],packageName:labels[1],product:labels[2],variant:labels[3],color:labels[4],size:labels[5],unitCost:expanded.unitCost,items:[]};packageGroups.set(key,group);}group.items.push(expanded);
  }
 }
 const packageProducts:PurchasePackageProduct[]=[...packageGroups.values()].map(group=>{const totals=purchaseTotals(group.items);return {...totals,category:group.category,packageName:group.packageName,product:group.product,variant:group.variant,color:group.color,size:group.size,unitCost:group.unitCost};}).sort((a,b)=>[a.category,a.packageName,a.product,a.variant,a.color,a.size].join(" ").localeCompare([b.category,b.packageName,b.product,b.variant,b.color,b.size].join(" "),"id"));
 const categoryGroups=new Map<string,{name:string;items:PurchaseProduct[]}>();
 for(const product of products){const key=normalize(product.category);let group=categoryGroups.get(key);if(!group){group={name:product.category,items:[]};categoryGroups.set(key,group);}group.items.push(product);}
 const subtotals=(items:PurchaseProduct[]):PurchaseTotals=>{const quantity=items.reduce((s,p)=>s+p.quantity,0),value=items.reduce((s,p)=>s+p.value,0),knownCost=items.reduce((s,p)=>s+p.knownCost,0),missingQuantity=items.reduce((s,p)=>s+p.missingQuantity,0);return {quantity,value,knownCost,missingQuantity,cost:missingQuantity?null:knownCost};};
  return {batch,orders,products,packageProducts,categories:[...categoryGroups.values()].map(group=>({...group,totals:subtotals(group.items)})),totals:{...purchaseTotals(orders.flatMap(order=>order.items)),shippingCharge:orders.reduce((sum,order)=>sum+order.shippingCharge,0)}};
}
export type ShoppingReport=ReturnType<typeof buildShoppingReport>;

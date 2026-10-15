import type { AppData, OrderItem } from "./types.ts";

export interface PurchaseTotals { quantity:number; value:number; knownCost:number; missingQuantity:number; cost:number|null; }
export interface PurchaseProduct extends PurchaseTotals { category:string;store:string;product:string;variant:string;color:string;size:string;unitPrice:number;unitCost:number|"Bervariasi"|null; }
export interface PurchaseOrder { id:string;customer:string;date:string;items:(OrderItem & {category:string})[];totals:PurchaseTotals; }
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
 const names=new Map(data.customers.map(customer=>[customer.id,customer.name]));
 const orders:PurchaseOrder[]=data.orders.filter(order=>order.batchId===batchId&&order.status!=="cancelled").sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(order=>({id:order.id,customer:names.get(order.customerId)||"Pelanggan",date:order.date,items:order.items.map(item=>({...item,category:batch.type==="po"?(categories.get(item.productId??"")||"Tanpa kategori"):"Tanpa kategori"})),totals:purchaseTotals(order.items)}));
 const groups=new Map<string,{labels:string[];items:OrderItem[]}>();
 for(const order of orders)for(const item of order.items){
  const labels=[item.category,clean(item.store)||"Tanpa toko / brand",clean(item.product),clean(item.variant),clean(item.color),clean(item.size)];
  const key=JSON.stringify([...labels.map(normalize),item.unitPrice]);let group=groups.get(key);if(!group){group={labels,items:[]};groups.set(key,group);}group.items.push(item);
 }
 const products:PurchaseProduct[]=[...groups.values()].map<PurchaseProduct>(({labels,items})=>{const prices=new Set(items.map(item=>item.unitCost));const totals=purchaseTotals(items);return {...totals,category:labels[0],store:labels[1],product:labels[2],variant:labels[3],color:labels[4],size:labels[5],unitPrice:items[0].unitPrice,unitCost:prices.has(null)?null:prices.size===1?items[0].unitCost:"Bervariasi"};}).sort((a,b)=>[a.category,a.store,a.product,a.variant,a.color,a.size].join(" ").localeCompare([b.category,b.store,b.product,b.variant,b.color,b.size].join(" "),"id"));
 const categoryGroups=new Map<string,{name:string;items:PurchaseProduct[]}>();
 for(const product of products){const key=normalize(product.category);let group=categoryGroups.get(key);if(!group){group={name:product.category,items:[]};categoryGroups.set(key,group);}group.items.push(product);}
 const subtotals=(items:PurchaseProduct[]):PurchaseTotals=>{const quantity=items.reduce((s,p)=>s+p.quantity,0),value=items.reduce((s,p)=>s+p.value,0),knownCost=items.reduce((s,p)=>s+p.knownCost,0),missingQuantity=items.reduce((s,p)=>s+p.missingQuantity,0);return {quantity,value,knownCost,missingQuantity,cost:missingQuantity?null:knownCost};};
 return {batch,orders,products,categories:[...categoryGroups.values()].map(group=>({...group,totals:subtotals(group.items)})),totals:purchaseTotals(orders.flatMap(order=>order.items))};
}
export type ShoppingReport=ReturnType<typeof buildShoppingReport>;

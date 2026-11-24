import type { AppData, OrderItem } from "./types.ts";

export interface PurchaseTotals { quantity:number; value:number; knownCost:number; missingQuantity:number; cost:number|null; shippingCharge?:number; }
export interface PurchaseProduct extends PurchaseTotals { category:string;packageName?:string;store:string;product:string;variant:string;color:string;size:string;unitCost:number|null; }
type ReportItem = OrderItem & { category:string; packageName?:string };
// ReportItem keeps the originating package visible while its members are expanded.
export interface PurchaseOrder { id:string;personal:boolean;customer:string;address:string;date:string;items:ReportItem[];totals:PurchaseTotals; shippingCharge:number; }
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
 const customers=new Map(data.customers.map(customer=>[customer.id,customer]));
 const expandItem=(item:OrderItem):OrderItem[]=>{const pack=item.packageId?data.packages?.find(candidate=>candidate.id===item.packageId):data.packages?.find(candidate=>candidate.name.trim().toLocaleLowerCase("id-ID")===item.product.trim().toLocaleLowerCase("id-ID"));if(!pack)return [item];return pack.products.map(member=>{const product=data.products.find(candidate=>candidate.id===member.id);return {...item,id:`${item.id}-${member.id}`,packageId:null,productId:member.id,packageName:pack.name,product:product?.name??item.product,variant:product?.variant??"",store:product?.store??"",color:product?.color??"",size:product?.size??"",quantity:item.quantity*member.quantity,unitPrice:product?.unitPrice??item.unitPrice,unitCost:product?.unitCost??item.unitCost};});};
  const orders:PurchaseOrder[]=data.orders.filter(order=>order.batchId===batchId&&order.status!=="cancelled").sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(order=>({id:order.id,personal:order.purpose==="personal",customer:order.purpose==="personal"?"Untuk sendiri":customers.get(order.customerId)?.name||"Pelanggan",address:customers.get(order.customerId)?.address?.trim()||"",date:order.date,items:order.items.flatMap(item=>{const pack=item.packageId?data.packages?.find(candidate=>candidate.id===item.packageId):data.packages?.find(candidate=>candidate.name.trim().toLocaleLowerCase("id-ID")===item.product.trim().toLocaleLowerCase("id-ID"));if(pack)return pack.products.map(member=>{const product=data.products.find(candidate=>candidate.id===member.id);return {...item,id:`${item.id}-${member.id}`,productId:member.id,packageId:null,product:product?.name??item.product,variant:product?.variant??"",store:product?.store??"",color:product?.color??"",size:product?.size??"",quantity:item.quantity*member.quantity,unitPrice:product?.unitPrice??item.unitPrice,unitCost:product?.unitCost??item.unitCost,category:batch.type==="po"?(clean(pack.category)||"Tanpa kategori"):"Tanpa kategori"};});return [{...item,category:batch.type==="po"?(categories.get(item.productId??"")||"Tanpa kategori"):"Tanpa kategori"}];}),totals:purchaseTotals(order.items.flatMap(expandItem)),shippingCharge:order.shippingCharge??0}));
 const groups=new Map<string,{labels:string[];items:ReportItem[]}>();
 for(const order of orders)for(const item of order.items){
  const labels=[item.category,clean(item.store)||"Tanpa toko / brand",clean(item.product),clean(item.variant),clean(item.color),clean(item.size)];
  const key=JSON.stringify([...labels.map(normalize),item.unitCost]);let group=groups.get(key);if(!group){group={labels,items:[]};groups.set(key,group);}group.items.push(item);
 }
 const products:PurchaseProduct[]=[...groups.values()].map<PurchaseProduct>(({labels,items})=>{const totals=purchaseTotals(items);return {...totals,category:labels[0],packageName:items[0].packageName,store:labels[1],product:labels[2],variant:labels[3],color:labels[4],size:labels[5],unitCost:items[0].unitCost};}).sort((a,b)=>[a.category,a.store,a.product,a.variant,a.color,a.size].join(" ").localeCompare([b.category,b.store,b.product,b.variant,b.color,b.size].join(" "),"id"));
 const categoryGroups=new Map<string,{name:string;items:PurchaseProduct[]}>();
 for(const product of products){const key=normalize(product.category);let group=categoryGroups.get(key);if(!group){group={name:product.category,items:[]};categoryGroups.set(key,group);}group.items.push(product);}
 const subtotals=(items:PurchaseProduct[]):PurchaseTotals=>{const quantity=items.reduce((s,p)=>s+p.quantity,0),value=items.reduce((s,p)=>s+p.value,0),knownCost=items.reduce((s,p)=>s+p.knownCost,0),missingQuantity=items.reduce((s,p)=>s+p.missingQuantity,0);return {quantity,value,knownCost,missingQuantity,cost:missingQuantity?null:knownCost};};
  return {batch,orders,products,categories:[...categoryGroups.values()].map(group=>({...group,totals:subtotals(group.items)})),totals:{...purchaseTotals(orders.flatMap(order=>order.items)),shippingCharge:orders.reduce((sum,order)=>sum+order.shippingCharge,0)}};
}
export type ShoppingReport=ReturnType<typeof buildShoppingReport>;

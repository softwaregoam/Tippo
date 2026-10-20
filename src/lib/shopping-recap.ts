import type { AppData } from "./types.ts";

export interface ShoppingLine {
 key:string; product:string; variant:string; color:string; size:string; quantity:number;
 customers:{id:string;name:string;quantity:number;orders:number}[];
}
export interface ShoppingGroup { key:string;store:string;quantity:number;lines:ShoppingLine[]; }
const label=(value:string|undefined)=>(value??"").trim().replace(/\s+/g," ");
const normalize=(value:string)=>value.normalize("NFKC").toLocaleLowerCase("id-ID");
export function shoppingRecap(data:AppData,batchId:string) {
 const orders=data.orders.filter(order=>order.batchId===batchId && order.status!=="cancelled");
 const names=new Map(data.customers.map(customer=>[customer.id,customer.name]));
 const groups=new Map<string,ShoppingGroup>();
 const customerOrders=new Map<string,Set<string>>();
 const linesByKey=new Map<string,ShoppingLine>();
 const customersByKey=new Map<string,ShoppingLine["customers"][number]>();
 for(const order of orders)for(const item of order.items){
  // Use saved order snapshots, including missing stores in older orders.
  const store=label(item.store),storeKey=normalize(store);
  let group=groups.get(storeKey);
  if(!group){group={key:storeKey,store:store||"Belum ditentukan",quantity:0,lines:[]};groups.set(storeKey,group);}
  const options=[item.product,item.variant,item.color,item.size].map(label);
  const key=JSON.stringify([storeKey,...options.map(normalize)]);
  let line=linesByKey.get(key);
  if(!line){line={key,product:options[0],variant:options[1],color:options[2],size:options[3],quantity:0,customers:[]};group.lines.push(line);linesByKey.set(key,line);}
  group.quantity+=item.quantity;line.quantity+=item.quantity;
  const customerKey=JSON.stringify([key,order.customerId]);
  let customer=customersByKey.get(customerKey);
  if(!customer){customer={id:order.customerId,name:order.purpose==="personal"?"Untuk sendiri":names.get(order.customerId)??"Pelanggan",quantity:0,orders:0};line.customers.push(customer);customersByKey.set(customerKey,customer);}
  customer.quantity+=item.quantity;
  let ids=customerOrders.get(customerKey);if(!ids){ids=new Set();customerOrders.set(customerKey,ids);}ids.add(order.id);customer.orders=ids.size;
 }
 const sorted=[...groups.values()].sort((a,b)=>a.key===""?1:b.key===""?-1:a.store.localeCompare(b.store,"id"));
 for(const group of sorted){group.lines.sort((a,b)=>[a.product,a.variant,a.color,a.size].join(" ").localeCompare([b.product,b.variant,b.color,b.size].join(" "),"id"));for(const line of group.lines)line.customers.sort((a,b)=>a.name.localeCompare(b.name,"id"));}
 return {groups:sorted,orders:orders.length,combinations:sorted.reduce((sum,group)=>sum+group.lines.length,0),quantity:sorted.reduce((sum,group)=>sum+group.quantity,0)};
}

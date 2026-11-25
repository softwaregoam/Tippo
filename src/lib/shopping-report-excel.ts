import { hasEstimatedCost } from "./purchase-fx.ts";
import { formatCalendarDate } from "./calendar-date.ts";
import type { Worksheet } from "exceljs";
import type { ShoppingReport } from "./shopping-report.ts";

const missing="Belum lengkap";
function shipmentQuantity(shipment:{packages:{packageId:string;quantity:number}[];products:{productId:string;quantity:number}[]},id:string,kind:"package"|"product") { const entries=kind==="package"?shipment.packages:shipment.products; return entries.find(entry=>kind==="package"?"packageId" in entry&&entry.packageId===id:"productId" in entry&&entry.productId===id)?.quantity??0; }
function packageMemberRows(report:ShoppingReport,item:ShoppingReport["orders"][number]["items"][number]) { const pack=item.packageId?report.packageCatalog.find(entry=>entry.id===item.packageId):undefined; if(!pack){const product=report.catalogProducts.find(entry=>entry.id===item.productId)||report.catalogProducts.find(entry=>entry.name.trim().toLocaleLowerCase("id-ID")===item.product.trim().toLocaleLowerCase("id-ID"));return [{...item,category:product?.category??item.category,unitPrice:product?.unitPrice??item.unitPrice}];} return pack.products.flatMap(member=>{const product=report.catalogProducts.find(entry=>entry.id===member.id);return product?[{...item,category:pack.category?.trim()||"Tanpa kategori",product:product.name,variant:product.variant??"",color:product.color??"",size:product.size??"",productId:product.id,packageId:item.packageId,quantity:item.quantity*member.quantity,unitPrice:product.unitPrice,unitCost:product.unitCost}]:[];}); }
function displayedItems(report:ShoppingReport,order:ShoppingReport["orders"][number]) { return order.items.flatMap(item=>packageMemberRows(report,item)); }
function reportOrderDiscount(order:ShoppingReport["orders"][number],base:number) { const discount=order.discount;if(order.personal||!discount)return order.globalDiscountAmount;if(discount.type==="amount")return Math.min(base+order.shippingCharge,discount.value)+order.globalDiscountAmount;if(discount.value>100)return order.globalDiscountAmount;return Math.round(base*discount.value/100)+order.globalDiscountAmount; }
export async function createShoppingReportExcel(report:ShoppingReport,kind:"products"|"packages"|"orders"):Promise<Uint8Array> {
 const ExcelJS=(await import("exceljs")).default;
 const book=new ExcelJS.Workbook();book.creator="Tippo";
 const po=report.batch.type==="po",color=po?"FF94501F":"FF245C4E";
 type Column={header:string;key:string;width:number;money?:boolean};
 const quantity:Column={header:"Qty",key:"quantity",width:12};
 function prepare(name:string,columns:Column[]) {
  const sheet=book.addWorksheet(name);sheet.columns=columns.map(({key,width,money})=>({key,width,style:{numFmt:money?'#,##0;[Red]-#,##0':'General'}}));
  for(const text of [`Rekap ${po?"Open PO":"Jastip"} · ${name}`,report.batch.name+(report.orders.some(order=>hasEstimatedCost(order))?(kind==="orders"?" · HPP/margin mencakup kurs estimasi":" · Harga beli mencakup kurs estimasi"):"")]){const row=sheet.addRow([text]);sheet.mergeCells(row.number,1,row.number,columns.length);row.alignment={vertical:"middle",wrapText:true};row.height=26;}
  const header=sheet.addRow(columns.map(column=>column.header));header.font={bold:true,color:{argb:"FFFFFFFF"}};header.fill={type:"pattern",pattern:"solid",fgColor:{argb:color}};header.alignment={wrapText:true,vertical:"middle"};header.height=32;
  // ExcelJS emits outlinePr after pageSetUpPr when outlineProperties is set; that order is invalid in XLSX.
  sheet.views=[{state:"frozen",ySplit:3,activeCell:"A4"}];
  sheet.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};sheet.pageSetup.printTitlesRow="1:3";
  return sheet;
 }
 function subtotal(sheet:Worksheet,values:Record<string,unknown>,grand=false) {
  const row=sheet.addRow(values);row.font={bold:true,color:{argb:grand?"FFFFFFFF":"FF25312E"}};row.fill={type:"pattern",pattern:"solid",fgColor:{argb:grand?color:"FFF1EEE5"}};return row;
 }
 const estimated=report.orders.some(order=>hasEstimatedCost(order));
 const palette=["FFFFF2CC","FFD9E2F3","FFF4CCCC","FFD9EAD3","FFD9EAF0"];
 if(kind==="products"){
 const products=prepare("Per produk",[
  {header:po?"Kategori":"Toko / brand",key:"group",width:25},{header:"Produk",key:"product",width:48},quantity,
  {header:"Harga beli / unit",key:"unitCost",width:22,money:true},{header:"Subtotal beli",key:"cost",width:22,money:true},
  {header:"Total qty grup",key:"groupQuantity",width:18},{header:"Total beli grup",key:"groupValue",width:25,money:true},
 ]);
 products.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF202622"}};
 products.getRow(3).alignment={vertical:"middle",horizontal:"center",wrapText:true};
 products.views=[{state:"frozen",ySplit:3,xSplit:2,activeCell:"C4",showGridLines:false}];
 for(const index of [4,5,7])products.getColumn(index).numFmt='"Rp" #,##0;[Red]-"Rp" #,##0';
 const storeGroups=new Map<string,{name:string;items:ShoppingReport["products"]}>();
 if(!po)for(const product of report.products){const key=product.store.normalize("NFKC").toLocaleLowerCase("id-ID");let group=storeGroups.get(key);if(!group){group={name:product.store,items:[]};storeGroups.set(key,group);}group.items.push(product);}
 const groups=po?report.categories:[...storeGroups.values()];
 for(const [index,group] of groups.entries()){
  const start=products.rowCount+1,fill=palette[index%palette.length];
  const groupQuantity=group.items.reduce((sum,product)=>sum+product.quantity,0),groupValue=group.items.some(product=>product.cost===null)?null:group.items.reduce((sum,product)=>sum+product.knownCost,0);
  for(const [line,product] of group.items.entries()){
   const label=[[product.product,product.variant].filter(Boolean).join(" "),product.color,product.size,...(po&&product.store!=="Tanpa toko / brand"?[`Toko: ${product.store}`]:[])].filter(Boolean).join(" · ");
   const row=products.addRow({group:line===0?group.name:undefined,product:label,quantity:product.quantity,unitCost:product.unitCost??missing,cost:product.cost??missing,groupQuantity:line===0?groupQuantity:undefined,groupValue:line===0?(groupValue??missing):undefined});
   row.height=Math.max(28,Math.ceil(label.length/48)*16+8,Math.ceil((Math.ceil(group.name.length/22)*16+8)/group.items.length));
   for(let column=1;column<=7;column++){
    const cell=row.getCell(column);cell.font={name:"Arial",size:11,color:{argb:cell.value===missing?"FFA75B1E":"FF25312E"},bold:[1,6,7].includes(column)};
    cell.alignment={vertical:"middle",horizontal:[1,3,6].includes(column)?"center":[4,5,7].includes(column)?"right":"left",wrapText:true};
    cell.border={top:{style:"thin",color:{argb:"FFAAB3AD"}},bottom:{style:"thin",color:{argb:"FFAAB3AD"}},left:{style:"thin",color:{argb:"FFAAB3AD"}},right:{style:"thin",color:{argb:"FFAAB3AD"}}};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:column===3?"FFFFF3B0":column===5?"FFD9EEE2":column===4?"FFFFFFFF":fill}};
   }
  }
  const end=products.rowCount;if(end>start)for(const column of [1,6,7])products.mergeCells(start,column,end,column);
 }
 const productTotals=report.products.reduce((totals,product)=>({quantity:totals.quantity+product.quantity,cost:totals.cost===null||product.cost===null?null:totals.cost+product.knownCost}),{quantity:0,cost:0 as number|null});
 const total=subtotal(products,{group:"TOTAL KESELURUHAN",groupQuantity:productTotals.quantity,groupValue:productTotals.cost??missing},true);
 products.mergeCells(total.number,1,total.number,5);total.height=30;total.alignment={vertical:"middle",horizontal:"right"};total.getCell(6).alignment={vertical:"middle",horizontal:"center"};
 }
 if(kind==="packages"){
  const packages=prepare("Per paket",[
   {header:"Kategori",key:"category",width:25},{header:"Paket",key:"packageName",width:32},{header:"Produk",key:"product",width:48},quantity,
   {header:"Harga beli / unit",key:"unitCost",width:22,money:true},{header:"Subtotal beli",key:"cost",width:22,money:true},{header:"Total qty grup",key:"groupQuantity",width:18},{header:"Total beli grup",key:"groupValue",width:25,money:true},
  ]);
  packages.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF202622"}};packages.getRow(3).alignment={vertical:"middle",horizontal:"center",wrapText:true};
  packages.views=[{state:"frozen",ySplit:3,xSplit:3,activeCell:"D4",showGridLines:false}];
  for(const index of [5,6,8])packages.getColumn(index).numFmt='"Rp" #,##0;[Red]-"Rp" #,##0';
  const groups=new Map<string,ShoppingReport["packageProducts"]>();
  for(const product of report.packageProducts){const key=`${product.category}\u0000${product.packageName}`;const group=groups.get(key)??[];group.push(product);groups.set(key,group);}
  for(const [index,group] of [...groups.values()].entries()){
   const start=packages.rowCount+1,fill=palette[index%palette.length],groupQuantity=group.reduce((sum,product)=>sum+product.quantity,0),groupValue=group.some(product=>product.cost===null)?null:group.reduce((sum,product)=>sum+product.knownCost,0);
   for(const [line,product] of group.entries()){
    const label=[product.product,product.variant,product.color,product.size].filter(Boolean).join(" · ");
    const row=packages.addRow({category:line===0?product.category:undefined,packageName:line===0?product.packageName:undefined,product:label,quantity:product.quantity,unitCost:product.unitCost??missing,cost:product.cost??missing,groupQuantity:line===0?groupQuantity:undefined,groupValue:line===0?(groupValue??missing):undefined});
    row.height=Math.max(28,Math.ceil(label.length/48)*16+8);
    for(let column=1;column<=8;column++){const cell=row.getCell(column);cell.font={name:"Arial",size:11,color:{argb:cell.value===missing?"FFA75B1E":"FF25312E"},bold:[1,2,7,8].includes(column)};cell.alignment={vertical:"middle",horizontal:[1,2,4,7].includes(column)?"center":column===5||column===6||column===8?"right":"left",wrapText:true};cell.border={top:{style:"thin",color:{argb:"FFAAB3AD"}},bottom:{style:"thin",color:{argb:"FFAAB3AD"}},left:{style:"thin",color:{argb:"FFAAB3AD"}},right:{style:"thin",color:{argb:"FFAAB3AD"}}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:column===4?"FFFFF3B0":column===5?"FFFFFFFF":column===6?"FFD9EEE2":fill}};}
   }
   const end=packages.rowCount;if(end>start)for(const column of [1,2,7,8])packages.mergeCells(start,column,end,column);
  }
  const packageTotals=report.packageProducts.reduce((totals,product)=>({quantity:totals.quantity+product.quantity,cost:totals.cost===null||product.cost===null?null:totals.cost+product.knownCost}),{quantity:0,cost:0 as number|null});
  const total=subtotal(packages,{category:"TOTAL KESELURUHAN",groupQuantity:packageTotals.quantity,groupValue:packageTotals.cost??missing},true);packages.mergeCells(total.number,1,total.number,6);total.height=30;total.alignment={vertical:"middle",horizontal:"right"};total.getCell(7).alignment={vertical:"middle",horizontal:"center"};
 }
 if(kind==="orders"){
  const orders=prepare("Per pesanan",[
  {header:"Pemesan",key:"customer",width:30},{header:"Penerima",key:"recipient",width:30},{header:"Telepon Penerima",key:"phone",width:20},{header:"Alamat Kirim",key:"address",width:38},{header:"Paket",key:"packageName",width:30},{header:"Kategori",key:"category",width:25},{header:"Produk",key:"product",width:48},quantity,
  {header:"Harga jual / unit",key:"unitPrice",width:22,money:true},{header:"Subtotal jual produk",key:"value",width:22,money:true},{header:"Total pesanan",key:"orderValue",width:24,money:true},{header:"Ongkir",key:"shippingCharge",width:18,money:true},{header:"Diskon",key:"discount",width:18,money:true},
  {header:"Harga beli / unit",key:"unitCost",width:22,money:true},{header:"Subtotal beli",key:"itemCost",width:22,money:true},{header:"HPP pelanggan",key:"cost",width:22,money:true},{header:"Margin usaha",key:"margin",width:22,money:true},
 ]);
 orders.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF202622"}};orders.getRow(3).alignment={vertical:"middle",horizontal:"center",wrapText:true};
 orders.views=[{state:"frozen",ySplit:3,xSplit:3,activeCell:"D4",showGridLines:false}];
  for(const index of [9,10,11,12,13,14,15,16,17])orders.getColumn(index).numFmt='"Rp" #,##0;[Red]-"Rp" #,##0';
 for(const [index,order] of report.orders.entries()){
  const start=orders.rowCount+1,fill=palette[index%palette.length],shownItems=displayedItems(report,order),shownTotals=shownItems.reduce((totals,item)=>({value:totals.value+item.quantity*item.unitPrice,cost:totals.cost===null||item.unitCost===null?null:totals.cost+item.quantity*item.unitCost}),{value:0,cost:0 as number|null});
  const shipmentRows=order.shipments.length?order.shipments.flatMap((shipment,shipmentIndex)=>{const allocated=order.items.flatMap(item=>{const quantity=item.packageId?(shipmentQuantity(shipment,item.packageId,"package")):(shipmentQuantity(shipment,item.productId??"product","product"));return quantity?packageMemberRows(report,{...item,quantity}).map(member=>({item:member,shipment,shipmentIndex})):[];});return allocated.length?allocated:[{item:{...order.items[0],quantity:0,product:""},shipment,shipmentIndex}];}):order.items.flatMap(item=>packageMemberRows(report,item).map(member=>({item:member,shipment:{id:"",recipient:order.recipient,phone:order.phone,address:order.address,shippingCharge:order.shippingCharge,packages:[],products:[]},shipmentIndex:0})));
  for(const [line,rowData] of shipmentRows.entries()){
   const {item,shipment,shipmentIndex}=rowData;const firstOrderRow=line===0;const firstShipmentRow=line===0||shipmentRows[line-1].shipmentIndex!==shipmentIndex;
   const options=[item.color,item.size,...(po&&item.category!=="Tanpa kategori"?[`Kategori: ${item.category}`]:[]),...(item.store?[`Toko: ${item.store}`]:[]),...(item.purchaseFx?[`Harga beli: ${item.purchaseFx.amount??"?"} ${item.purchaseFx.currency}; 1 ${item.purchaseFx.currency} = Rp${item.purchaseFx.rate??"?"} (${item.purchaseFx.status==="estimate"?"estimasi":"final"})`]:[])].filter(Boolean).join(" · ");
   const label=[item.product,item.variant].filter(Boolean).join(" ")+(options?`\n${options}`:"");
    const row=orders.addRow({customer:firstOrderRow?{richText:[{text:order.customer,font:{bold:true,size:11}},{text:`\n${formatCalendarDate(order.date)}`,font:{bold:false,size:10,color:{argb:"FF626862"}}}]}:undefined,recipient:firstShipmentRow?shipment.recipient:undefined,phone:firstShipmentRow?shipment.phone:undefined,address:firstShipmentRow?shipment.address:undefined,packageName:item.packageName||undefined,category:item.category||"Tanpa kategori",product:label,quantity:item.quantity,unitPrice:item.unitPrice,value:item.quantity*item.unitPrice,orderValue:firstOrderRow?shownTotals.value:undefined,shippingCharge:firstShipmentRow?shipment.shippingCharge:undefined,discount:firstOrderRow?reportOrderDiscount(order,shownTotals.value):undefined,unitCost:item.unitCost??missing,itemCost:item.unitCost===null?missing:item.quantity*item.unitCost,cost:firstOrderRow?(order.personal?"—":shownTotals.cost??missing):undefined,margin:firstOrderRow?(order.personal?"—":shownTotals.cost===null?missing:shownTotals.value-shownTotals.cost):undefined});
   const identityHeight=(Math.ceil(order.customer.length/28)+1)*16+8;
   const addressHeight=shipment.address.split("\n").reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/36)),0)*16+8;
   row.height=Math.max(30,label.split("\n").reduce((sum,line)=>sum+Math.ceil(line.length/48),0)*16+8,Math.ceil(Math.max(identityHeight,addressHeight)/shipmentRows.length));
    for(let column=1;column<=17;column++){
     const cell=row.getCell(column);cell.font={name:"Arial",size:11,color:{argb:cell.value===missing?"FFA75B1E":"FF25312E"},bold:[1,2,3,5,6,12,16,17].includes(column)};
     cell.alignment={vertical:"middle",horizontal:column===8?"center":[9,10,11,12,13,14,15,16,17].includes(column)?"right":"left",wrapText:true};
     cell.border={top:{style:"thin",color:{argb:"FFAAB3AD"}},bottom:{style:"thin",color:{argb:"FFAAB3AD"}},left:{style:"thin",color:{argb:"FFAAB3AD"}},right:{style:"thin",color:{argb:"FFAAB3AD"}}};
     cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:column===8?"FFFFF3B0":[9,10,11,12,13,14,15].includes(column)?"FFFFFFFF":fill}};
    }
   }
  const end=orders.rowCount;if(end>start)for(const column of [1,11,16,17])orders.mergeCells(start,column,end,column);
  for(let shipmentStart=0;shipmentStart<shipmentRows.length;){const shipmentIndex=shipmentRows[shipmentStart].shipmentIndex;let shipmentEnd=shipmentStart+1;while(shipmentEnd<shipmentRows.length&&shipmentRows[shipmentEnd].shipmentIndex===shipmentIndex)shipmentEnd++;if(shipmentEnd-shipmentStart>1)for(const column of [2,3,4,13])orders.mergeCells(start+shipmentStart,column,start+shipmentEnd-1,column);shipmentStart=shipmentEnd;}
 }
 if(report.orders.some(order=>order.personal))subtotal(orders,{customer:"BELANJA SENDIRI",itemCost:report.orders.filter(order=>order.personal).reduce((sum,order)=>sum+order.totals.knownCost,0)});
  const displayedTotals=report.orders.reduce((totals,order)=>{const items=displayedItems(report,order);const value=items.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0);const cost=items.some(item=>item.unitCost===null)?null:items.reduce((sum,item)=>sum+item.quantity*(item.unitCost??0),0);return {quantity:totals.quantity+items.reduce((sum,item)=>sum+item.quantity,0),value:totals.value+value,cost:totals.cost===null||cost===null?null:totals.cost+cost,shipping:totals.shipping+order.shippingCharge,discount:totals.discount+reportOrderDiscount(order,value)};},{quantity:0,value:0,cost:0 as number|null,shipping:0,discount:0});
  const orderTotal=subtotal(orders,{customer:estimated?"TOTAL KESELURUHAN · ESTIMASI":"TOTAL KESELURUHAN",quantity:displayedTotals.quantity,itemCost:displayedTotals.cost??missing,orderValue:displayedTotals.value,shippingCharge:displayedTotals.shipping,discount:displayedTotals.discount,cost:displayedTotals.cost??missing,margin:displayedTotals.cost===null?missing:displayedTotals.value-displayedTotals.cost},true);
 orders.mergeCells(orderTotal.number,1,orderTotal.number,8);orderTotal.height=30;orderTotal.alignment={vertical:"middle",horizontal:"right"};orderTotal.getCell(9).alignment={vertical:"middle",horizontal:"center"};
 }
 return new Uint8Array(await book.xlsx.writeBuffer());
}

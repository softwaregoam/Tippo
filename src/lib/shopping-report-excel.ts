import { formatCalendarDate } from "./calendar-date.ts";
import type { Worksheet } from "exceljs";
import type { ShoppingReport } from "./shopping-report.ts";

const missing="Belum lengkap";
export async function createShoppingReportExcel(report:ShoppingReport):Promise<Uint8Array> {
 const ExcelJS=(await import("exceljs")).default;
 const book=new ExcelJS.Workbook();book.creator="Tippo";
 const po=report.batch.type==="po",color=po?"FF94501F":"FF245C4E";
 type Column={header:string;key:string;width:number;money?:boolean};
 const quantity:Column={header:"Qty",key:"quantity",width:12};
 function prepare(name:string,columns:Column[]) {
  const sheet=book.addWorksheet(name);sheet.columns=columns.map(({key,width,money})=>({key,width,style:{numFmt:money?'#,##0;[Red]-#,##0':'General'}}));
  for(const text of [`Rekap ${po?"Open PO":"Jastip"} · ${name}`,report.batch.name]){const row=sheet.addRow([text]);sheet.mergeCells(row.number,1,row.number,columns.length);row.alignment={vertical:"middle",wrapText:true};row.height=26;}
  const header=sheet.addRow(columns.map(column=>column.header));header.font={bold:true,color:{argb:"FFFFFFFF"}};header.fill={type:"pattern",pattern:"solid",fgColor:{argb:color}};header.alignment={wrapText:true,vertical:"middle"};header.height=32;
  sheet.views=[{state:"frozen",ySplit:3}];sheet.properties.outlineProperties={summaryBelow:true,summaryRight:true};
  sheet.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};sheet.pageSetup.printTitlesRow="1:3";
  return sheet;
 }
 function subtotal(sheet:Worksheet,values:Record<string,unknown>,grand=false) {
  const row=sheet.addRow(values);row.font={bold:true,color:{argb:grand?"FFFFFFFF":"FF25312E"}};row.fill={type:"pattern",pattern:"solid",fgColor:{argb:grand?color:"FFF1EEE5"}};return row;
 }
 const products=prepare("Per produk",[
  {header:po?"Kategori":"Toko / brand",key:"group",width:25},{header:"Produk",key:"product",width:48},quantity,
  {header:"Harga jual / unit",key:"unitPrice",width:22,money:true},{header:"Total",key:"value",width:22,money:true},
  {header:"Total qty grup",key:"groupQuantity",width:18},{header:"Total harga grup",key:"groupValue",width:25,money:true},
 ]);
 products.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF202622"}};
 products.getRow(3).alignment={vertical:"middle",horizontal:"center",wrapText:true};
 products.views=[{state:"frozen",ySplit:3,xSplit:2,showGridLines:false}];
 for(const index of [4,5,7])products.getColumn(index).numFmt='"Rp" #,##0;[Red]-"Rp" #,##0';
 const storeGroups=new Map<string,{name:string;items:ShoppingReport["products"]}>();
 if(!po)for(const product of report.products){const key=product.store.normalize("NFKC").toLocaleLowerCase("id-ID");let group=storeGroups.get(key);if(!group){group={name:product.store,items:[]};storeGroups.set(key,group);}group.items.push(product);}
 const groups=po?report.categories:[...storeGroups.values()];
 const palette=["FFFFF2CC","FFD9E2F3","FFF4CCCC","FFD9EAD3","FFD9EAF0"];
 for(const [index,group] of groups.entries()){
  const start=products.rowCount+1,fill=palette[index%palette.length];
  const groupQuantity=group.items.reduce((sum,product)=>sum+product.quantity,0),groupValue=group.items.reduce((sum,product)=>sum+product.value,0);
  for(const [line,product] of group.items.entries()){
   const label=[[product.product,product.variant].filter(Boolean).join(" "),product.color,product.size,...(po&&product.store!=="Tanpa toko / brand"?[`Toko: ${product.store}`]:[])].filter(Boolean).join(" · ");
   const row=products.addRow({group:line===0?group.name:undefined,product:label,quantity:product.quantity,unitPrice:product.unitPrice,value:product.value,groupQuantity:line===0?groupQuantity:undefined,groupValue:line===0?groupValue:undefined});
   row.height=Math.max(28,Math.ceil(label.length/48)*16+8,Math.ceil((Math.ceil(group.name.length/22)*16+8)/group.items.length));
   for(let column=1;column<=7;column++){
    const cell=row.getCell(column);cell.font={name:"Arial",size:11,color:{argb:"FF25312E"},bold:[1,6,7].includes(column)};
    cell.alignment={vertical:"middle",horizontal:[1,3,6].includes(column)?"center":[4,5,7].includes(column)?"right":"left",wrapText:true};
    cell.border={top:{style:"thin",color:{argb:"FFAAB3AD"}},bottom:{style:"thin",color:{argb:"FFAAB3AD"}},left:{style:"thin",color:{argb:"FFAAB3AD"}},right:{style:"thin",color:{argb:"FFAAB3AD"}}};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:column===3?"FFFFF3B0":column===5?"FFD9EEE2":column===4?"FFFFFFFF":fill}};
   }
  }
  const end=products.rowCount;if(end>start)for(const column of [1,6,7])products.mergeCells(start,column,end,column);
 }
 const total=subtotal(products,{group:"TOTAL KESELURUHAN",groupQuantity:report.totals.quantity,groupValue:report.totals.value},true);
 products.mergeCells(total.number,1,total.number,5);total.height=30;total.alignment={vertical:"middle",horizontal:"right"};total.getCell(6).alignment={vertical:"middle",horizontal:"center"};
 const orders=prepare("Per pesanan",[
  {header:"Pemesan",key:"customer",width:30},{header:"Produk",key:"product",width:48},quantity,
  {header:"Harga jual / unit",key:"unitPrice",width:22,money:true},{header:"Subtotal jual produk",key:"value",width:22,money:true},{header:"Total pesanan",key:"orderValue",width:24,money:true},
  {header:"Alamat kirim",key:"address",width:38},{header:"Harga beli / unit",key:"unitCost",width:22,money:true},{header:"Subtotal beli",key:"itemCost",width:22,money:true},{header:"Total HPP",key:"cost",width:22,money:true},{header:"Margin",key:"margin",width:22,money:true},
 ]);
 orders.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF202622"}};orders.getRow(3).alignment={vertical:"middle",horizontal:"center",wrapText:true};
 orders.views=[{state:"frozen",ySplit:3,xSplit:3,showGridLines:false}];
 for(const index of [4,5,6,8,9,10,11])orders.getColumn(index).numFmt='"Rp" #,##0;[Red]-"Rp" #,##0';
 for(const [index,order] of report.orders.entries()){
  const start=orders.rowCount+1,fill=palette[index%palette.length];
  for(const [line,item] of order.items.entries()){
   const options=[item.color,item.size,...(po&&item.category!=="Tanpa kategori"?[`Kategori: ${item.category}`]:[]),...(item.store?[`Toko: ${item.store}`]:[])].filter(Boolean).join(" · ");
   const label=[item.product,item.variant].filter(Boolean).join(" ")+(options?`\n${options}`:"");
   const row=orders.addRow({customer:line===0?{richText:[{text:order.customer,font:{bold:true,size:11}},{text:`\n${order.id}\n${formatCalendarDate(order.date)}`,font:{bold:false,size:10,color:{argb:"FF626862"}}}]}:undefined,product:label,quantity:item.quantity,unitPrice:item.unitPrice,value:item.quantity*item.unitPrice,orderValue:line===0?order.totals.value:undefined,address:line===0?order.address:undefined,unitCost:item.unitCost??missing,itemCost:item.unitCost===null?missing:item.quantity*item.unitCost,cost:line===0?(order.totals.cost??missing):undefined,margin:line===0?(order.totals.cost===null?missing:order.totals.value-order.totals.cost):undefined});
   const identityHeight=(Math.ceil(order.customer.length/28)+Math.ceil(order.id.length/28)+1)*16+8;
   const addressHeight=order.address.split("\n").reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/36)),0)*16+8;
   row.height=Math.max(30,label.split("\n").reduce((sum,line)=>sum+Math.ceil(line.length/48),0)*16+8,Math.ceil(Math.max(identityHeight,addressHeight)/order.items.length));
   for(let column=1;column<=11;column++){
    const cell=row.getCell(column);cell.font={name:"Arial",size:11,color:{argb:cell.value===missing?"FFA75B1E":"FF25312E"},bold:[1,6,10,11].includes(column)};
    cell.alignment={vertical:"middle",horizontal:column===3?"center":[4,5,6,8,9,10,11].includes(column)?"right":"left",wrapText:true};
    cell.border={top:{style:"thin",color:{argb:"FFAAB3AD"}},bottom:{style:"thin",color:{argb:"FFAAB3AD"}},left:{style:"thin",color:{argb:"FFAAB3AD"}},right:{style:"thin",color:{argb:"FFAAB3AD"}}};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:column===3?"FFFFF3B0":[4,5,7,8,9].includes(column)?"FFFFFFFF":fill}};
   }
  }
  const end=orders.rowCount;if(end>start)for(const column of [1,6,7,10,11])orders.mergeCells(start,column,end,column);
 }
 const orderTotal=subtotal(orders,{customer:"TOTAL KESELURUHAN",quantity:report.totals.quantity,orderValue:report.totals.value,cost:report.totals.cost??missing,margin:report.totals.cost===null?missing:report.totals.value-report.totals.cost},true);
 orders.mergeCells(orderTotal.number,1,orderTotal.number,2);orderTotal.height=30;orderTotal.alignment={vertical:"middle",horizontal:"right"};orderTotal.getCell(3).alignment={vertical:"middle",horizontal:"center"};
 return new Uint8Array(await book.xlsx.writeBuffer());
}

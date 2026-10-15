import type { Row, Worksheet } from "exceljs";
import type { ShoppingReport } from "./shopping-report.ts";

const missing="Belum lengkap";
export async function createShoppingReportExcel(report:ShoppingReport):Promise<Uint8Array> {
 const ExcelJS=(await import("exceljs")).default;
 const book=new ExcelJS.Workbook();book.creator="Tippo";
 const po=report.batch.type==="po",color=po?"FF94501F":"FF245C4E",grandLabel=po?"TOTAL BATCH":"TOTAL PERJALANAN";
 type Column={header:string;key:string;width:number;money?:boolean};
 const category:Column={header:"Kategori",key:"category",width:24},store:Column={header:"Toko / brand",key:"store",width:24};
 const productColumns:Column[]=[{header:"Produk",key:"product",width:32},{header:"Varian",key:"variant",width:22},{header:"Warna",key:"color",width:16},{header:"Ukuran",key:"size",width:14}];
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
 function detail(row:Row){row.outlineLevel=1;row.alignment={vertical:"top",wrapText:true};}
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
  {header:"Nomor pesanan",key:"id",width:38},{header:"Pelanggan",key:"customer",width:24},{header:"Tanggal",key:"date",width:15},...(po?[category,...productColumns,store]:[store,...productColumns]),quantity,
  {header:"Harga jual / unit",key:"unitPrice",width:22,money:true},{header:"Subtotal jual produk",key:"value",width:22,money:true},{header:"Harga beli / unit",key:"unitCost",width:22,money:true},{header:"HPP diketahui",key:"knownCost",width:22,money:true},{header:"Total HPP",key:"cost",width:22,money:true},{header:"Qty HPP belum diisi",key:"missingQuantity",width:18},
 ]);
 for(const order of report.orders){for(const item of order.items)detail(orders.addRow({...item,id:order.id,customer:order.customer,date:order.date,store:item.store||"Tanpa toko / brand",value:item.quantity*item.unitPrice,unitCost:item.unitCost??missing,knownCost:item.quantity*(item.unitCost??0),cost:item.unitCost===null?missing:item.quantity*item.unitCost,missingQuantity:item.unitCost===null?item.quantity:0}));subtotal(orders,{id:`Subtotal ${order.id}`,customer:order.customer,...order.totals,cost:order.totals.cost??missing});}
 subtotal(orders,{id:grandLabel,...report.totals,cost:report.totals.cost??missing},true);
 return new Uint8Array(await book.xlsx.writeBuffer());
}

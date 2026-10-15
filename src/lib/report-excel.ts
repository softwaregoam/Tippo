import type { Worksheet, Row } from "exceljs";
import type { SalesReport } from "./sales-report.ts";
import { orderDiscount } from "./finance.ts";
import { formatCalendarDate } from "./calendar-date.ts";

export async function createReportExcel(report: SalesReport): Promise<Uint8Array> {
 const ExcelJS=(await import("exceljs")).default;
 const workbook=new ExcelJS.Workbook();workbook.creator="Tippo";
 const po=report.filter.type==="po",color=po?"FF94501F":"FF245C4E",soft=po?"FFFFF3E2":"FFEDF5F1";
 const money='"Rp" #,##0;[Red]-"Rp" #,##0';
 const period=`${formatCalendarDate(report.filter.from)} – ${formatCalendarDate(report.filter.to)}`;
 const batch=`${po?"Batch PO":"Perjalanan"}: ${report.batchLabel}`;
 type Column={header:string;key:string;width:number;money?:boolean};
 function prepare(name:string,columns:Column[]){
  const sheet=workbook.addWorksheet(name);sheet.columns=columns.map(({key,width,money:currency})=>({key,width,style:{font:{name:"Arial",size:11,color:{argb:"FF25312E"}},numFmt:currency?money:"#,##0"}}));
  for(const [index,text] of [`${name} · ${po?"Open PO":"Jastip"}`,period,batch].entries()){
   const row=sheet.addRow([text]);sheet.mergeCells(row.number,1,row.number,columns.length);row.height=index===0?34:index===2?32:24;row.font={name:"Arial",size:index===0?18:11,bold:index===0,color:{argb:index===0?color:"FF626862"}};row.alignment={horizontal:"left",vertical:"middle",wrapText:true};
  }
  const header=sheet.addRow(columns.map(column=>column.header));header.height=34;header.font={name:"Arial",size:11,bold:true,color:{argb:"FFFFFFFF"}};header.fill={type:"pattern",pattern:"solid",fgColor:{argb:color}};header.alignment={vertical:"middle",wrapText:true};
  sheet.views=[{state:"frozen",ySplit:4,showGridLines:false}];sheet.properties.tabColor={argb:color};
  sheet.pageSetup={orientation:name==="Ringkasan"?"portrait":"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};sheet.pageSetup.printTitlesRow="1:4";
  return sheet;
 }
 function decorate(row:Row,index:number){
  row.height=32;row.alignment={vertical:"middle",wrapText:true};
  row.eachCell({includeEmpty:true},cell=>{
   cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:index%2?"FFF7F8F6":"FFFFFFFF"}};
   cell.border={bottom:{style:"hair",color:{argb:"FFE2E6E3"}}};
   if(cell.value==="Belum lengkap")cell.font={name:"Arial",size:10,color:{argb:"FFA75B1E"}};
  });
 }
 function total(sheet:Worksheet,values:Record<string,unknown>,mergeTo:number){
  const row=sheet.addRow(values);sheet.mergeCells(row.number,1,row.number,mergeTo);row.height=36;
  row.font={name:"Arial",size:11,bold:true,color:{argb:"FFFFFFFF"}};row.fill={type:"pattern",pattern:"solid",fgColor:{argb:color}};row.alignment={vertical:"middle",horizontal:"right",wrapText:true};row.getCell(1).alignment={vertical:"middle",wrapText:true};return row;
 }
 const s=report.summary,unknown=s.orders>0&&s.unknownCosts===s.orders;
 const summary=prepare("Ringkasan",[{header:"Keterangan",key:"label",width:46},{header:"Nilai",key:"value",width:34}]);
 const summaryRows:[string,number|string,boolean][]=[
  ["Total penjualan",s.revenue,true],["HPP diketahui",unknown?"Belum lengkap":s.hpp,true],[s.unknownCosts?"Margin diketahui":"Estimasi margin",unknown?"Belum lengkap":s.margin,true],
  ["Jumlah pesanan",s.orders,false],["Unit produk",s.quantity,false],["Pesanan dengan HPP belum lengkap",s.unknownCosts,false],["Penjualan dengan HPP lengkap",s.knownRevenue,true],
 ];
 for(const [index,[label,value,currency]] of summaryRows.entries()){
  const row=summary.addRow({label,value});decorate(row,index);row.height=34;row.getCell(2).alignment={horizontal:"right",vertical:"middle",wrapText:true};row.getCell(2).numFmt=currency?money:"#,##0";
  if(index<3){row.fill={type:"pattern",pattern:"solid",fgColor:{argb:soft}};row.font={name:"Arial",size:12,bold:true,color:{argb:color}};if(value==="Belum lengkap")row.getCell(2).font={bold:true,color:{argb:"FFA75B1E"}};}
 }
 summary.addRow([]);
 for(const note of ["Pesanan dibatalkan tidak disertakan.","HPP dan margin hanya dari pesanan dengan harga beli lengkap."]){const row=summary.addRow([note]);summary.mergeCells(row.number,1,row.number,2);row.height=28;row.font={name:"Arial",size:10,color:{argb:"FF626862"}};row.alignment={wrapText:true,vertical:"middle"};}
 const orders=prepare("Pesanan",[{header:"Nomor pesanan",key:"id",width:38},{header:"Tanggal",key:"date",width:16},{header:"Pelanggan",key:"customer",width:26},{header:po?"Batch PO":"Perjalanan",key:"batch",width:30},{header:"Produk & varian",key:"product",width:46},{header:"Qty",key:"quantity",width:12},...([['Harga jual / unit','unitPrice'],['Subtotal produk','value'],['Harga beli / unit','unitCost'],['HPP produk','itemCost'],[po?'Biaya tambahan':'Fee Jastip','fee'],['Diskon','discount'],['Ongkir','shipping'],['Total tagihan','revenue'],['HPP pesanan','hpp'],['Margin','margin']] as const).map(([header,key])=>({header,key,width:22,money:true}))]);
 let productValue=0,productCost=0,missingProducts=false;
 for(const [index,row] of report.rows.entries()){
  const start=orders.rowCount+1;
  for(const [itemIndex,item] of row.order.items.entries()){
   const value=item.quantity*item.unitPrice,cost=item.unitCost===null?null:item.quantity*item.unitCost;productValue+=value;productCost+=cost??0;if(cost===null)missingProducts=true;
   const label=[[item.product,item.variant].filter(Boolean).join(" "),[item.color,item.size,item.store].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
   const line=orders.addRow({id:itemIndex===0?row.order.id:undefined,date:itemIndex===0?formatCalendarDate(row.order.date):undefined,customer:itemIndex===0?row.customer:undefined,batch:itemIndex===0?row.batch:undefined,product:label,quantity:item.quantity,unitPrice:item.unitPrice,value,unitCost:item.unitCost??"Belum lengkap",itemCost:cost??"Belum lengkap",...(itemIndex===0?{fee:row.order.serviceFee,discount:orderDiscount(row.order),shipping:row.order.shippingCharge,revenue:row.revenue,hpp:row.hpp??"Belum lengkap",margin:row.margin??"Belum lengkap"}:{})});decorate(line,index);
   line.height=Math.max(36,label.split("\n").reduce((sum,text)=>sum+Math.ceil(text.length/46),0)*14+8,Math.ceil(Math.max(Math.ceil(row.customer.length/26),Math.ceil(row.batch.length/30))*14/row.order.items.length)+8);
   for(let column=6;column<=16;column++)line.getCell(column).alignment={horizontal:"right",vertical:"middle",wrapText:true};line.getCell(1).font={name:"Arial",size:10,color:{argb:"FF626862"}};
  }
  const end=orders.rowCount;if(end>start)for(const column of [1,2,3,4,11,12,13,14,15,16])orders.mergeCells(start,column,end,column);
 }
 for(let column=6;column<=16;column++)orders.getRow(4).getCell(column).alignment={horizontal:"right",vertical:"middle",wrapText:true};
 total(orders,{id:`TOTAL · ${s.orders} pesanan${s.unknownCosts?" · HPP/margin pesanan diketahui":""}`,quantity:s.quantity,value:productValue,itemCost:missingProducts?"Belum lengkap":productCost,fee:report.rows.reduce((sum,row)=>sum+row.order.serviceFee,0),discount:report.rows.reduce((sum,row)=>sum+orderDiscount(row.order),0),shipping:report.rows.reduce((sum,row)=>sum+row.order.shippingCharge,0),revenue:s.revenue,hpp:unknown?"Belum lengkap":s.hpp,margin:unknown?"Belum lengkap":s.margin},5);
 const products=prepare("Produk terlaris",[{header:"No.",key:"rank",width:8},{header:"Produk",key:"name",width:36},{header:"Varian / toko",key:"detail",width:46},{header:"Unit terjual",key:"quantity",width:18}]);
 for(const [index,product] of report.products.entries()){
  const row=products.addRow({rank:index+1,name:product.name,detail:product.detail,quantity:product.quantity});decorate(row,index);row.height=Math.max(32,Math.max(Math.ceil(product.name.length/36),Math.ceil(product.detail.length/46))*14+8);row.getCell(1).alignment={vertical:"middle",horizontal:"center"};row.getCell(4).alignment={vertical:"middle",horizontal:"right"};if(index<3){row.getCell(4).font={name:"Arial",size:12,bold:true,color:{argb:color}};row.getCell(4).fill={type:"pattern",pattern:"solid",fgColor:{argb:soft}};}
 }
 products.autoFilter={from:{row:4,column:1},to:{row:products.rowCount,column:4}};total(products,{rank:"TOTAL UNIT",quantity:s.quantity},3);
 return new Uint8Array(await workbook.xlsx.writeBuffer());
}

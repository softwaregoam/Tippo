import type { Row, Worksheet } from "exceljs";
import type { ShoppingReport } from "./shopping-report.ts";

const missing="Belum lengkap";
export async function createShoppingReportExcel(report:ShoppingReport):Promise<Uint8Array> {
 const ExcelJS=(await import("exceljs")).default;
 const book=new ExcelJS.Workbook();book.creator="Tippo";
 const color=report.batch.type==="po"?"FF94501F":"FF245C4E";
 function prepare(name:string,columns:{header:string;key:string;width:number;money?:boolean}[]) {
  const sheet=book.addWorksheet(name);sheet.columns=columns.map(({key,width,money})=>({key,width,style:{numFmt:money?'#,##0;[Red]-#,##0':'General'}}));
  for(const text of [`Rekap ${report.batch.type==="po"?"kebutuhan produk":"belanja"} · ${name}`,report.batch.name,"Kategori mengikuti katalog saat ekspor. Produk dan harga mengikuti data pesanan.","Nilai jual hanya produk, tanpa ongkir, fee, diskon, atau biaya batch. HPP kosong tidak dianggap nol."]){const row=sheet.addRow([text]);sheet.mergeCells(row.number,1,row.number,columns.length);row.alignment={vertical:"middle",wrapText:true};row.height=26;}
  const header=sheet.addRow(columns.map(column=>column.header));header.font={bold:true,color:{argb:"FFFFFFFF"}};header.fill={type:"pattern",pattern:"solid",fgColor:{argb:color}};header.alignment={wrapText:true,vertical:"middle"};header.height=32;
  sheet.views=[{state:"frozen",ySplit:5}];sheet.properties.outlineProperties={summaryBelow:true,summaryRight:true};
  sheet.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};sheet.pageSetup.printTitlesRow="1:5";
  return sheet;
 }
 function subtotal(sheet:Worksheet,values:Record<string,unknown>,grand=false) {
  const row=sheet.addRow(values);row.font={bold:true,color:{argb:grand?"FFFFFFFF":"FF25312E"}};row.fill={type:"pattern",pattern:"solid",fgColor:{argb:grand?color:"FFF1EEE5"}};return row;
 }
 function detail(row:Row){row.outlineLevel=1;row.alignment={vertical:"top",wrapText:true};}
 const products=prepare("Per produk",[
  {header:"Kategori",key:"category",width:24},{header:"Toko / brand",key:"store",width:24},{header:"Produk",key:"product",width:32},{header:"Varian",key:"variant",width:22},{header:"Warna",key:"color",width:16},{header:"Ukuran",key:"size",width:14},{header:"Qty",key:"quantity",width:12},{header:"Harga beli / unit",key:"unitCost",width:22,money:true},{header:"HPP diketahui",key:"knownCost",width:22,money:true},{header:"Total HPP",key:"cost",width:22,money:true},{header:"Qty HPP belum diisi",key:"missingQuantity",width:18},
 ]);
 for(const category of report.categories){for(const product of category.items)detail(products.addRow({...product,unitCost:product.unitCost??missing,cost:product.cost??missing}));subtotal(products,{category:`Subtotal ${category.name}`,...category.totals,cost:category.totals.cost??missing});}
 subtotal(products,{category:"TOTAL BATCH / PERJALANAN",...report.totals,cost:report.totals.cost??missing},true);
 const orders=prepare("Per pesanan",[
  {header:"Nomor pesanan",key:"id",width:38},{header:"Pelanggan",key:"customer",width:24},{header:"Tanggal",key:"date",width:15},{header:"Kategori",key:"category",width:24},{header:"Toko / brand",key:"store",width:24},{header:"Produk",key:"product",width:32},{header:"Varian",key:"variant",width:22},{header:"Warna",key:"color",width:16},{header:"Ukuran",key:"size",width:14},{header:"Qty",key:"quantity",width:12},{header:"Harga jual / unit",key:"unitPrice",width:22,money:true},{header:"Subtotal jual produk",key:"value",width:22,money:true},{header:"Harga beli / unit",key:"unitCost",width:22,money:true},{header:"HPP diketahui",key:"knownCost",width:22,money:true},{header:"Total HPP",key:"cost",width:22,money:true},{header:"Qty HPP belum diisi",key:"missingQuantity",width:18},
 ]);
 for(const order of report.orders){for(const item of order.items)detail(orders.addRow({...item,id:order.id,customer:order.customer,date:order.date,store:item.store||"Tanpa toko / brand",value:item.quantity*item.unitPrice,unitCost:item.unitCost??missing,knownCost:item.quantity*(item.unitCost??0),cost:item.unitCost===null?missing:item.quantity*item.unitCost,missingQuantity:item.unitCost===null?item.quantity:0}));subtotal(orders,{id:`Subtotal ${order.id}`,customer:order.customer,...order.totals,cost:order.totals.cost??missing});}
 subtotal(orders,{id:"TOTAL BATCH / PERJALANAN",...report.totals,cost:report.totals.cost??missing},true);
 return new Uint8Array(await book.xlsx.writeBuffer());
}

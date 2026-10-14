import type { SalesReport } from "./sales-report.ts";
import { orderDiscount, orderSubtotal } from "./finance.ts";

export async function createReportExcel(report: SalesReport): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook(); workbook.creator = "Tippo";
  const summary = workbook.addWorksheet("Ringkasan");
  summary.columns = [{header:"Keterangan",width:48},{header:"Nilai",width:40}];
  const s = report.summary;
  summary.addRows([
    ["Usaha",report.filter.type === "po" ? "Open PO" : "Jastip"], ["Dari tanggal",report.filter.from], ["Sampai tanggal",report.filter.to], ["Batch / perjalanan",report.batchLabel],
    ["Jumlah pesanan",s.orders],["Unit produk",s.quantity],["Total penjualan",s.revenue],["HPP diketahui",s.orders>0 && s.unknownCosts===s.orders?"Belum lengkap":s.hpp],["Margin diketahui",s.orders>0 && s.unknownCosts===s.orders?"Belum lengkap":s.margin],["Penjualan dengan HPP lengkap",s.knownRevenue],["Pesanan tanpa HPP lengkap",s.unknownCosts],
    ["Dasar laporan","Tanggal pesanan; pesanan dibatalkan tidak dihitung."], ["Margin","Laba kotor sebelum biaya umum. Hanya pesanan dengan HPP lengkap."],
  ]);
  const orders = workbook.addWorksheet("Pesanan");
  orders.columns = [{header:"Nomor pesanan",key:"id",width:38},{header:"Tanggal",key:"date",width:15},{header:"Pelanggan",key:"customer",width:26},{header:"Batch / perjalanan",key:"batch",width:30},{header:"Unit",key:"quantity",width:12},...([['Subtotal termasuk fee','subtotal'],['Diskon','discount'],['Ongkir','shipping'],['Total tagihan','revenue'],['HPP','hpp'],['Margin','margin']] as const).map(([header,key])=>({header,key,width:22}))];
  for (const row of report.rows) orders.addRow({id:row.order.id,date:row.order.date,customer:row.customer,batch:row.batch,quantity:row.quantity,subtotal:orderSubtotal(row.order),discount:orderDiscount(row.order),shipping:row.order.shippingCharge,revenue:row.revenue,hpp:row.hpp,margin:row.margin});
  for (const key of ['subtotal','discount','shipping','revenue','hpp','margin']) orders.getColumn(key).numFmt = '#,##0;[Red]-#,##0';
  const products = workbook.addWorksheet("Produk terlaris");
  products.columns = [{header:"Produk",key:"name",width:35},{header:"Varian / toko",key:"detail",width:45},{header:"Unit terjual",key:"quantity",width:18}];
  for (const product of report.products) products.addRow({name:product.name,detail:product.detail,quantity:product.quantity});
  for (const sheet of [summary,orders,products]) {
    sheet.views=[{state:"frozen",ySplit:1}];
    sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
    sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:report.filter.type === "po" ? "FF94501F" : "FF245C4E"}};
    sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:sheet.columnCount}};
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

"use client";
import {useState} from "react";
import {BatchStatusDialog} from "@/components/batch-status-dialog";
import {batchStatusLabels} from "@/lib/batch-status";
import {MobileDataList} from "@/components/mobile-data-list";
import {Archive,ArchiveRestore,CircleArrowRight,CircleCheck,Pencil} from "lucide-react";
import {formatCurrency} from "@/lib/finance";
import type {Product,Batch,Order} from "@/lib/types";
export function ProductsTable({products,onEdit,onRemove}:{products:Product[];onEdit:(p:Product)=>void;onRemove:(p:Product)=>void}){
 return <><MobileDataList entries={products.map(p=>({id:p.id,title:p.name,subtitle:<span className="product-mobile-attributes"><span><span>Kategori</span><span className={!p.category?"muted":undefined}>{p.category||"Belum diisi"}</span></span><span><span>Varian</span><span className={!p.variant?"muted":undefined}>{p.variant||"Belum diisi"}</span></span></span>,meta:<span className="product-mobile-price"><span>Harga jual</span><strong>{formatCurrency(p.unitPrice)}</strong></span>,status:p.active?"Aktif":"Diarsipkan",statusClassName:`status-tag product-status-${p.active?"active":"archived"}`,details:<><span className={`status-tag product-status-${p.active?"active":"archived"}`}>{p.active?"Aktif":"Diarsipkan"}</span><dl className="mobile-detail-fields"><dt>SKU</dt><dd>{p.sku||"Belum diisi"}</dd><dt>Kategori</dt><dd>{p.category||"Belum diisi"}</dd><dt>Varian</dt><dd>{p.variant||"Belum diisi"}</dd><dt>Harga jual</dt><dd>{formatCurrency(p.unitPrice)}</dd><dt>Harga beli</dt><dd>{p.unitCost===null?"Belum diisi":formatCurrency(p.unitCost)}</dd></dl><button className="btn btn-secondary product-mobile-action" data-close-detail onClick={()=>onRemove(p)}>{p.active?<Archive size={16}/>:<ArchiveRestore size={16}/>} {p.active?"Arsipkan produk":"Aktifkan kembali"}</button><button className="btn btn-primary product-mobile-action" data-close-detail onClick={()=>onEdit(p)}>Edit produk</button></>}))}/><div className="card management-table-wrap desktop-data-table"><table className="management-table" aria-label="Daftar produk PO"><thead><tr>{['Produk','Kategori','Varian','Harga jual','Harga beli','Status','Aksi'].map(t=><th scope="col" key={t} className={t.startsWith('Harga')?'numeric':''}>{t}</th>)}</tr></thead><tbody>{products.map(p=><tr className="product-row" key={p.id}><td data-label="Produk"><h3>{p.name}</h3><small className="muted">{p.sku || 'Tanpa SKU'}</small></td><td data-label="Kategori">{p.category || '—'}</td><td data-label="Varian">{p.variant || '—'}</td><td data-label="Harga jual" className="numeric"><strong>{formatCurrency(p.unitPrice)}</strong></td><td data-label="Harga beli" className="numeric">{p.unitCost===null?'Belum diisi':formatCurrency(p.unitCost)}</td><td data-label="Status"><span className={`status-tag product-status-${p.active?"active":"archived"}`}>{p.active?"Aktif":"Diarsipkan"}</span></td><td data-label="Aksi"><div className="management-actions"><button className="icon-button" aria-label={`Edit produk ${p.name}`} onClick={()=>onEdit(p)}><Pencil size={16}/></button><button className="icon-button" aria-label={`${p.active?"Arsipkan produk":"Aktifkan kembali"} ${p.name}`} title={p.active?"Arsipkan produk":"Aktifkan kembali"} onClick={()=>onRemove(p)}>{p.active?<Archive size={16}/>:<ArchiveRestore size={16}/>}</button></div></td></tr>)}</tbody></table></div></>;
}
export function BatchesTable({ title, batches, orders, onEdit, onStatus }: {
 title: string; batches: Batch[]; orders: Order[];
 onEdit: (batch: Batch) => void;
 onStatus: (batch: Batch, status: Batch["status"]) => boolean | Promise<boolean>;
}) {
 const [changing, setChanging] = useState<Batch | null>(null);
 const count = (batch: Batch) => orders.filter(order => order.batchId === batch.id && order.status !== "cancelled").length;
 const badge = (batch: Batch) => <span className={`status-tag batch-status-${batch.status}`}>{batchStatusLabels[batch.status]}</span>;
 const statusAction = (batch: Batch) => batch.status === "completed"
   ? null
   : <button className="icon-button" data-close-detail aria-label={`${batch.status === "open" ? "Tutup batch" : "Selesaikan batch"} ${batch.name}`} title={batch.status === "open" ? "Tutup batch" : "Selesaikan batch"} onClick={() => setChanging(batch)}>{batch.status === "open" ? <CircleArrowRight size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}</button>;
 return <>
   <MobileDataList entries={batches.map(batch => ({
     id: batch.id, title: batch.name, subtitle: batch.origin || "Lokasi belum diisi",
     meta: `${new Date(`${batch.closeDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · ${count(batch)} pesanan`,
     status: batchStatusLabels[batch.status],
     statusClassName: `status-tag batch-status-${batch.status}`,
     details: <><dl className="mobile-detail-fields"><dt>Lokasi / supplier</dt><dd>{batch.origin || "Belum diisi"}</dd><dt>Tutup pesanan</dt><dd>{batch.closeDate}</dd><dt>Jumlah pesanan</dt><dd>{count(batch)}</dd><dt>Status</dt><dd>{badge(batch)}</dd></dl>{statusAction(batch)}<button className="btn btn-primary" data-close-detail onClick={() => onEdit(batch)}>Edit batch</button></>,
   }))} />
   <div className="card management-table-wrap desktop-data-table"><table className="management-table" aria-label={title}>
     <thead><tr>{["Nama batch", "Lokasi / supplier", "Tutup pesanan", "Pesanan", "Status", "Aksi"].map(label => <th scope="col" key={label} className={label === "Pesanan" ? "center-cell" : undefined}>{label}</th>)}</tr></thead>
     <tbody>{batches.map(batch => <tr key={batch.id}>
       <td data-label="Nama batch"><h3>{batch.name}</h3></td>
       <td data-label="Lokasi / supplier">{batch.origin || "Belum diisi"}</td>
       <td data-label="Tutup pesanan">{new Date(`${batch.closeDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
       <td data-label="Pesanan" className="center-cell">{count(batch)}</td><td data-label="Status">{badge(batch)}</td>
       <td data-label="Aksi"><div className="management-actions">{statusAction(batch)}<button className="icon-button" aria-label={`Edit batch ${batch.name}`} onClick={() => onEdit(batch)}><Pencil size={16} /></button></div></td>
     </tr>)}</tbody>
   </table></div>
   {changing && <BatchStatusDialog batch={changing} onClose={() => setChanging(null)} onSave={onStatus} />}
 </>;
}

"use client";
import { productDisplayName } from "@/lib/product-name";
import {useState} from "react";
import {BatchStatusDialog} from "@/components/batch-status-dialog";
import {batchStatusLabels} from "@/lib/batch-status";
import {ShoppingRecapDialog} from "@/components/shopping-recap-dialog";
import {MobileDataList} from "@/components/mobile-data-list";
import {Archive,ArchiveRestore,CircleArrowRight,CircleCheck,ClipboardList,Copy,Pencil} from "lucide-react";
import {formatCalendarDate} from "@/lib/calendar-date";
import {formatCurrency} from "@/lib/finance";
import type {Product,Batch,Order,AppData} from "@/lib/types";
const productTitle = (product: Product) => [productDisplayName(product.name), product.variant.trim()].filter(Boolean).join(" ");

export function ProductsTable({products,onEdit,onRemove,onDuplicate}:{products:Product[];onEdit:(p:Product)=>void;onRemove:(p:Product)=>void;onDuplicate:(p:Product)=>void}){
 const [sort, setSort] = useState<{key: "name"|"category"|"size"|"sell"|"cost"|"status"; direction: "asc"|"desc"}>({key:"name",direction:"asc"});
 const toggleSort = (key: typeof sort.key) => setSort(current => ({key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc"}));
 const indicator = (key: typeof sort.key) => <span className={`table-sort-indicator${sort.key === key ? " is-active" : ""}`} aria-hidden="true">{sort.key === key ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>;
 const sortedProducts = [...products].sort((a,b) => { const values = {name:[productTitle(a),productTitle(b)],category:[a.category??"",b.category??""],size:[a.size??"",b.size??""],sell:[String(a.unitPrice),String(b.unitPrice)],cost:[String(a.unitCost??-1),String(b.unitCost??-1)],status:[a.active?"Aktif":"Diarsipkan",b.active?"Aktif":"Diarsipkan"]}[sort.key]; const result = values[0].localeCompare(values[1], "id", {numeric: sort.key === "sell" || sort.key === "cost", sensitivity:"base"}); return sort.direction === "asc" ? result : -result; });
 return <><MobileDataList entries={sortedProducts.map(p=>({id:p.id,title:productTitle(p),dialogClassName:"product-data-dialog",subtitle:<span className="product-mobile-attributes">{p.store && <span><span>Supplier / brand</span><span>{p.store}</span></span>}<span><span>SKU:</span><span className={!p.sku?"muted":undefined}>{p.sku||"Belum diisi"}</span></span>{p.color && <span><span>Warna</span><span>{p.color}</span></span>}<span><span>Kategori</span><span className={!p.category?"muted":undefined}>{p.category||"Belum diisi"}</span></span><span><span>Ukuran</span><span className={!p.size?"muted":undefined}>{p.size||"Belum diisi"}</span></span></span>,meta:<span className="product-mobile-price"><span>Harga jual</span><strong>{formatCurrency(p.unitPrice)}</strong></span>,status:p.active?"Aktif":"Diarsipkan",statusClassName:`status-tag product-status-${p.active?"active":"archived"}`,details:<><div className="product-detail-summary"><div><span>Harga jual</span><strong>{formatCurrency(p.unitPrice)}</strong></div><span className={`status-tag product-status-${p.active?"active":"archived"}`}>{p.active?"Aktif":"Diarsipkan"}</span></div><dl className="mobile-detail-fields"><dt>Supplier / brand</dt><dd>{p.store||"Belum diisi"}</dd><dt>SKU</dt><dd>{p.sku||"Belum diisi"}</dd><dt>Warna</dt><dd>{p.color||"Belum diisi"}</dd><dt>Ukuran</dt><dd>{p.size||"Belum diisi"}</dd><dt>Kategori</dt><dd>{p.category||"Belum diisi"}</dd><dt>Harga beli</dt><dd>{p.unitCost===null?"Belum diisi":formatCurrency(p.unitCost)}</dd></dl><button className="btn btn-secondary product-mobile-action" data-close-detail onClick={()=>onRemove(p)}>{p.active?<Archive size={16}/>:<ArchiveRestore size={16}/>} {p.active?"Arsipkan produk":"Aktifkan kembali"}</button><button className="btn btn-secondary product-mobile-action" data-close-detail onClick={()=>onDuplicate(p)}><Copy size={16}/>Duplikat produk</button><button className="btn btn-primary product-mobile-action" data-close-detail onClick={()=>onEdit(p)}>Edit produk</button></>}))}/><div className="card management-table-wrap desktop-data-table"><table className="management-table" aria-label="Daftar produk PO"><thead><tr>{[['Produk','name'],['Kategori','category'],['Ukuran','size'],['Harga jual','sell'],['Harga beli','cost'],['Status','status'],['Aksi',null]].map(([label,key])=><th scope="col" key={label as string} className={`${(label as string).startsWith('Harga')?'numeric':''}${label === 'Status' ? ' center-cell' : ''}`}>{key ? <button type="button" className="table-sort-button" aria-label={`Urutkan berdasarkan ${label}`} onClick={() => toggleSort(key as typeof sort.key)}>{label}{indicator(key as typeof sort.key)}</button> : label}</th>)}</tr></thead><tbody>{sortedProducts.map(p=><tr className="product-row" key={p.id}><td data-label="Produk"><h3>{productTitle(p)}</h3>{p.color && <div className="row-subtitle">Warna: {p.color}</div>}{p.store && <div className="row-subtitle">Supplier / brand: {p.store}</div>}<div className="row-subtitle">SKU: {p.sku || 'Belum diisi'}</div></td><td data-label="Kategori">{p.category || '—'}</td><td data-label="Ukuran">{p.size || '—'}</td><td data-label="Harga jual" className="numeric"><strong>{formatCurrency(p.unitPrice)}</strong></td><td data-label="Harga beli" className="numeric">{p.unitCost===null?'Belum diisi':formatCurrency(p.unitCost)}</td><td data-label="Status"><span className={`status-tag product-status-${p.active?"active":"archived"}`}>{p.active?"Aktif":"Diarsipkan"}</span></td><td data-label="Aksi"><div className="management-actions"><button className="icon-button" aria-label={`Duplikat produk ${productDisplayName(p.name)}`} title="Duplikat produk" onClick={()=>onDuplicate(p)}><Copy size={16}/></button><button className="icon-button" aria-label={`Edit produk ${productDisplayName(p.name)}`} onClick={()=>onEdit(p)}><Pencil size={16}/></button><button className="icon-button" aria-label={`${p.active?"Arsipkan produk":"Aktifkan kembali"} ${productDisplayName(p.name)}`} title={p.active?"Arsipkan produk":"Aktifkan kembali"} onClick={()=>onRemove(p)}>{p.active?<Archive size={16}/>:<ArchiveRestore size={16}/>}</button></div></td></tr>)}</tbody></table></div></>;
}
export function BatchesTable({ title, batches, orders, data, onEdit, onStatus }: {
 title: string; batches: Batch[]; orders: Order[]; data:AppData;
 onEdit: (batch: Batch) => void;
 onStatus: (batch: Batch, status: Batch["status"]) => boolean | Promise<boolean>;
}) {
 const [recapBatch,setRecapBatch]=useState<Batch|null>(null);
 const recapLabel=(batch:Batch)=>batch.type==="po"?"Rekap kebutuhan produk":"Rekap belanja";
 const [changing, setChanging] = useState<Batch | null>(null);
 const count = (batch: Batch) => orders.filter(order => order.batchId === batch.id && order.status !== "cancelled").length;
 const [batchSort, setBatchSort] = useState<{key: "name"|"origin"|"date"|"count"|"status"; direction: "asc"|"desc"}>({key:"name",direction:"asc"});
 const toggleBatchSort = (key: typeof batchSort.key) => setBatchSort(current => ({key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc"}));
 const batchIndicator = (key: typeof batchSort.key) => <span className={`table-sort-indicator${batchSort.key === key ? " is-active" : ""}`} aria-hidden="true">{batchSort.key === key ? (batchSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>;
 const sortedBatches = [...batches].sort((a,b) => { const values = {name:[a.name,b.name],origin:[a.origin,b.origin],date:[a.closeDate,b.closeDate],count:[String(count(a)),String(count(b))],status:[batchStatusLabels[a.status],batchStatusLabels[b.status]]}[batchSort.key]; const result=values[0].localeCompare(values[1],"id",{numeric:batchSort.key==="count",sensitivity:"base"}); return batchSort.direction==="asc"?result:-result; });
 const badge = (batch: Batch) => <span className={`status-tag batch-status-${batch.status}`}>{batchStatusLabels[batch.status]}</span>;
 const statusAction = (batch: Batch, mobile=false) => batch.status === "completed"
   ? null
   : <button className={mobile?"btn btn-secondary":"icon-button"} data-close-detail aria-label={`${batch.status === "open" ? "Tutup batch" : "Selesaikan batch"} ${batch.name}`} title={batch.status === "open" ? "Tutup batch" : "Selesaikan batch"} onClick={() => setChanging(batch)}>{batch.status === "open" ? <CircleArrowRight size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}{mobile && <span>{batch.status === "open" ? "Tutup batch" : "Selesaikan batch"}</span>}</button>;
 return <>
   <MobileDataList entries={sortedBatches.map(batch => ({
     id: batch.id, title: batch.name, subtitle: batch.origin || "Lokasi belum diisi",
     meta: `${formatCalendarDate(batch.closeDate,false)} · ${count(batch)} pesanan`,
     status: batchStatusLabels[batch.status],
     statusClassName: `status-tag batch-status-${batch.status}`,
     details: <><dl className="mobile-detail-fields"><dt>Lokasi / supplier</dt><dd>{batch.origin || "Belum diisi"}</dd><dt>Tutup pesanan</dt><dd>{formatCalendarDate(batch.closeDate)}</dd><dt>Jumlah pesanan</dt><dd>{count(batch)}</dd><dt>Status</dt><dd>{badge(batch)}</dd></dl><button className="btn btn-secondary product-mobile-action" data-close-detail onClick={()=>setRecapBatch(batch)}><ClipboardList size={16}/>{recapLabel(batch)}</button><div className={`batch-mobile-actions ${batch.status==="completed"?"single":""}`}>{statusAction(batch,true)}<button className="btn btn-primary" data-close-detail onClick={() => onEdit(batch)}><Pencil size={16} aria-hidden="true"/>Edit batch</button></div></>,
   }))} />
   <div className="card management-table-wrap desktop-data-table"><table className="management-table" aria-label={title}>
     <thead><tr><th scope="col"><button type="button" className="table-sort-button" onClick={() => toggleBatchSort("name")}>Nama batch{batchIndicator("name")}</button></th><th scope="col"><button type="button" className="table-sort-button" onClick={() => toggleBatchSort("origin")}>Lokasi / supplier{batchIndicator("origin")}</button></th><th scope="col"><button type="button" className="table-sort-button" onClick={() => toggleBatchSort("date")}>Tutup pesanan{batchIndicator("date")}</button></th><th scope="col" className="center-cell"><button type="button" className="table-sort-button" onClick={() => toggleBatchSort("count")}>Pesanan{batchIndicator("count")}</button></th><th scope="col" className="center-cell"><button type="button" className="table-sort-button" onClick={() => toggleBatchSort("status")}>Status{batchIndicator("status")}</button></th><th scope="col">Aksi</th></tr></thead>
     <tbody>{sortedBatches.map(batch => <tr key={batch.id}>
       <td data-label="Nama batch"><h3>{batch.name}</h3></td>
       <td data-label="Lokasi / supplier">{batch.origin || "Belum diisi"}</td>
       <td data-label="Tutup pesanan">{formatCalendarDate(batch.closeDate)}</td>
       <td data-label="Pesanan" className="center-cell">{count(batch)}</td><td data-label="Status">{badge(batch)}</td>
       <td data-label="Aksi"><div className="management-actions"><button className="icon-button" aria-label={`${recapLabel(batch)} ${batch.name}`} title={recapLabel(batch)} onClick={()=>setRecapBatch(batch)}><ClipboardList size={18}/></button>{statusAction(batch)}<button className="icon-button" aria-label={`Edit batch ${batch.name}`} onClick={() => onEdit(batch)}><Pencil size={16} /></button></div></td>
     </tr>)}</tbody>
   </table></div>
   {recapBatch && <ShoppingRecapDialog batch={recapBatch} data={data} onClose={()=>setRecapBatch(null)}/> }
   {changing && <BatchStatusDialog batch={changing} onClose={() => setChanging(null)} onSave={onStatus} />}
 </>;
}

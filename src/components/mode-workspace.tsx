"use client";
import { productDisplayName } from "@/lib/product-name";
import { BatchPicker } from "./batch-picker";
import { CategoryFilter } from "./category-filter";
import type { InvoiceSettings } from "@/lib/business-profile";
import { visibleOrderStatus } from "@/lib/order-status";

import { NumberInput } from "@/components/ui/number-input";

import { useState } from "react";
import { Layers3, Package, Search, ShoppingBag, Upload, UsersRound, X } from "lucide-react";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { OrdersTable } from "@/components/orders-table";
import { ProductsTable,BatchesTable } from "@/components/po-management-tables";
import { ProductRemovalDialog } from "@/components/product-removal-dialog";
import { ProductExcelImportDialog } from "@/components/product-excel-import";
import { ExcelImportDialog } from "@/components/excel-import";
import { orderLabel, outstanding } from "@/lib/finance";
import type { AppData, Batch, Order, Product } from "@/lib/types";

type Props = {
  tab: "products" | "orders" | "batches";
  type: Batch["type"];
  data: AppData;
  invoiceSettings?: InvoiceSettings;
  onEditBatch: (batch: Batch) => void;
  onNewOrder: (batchId?: string, productId?: string) => void;
  onEditOrder: (order: Order) => void;
  onStatus: (order: Order, status: Order["status"]) => boolean | Promise<boolean>;
  onBatchStatus: (batch: Batch, status: Batch["status"]) => boolean | Promise<boolean>;
  onHpp: (batch: Batch) => void;
  onEditProduct: (product: Product) => void;
  onDuplicateProduct: (product: Product) => void;
  onRefund: (id: string, amount: number, date: string, reason: string, cancel: boolean) => Promise<boolean>;
  onImportProducts: (products: Product[]) => boolean | Promise<boolean>;
  onProductStatus: (product: Product) => boolean | Promise<boolean>;
  onImport: (orders: Order[], customers: AppData["customers"]) => boolean | Promise<boolean>;
  importAllowed: boolean;
  productLimit?: number;
  onUpgrade: () => void;
};

export function ModeWorkspace({ tab, type, data, invoiceSettings, onEditBatch, onEditOrder, onStatus, onBatchStatus, onEditProduct, onDuplicateProduct, onImportProducts, onRefund, onProductStatus, onImport, importAllowed, productLimit, onUpgrade }: Props) {
  const po = type === "po";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [batchStatus, setBatchStatus] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [categoryFilter,setCategoryFilter]=useState("all");
  const categories=[...new Set(data.products.map(p=>p.category?.trim()).filter((c):c is string=>Boolean(c)))].sort((a,b)=>a.localeCompare(b,"id"));
  const [removingProduct,setRemovingProduct]=useState<Product|null>(null);
  const [productStatus, setProductStatus] = useState("active");
  const [importOpen, setImportOpen] = useState(false);
  const [productImportOpen, setProductImportOpen] = useState(false);
  const batches = data.batches.filter((b) => b.type === type);
  const filteredBatches = batches.filter(b => `${b.name} ${b.origin}`.toLowerCase().includes(search.trim().toLowerCase()) && (batchStatus === "all" || b.status === batchStatus));
  const batchIds = new Set(batches.map((b) => b.id));
  const orders = data.orders.filter((o) => batchIds.has(o.batchId));
  const filteredOrders = orders.filter((o) => {
    const name = o.purpose==="personal"?"Untuk sendiri Belanja pribadi":data.customers.find((c) => c.id === o.customerId)?.name ?? "";
    return `${orderLabel(o)} ${name}`.toLowerCase().includes(search.toLowerCase()) && (status === "all" || (status === "unpaid" ? outstanding(o) > 0 : visibleOrderStatus(o.status) === status)) && (batchFilter === "all" || o.batchId === batchFilter);
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const products = data.products.filter((p) => `${p.name} ${p.variant} ${p.sku} ${p.category ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (categoryFilter === "all" || p.category === categoryFilter) && (productStatus === "all" || p.active === (productStatus === "active")));

  return <div className={`mode-workspace ${po ? "mode-po" : "mode-jastip"}`}>
    <div>
      {tab === "products" && <>
        <section className="card workspace-list-card" aria-label="Daftar produk">
          <div className="card-header list-import-header"><div><h2>Master produk PO</h2><p>Harga dan varian siap pakai untuk setiap pesanan.{!importAllowed && " Import template Excel tersedia di Pro."}</p></div><ExcelImportButton allowed={importAllowed} onClick={() => importAllowed ? setProductImportOpen(true) : onUpgrade()} /></div>
          <div className="list-toolbar" role="group" aria-label="Pencarian dan filter katalog">
            <div className="search-field"><Search size={18} /><input aria-label="Cari produk master" placeholder="Cari produk, varian, atau SKU..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div className="toolbar-filters">
              <Select className="input filter-input" aria-label="Filter produk" value={productStatus} onValueChange={setProductStatus}><SelectOption value="active">Produk aktif</SelectOption><SelectOption value="archived">Diarsipkan</SelectOption><SelectOption value="all">Semua produk</SelectOption></Select>
              <CategoryFilter categories={categories} value={categoryFilter} onValueChange={setCategoryFilter}/>
            </div>
          </div>
          {products.length > 0 ? <ProductsTable products={products} onEdit={onEditProduct} onDuplicate={onDuplicateProduct} onRemove={setRemovingProduct} /> : <WorkspaceEmptyState kind="products" hasData={data.products.length > 0} onReset={() => { setSearch(""); setProductStatus("all"); setCategoryFilter("all"); }} />}
          <div className="table-footer">{listCount(products.length, data.products.length, "produk")} {productLimit !== undefined && <span>{data.products.length} / {productLimit} produk Gratis (termasuk arsip)</span>}</div>
        </section>
      </>}
      {tab === "batches" && <section className="card workspace-list-card" aria-label={po ? "Daftar batch" : "Daftar perjalanan"}>
        <div className="card-header"><div><h2>{po ? "Daftar batch PO" : "Daftar perjalanan Jastip"}</h2><p>{po ? "Kelola periode PO dan kebutuhan produk setiap batch." : "Kelola perjalanan belanja dan rekap produk titipan."}</p></div></div>
        <div className="list-toolbar">
          <div className="search-field"><Search size={18} /><input aria-label={po ? "Cari batch" : "Cari perjalanan"} placeholder={po ? "Cari nama batch atau supplier..." : "Cari nama perjalanan atau lokasi..."} value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="toolbar-filters"><Select className="input filter-input" aria-label={po ? "Filter status batch" : "Filter status perjalanan"} value={batchStatus} onValueChange={setBatchStatus}><SelectOption value="all">Semua status</SelectOption><SelectOption value="open">Dibuka</SelectOption><SelectOption value="closed">Ditutup</SelectOption><SelectOption value="completed">Selesai</SelectOption></Select></div>
        </div>
        {filteredBatches.length > 0 ? <BatchesTable title={po ? "Daftar batch PO" : "Daftar perjalanan Jastip"} batches={filteredBatches} orders={orders} data={data} onEdit={onEditBatch} onStatus={onBatchStatus} /> : <WorkspaceEmptyState kind={po ? "batches" : "trips"} hasData={batches.length > 0} onReset={() => { setSearch(""); setBatchStatus("all"); }} />}
        <div className="table-footer">{listCount(filteredBatches.length, batches.length, po ? "batch PO" : "perjalanan")}</div>
      </section>}
      {tab === "orders" && <section className="card workspace-list-card" aria-label="Daftar pesanan">
        <div className="card-header list-import-header"><div><h2>Pesanan {po ? "Open PO" : "Jastip"}</h2><p>{importAllowed ? "Isi satu per satu atau sekaligus dari Excel." : "Isi pesanan secara manual. Import template Excel tersedia di Pro."}</p></div><ExcelImportButton allowed={importAllowed} onClick={() => importAllowed ? setImportOpen(true) : onUpgrade()} /></div>
        <div className="list-toolbar"><div className="search-field"><Search size={18} /><input aria-label="Cari pesanan" placeholder={`Cari pesanan ${po ? "PO" : "jastip"}...`} value={search} onChange={e => setSearch(e.target.value)} /></div><div className="toolbar-filters"><Select className="input filter-input" aria-label="Filter status pesanan" value={status} onValueChange={setStatus}><SelectOption value="all">Semua status</SelectOption><SelectOption value="unpaid">Belum lunas</SelectOption><SelectOption value="new">Tercatat</SelectOption><SelectOption value="shipped">Dikirim</SelectOption><SelectOption value="done">Selesai</SelectOption><SelectOption value="cancelled">Dibatalkan</SelectOption></Select><BatchPicker purpose="orders" batches={batches} type={type} value={batchFilter==="all"?"":batchFilter} onValueChange={value=>setBatchFilter(value||"all")}/></div></div>
        {filteredOrders.length > 0 ? <OrdersTable invoiceSettings={invoiceSettings} data={data} orders={filteredOrders} onEdit={onEditOrder} onStatus={onStatus} onRefund={onRefund} /> : <WorkspaceEmptyState kind="orders" hasData={orders.length > 0} onReset={() => { setSearch(""); setStatus("all"); setBatchFilter("all"); }} />}
        <div className="table-footer">{listCount(filteredOrders.length, orders.length, `pesanan ${po ? "PO" : "jastip"}`)}{!po && <span>Produk bebas, sesuai titipan pelanggan</span>}</div>
      </section>}

    </div>
    {removingProduct && <ProductRemovalDialog product={removingProduct} onClose={()=>setRemovingProduct(null)} onConfirm={()=>onProductStatus(removingProduct)} />}
    {productImportOpen && <ProductExcelImportDialog importAllowed={importAllowed} data={data} productLimit={productLimit} onImport={onImportProducts} onClose={()=>setProductImportOpen(false)}/> }
    {importOpen && <ExcelImportDialog importAllowed={importAllowed} type={type} data={data} defaultBatchId={batchFilter === "all" ? undefined : batchFilter} onImport={onImport} onClose={() => setImportOpen(false)} />}
  </div>;
}

function listCount(shown: number, total: number, label: string) {
  return `${shown}${shown !== total ? ` dari ${total}` : ""} ${label}`;
}

export function WorkspaceEmptyState({ kind, hasData, onReset }: { kind: "products" | "orders" | "batches" | "trips" | "customers"; hasData: boolean; onReset: () => void }) {
  const content = {
    customers: { label: "Pelanggan", empty: "Belum ada pelanggan", description: "Simpan nama dan nomor pelanggan melalui tombol Tambah pelanggan sebelum mencatat pesanan.", Icon: UsersRound },
    products: { label: "Produk", empty: "Belum ada produk", description: "Tambahkan produk melalui tombol Tambah produk atau import Excel.", Icon: Package },
    orders: { label: "Pesanan", empty: "Belum ada pesanan", description: "Tambahkan pesanan pertama melalui tombol Tambah pesanan.", Icon: ShoppingBag },
    batches: { label: "Batch", empty: "Belum ada batch PO", description: "Buat periode PO melalui tombol Tambah batch untuk mengumpulkan pesanan produkmu.", Icon: Layers3 },
    trips: { label: "Perjalanan", empty: "Belum ada perjalanan", description: "Tentukan perjalanan belanja melalui tombol Tambah perjalanan, lalu catat produk titipannya.", Icon: Layers3 },
  }[kind];
  return <div className="empty-state workspace-empty-state" role="status"><div className="empty-icon"><content.Icon size={26} aria-hidden="true" /></div><h3>{hasData ? `${content.label} tidak ditemukan` : content.empty}</h3><p>{hasData ? "Coba kata pencarian lain atau reset filter untuk melihat semua data." : content.description}</p>{hasData && <Button className="btn btn-secondary" onClick={onReset}>Reset filter {content.label.toLowerCase()}</Button>}</div>;
}

function ExcelImportButton({ allowed, onClick }: { allowed: boolean; onClick: () => void }) {
  return <Button className="btn btn-secondary excel-import-button" onClick={onClick}><Upload size={16} aria-hidden="true" /><span>Import Excel</span>{!allowed && <span className="import-plan-badge" aria-hidden="true">Pro</span>}</Button>;
}

export function ProductForm({ product, duplicate=false, categories, onSave, onClose }: { categories: string[]; product?: Product; duplicate?: boolean; onSave: (product: Product) => boolean | Promise<boolean>; onClose: () => void }) {
  const [name, setName] = useState(duplicate && product ? productDisplayName(product.name) : product?.name ?? "");
  const [variant, setVariant] = useState(product?.variant ?? "");
  const [store,setStore]=useState(product?.store ?? "");
  const [color,setColor]=useState(product?.color ?? "");
  const [size,setSize]=useState(product?.size ?? "");
  const [sku, setSku] = useState(duplicate ? "" : product?.sku ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [addingCategory, setAddingCategory] = useState(() => !product && !categories.some(value => value.trim()));
  const [newCategory, setNewCategory] = useState("");
  const categoryOptions = Array.from(new Set([...categories, category.trim()].filter(Boolean)));
  const [price, setPrice] = useState(product ? String(product.unitPrice) : "");
  const [cost, setCost] = useState(product?.unitCost == null ? "" : String(product.unitCost));
  const [error, setError] = useState("");
  const showDialog = (element: HTMLDialogElement | null) => { if (element && !element.open) element.showModal(); };
  return <dialog className="native-dialog" ref={showDialog} aria-label={duplicate ? "Duplikat produk" : product ? "Edit produk" : "Produk baru"} onCancel={(e) => { e.preventDefault(); onClose(); }}><div className="modal-header"><div><span className="eyebrow">MASTER PRODUK OPEN PO</span><h2>{duplicate ? "Duplikat produk" : product ? "Edit produk" : "Produk baru"}</h2><p>Simpan harga sekali, buat pesanan lebih cepat.</p></div><button className="icon-button" aria-label="Tutup produk" onClick={onClose}><X size={20} /></button></div><form onSubmit={async (e) => { e.preventDefault(); setError(""); if (!name.trim() || !price.trim() || !Number.isSafeInteger(Number(price)) || Number(price) < 0 || (cost.trim() && (!Number.isSafeInteger(Number(cost)) || Number(cost) < 0))) { setError("Isi nama dan harga jual. Nominal harus rupiah bulat, minimal nol."); return; } const saved = await onSave({ id: duplicate ? crypto.randomUUID() : product?.id ?? crypto.randomUUID(), name: name.trim(), variant: variant.trim(), store:store.trim(), color:color.trim(), size:size.trim(), sku: sku.trim(), category: (addingCategory ? newCategory : category).trim(), unitPrice: Number(price), unitCost: cost.trim() ? Number(cost) : null, active: duplicate ? true : product?.active ?? true }); if (!saved) setError("Produk belum tersimpan. Periksa data dan koneksi, lalu coba lagi."); }}><div className="modal-body"><div className="field"><label className="field-label" htmlFor="product-name">Nama produk<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama produk" id="product-name" className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Roti Sobek" /></div><div className="field">
  <label className="field-label" htmlFor="product-category">Kategori (opsional)</label>
  {addingCategory ? <input id="product-category" aria-label="Kategori (opsional)" className="input" maxLength={80} value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="Contoh: Roti manis, roti tawar" /> : <Select id="product-category" className="input" aria-label="Kategori (opsional)" placeholder="Pilih kategori" value={category.trim()} onValueChange={setCategory}>
    <SelectOption value="">Tanpa kategori</SelectOption>
    {categoryOptions.map(value => <SelectOption key={value} value={value}>{value}</SelectOption>)}
  </Select>}
  <button className="category-mode-toggle" type="button" role="switch" aria-checked={addingCategory} aria-controls="product-category" onClick={() => setAddingCategory(value => !value)}><span className="category-toggle-track" aria-hidden="true"><span /></span>Tambah Kategori</button>
  {addingCategory && <span className="field-hint">Kategori disimpan bersama produk dan bisa dipilih untuk produk berikutnya.</span>}
</div><div className="form-grid" style={{marginTop:20}}><div className="field"><label className="field-label" htmlFor="product-store">Supplier / brand (opsional)</label><input id="product-store" className="input" maxLength={80} value={store} onChange={e=>setStore(e.target.value)} placeholder="Contoh: Dapur Roti" /></div><div className="field"><label className="field-label" htmlFor="product-color">Warna (opsional)</label><input id="product-color" className="input" maxLength={80} value={color} onChange={e=>setColor(e.target.value)} placeholder="Contoh: Cokelat keemasan" /></div><div className="field"><label className="field-label" htmlFor="product-size">Ukuran (opsional)</label><input id="product-size" className="input" maxLength={80} value={size} onChange={e=>setSize(e.target.value)} placeholder="Contoh: Mini / reguler" /></div><div className="field"><label className="field-label" htmlFor="product-variant">Varian (opsional)</label><input id="product-variant" className="input" maxLength={80} value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Contoh: Cokelat / keju" /></div><div className="field"><label className="field-label" htmlFor="product-sku">SKU (opsional)</label><input id="product-sku" className="input" maxLength={60} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Contoh: ROTI-CKL-MINI" /></div><div className="field"><label className="field-label" htmlFor="product-price">Harga jual / unit<span className="required-mark" aria-hidden="true"> *</span></label><NumberInput aria-label="Harga jual / unit" id="product-price" className="input" required inputMode="numeric" min="0" step="1" value={price} onValueChange={(value) => setPrice(value)} placeholder="15.000" /></div><div className="field"><label className="field-label" htmlFor="product-cost">Harga beli / unit</label><NumberInput id="product-cost" className="input" inputMode="numeric" min="0" step="1" value={cost} onValueChange={(value) => setCost(value)} placeholder="Belum diketahui" /></div></div>{error && <p className="error-message" role="alert">{error}</p>}</div><div className="modal-footer"><Button className="btn btn-secondary" type="button" onClick={onClose}>Batal</Button><Button className="btn btn-primary" type="submit">Simpan produk</Button></div></form></dialog>;
}

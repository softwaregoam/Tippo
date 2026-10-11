"use client";
import { visibleOrderStatus } from "@/lib/order-status";

import { NumberInput } from "@/components/ui/number-input";

import { useState } from "react";
import { ArrowRight, Check, Layers3, Plus, Search, Tag, Upload, X } from "lucide-react";
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
  onNewBatch: () => void;
  onEditBatch: (batch: Batch) => void;
  onNewOrder: (batchId?: string, productId?: string) => void;
  onEditOrder: (order: Order) => void;
  onStatus: (order: Order, status: Order["status"]) => void;
  onBatchStatus: (batch: Batch, status: Batch["status"]) => boolean | Promise<boolean>;
  onHpp: (batch: Batch) => void;
  onSaveProduct: (product: Product) => boolean | Promise<boolean>;
  onRefund: (id: string, amount: number, date: string, reason: string, cancel: boolean) => Promise<boolean>;
  onImportProducts: (products: Product[]) => boolean | Promise<boolean>;
  onProductStatus: (product: Product) => boolean | Promise<boolean>;
  onImport: (orders: Order[], customers: AppData["customers"]) => boolean | Promise<boolean>;
  importAllowed: boolean;
  productLimit?: number;
  onUpgrade: () => void;
};

export function ModeWorkspace({ tab, type, data, onNewBatch, onEditBatch, onEditOrder, onStatus, onBatchStatus, onSaveProduct, onImportProducts, onRefund, onProductStatus, onImport, importAllowed, productLimit, onUpgrade }: Props) {
  const po = type === "po";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [categoryFilter,setCategoryFilter]=useState("all");
  const categories=[...new Set(data.products.map(p=>p.category?.trim()).filter((c):c is string=>Boolean(c)))].sort((a,b)=>a.localeCompare(b,"id"));
  const [removingProduct,setRemovingProduct]=useState<Product|null>(null);
  const [productStatus, setProductStatus] = useState("active");
  const [editingProduct, setEditingProduct] = useState<Product | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [productImportOpen, setProductImportOpen] = useState(false);
  const batches = data.batches.filter((b) => b.type === type);
  const batchIds = new Set(batches.map((b) => b.id));
  const orders = data.orders.filter((o) => batchIds.has(o.batchId));
  const productQuotaReached = productLimit !== undefined && data.products.length >= productLimit;
  function newProduct() { if (productQuotaReached) onUpgrade(); else setEditingProduct("new"); }
  const filteredOrders = orders.filter((o) => {
    const name = data.customers.find((c) => c.id === o.customerId)?.name ?? "";
    return `${orderLabel(o)} ${name}`.toLowerCase().includes(search.toLowerCase()) && (status === "all" || (status === "unpaid" ? outstanding(o) > 0 : visibleOrderStatus(o.status) === status)) && (batchFilter === "all" || o.batchId === batchFilter);
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const products = data.products.filter((p) => `${p.name} ${p.variant} ${p.sku} ${p.category ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (categoryFilter === "all" || p.category === categoryFilter) && (productStatus === "all" || p.active === (productStatus === "active")));

  return <div className={`mode-workspace ${po ? "mode-po" : "mode-jastip"}`}>
    <div>
      {tab === "products" && <>
        <section className="catalog-controls" aria-label="Pencarian dan filter katalog"><div className="catalog-toolbar"><div><h2>Master produk PO</h2><p>Harga dan varian siap pakai untuk setiap pesanan.{!importAllowed && " Import template Excel tersedia di Pro."}</p></div><div className="catalog-actions"><Button className="btn btn-secondary" onClick={()=>importAllowed ? setProductImportOpen(true) : onUpgrade()}><Upload size={16}/>Import produk Excel{!importAllowed && <span aria-hidden="true" className="status-tag">Pro</span>}</Button><Button className="btn btn-primary" onClick={newProduct}><Plus size={16} />Produk baru</Button></div></div>
        <div className="catalog-filters"><div className="search-field"><Search size={17} /><input aria-label="Cari produk master" placeholder="Cari produk, varian, atau SKU..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select className="input filter-input" aria-label="Filter produk" value={productStatus} onValueChange={(value) => setProductStatus(value)}><SelectOption value="active">Produk aktif</SelectOption><SelectOption value="archived">Diarsipkan</SelectOption><SelectOption value="all">Semua produk</SelectOption></Select><Select className="input filter-input" aria-label="Filter kategori produk" value={categoryFilter} onValueChange={setCategoryFilter}><SelectOption value="all">Semua kategori</SelectOption>{categories.map(category=><SelectOption key={category} value={category}>{category}</SelectOption>)}</Select></div></section>
        {!products.length && data.products.length > 0 && <div className="card empty-state"><h3>Produk tidak ditemukan</h3><p>Coba kata lain atau lihat semua produk, termasuk yang diarsipkan.</p><Button className="btn btn-secondary" onClick={() => { setSearch(""); setProductStatus("all"); setCategoryFilter("all"); }}>Reset filter produk</Button></div>}
        {products.length > 0 && <ProductsTable products={products} onEdit={setEditingProduct} onRemove={product=>product.active ? setRemovingProduct(product) : onProductStatus(product)} />}
        {!data.products.length && <div className="card empty-state"><h3>Belum ada produk</h3><p>Tambahkan produk melalui tombol Produk baru atau import Excel.</p></div>}
        <p className="catalog-note"><Tag size={14} />{productLimit !== undefined && <span>{data.products.length} / {productLimit} produk Gratis (termasuk arsip). </span>}Perubahan master berlaku untuk pesanan baru. Harga pesanan lama tetap tersimpan.</p>
      </>}
      {tab === "batches" && <>
        <div className="inline-heading"><span>{batches.length} {po ? "batch PO untuk katalogmu" : "perjalanan, semua titipanmu"}.</span><Button className="btn btn-secondary" onClick={onNewBatch}><Plus size={16} />{po ? "Batch PO baru" : "Batch jastip baru"}</Button></div>
        {batches.length > 0 && <BatchesTable title={po ? "Daftar batch PO" : "Daftar perjalanan Jastip"} batches={batches} orders={orders} onEdit={onEditBatch} onStatus={onBatchStatus} />}
        {!batches.length && <div className="card empty-state"><div className="empty-icon"><Layers3 size={26} /></div><h3>{po ? "Katalog siap, mulai batch pertamamu" : "Perjalanan pertama dimulai di sini"}</h3><p>{po ? "Buat periode PO untuk mengumpulkan pesanan produkmu." : "Tentukan perjalanan belanja, lalu catat barang titipannya."}</p><Button className="btn btn-primary" onClick={onNewBatch}>{po ? "Batch PO baru" : "Batch jastip baru"}</Button></div>}
      </>}
      {tab === "orders" && <section className="card"><div className="card-header"><div><h2>Pesanan {po ? "Open PO" : "Jastip"}</h2><p>{importAllowed ? "Isi satu per satu atau sekaligus dari Excel." : "Isi pesanan secara manual. Import template Excel tersedia di Pro."}</p></div><Button className="btn btn-secondary" onClick={() => importAllowed ? setImportOpen(true) : onUpgrade()}><Upload size={15} />Import Excel{!importAllowed && <span aria-hidden="true" className="status-tag">Pro</span>}</Button></div><div className="list-toolbar"><div className="search-field"><Search size={18} /><input aria-label="Cari pesanan" placeholder={`Cari pesanan ${po ? "PO" : "jastip"}...`} value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="toolbar-filters"><Select className="input filter-input" aria-label="Filter status pesanan" value={status} onValueChange={(value) => setStatus(value)}><SelectOption value="all">Semua status</SelectOption><SelectOption value="unpaid">Belum lunas</SelectOption><SelectOption value="new">Tercatat</SelectOption><SelectOption value="shipped">Dikirim</SelectOption><SelectOption value="done">Selesai</SelectOption><SelectOption value="cancelled">Dibatalkan</SelectOption></Select><Select className="input filter-input" aria-label="Filter batch" value={batchFilter} onValueChange={(value) => setBatchFilter(value)}><SelectOption value="all">Semua {po ? "batch PO" : "perjalanan"}</SelectOption>{batches.map((b) => <SelectOption value={b.id} key={b.id}>{b.name}</SelectOption>)}</Select></div></div><OrdersTable data={data} orders={filteredOrders} onEdit={onEditOrder} onStatus={onStatus} onRefund={onRefund} /><div className="table-footer">{filteredOrders.length} pesanan {po ? "PO" : "jastip"}<span>{po ? "Harga dari master, tersimpan per pesanan" : "Barang bebas, sesuai titipan pelanggan"}</span></div></section>}
    </div>
    {removingProduct && <ProductRemovalDialog product={removingProduct} onClose={()=>setRemovingProduct(null)} onConfirm={()=>onProductStatus(removingProduct)} />}
    {editingProduct && <ProductForm categories={categories} product={editingProduct === "new" ? undefined : editingProduct} onClose={() => setEditingProduct(null)} onSave={async (product) => { const saved = await onSaveProduct(product); if (saved) setEditingProduct(null); return saved; }} />}
    {productImportOpen && <ProductExcelImportDialog importAllowed={importAllowed} data={data} productLimit={productLimit} onImport={onImportProducts} onClose={()=>setProductImportOpen(false)}/> }
    {importOpen && <ExcelImportDialog importAllowed={importAllowed} type={type} data={data} defaultBatchId={batchFilter === "all" ? undefined : batchFilter} onImport={onImport} onClose={() => setImportOpen(false)} />}
  </div>;
}

function ProductForm({ product, categories, onSave, onClose }: { categories: string[]; product?: Product; onSave: (product: Product) => boolean | Promise<boolean>; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [variant, setVariant] = useState(product?.variant ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const categoryOptions = Array.from(new Set([...categories, category.trim()].filter(Boolean)));
  const [price, setPrice] = useState(product ? String(product.unitPrice) : "");
  const [cost, setCost] = useState(product?.unitCost == null ? "" : String(product.unitCost));
  const [error, setError] = useState("");
  const showDialog = (element: HTMLDialogElement | null) => { if (element && !element.open) element.showModal(); };
  return <dialog className="native-dialog" ref={showDialog} aria-label={product ? "Edit produk" : "Produk baru"} onCancel={(e) => { e.preventDefault(); onClose(); }}><div className="modal-header"><div><span className="eyebrow">MASTER PRODUK OPEN PO</span><h2>{product ? "Edit produk" : "Produk baru"}</h2><p>Simpan harga sekali, buat pesanan lebih cepat.</p></div><button className="icon-button" aria-label="Tutup produk" onClick={onClose}><X size={20} /></button></div><form onSubmit={async (e) => { e.preventDefault(); setError(""); if (!name.trim() || !price.trim() || !Number.isSafeInteger(Number(price)) || Number(price) < 0 || (cost.trim() && (!Number.isSafeInteger(Number(cost)) || Number(cost) < 0))) { setError("Isi nama dan harga jual. Nominal harus rupiah bulat, minimal nol."); return; } const saved = await onSave({ id: product?.id ?? crypto.randomUUID(), name: name.trim(), variant: variant.trim(), sku: sku.trim(), category: (addingCategory ? newCategory : category).trim(), unitPrice: Number(price), unitCost: cost.trim() ? Number(cost) : null, active: product?.active ?? true }); if (!saved) setError("Produk belum tersimpan. Periksa data dan koneksi, lalu coba lagi."); }}><div className="modal-body"><div className="field"><label className="field-label" htmlFor="product-name">Nama produk<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama produk" id="product-name" className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Kaos Studio Oversize" /></div><div className="field">
  <label className="field-label" htmlFor="product-category">Kategori (opsional)</label>
  {addingCategory ? <input id="product-category" aria-label="Kategori (opsional)" className="input" maxLength={80} value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="Contoh: Makanan, pakaian, skincare" /> : <Select id="product-category" className="input" aria-label="Kategori (opsional)" placeholder="Pilih kategori" value={category.trim()} onValueChange={setCategory}>
    <SelectOption value="">Tanpa kategori</SelectOption>
    {categoryOptions.map(value => <SelectOption key={value} value={value}>{value}</SelectOption>)}
  </Select>}
  <button className="category-mode-toggle" type="button" role="switch" aria-checked={addingCategory} aria-controls="product-category" onClick={() => setAddingCategory(value => !value)}><span className="category-toggle-track" aria-hidden="true"><span /></span>Kategori manual</button>
  {addingCategory && <span className="field-hint">Kategori disimpan bersama produk dan bisa dipilih untuk produk berikutnya.</span>}
</div><div className="form-grid" style={{marginTop:20}}><div className="field"><label className="field-label" htmlFor="product-variant">Varian (opsional)</label><input id="product-variant" className="input" maxLength={80} value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Contoh: Navy · ukuran M" /></div><div className="field"><label className="field-label" htmlFor="product-sku">SKU (opsional)</label><input id="product-sku" className="input" maxLength={60} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Contoh: STUDIO-NV-M" /></div><div className="field"><label className="field-label" htmlFor="product-price">Harga jual / unit<span className="required-mark" aria-hidden="true"> *</span></label><NumberInput aria-label="Harga jual / unit" id="product-price" className="input" required inputMode="numeric" min="0" step="1" value={price} onValueChange={(value) => setPrice(value)} placeholder="185.000" /></div><div className="field"><label className="field-label" htmlFor="product-cost">Harga beli / unit</label><NumberInput id="product-cost" className="input" inputMode="numeric" min="0" step="1" value={cost} onValueChange={(value) => setCost(value)} placeholder="Belum diketahui" /><span className="field-hint">Boleh kosong. HPP pesanan akan ditandai belum lengkap.</span></div></div><div className="master-info"><Check size={16} /><p>Harga dan nama disalin saat pesanan dibuat. Mengedit master tidak mengubah histori pesanan.</p></div>{error && <p className="error-message" role="alert">{error}</p>}</div><div className="modal-footer"><Button className="btn btn-secondary" type="button" onClick={onClose}>Batal</Button><Button className="btn btn-primary" type="submit">Simpan produk <ArrowRight size={15} /></Button></div></form></dialog>;
}

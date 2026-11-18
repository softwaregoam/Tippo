"use client";
import { useId, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { Archive, ArchiveRestore, Check, ChevronDown, Copy, PackagePlus, Pencil, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectOption } from "@/components/ui/select";
import { CategoryFilter } from "@/components/category-filter";
import { MobileDataList } from "@/components/mobile-data-list";
import type { AppData, Product, ProductPackage } from "@/lib/types";

export function PackageWorkspace({ data, onPackageStatus, onEditPackage, onDuplicatePackage }: {
  data: AppData;
  onSavePackage: (p: ProductPackage) => boolean | Promise<boolean>;
  onPackageStatus: (p: ProductPackage) => boolean | Promise<boolean>;
  onEditPackage: (p: ProductPackage) => void;
  onDuplicatePackage: (p: ProductPackage) => void;
}) {
  const [search, setSearch] = useState("");
  const [packageStatus, setPackageStatus] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [removingPackage, setRemovingPackage] = useState<ProductPackage | null>(null);
  const productById = new Map(data.products.map((p) => [p.id, p]));
  const categories = [...new Set((data.packages ?? []).map((p) => p.category?.trim()).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "id"));
  const packages = (data.packages ?? []).filter((p) => {
    const memberNames = p.productIds.map((id) => productById.get(id)?.name ?? id).join(", ");
    return `${p.name} ${p.sku} ${p.category ?? ""} ${memberNames}`.toLowerCase().includes(search.trim().toLowerCase())
      && (categoryFilter === "all" || (p.category?.trim() ?? "") === categoryFilter)
      && (packageStatus === "all" || p.active === (packageStatus === "active"));
  });
  const activeProducts = data.products.filter((p) => p.active);

  const packageTitle = (pack: ProductPackage) => pack.name.trim() || "Paket tanpa nama";
  const memberLabel = (pack: ProductPackage) => pack.productIds.map((id) => productById.get(id)?.name ?? id).join(", ") || "Belum ada produk";
  const packageCostLabel = (pack: ProductPackage) => pack.unitCost === undefined || pack.unitCost === null ? "Belum diisi" : formatCurrency(pack.unitCost);
  const packageCategory = (pack: ProductPackage) => pack.category?.trim() || "Belum diisi";

  return <div>
    <section className="card workspace-list-card" aria-label="Daftar produk paket">
      <div className="card-header list-import-header"><div><h2>Produk Paket</h2><p>Gabungkan produk katalog jadi satu paket dengan harga jual paket baru.</p></div></div>
      <div className="list-toolbar" role="group" aria-label="Pencarian dan filter paket">
        <div className="search-field"><Search size={18} /><input aria-label="Cari produk paket" placeholder="Cari nama paket, SKU, kategori, atau produk anggota..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="toolbar-filters">
          <Select className="input filter-input" aria-label="Filter paket" value={packageStatus} onValueChange={setPackageStatus}>
            <SelectOption value="active">Paket aktif</SelectOption>
            <SelectOption value="archived">Diarsipkan</SelectOption>
            <SelectOption value="all">Semua paket</SelectOption>
          </Select>
          <CategoryFilter categories={categories} value={categoryFilter} onValueChange={setCategoryFilter} label="paket" />
        </div>
      </div>
      <MobileDataList entries={packages.map(pack => ({
        id: pack.id,
        title: packageTitle(pack),
        dialogClassName: "package-data-dialog",
        subtitle: <span className="package-mobile-members">{pack.category?.trim() ? `${pack.category.trim()} · ` : ""}{memberLabel(pack)}</span>,
        meta: <span className="package-mobile-price"><span>Harga paket</span><strong>{formatCurrency(pack.unitPrice)}</strong></span>,
        status: pack.active ? "Aktif" : "Diarsipkan",
        statusClassName: `status-tag package-status-${pack.active ? "active" : "archived"}`,
        details: <><div className="package-detail-summary"><div><span>Harga paket</span><strong>{formatCurrency(pack.unitPrice)}</strong></div><div><span>HPP paket</span><strong>{packageCostLabel(pack)}</strong></div><div><span>Kategori</span><span>{packageCategory(pack)}</span></div><div><span>Produk anggota</span><span>{memberLabel(pack)}</span></div><span className={`status-tag package-status-${pack.active ? "active" : "archived"}`}>{pack.active ? "Aktif" : "Diarsipkan"}</span></div><dl className="mobile-detail-fields"><dt>SKU</dt><dd>{pack.sku || "Belum diisi"}</dd><dt>Kategori</dt><dd>{packageCategory(pack)}</dd><dt>HPP</dt><dd>{packageCostLabel(pack)}</dd><dt>Produk anggota</dt><dd>{memberLabel(pack)}</dd></dl><button className="btn btn-secondary package-mobile-action" data-close-detail onClick={() => onPackageStatus(pack)}>{pack.active ? <Archive size={16} /> : <ArchiveRestore size={16} />} {pack.active ? "Arsipkan paket" : "Aktifkan kembali"}</button><button className="btn btn-secondary package-mobile-action" data-close-detail onClick={() => onDuplicatePackage(pack)}><Copy size={16} />Duplikat paket</button><button className="btn btn-primary package-mobile-action" data-close-detail onClick={() => onEditPackage(pack)}>Edit paket</button></>,
      }))} />
      <div className="card management-table-wrap desktop-data-table"><table className="management-table" aria-label="Daftar produk paket">
        <thead><tr><th scope="col">Nama paket</th><th scope="col">SKU</th><th scope="col">Produk anggota</th><th scope="col" className="numeric">Harga paket</th><th scope="col">Status</th><th scope="col">Aksi</th></tr></thead>
        <tbody>{packages.length > 0 ? packages.map(pack => <tr key={pack.id}>
          <td data-label="Nama paket"><h3>{packageTitle(pack)}</h3><p className="package-category">{packageCategory(pack)}</p></td>
          <td data-label="SKU">{pack.sku || "Belum diisi"}</td>
          <td data-label="Produk anggota"><p className="package-members">{memberLabel(pack)}</p></td>
          <td data-label="Harga paket" className="numeric"><strong>{formatCurrency(pack.unitPrice)}</strong><small className="package-cost">HPP {packageCostLabel(pack)}</small></td>
          <td data-label="Status"><span className={`status-tag package-status-${pack.active ? "active" : "archived"}`}>{pack.active ? "Aktif" : "Diarsipkan"}</span></td>
          <td data-label="Aksi"><div className="management-actions"><button className="icon-button" aria-label={`Edit paket ${packageTitle(pack)}`} onClick={() => onEditPackage(pack)}><Pencil size={16} /></button><button className="icon-button" aria-label={pack.active ? `Arsipkan paket ${packageTitle(pack)}` : `Aktifkan kembali paket ${packageTitle(pack)}`} onClick={() => onPackageStatus(pack)}>{pack.active ? <Archive size={16} /> : <ArchiveRestore size={16} />}</button></div></td>
        </tr>) : <tr><td colSpan={6} className="empty-row"><p>Belum ada produk paket.</p></td></tr>}</tbody>
      </table></div>
      {packages.length === 0 && activeProducts.length === 0 && <div className="empty-state workspace-empty-state" role="status"><div className="empty-icon"><PackagePlus size={26} aria-hidden="true" /></div><h3>Belum ada produk</h3><p>Tambahkan produk terlebih dahulu sebelum membuat produk paket.</p><Button className="btn btn-secondary" onClick={() => { }} disabled>Buat produk dulu</Button></div>}
      <div className="table-footer">{packages.length} paket</div>
    </section>
    {removingPackage && <dialog className="native-dialog" ref={el => { if (el && !el.open) el.showModal(); }} aria-label={`Arsipkan ${removingPackage.name}`} onCancel={(e) => { e.preventDefault(); setRemovingPackage(null); }}><div className="modal-header"><div><h2>Arsipkan paket?</h2><p>Paket yang diarsipkan tidak akan muncul dalam daftar paket aktif, tapi histori tetap tersimpan.</p></div><button className="icon-button" aria-label="Batal" onClick={() => setRemovingPackage(null)}><X size={20} /></button></div><div className="modal-body"><p>Yakin ingin mengarsipkan <strong>{packageTitle(removingPackage)}</strong>?</p></div><div className="modal-footer"><Button type="button" className="btn btn-secondary" onClick={() => setRemovingPackage(null)}>Batal</Button><Button type="button" className="btn btn-primary" onClick={() => { onPackageStatus(removingPackage); setRemovingPackage(null); }}>{removingPackage.active ? "Arsipkan paket" : "Aktifkan kembali"}</Button></div></dialog>}
  </div>;
}

export function ProductPackageForm({ products, pack, onSave, onClose }: {
  products: Product[];
  pack?: ProductPackage;
  onSave: (p: ProductPackage) => boolean | Promise<boolean>;
  onClose: () => void;
}) {
  const showDialog = (element: HTMLDialogElement | null) => { if (element && !element.open) element.showModal(); };
  const [name, setName] = useState(pack ? pack.name : "");
  const [sku, setSku] = useState(pack ? pack.sku : "");
  const [category, setCategory] = useState(pack?.category ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(pack ? [...pack.productIds] : []);
  const [price, setPrice] = useState(pack ? String(pack.unitPrice) : "");
  const [cost, setCost] = useState(pack && pack.unitCost !== undefined && pack.unitCost !== null ? String(pack.unitCost) : "");
  const [error, setError] = useState("");
  const productById = new Map(products.map((p) => [p.id, p]));
  const [pickerPortal, setPickerPortal] = useState<HTMLDivElement | null>(null);
  const toggleProduct = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);  return <dialog ref={showDialog} className="native-dialog" onCancel={(e) => { e.preventDefault(); onClose(); }} aria-label={pack ? "Edit produk paket" : "Produk paket baru"}><div className="modal-header"><div><span className="eyebrow">PRODUK PAKET</span><h2>{pack ? "Edit paket" : "Paket baru"}</h2><p>Gabungkan produk yang sudah ada menjadi satu paket dengan harga jual baru.</p></div><button className="icon-button" aria-label="Tutup paket" onClick={onClose}><X size={20} /></button></div><form onSubmit={async (e) => { e.preventDefault(); setError(""); if (!name.trim()) { setError("Isi nama paket."); return; } if (selectedIds.length === 0) { setError("Pilih setidaknya satu produk anggota."); return; } if (!price.trim() || !Number.isSafeInteger(Number(price)) || Number(price) < 0) { setError("Isi harga paket. Nominal harus rupiah bulat, minimal nol."); return; } if (cost.trim() && (!Number.isSafeInteger(Number(cost)) || Number(cost) < 0)) { setError("Harga beli paket harus rupiah bulat, minimal nol."); return; } const saved = await onSave({ id: pack ? pack.id : crypto.randomUUID(), name: name.trim(), sku: sku.trim(), category: category.trim(), productIds: selectedIds, unitPrice: Number(price), unitCost: cost.trim() ? Number(cost) : null, active: pack ? pack.active : true }); if (!saved) setError("Paket belum tersimpan. Periksa data dan koneksi, lalu coba lagi."); }}><div className="modal-body"><div className="field"><label className="field-label" htmlFor="package-name">Nama paket<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama paket" id="package-name" className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Paket Roti Sobek" /></div><div className="field"><label className="field-label" htmlFor="package-sku">SKU paket (opsional)</label><input id="package-sku" className="input" maxLength={60} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Contoh: ROTI-SOBEK-SET" /></div><div className="field"><label className="field-label" htmlFor="package-category">Kategori (opsional)</label><input id="package-category" className="input" maxLength={80} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Contoh: Roti manis" /></div><div className="field"><label className="field-label" htmlFor="package-members">Produk anggota<span className="required-mark" aria-hidden="true"> *</span></label><PackageMemberPicker id="package-members" products={products} selectedIds={selectedIds} onToggle={toggleProduct} container={pickerPortal} />{selectedIds.length === 0 ? <p className="field-hint">Belum ada produk dipilih. Paket wajib berisi minimal satu produk.</p> : <div className="package-selected-members">{selectedIds.map(id => { const product = productById.get(id); return <span key={id} className="package-selected-chip"><span>{product ? productDisplay(product) : id}</span><button type="button" className="icon-button" aria-label={`Hapus ${product ? productDisplay(product) : id} dari paket`} onClick={() => toggleProduct(id)}><X size={14} aria-hidden="true" /></button></span>; })}</div>}</div><div className="field"><label className="field-label" htmlFor="package-price">Harga jual paket<span className="required-mark" aria-hidden="true"> *</span></label><NumberInput aria-label="Harga jual paket" id="package-price" className="input" min="0" step="1" value={price} onValueChange={(value) => setPrice(value)} placeholder="Contoh: 450.000" /></div><div className="field"><label className="field-label" htmlFor="package-cost">Harga beli paket / HPP (opsional)</label><NumberInput aria-label="Harga beli paket" id="package-cost" className="input" min="0" step="1" value={cost} onValueChange={(value) => setCost(value)} placeholder="Belum diketahui" /></div>{error && <p className="error-message" role="alert">{error}</p>}</div><div className="modal-footer"><Button type="button" className="btn btn-secondary" onClick={onClose}>Batal</Button><Button type="submit" className="btn btn-primary">{pack ? "Simpan paket" : "Simpan paket baru"}</Button></div></form><div ref={setPickerPortal} /></dialog>;

}
function productDisplay(p: Product) {
  return [p.name, p.variant.trim()].filter(Boolean).join(" ") || "Produk tanpa nama";
}

const normalizeText = (text: string) => text.normalize("NFKC").toLocaleLowerCase("id").replace(/\s+/g, " ").trim();

function PackageMemberPicker({ id, products, selectedIds, onToggle, container }: {
  id?: string;
  products: Product[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  container?: HTMLElement | null;
}) {
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  const filtered = products.filter((product) => {
    const text = normalizeText([product.name, product.variant, product.color, product.size, product.store, product.sku, product.category].filter(Boolean).join(" "));
    return tokens.every((token) => text.includes(token));
  });
  return <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setQuery(""); }}>
    <Popover.Trigger asChild>
      <button type="button" id={id} className="package-member-trigger" aria-haspopup="dialog" aria-controls={contentId} aria-expanded={open} disabled={products.length === 0}>
        <span className="package-member-trigger-label"><PackagePlus size={18} aria-hidden="true" />Pilih produk</span>
        <span className="package-member-trigger-meta">{selectedIds.length > 0 ? `${selectedIds.length} dipilih` : "Belum ada"}<ChevronDown size={16} aria-hidden="true" /></span>
      </button>
    </Popover.Trigger>
    <Popover.Portal container={container}><div className="product-picker-portal">
      {open && <div className="product-picker-scrim" onClick={() => setOpen(false)} />}
      <Popover.Content id={contentId} data-product-picker className="product-picker" sideOffset={6} collisionPadding={12} aria-label="Pilih produk anggota paket" aria-modal="true" onOpenAutoFocus={(event) => { event.preventDefault(); search.current?.focus({ preventScroll: true }); }}>
        <div className="product-picker-heading"><div><h2>Pilih produk</h2><p className="field-hint">Centang produk yang digabung ke paket ini.</p></div><Popover.Close className="icon-button" aria-label="Tutup pilihan produk"><X size={18} /></Popover.Close></div>
        <div className="product-picker-search"><Search size={18} aria-hidden="true" /><input ref={search} aria-label="Cari produk anggota" placeholder="Nama, SKU, varian, atau kategori…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button className="icon-button" type="button" aria-label="Hapus pencarian produk" onClick={() => { setQuery(""); search.current?.focus(); }}><X size={16} /></button>}</div>
        <p className="product-picker-count" role="status">{filtered.length} dari {products.length} produk · {selectedIds.length} dipilih</p>
        <div className="product-picker-list" role="group" aria-label="Produk tersedia">
          {filtered.map((product) => {
            const checked = selectedIds.includes(product.id);
            return <label key={product.id} className="product-picker-option package-picker-option" data-selected={checked}>
              <input type="checkbox" className="package-member-checkbox" checked={checked} onChange={() => onToggle(product.id)} />
              <span className="package-picker-details"><strong>{productDisplay(product)}</strong>{product.category && <small>Kategori: {product.category}</small>}{product.store?.trim() && <small>Supplier: {product.store.trim()}</small>}{product.sku && <small>SKU: {product.sku}</small>}{product.color?.trim() && <small>Warna: {product.color.trim()}</small>}{product.size?.trim() && <small>Ukuran: {product.size.trim()}</small>}</span>
              <span className="product-picker-price">{formatCurrency(product.unitPrice)}{checked && <Check size={16} aria-hidden="true" />}</span>
            </label>;
          })}
        </div>
        {!filtered.length && <div className="empty-state compact"><strong>Produk tidak ditemukan</strong><p>Coba nama, SKU, varian, atau kategori lain.</p><button type="button" className="btn btn-secondary" onClick={() => { setQuery(""); search.current?.focus(); }}>Reset pencarian</button></div>}
        <div className="product-picker-footer"><span>{selectedIds.length > 0 ? `${selectedIds.length} produk dipilih` : "Belum ada produk dipilih"}</span><Button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>Selesai</Button></div>
      </Popover.Content>
    </div></Popover.Portal>
  </Popover.Root>;
}
"use client";
import { CustomerPicker } from "./customer-picker";

import { ProductPicker, type ProductChoice } from "@/components/product-picker";
import { NumberInput } from "@/components/ui/number-input";
import { DatePicker } from "@/components/ui/date-picker";
import { OrderShippingFields } from "@/components/order-shipping-fields";
import { shippingFieldErrors } from "@/lib/order-shipping";
import { OrderDiscountFields } from "@/components/order-discount-fields";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency, itemLabel, orderDiscount, orderSubtotal, orderHpp, orderRevenue, outstanding } from "@/lib/finance";
import type { AppData, Customer, Order, OrderItem } from "@/lib/types";

type PoOrderFormProps = {
  saveError?: string;
  saving?: boolean;
  data: AppData;
  order?: Order;
  onSave: (order: Order, customer?: Customer) => void;
  onClose: () => void;
};
type Fields = {
  batchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paid: string;
  shippingCharge: string;
  discountType: "amount" | "percent";
  discountValue: string;
  serviceFee: string;
  date: string;
  notes: string;
  shippingDate: string;
  shippingTime: string;
  shippingMethod: string;
};
type ItemFields = { id: string; productId: string; quantity: string };
type FieldErrors = Partial<Record<keyof Fields | "items", string>>;
type ItemErrors = Record<string, Partial<Record<"productId" | "quantity", string>>>;
const textLimits = { customerName: 120, customerPhone: 30, customerAddress: 1000, notes: 1000 };

function originalProductValue(item: OrderItem) {
  return item.productId ?? `original-order-snapshot-${item.id}`;
}

function previewAmount(value: string) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

export function PoOrderForm({ data, order, onSave, onClose, saveError, saving }: PoOrderFormProps) {
  const poBatches = data.batches.filter((batch) => batch.type === "po");
  const [fields, setFields] = useState<Fields>(() => ({
    batchId: order?.batchId ?? (poBatches.filter(batch=>batch.status === "open").length === 1 ? poBatches.find(batch=>batch.status === "open")?.id : "") ?? "",
    customerId: order?.customerId ?? "",
    customerName: "", customerPhone: "", customerAddress: "",
    paid: order ? String(order.paid) : "", shippingCharge: order ? String(order.shippingCharge) : "", serviceFee: order ? String(order.serviceFee) : "",
    discountType: order?.discount?.type ?? "amount", discountValue: order?.discount ? String(order.discount.value) : "",
    date: order?.date ?? "", notes: order?.notes ?? "",
    shippingDate:order?.shippingDate??"",shippingTime:order?.shippingTime??"",shippingMethod:order?.shippingMethod??"",
  }));
  const [items, setItems] = useState<ItemFields[]>(() => order?.items.map((item) => ({
    id: item.id, productId: originalProductValue(item), quantity: String(item.quantity),
  })) ?? [{
    id: crypto.randomUUID(),
    productId: "",
    quantity: "",
  }]);
  const [createdAt] = useState(() => order?.createdAt ?? new Date().toISOString());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [itemErrors, setItemErrors] = useState<ItemErrors>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLButtonElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const closeRef = useRef(onClose);
  const pendingItemFocus = useRef<string | null>(null);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (pendingItemFocus.current) {
      modalRef.current?.querySelector<HTMLButtonElement>(`[name="item-${pendingItemFocus.current}-productId"]`)?.focus();
      pendingItemFocus.current = null;
    }
  }, [items]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector<HTMLButtonElement>(".modal-header button")?.focus({ preventScroll: true });
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector(".select-content, .product-picker")) return;
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modalRef.current.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modalRef.current.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow; previousFocus?.focus();
    };
  }, []);

  function originalItem(item: ItemFields) { return order?.items.find((entry) => entry.id === item.id); }
  function usesOriginalSnapshot(item: ItemFields) {
    const original = originalItem(item);
    return Boolean(original && item.productId === originalProductValue(original));
  }
  function canUseProduct(item: ItemFields) {
    return usesOriginalSnapshot(item) || data.products.some((product) => product.id === item.productId && product.active);
  }
  const selectedBatch = poBatches.find((batch) => batch.id === fields.batchId);
  const canUseSelectedBatch = Boolean(selectedBatch && (selectedBatch.status === "open" || selectedBatch.id === order?.batchId));
  const hasOpenBatch = poBatches.some((batch) => batch.status === "open");
  const batchHint = !hasOpenBatch
    ? order && canUseSelectedBatch
      ? "Belum ada batch PO aktif. Pesanan ini tetap dapat diedit pada batch asalnya."
      : "Buat atau buka batch PO sebelum menambahkan pesanan."
    : undefined;

  const draft = useMemo<Order>(() => ({
    id: order?.id ?? "draft-po-order-preview", batchId: fields.batchId, customerId: fields.customerId,
    items: items.map((item) => {
      const original = order?.items.find((entry) => entry.id === item.id);
      if (original && item.productId === originalProductValue(original)) return { ...original, quantity: previewAmount(item.quantity) };
      const product = data.products.find((entry) => entry.id === item.productId);
      return {
        id: item.id, productId: product?.id ?? null, product: product?.name ?? "", variant: product?.variant ?? "", store: product?.store ?? "", color: product?.color ?? "", size: product?.size ?? "",
        quantity: previewAmount(item.quantity), unitPrice: product?.unitPrice ?? 0, unitCost: product?.unitCost ?? null,
      };
    }),
    serviceFee: previewAmount(fields.serviceFee), shippingCharge: previewAmount(fields.shippingCharge), paid: previewAmount(fields.paid),
    discount: { type: fields.discountType, value: previewAmount(fields.discountValue) }, refunds: order?.refunds,
    date: fields.date, createdAt, status: order?.status ?? "new", notes: fields.notes.trim(),
    shippingDate:fields.shippingDate||undefined,shippingTime:fields.shippingTime||undefined,shippingMethod:fields.shippingMethod.trim()||undefined,
  }), [fields, items, order, data.products, createdAt]);
  const revenue = orderRevenue(draft);
  const previewOrders = [...data.orders.filter((entry) => entry.id !== draft.id), draft];
  const hpp = orderHpp(draft, previewOrders, data.batches);
  const hasActiveProducts = data.products.some((product) => product.active);

  function update(name: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current }; delete next[name];
      if (name === "customerId") { delete next.customerName; delete next.customerPhone; delete next.customerAddress; }
      return next;
    });
  }

  function updateItem(id: string, name: "productId" | "quantity", value: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [name]: value } : item));
    setItemErrors((current) => { const next = { ...current, [id]: { ...current[id] } }; delete next[id][name]; return next; });
    setErrors((current) => { const next = { ...current }; delete next.items; return next; });
  }

  function addItem() {
    if (items.length >= 100 || !hasActiveProducts) return;
    const item = { id: crypto.randomUUID(), productId: "", quantity: "" };
    pendingItemFocus.current = item.id; setItems((current) => [...current, item]);
  }

  function removeItem(id: string) {
    if (items.length <= 1) return;
    setItems((current) => current.filter((item) => item.id !== id));
    setItemErrors((current) => { const next = { ...current }; delete next[id]; return next; });
    setErrors((current) => { const next = { ...current }; delete next.items; return next; });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {}; const nextItemErrors: ItemErrors = {};
    if (!selectedBatch) nextErrors.batchId = "Pilih batch PO yang aktif.";
    else if (!canUseSelectedBatch) nextErrors.batchId = "Batch sudah ditutup. Pilih batch PO yang masih aktif.";
    if (fields.customerId === "new") {
      if (!fields.customerName.trim()) nextErrors.customerName = "Isi nama pelanggan.";
    } else if (!data.customers.some((customer) => customer.id === fields.customerId)) nextErrors.customerId = "Pilih pelanggan.";
    for (const [name, limit] of Object.entries(textLimits)) {
      const field = name as keyof typeof textLimits;
      if (fields[field].length > limit) nextErrors[field] = `Maksimal ${limit} karakter.`;
    }
    if (items.length < 1 || items.length > 100) nextErrors.items = "Isi 1 sampai 100 produk dalam satu pesanan.";
    for (const item of items) {
      const rowErrors: Partial<Record<"productId" | "quantity", string>> = {};
      if (!canUseProduct(item)) rowErrors.productId = "Pilih produk aktif dari master produk.";
      const quantity = Number(item.quantity);
      if (item.quantity.trim() === "" || !Number.isSafeInteger(quantity) || quantity < 1) rowErrors.quantity = "Jumlah harus berupa angka bulat minimal 1.";
      const itemDraft = draft.items.find((entry) => entry.id === item.id)!;
      if (!rowErrors.quantity && (!Number.isSafeInteger(quantity * itemDraft.unitPrice) || (itemDraft.unitCost !== null && !Number.isSafeInteger(quantity * itemDraft.unitCost)))) rowErrors.quantity = "Total harga terlalu besar. Kurangi jumlah produk.";
      if (Object.keys(rowErrors).length) nextItemErrors[item.id] = rowErrors;
    }
    for (const name of ["paid", "shippingCharge", "serviceFee"] as const) {
      const value = Number(fields[name]);
      if (!Number.isSafeInteger(value) || value < 0) nextErrors[name] = "Masukkan angka bulat minimal 0.";
    }
    const discountValue = Number(fields.discountValue);
    if (!Number.isSafeInteger(discountValue) || discountValue < 0) nextErrors.discountValue = "Masukkan diskon berupa angka bulat minimal 0.";
    else if (fields.discountType === "percent" && discountValue > 100) nextErrors.discountValue = "Diskon maksimal 100%.";
    else if (fields.discountType === "amount" && discountValue > orderSubtotal(draft) + draft.shippingCharge) nextErrors.discountValue = "Diskon tidak boleh melebihi total tagihan sebelum diskon.";
    if (!nextErrors.paid && Number(fields.paid) > revenue) nextErrors.paid = "Pembayaran tidak boleh melebihi total tagihan setelah diskon.";
    if (order?.status === "cancelled" && Number(fields.paid) > 0) nextErrors.paid = "Untuk pesanan yang dibatalkan, pembayaran harus 0.";
    Object.assign(nextErrors,shippingFieldErrors(fields));
    const parsedDate = new Date(`${fields.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== fields.date) nextErrors.date = "Pilih tanggal yang valid.";
    const totalQuantity = draft.items.reduce((total, item) => total + item.quantity, 0);
    const totalCost = draft.items.reduce((total, item) => total + (item.unitCost ?? 0) * item.quantity, 0);
    if (!Number.isSafeInteger(revenue) || !Number.isSafeInteger(totalQuantity) || !Number.isSafeInteger(totalCost)) nextErrors.items = "Total pesanan terlalu besar. Kurangi jumlah produk.";
    setErrors(nextErrors); setItemErrors(nextItemErrors);
    if (Object.keys(nextErrors).length || Object.keys(nextItemErrors).length) {
      if (["shippingCharge","serviceFee","discountValue","notes","shippingDate","shippingTime","shippingMethod"].some(field=>nextErrors[field as keyof Fields]) && detailsRef.current) detailsRef.current.open=true;
      const firstField = Object.keys(nextErrors).find((name) => name !== "items");
      const firstItemError = Object.entries(nextItemErrors)[0];
      const name = firstField ?? (firstItemError ? `item-${firstItemError[0]}-${Object.keys(firstItemError[1])[0]}` : undefined);
      if (name) modalRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
      return;
    }
    const customer: Customer | undefined = fields.customerId === "new" ? {
      id: crypto.randomUUID(), name: fields.customerName.trim(), phone: fields.customerPhone.trim(), address: fields.customerAddress.trim(),
    } : undefined;
    onSave({ ...draft, id: order?.id ?? crypto.randomUUID(), customerId: customer?.id ?? fields.customerId }, customer);
  }

  function amountField(name: "paid" | "shippingCharge" | "serviceFee", label: string) {
    return <div className={`field ${name === "paid" ? "payment-field" : ""}`}>
      <label className="field-label" htmlFor={`po-order-${name}`}>{label}</label>
      <div className="amount-input" style={{ position: "relative" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13 }}>Rp</span>
        <NumberInput id={`po-order-${name}`} name={name} className="input" inputMode="numeric" min="0" step="1" style={{ paddingLeft: 37 }} placeholder="0" value={fields[name]} onValueChange={(value) => update(name, value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `po-error-${name}` : undefined} />
      </div>
      {name === "paid" && <div className="payment-shortcuts"><Button type="button" className="btn btn-secondary" disabled={order?.status === "cancelled" || revenue <= 0 || !Number.isSafeInteger(revenue)} onClick={() => update("paid", String(revenue))}>Lunas</Button><Button type="button" className="btn btn-secondary" disabled={order?.status === "cancelled" || revenue <= 0 || !Number.isSafeInteger(revenue)} onClick={() => { update("paid", ""); document.getElementById("po-order-paid")?.focus(); }}>Bayar sebagian</Button></div>}
      {errors[name] && <span className="error-message" id={`po-error-${name}`}>{errors[name]}</span>}
    </div>;
  }

  return <div className="modal-backdrop">
    <div className="modal order-dialog" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="po-order-form-title" style={{ maxWidth: 760 }}>
      <div className="modal-header">
        <div><span className="eyebrow">OPEN PO</span><h2 id="po-order-form-title">{order ? "Edit pesanan PO" : "Pesanan PO baru"}</h2></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup formulir pesanan PO"><X size={20} /></button>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {(Object.keys(errors).length > 0 || Object.values(itemErrors).some((row) => Object.keys(row).length)) && <p className="error-message" role="alert">Periksa kembali kolom yang ditandai sebelum menyimpan.</p>}
          {!hasActiveProducts && !order && <p className="error-message" role="status">Belum ada produk aktif. Tambahkan produk di menu Produk pada Open PO terlebih dahulu.</p>}
          <section className="order-section order-context"><h3><span className="order-section-number">1</span>Informasi pesanan</h3><div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="po-order-batchId">Batch PO<span className="required-mark" aria-hidden="true"> *</span></label>
              <Select aria-label="Batch PO" aria-required="true" id="po-order-batchId" name="batchId" className="input" value={fields.batchId} onValueChange={(value) => update("batchId", value)} aria-invalid={Boolean(errors.batchId)} aria-describedby={errors.batchId ? "po-error-batchId" : batchHint ? "po-hint-batchId" : undefined}>
                {!fields.batchId && <SelectOption value="">{hasOpenBatch ? "Pilih batch PO aktif" : "Buat atau buka batch PO"}</SelectOption>}
                {poBatches.filter(batch => batch.status === "open" || batch.id === order?.batchId).map((batch) => <SelectOption key={batch.id} value={batch.id} disabled={batch.status !== "open" && batch.id !== order?.batchId}>{batch.name}{batch.status === "closed" ? " · ditutup" : batch.status === "completed" ? " · selesai" : ""}</SelectOption>)}
              </Select>
              {errors.batchId && <span id="po-error-batchId" className="error-message">{errors.batchId}</span>}{batchHint && <span id="po-hint-batchId" className="field-hint">{batchHint}</span>}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="po-order-customerId">Pelanggan<span className="required-mark" aria-hidden="true"> *</span></label>
              <CustomerPicker customers={data.customers} aria-label="Pelanggan" aria-required="true" id="po-order-customerId" name="customerId" className="input" value={fields.customerId} onValueChange={(value) => update("customerId", value)} aria-invalid={Boolean(errors.customerId)} aria-describedby={errors.customerId ? "po-error-customerId" : undefined}/>
              {errors.customerId && <span id="po-error-customerId" className="error-message">{errors.customerId}</span>}
            </div>
            <div className="field"><label className="field-label" htmlFor="po-order-date">Tanggal pesanan<span className="required-mark" aria-hidden="true"> *</span></label><DatePicker aria-label="Tanggal pesanan" required id="po-order-date" name="date" value={fields.date} onValueChange={value => update("date", value)} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? "po-error-date" : undefined} />{errors.date && <span id="po-error-date" className="error-message">{errors.date}</span>}</div>
            {fields.customerId === "new" && <>
              <div className="field"><label className="field-label" htmlFor="po-order-customerName">Nama pelanggan<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama pelanggan" required id="po-order-customerName" name="customerName" className="input" value={fields.customerName} maxLength={textLimits.customerName} autoComplete="name" placeholder="Contoh: Alya Putri" onChange={(event) => update("customerName", event.target.value)} aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? "po-error-customerName" : undefined} />{errors.customerName && <span id="po-error-customerName" className="error-message">{errors.customerName}</span>}</div>
              <div className="field"><label className="field-label" htmlFor="po-order-customerPhone">WhatsApp <span>(opsional)</span></label><input id="po-order-customerPhone" name="customerPhone" className="input" type="tel" value={fields.customerPhone} maxLength={textLimits.customerPhone} autoComplete="tel" placeholder="08xxxxxxxxxx" onChange={(event) => update("customerPhone", event.target.value)} aria-invalid={Boolean(errors.customerPhone)} aria-describedby={errors.customerPhone ? "po-error-customerPhone" : undefined} />{errors.customerPhone && <span id="po-error-customerPhone" className="error-message">{errors.customerPhone}</span>}</div>
              <div className="field"><label className="field-label" htmlFor="po-order-customerAddress">Alamat (opsional)</label><textarea id="po-order-customerAddress" name="customerAddress" className="input" rows={3} placeholder="Alamat lengkap pelanggan" maxLength={textLimits.customerAddress} autoComplete="street-address" value={fields.customerAddress} onChange={(event) => update("customerAddress", event.target.value)} /></div>
            </>}
          </div></section>
          <div className="form-section order-section">
            <h3><span className="order-section-number">2</span>Produk pesanan</h3>
            {errors.items && <p className="error-message" role="alert">{errors.items}</p>}
            {items.map((item, index) => {
              const original = originalItem(item);
              const available = data.products.filter((product) => product.active || product.id === original?.productId);
              const needsOriginalOption = original && !available.some((product) => product.id === originalProductValue(original));
              const productOptions: ProductChoice[] = available.map(product => {
                const snapshot = original?.productId === product.id ? original : undefined;
                return { value: product.id, name: snapshot?.product ?? product.name, detail: (snapshot ? [snapshot.variant, snapshot.color, snapshot.size, snapshot.store] : [product.variant, product.color, product.size, product.store]).filter(Boolean).join(" · "), sku: product.sku, category: product.category ?? "", price: snapshot?.unitPrice ?? product.unitPrice, searchText: [product.name, product.variant, product.color, product.size, product.store, product.sku, product.category, snapshot ? itemLabel(snapshot) : ""].filter(Boolean).join(" "), note: snapshot ? "Data pesanan asal" : !product.active ? "Diarsipkan" : undefined };
              });
              if (needsOriginalOption) productOptions.unshift({ value: originalProductValue(original), name: original.product, detail: [original.variant, original.color, original.size, original.store].filter(Boolean).join(" · "), sku: "", category: "", price: original.unitPrice, searchText: itemLabel(original), note: "Data pesanan asal" });
              const itemDraft = draft.items[index];
              const productId = index === 0 ? "po-order-productId" : `po-order-${item.id}-productId`;
              const pricesId = index === 0 ? "po-product-prices" : `po-product-prices-${item.id}`;
              const quantityId = index === 0 ? "po-order-quantity" : `po-order-${item.id}-quantity`;
              const rowErrors = itemErrors[item.id];
              return <fieldset key={item.id} className="order-item-card">
                <legend className="field-label" style={{ padding: "0 6px" }}>Produk {index + 1}</legend>
                <div className="order-item-heading">
                  <span className="field-hint">Subtotal {formatCurrency(itemDraft.quantity * itemDraft.unitPrice)}</span>
                  <button type="button" className="icon-button delete-item" aria-label={`Hapus produk ${index + 1}`} disabled={items.length === 1} onClick={() => removeItem(item.id)}><Trash2 size={16} /></button>
                </div>
                <div className="form-grid">
                  <div className="field" >
                    <label className="field-label" htmlFor={productId}>Produk<span className="required-mark" aria-hidden="true"> *</span></label>
                    <ProductPicker aria-label="Produk" aria-required="true" id={productId} name={`item-${item.id}-productId`} className="input" ref={index === 0 ? productRef : undefined} value={item.productId} options={productOptions} onValueChange={value => updateItem(item.id, "productId", value)} aria-invalid={Boolean(rowErrors?.productId)} aria-describedby={rowErrors?.productId ? `${productId}-error` : pricesId} />
                    {rowErrors?.productId && <span id={`${productId}-error`} className="error-message">{rowErrors.productId}</span>}
                    {usesOriginalSnapshot(item) && <span className="field-hint">Nama dan harga memakai data saat pesanan dibuat. Perubahan master tidak mengubah produk ini.</span>}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={quantityId}>Jumlah produk<span className="required-mark" aria-hidden="true"> *</span></label>
                    <NumberInput aria-label="Jumlah produk" required id={quantityId} name={`item-${item.id}-quantity`} className="input" inputMode="numeric" min="1" step="1" placeholder="Contoh: 2" value={item.quantity} onValueChange={(value) => updateItem(item.id, "quantity", value)} aria-invalid={Boolean(rowErrors?.quantity)} aria-describedby={rowErrors?.quantity ? `${quantityId}-error` : undefined} />
                    {rowErrors?.quantity && <span id={`${quantityId}-error`} className="error-message">{rowErrors.quantity}</span>}
                  </div>
                    <dl id={pricesId} className="po-product-prices order-full-width" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, padding: "10px 12px", borderRadius: 6 }}>
                      <div><dt className="field-hint">Harga jual / produk</dt><dd style={{ fontSize: 14, marginTop: 3 }}>{canUseProduct(item) ? formatCurrency(itemDraft.unitPrice) : "Pilih produk"}</dd></div>
                      <div><dt className="field-hint">Harga beli / produk</dt><dd style={{ fontSize: 14, marginTop: 3 }}>{!canUseProduct(item) ? "Pilih produk" : itemDraft.unitCost === null ? "Belum diisi" : formatCurrency(itemDraft.unitCost)}</dd></div>
                    </dl>
                </div>
              </fieldset>;
            })}
            <Button className="btn btn-primary add-order-item" type="button" onClick={addItem} disabled={items.length >= 100 || !hasActiveProducts} style={{ marginTop: 14 }}><Plus size={16} />Tambah produk</Button>
            {items.length >= 100 && <p className="field-hint">Maksimal 100 produk per pesanan.</p>}
          </div>
          <details ref={detailsRef} className="order-section order-extra-details" onInvalidCapture={event=>{event.currentTarget.open=true;}}><summary><span><span className="order-section-number">3</span>Detail tambahan</span><ChevronDown size={18}/></summary><div className="order-extra-body">
            <OrderDiscountFields id="po-order-discount" type={fields.discountType} value={fields.discountValue} amount={orderDiscount(draft)} total={orderSubtotal(draft) + draft.shippingCharge} onType={value => { update("discountType", value); update("discountValue", ""); }} onValue={value => update("discountValue", value)} error={errors.discountValue} />
            <div className="form-grid" style={{ marginTop: 14 }}>
              {amountField("shippingCharge", "Ongkir yang ditagihkan")}

              {Boolean(order?.serviceFee) && amountField("serviceFee", "Fee tambahan pesanan asal")}
              <div className="field" style={{ gridColumn: "1 / -1" }}><label className="field-label" htmlFor="po-order-notes">Catatan invoice <span className="muted">(opsional)</span></label><input id="po-order-notes" name="notes" className="input" value={fields.notes} maxLength={textLimits.notes} placeholder="Catatan untuk pelanggan" onChange={(event) => update("notes", event.target.value)} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? "po-error-notes" : undefined} />{errors.notes && <span id="po-error-notes" className="error-message">{errors.notes}</span>}</div>
            </div>
            <OrderShippingFields id="po-order" values={fields} onChange={update} errors={errors}/>
          </div></details>
          <section className="order-section"><h3><span className="order-section-number">4</span>Pembayaran</h3><div className="order-payment"><p className="payment-total">Total tagihan <strong>{formatCurrency(revenue)}</strong></p><div className="form-grid">{amountField("paid", "Sudah dibayar (DP / lunas)")}</div></div></section>
          <div className="summary-strip" aria-live="polite"><div className="summary-cell"><span>Total tagihan</span><strong>{formatCurrency(revenue)}</strong></div><div className="summary-cell"><span>Estimasi HPP</span><strong>{hpp === null ? "Belum lengkap" : formatCurrency(hpp)}</strong></div><div className="summary-cell"><span>Sisa tagihan</span><strong>{formatCurrency(outstanding(draft))}</strong></div></div>
        </div>
        <div className="modal-footer">{saveError && <p role="alert" className="auth-alert error" style={{flexBasis:"100%",margin:0}}>{saveError}</p>}<Button className="btn btn-secondary" variant="outline" type="button" onClick={onClose}>Batal</Button><Button className="btn btn-primary" type="submit" disabled={saving || (!order && (!hasOpenBatch || !hasActiveProducts))}>{order ? <Check size={17} /> : <Plus size={17} />}{saving ? "Menyimpan…" : "Simpan pesanan"}</Button></div>
      </form>
    </div>
  </div>;
}

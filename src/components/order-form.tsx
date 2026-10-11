"use client";

import { NumberInput } from "@/components/ui/number-input";
import { DatePicker } from "@/components/ui/date-picker";
import { OrderDiscountFields } from "@/components/order-discount-fields";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency, orderDiscount, orderSubtotal, orderHpp, orderMargin, orderRevenue, outstanding } from "@/lib/finance";
import type { AppData, Customer, Order } from "@/lib/types";

type OrderFormProps = {
  saveError?: string;
  saving?: boolean;
  data: AppData;
  order?: Order;
  defaultBatchId?: string;
  onSave: (order: Order, customer?: Customer) => void;
  onClose: () => void;
};

type Fields = {
  batchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  serviceFee: string;
  shippingCharge: string;
  discountType: "amount" | "percent";
  discountValue: string;
  paid: string;
  date: string;
  notes: string;
};
type ItemFields = {
  id: string;
  product: string;
  variant: string;
  color: string;
  size: string;
  quantity: string;
  unitPrice: string;
  unitCost: string;
};
type ItemField = Exclude<keyof ItemFields, "id">;
type FieldErrors = Partial<Record<keyof Fields | "items", string>>;
type ItemErrors = Record<string, Partial<Record<ItemField, string>>>;
const textLimits = { customerName: 120, customerPhone: 30, customerAddress: 1000, notes: 1000 };
const itemTextLimits = { product: 120, variant: 80, color: 80, size: 80 };

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function previewAmount(value: string) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

function newItem(): ItemFields {
  return { id: crypto.randomUUID(), product: "", variant: "", color: "", size: "", quantity: "1", unitPrice: "", unitCost: "" };
}

export function OrderForm({ data, order, defaultBatchId, onSave, onClose, saveError, saving }: OrderFormProps) {
  const jastipBatches = data.batches.filter((batch) => batch.type === "jastip");
  const [fields, setFields] = useState<Fields>(() => ({
    batchId: order?.batchId
      ?? jastipBatches.find((batch) => batch.id === defaultBatchId && batch.status === "open")?.id
      ?? (jastipBatches.filter(batch=>batch.status === "open").length === 1 ? jastipBatches.find(batch=>batch.status === "open")?.id : "") ?? "",
    customerId: order?.customerId ?? data.customers[0]?.id ?? "new",
    customerName: "", customerPhone: "", customerAddress: "",
    serviceFee: String(order?.serviceFee ?? 0),
    shippingCharge: String(order?.shippingCharge ?? 0),
    discountType: order?.discount?.type ?? "amount", discountValue: order?.discount ? String(order.discount.value) : "",
    paid: String(order?.paid ?? 0),
    date: order?.date ?? jakartaToday(), notes: order?.notes ?? "",
  }));
  const [items, setItems] = useState<ItemFields[]>(() => order?.items.map((item) => ({
    id: item.id, product: item.product, variant: item.variant, color: item.color, size: item.size,
    quantity: String(item.quantity), unitPrice: String(item.unitPrice), unitCost: item.unitCost === null ? "" : String(item.unitCost),
  })) ?? [newItem()]);
  const [createdAt] = useState(() => order?.createdAt ?? new Date().toISOString());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [itemErrors, setItemErrors] = useState<ItemErrors>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  const pendingItemFocus = useRef<string | null>(null);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (pendingItemFocus.current) {
      modalRef.current?.querySelector<HTMLInputElement>(`[name="item-${pendingItemFocus.current}-product"]`)?.focus();
      pendingItemFocus.current = null;
    }
  }, [items]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    productRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector(".select-content")) return;
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
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

  const draft = useMemo<Order>(() => ({
    id: order?.id ?? "draft-order-preview", batchId: fields.batchId, customerId: fields.customerId,
    items: items.map((item) => ({
      id: item.id, product: item.product.trim(), variant: item.variant.trim(), color: item.color.trim(), size: item.size.trim(),
      quantity: Math.max(1, previewAmount(item.quantity)), unitPrice: previewAmount(item.unitPrice),
      unitCost: item.unitCost.trim() === "" ? null : previewAmount(item.unitCost),
    })),
    serviceFee: previewAmount(fields.serviceFee), shippingCharge: previewAmount(fields.shippingCharge), paid: previewAmount(fields.paid),
    discount: { type: fields.discountType, value: previewAmount(fields.discountValue) }, refunds: order?.refunds,
    date: fields.date, createdAt, status: order?.status ?? "new", notes: fields.notes.trim(),
  }), [fields, items, order, createdAt]);
  const revenue = orderRevenue(draft);
  const previewOrders = [...data.orders.filter((entry) => entry.id !== draft.id), draft];
  const hpp = orderHpp(draft, previewOrders, data.batches);
  const margin = orderMargin(draft, previewOrders, data.batches);
  const selectedBatch = jastipBatches.find((batch) => batch.id === fields.batchId);
  const canUseSelectedBatch = Boolean(selectedBatch && (selectedBatch.status === "open" || selectedBatch.id === order?.batchId));
  const hasOpenBatch = jastipBatches.some((batch) => batch.status === "open");
  const batchHint = !hasOpenBatch
    ? order && canUseSelectedBatch
      ? "Belum ada batch aktif. Pesanan ini tetap dapat diedit pada batch asalnya."
      : "Buat atau buka batch sebelum menambahkan pesanan."
    : undefined;

  function update(name: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current }; delete next[name];
      if (name === "customerId") { delete next.customerName; delete next.customerPhone; delete next.customerAddress; }
      return next;
    });
  }

  function updateItem(id: string, name: ItemField, value: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [name]: value } : item));
    setItemErrors((current) => { const next = { ...current, [id]: { ...current[id] } }; delete next[id][name]; return next; });
    setErrors((current) => { const next = { ...current }; delete next.items; return next; });
  }

  function addItem() {
    if (items.length >= 100) return;
    const item = newItem(); pendingItemFocus.current = item.id;
    setItems((current) => [...current, item]);
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
    if (!selectedBatch) nextErrors.batchId = "Pilih batch pesanan yang aktif.";
    else if (!canUseSelectedBatch) nextErrors.batchId = "Batch sudah ditutup. Pilih batch yang masih aktif.";
    if (fields.customerId === "new") {
      if (!fields.customerName.trim()) nextErrors.customerName = "Isi nama pelanggan.";
    } else if (!data.customers.some((customer) => customer.id === fields.customerId)) nextErrors.customerId = "Pilih pelanggan.";
    for (const [name, limit] of Object.entries(textLimits)) {
      const field = name as keyof typeof textLimits;
      if (fields[field].length > limit) nextErrors[field] = `Maksimal ${limit} karakter.`;
    }
    if (items.length < 1 || items.length > 100) nextErrors.items = "Isi 1 sampai 100 barang dalam satu pesanan.";
    for (const item of items) {
      const rowErrors: Partial<Record<ItemField, string>> = {};
      if (!item.product.trim()) rowErrors.product = "Isi nama barang atau makanan.";
      for (const [name, limit] of Object.entries(itemTextLimits)) {
        const field = name as keyof typeof itemTextLimits;
        if (item[field].length > limit) rowErrors[field] = `Maksimal ${limit} karakter.`;
      }
      for (const name of ["quantity", "unitPrice", "unitCost"] as const) {
        if (name === "unitCost" && item[name].trim() === "") continue;
        const value = Number(item[name]);
        if (item[name].trim() === "" || !Number.isSafeInteger(value) || value < 0) rowErrors[name] = "Masukkan angka bulat minimal 0.";
      }
      if (!rowErrors.quantity && Number(item.quantity) < 1) rowErrors.quantity = "Jumlah minimal 1.";
      if (!rowErrors.unitPrice && !rowErrors.quantity && !Number.isSafeInteger(Number(item.quantity) * Number(item.unitPrice))) rowErrors.unitPrice = "Total harga barang terlalu besar.";
      if (item.unitCost.trim() !== "" && !rowErrors.unitCost && !rowErrors.quantity && !Number.isSafeInteger(Number(item.quantity) * Number(item.unitCost))) rowErrors.unitCost = "Total harga beli terlalu besar.";
      if (Object.keys(rowErrors).length) nextItemErrors[item.id] = rowErrors;
    }
    for (const name of ["serviceFee", "shippingCharge", "paid"] as const) {
      const value = Number(fields[name]);
      if (fields[name].trim() === "" || !Number.isSafeInteger(value) || value < 0) nextErrors[name] = "Masukkan angka bulat minimal 0.";
    }
    const discountValue = Number(fields.discountValue);
    if (!Number.isSafeInteger(discountValue) || discountValue < 0) nextErrors.discountValue = "Masukkan diskon berupa angka bulat minimal 0.";
    else if (fields.discountType === "percent" && discountValue > 100) nextErrors.discountValue = "Diskon maksimal 100%.";
    else if (fields.discountType === "amount" && discountValue > orderSubtotal(draft) + draft.shippingCharge) nextErrors.discountValue = "Diskon tidak boleh melebihi total tagihan sebelum diskon.";
    if (!nextErrors.paid && Number(fields.paid) > revenue) nextErrors.paid = "Pembayaran tidak boleh melebihi total tagihan setelah diskon.";
    if (order?.status === "cancelled" && Number(fields.paid) > 0) nextErrors.paid = "Untuk pesanan yang dibatalkan, pembayaran harus 0.";
    const parsedDate = new Date(`${fields.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== fields.date) nextErrors.date = "Pilih tanggal yang valid.";
    const totalQuantity = draft.items.reduce((total, item) => total + item.quantity, 0);
    const totalCost = draft.items.reduce((total, item) => total + (item.unitCost ?? 0) * item.quantity, 0);
    if (!Number.isSafeInteger(revenue) || !Number.isSafeInteger(totalQuantity) || !Number.isSafeInteger(totalCost)) nextErrors.items = "Total pesanan terlalu besar. Kurangi jumlah atau harga barang.";
    setErrors(nextErrors); setItemErrors(nextItemErrors);
    if (Object.keys(nextErrors).length || Object.keys(nextItemErrors).length) {
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

  function amountField(name: "serviceFee" | "shippingCharge" | "paid", label: string, hint?: string) {
    return <div className={`field ${name === "paid" ? "payment-field" : ""}`}>
      <label className="field-label" htmlFor={`order-${name}`}>{label}<span className="required-mark" aria-hidden="true"> *</span></label>
      <div className="amount-input" style={{ position: "relative" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13 }}>Rp</span>
        <NumberInput aria-label={label} required id={`order-${name}`} name={name} className="input" inputMode="numeric" min="0" step="1" style={{ paddingLeft: 37 }} value={fields[name]} onValueChange={(value) => update(name, value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `error-${name}` : hint ? `hint-${name}` : undefined} />
      </div>
      {name === "paid" && <div className="payment-shortcuts"><Button type="button" className="btn btn-secondary" disabled={order?.status === "cancelled" || revenue <= 0 || !Number.isSafeInteger(revenue)} onClick={() => update("paid", String(revenue))}>Lunas</Button><Button type="button" className="btn btn-secondary" disabled={order?.status === "cancelled" || revenue <= 0 || !Number.isSafeInteger(revenue)} onClick={() => { update("paid", ""); document.getElementById("order-paid")?.focus(); }}>Bayar sebagian</Button></div>}
      {errors[name] ? <span className="error-message" id={`error-${name}`}>{errors[name]}</span> : hint ? <span className="field-hint" id={`hint-${name}`}>{hint}</span> : null}
    </div>;
  }

  function itemField(item: ItemFields, index: number, name: ItemField, label: string, hint?: string) {
    const id = `order-item-${item.id}-${name}`;
    const error = itemErrors[item.id]?.[name];
    const isAmount = name === "unitPrice" || name === "unitCost";
    const numeric = isAmount || name === "quantity";
    return <div className="field" >
      <label className="field-label" htmlFor={id}>{label}{["product", "quantity", "unitPrice"].includes(name) && <span className="required-mark" aria-hidden="true"> *</span>}</label>
      <div style={{ position: "relative" }}>
        {isAmount && <span aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13 }}>Rp</span>}
        {numeric ? <NumberInput aria-label={label} required={["product", "quantity", "unitPrice"].includes(name)} id={id} name={`item-${item.id}-${name}`} className="input" inputMode={numeric ? "numeric" : undefined} min={numeric ? name === "quantity" ? "1" : "0" : undefined} step={numeric ? "1" : undefined} maxLength={!numeric ? itemTextLimits[name as keyof typeof itemTextLimits] : undefined} style={isAmount ? { paddingLeft: 37 } : undefined} value={item[name]} placeholder={name === "quantity" ? "Contoh: 2" : name === "unitCost" ? "Belum diketahui" : "0"} onValueChange={(value) => updateItem(item.id, name, value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} /> : <input aria-label={label} required={["product", "quantity", "unitPrice"].includes(name)} id={id} name={`item-${item.id}-${name}`} className="input" ref={index === 0 && name === "product" ? productRef : undefined} type="text" inputMode={numeric ? "numeric" : undefined} min={numeric ? name === "quantity" ? "1" : "0" : undefined} step={numeric ? "1" : undefined} maxLength={!numeric ? itemTextLimits[name as keyof typeof itemTextLimits] : undefined} style={isAmount ? { paddingLeft: 37 } : undefined} value={item[name]} placeholder={name === "product" ? "Contoh: Airism Oversized / Nasi ayam"  : name === "variant" ? "Contoh: original / pedas" : name === "color" ? "Contoh: navy" : name === "size" ? "Contoh: M / porsi besar" : "0"} onChange={(event) => updateItem(item.id, name, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />}
      </div>
      {error ? <span className="error-message" id={`${id}-error`}>{error}</span> : hint ? <span className="field-hint" id={`${id}-hint`}>{hint}</span> : null}
    </div>;
  }

  return <div className="modal-backdrop">
    <div className="modal order-dialog" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="order-form-title" aria-describedby="order-form-description" style={{ maxWidth: 760 }}>
      <div className="modal-header">
        <div><span className="eyebrow">JASTIP</span><h2 id="order-form-title">{order ? "Edit pesanan jastip" : "Pesanan jastip baru"}</h2><p className="muted" id="order-form-description">Satu pesanan dapat berisi beberapa barang atau makanan untuk satu pelanggan.</p></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Tutup formulir pesanan"><X size={20} /></button>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {(Object.keys(errors).length > 0 || Object.values(itemErrors).some((row) => Object.keys(row).length)) && <p className="error-message" role="alert">Periksa kembali kolom yang ditandai sebelum menyimpan.</p>}
          <section className="order-section order-context"><h3><span className="order-section-number">1</span>Informasi pesanan</h3><div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="order-batchId">Batch / perjalanan<span className="required-mark" aria-hidden="true"> *</span></label>
              <Select aria-label="Batch / perjalanan" aria-required="true" id="order-batchId" name="batchId" className="input" value={fields.batchId} onValueChange={(value) => update("batchId", value)} aria-invalid={Boolean(errors.batchId)} aria-describedby={errors.batchId ? "error-batchId" : batchHint ? "hint-batchId" : undefined}>
                {!fields.batchId && <SelectOption value="">{hasOpenBatch ? "Pilih batch aktif" : "Buat atau buka batch terlebih dahulu"}</SelectOption>}
                {jastipBatches.map((batch) => <SelectOption key={batch.id} value={batch.id} disabled={batch.status !== "open" && batch.id !== order?.batchId}>{batch.name}{batch.status === "closed" ? " · ditutup" : batch.status === "completed" ? " · selesai" : ""}</SelectOption>)}
              </Select>
              {errors.batchId && <span id="error-batchId" className="error-message">{errors.batchId}</span>}{batchHint && <span id="hint-batchId" className="field-hint">{batchHint}</span>}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="order-customerId">Pelanggan<span className="required-mark" aria-hidden="true"> *</span></label>
              <Select aria-label="Pelanggan" aria-required="true" id="order-customerId" name="customerId" className="input" value={fields.customerId} onValueChange={(value) => update("customerId", value)} aria-invalid={Boolean(errors.customerId)} aria-describedby={errors.customerId ? "error-customerId" : undefined}>
                {data.customers.map((customer) => <SelectOption key={customer.id} value={customer.id}>{customer.name}</SelectOption>)}<SelectOption value="new">+ Pelanggan baru</SelectOption>
              </Select>
              {errors.customerId && <span id="error-customerId" className="error-message">{errors.customerId}</span>}
            </div>
              <div className="field"><label className="field-label" htmlFor="order-date">Tanggal pesanan<span className="required-mark" aria-hidden="true"> *</span></label><DatePicker aria-label="Tanggal pesanan" required id="order-date" name="date" value={fields.date} onValueChange={value => update("date", value)} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? "error-date" : undefined} />{errors.date && <span id="error-date" className="error-message">{errors.date}</span>}</div>
            {fields.customerId === "new" && <>
              <div className="field"><label className="field-label" htmlFor="order-customerName">Nama pelanggan<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama pelanggan" required id="order-customerName" name="customerName" className="input" maxLength={textLimits.customerName} value={fields.customerName} placeholder="Contoh: Alya Putri" autoComplete="name" onChange={(event) => update("customerName", event.target.value)} aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? "error-customerName" : undefined} />{errors.customerName && <span id="error-customerName" className="error-message">{errors.customerName}</span>}</div>
              <div className="field"><label className="field-label" htmlFor="order-customerPhone">WhatsApp <span className="muted">(opsional)</span></label><input id="order-customerPhone" name="customerPhone" className="input" type="tel" maxLength={textLimits.customerPhone} value={fields.customerPhone} placeholder="08xxxxxxxxxx" autoComplete="tel" onChange={(event) => update("customerPhone", event.target.value)} aria-invalid={Boolean(errors.customerPhone)} aria-describedby={errors.customerPhone ? "error-customerPhone" : undefined} />{errors.customerPhone && <span id="error-customerPhone" className="error-message">{errors.customerPhone}</span>}</div>
              <div className="field"><label className="field-label" htmlFor="order-customerAddress">Alamat (opsional)</label><textarea id="order-customerAddress" name="customerAddress" className="input" rows={3} placeholder="Alamat lengkap pelanggan" maxLength={textLimits.customerAddress} autoComplete="street-address" value={fields.customerAddress} onChange={(event) => update("customerAddress", event.target.value)} /></div>
            </>}
          </div></section>
          <div className="form-section order-section">
            <h3><span className="order-section-number">2</span>Barang / makanan</h3>
            <p className="field-hint" style={{ marginTop: 6 }}>Varian, warna, dan ukuran dicatat pada masing-masing barang.</p>
            {errors.items && <p className="error-message" role="alert">{errors.items}</p>}
            {items.map((item, index) => <fieldset key={item.id} className="order-item-card">
              <legend className="field-label" style={{ padding: "0 6px" }}>Produk</legend>
              <div className="order-item-heading">
                <span className="field-hint">Subtotal {formatCurrency(previewAmount(item.quantity) * previewAmount(item.unitPrice))}</span>
                <button type="button" className="icon-button delete-item" aria-label={`Hapus barang ${index + 1}`} disabled={items.length === 1} onClick={() => removeItem(item.id)}><Trash2 size={16} /></button>
              </div>
              <div className="form-grid jastip-item-grid">
                {itemField(item, index, "product", "Nama barang")}
                {itemField(item, index, "quantity", "Jumlah barang")}
                {itemField(item, index, "variant", "Varian (opsional)")}
                {itemField(item, index, "color", "Warna (opsional)")}
                {itemField(item, index, "size", "Ukuran (opsional)")}
                {itemField(item, index, "unitPrice", "Harga jual / barang")}
                {itemField(item, index, "unitCost", "Harga beli / barang", "Kosongkan jika belum tahu. HPP ditandai belum lengkap.")}
              </div>
            </fieldset>)}
            <Button className="btn btn-primary add-order-item" type="button" onClick={addItem} disabled={items.length >= 100} style={{ marginTop: 14 }}><Plus size={16} />Tambah barang</Button>
            {items.length >= 100 && <p className="field-hint">Maksimal 100 barang per pesanan.</p>}
          </div>
          <div className="form-section order-section">
            <h3><span className="order-section-number">3</span>Diskon, ongkir & catatan</h3>
            <OrderDiscountFields id="order-discount" type={fields.discountType} value={fields.discountValue} amount={orderDiscount(draft)} total={orderSubtotal(draft) + draft.shippingCharge} onType={value => { update("discountType", value); update("discountValue", ""); }} onValue={value => update("discountValue", value)} error={errors.discountValue} />
            <div className="form-grid" style={{ marginTop: 12 }}>
              {amountField("serviceFee", "Fee jastip / pesanan", "Total fee untuk semua barang pada pesanan ini.")}
              {amountField("shippingCharge", "Ongkir yang ditagihkan")}


              <div className="field" style={{ gridColumn: "1 / -1" }}><label className="field-label" htmlFor="order-notes">Catatan <span className="muted">(opsional)</span></label><input id="order-notes" name="notes" className="input" maxLength={textLimits.notes} value={fields.notes} placeholder="Permintaan atau catatan pelanggan" onChange={(event) => update("notes", event.target.value)} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? "error-notes" : undefined} />{errors.notes && <span id="error-notes" className="error-message">{errors.notes}</span>}</div>
            </div>
          </div>
          <section className="order-section"><h3><span className="order-section-number">4</span>Pembayaran</h3><div className="order-payment"><p className="payment-total">Total tagihan <strong>{formatCurrency(revenue)}</strong></p>{amountField("paid", "Sudah dibayar (DP / lunas)")}</div></section>
          <div className="summary-strip" aria-live="polite" style={{ marginTop: 20 }}>
            <div className="summary-cell"><span>Total tagihan</span><strong>{formatCurrency(revenue)}</strong></div>
            <div className="summary-cell"><span>Estimasi HPP</span><strong>{hpp === null ? "Belum lengkap" : formatCurrency(hpp)}</strong></div>
            <div className="summary-cell"><span>Estimasi laba</span><strong style={margin !== null && margin < 0 ? { color: "var(--danger)" } : undefined}>{margin === null ? "Belum lengkap" : formatCurrency(margin)}</strong></div>
            <div className="summary-cell"><span>Sisa tagihan</span><strong>{formatCurrency(outstanding(draft))}</strong></div>
          </div>
          <p className="field-hint" style={{ marginTop: 10 }}>HPP dihitung dari harga beli per barang dan jumlahnya. Satu barang yang belum memiliki harga beli membuat HPP pesanan belum lengkap.</p>
        </div>
        <div className="modal-footer">{saveError && <p role="alert" className="auth-alert error" style={{flexBasis:"100%",margin:0}}>{saveError}</p>}<Button className="btn btn-secondary" variant="outline" type="button" onClick={onClose}>Batal</Button><Button className="btn btn-primary" type="submit" disabled={saving || !canUseSelectedBatch}>{order ? <Check size={17} /> : <Plus size={17} />}{saving ? "Menyimpan…" : "Simpan pesanan"}</Button></div>
      </form>
    </div>
  </div>;
}

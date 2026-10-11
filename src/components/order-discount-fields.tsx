"use client";

import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectOption } from "@/components/ui/select";
import { formatCurrency } from "@/lib/finance";

export function OrderDiscountFields({ id, type, value, amount, onType, onValue, error }: {
  id: string; type: "amount" | "percent"; value: string; amount: number;
  onType: (type: "amount" | "percent") => void; onValue: (value: string) => void; error?: string;
}) {
  return <div className="order-discount-fields">
    <div className="field"><label className="field-label" htmlFor={`${id}-type`}>Jenis diskon</label><Select id={`${id}-type`} aria-label="Jenis diskon" className="input" value={type} onValueChange={value => onType(value as "amount" | "percent")}><SelectOption value="amount">Rupiah</SelectOption><SelectOption value="percent">Persen</SelectOption></Select></div>
    <div className="field"><label className="field-label" htmlFor={`${id}-value`}>Diskon <span className="muted">(opsional)</span></label><div className="discount-value-input"><span aria-hidden="true">{type === "amount" ? "Rp" : "%"}</span><NumberInput id={`${id}-value`} name="discountValue" aria-label="Diskon" className="input" min="0" max={type === "percent" ? 100 : undefined} step="1" value={value} placeholder="0" onValueChange={onValue} aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} /></div></div>
    <p className="field-hint" id={`${id}-hint`}>Potongan {formatCurrency(amount)}. {type === "percent" ? "Maksimal 100% dari subtotal barang dan fee; ongkir tidak didiskon." : "Maksimal total tagihan sebelum diskon, termasuk ongkir."}</p>
    {error && <p className="error-message" role="alert" id={`${id}-error`}>{error}</p>}
  </div>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectOption } from "@/components/ui/select";
import { formatCurrency } from "@/lib/finance";
import { convertedCost, FX_CURRENCIES, fxFromDraft, readFrankfurterRate, type FxDraft } from "@/lib/purchase-fx";
import { formatCalendarDate } from "@/lib/calendar-date";

type Props = { id: string; name?: string; label?: string; ariaLabel?: string; cost: string; fx?: FxDraft; error?: string; disabled?: boolean; allowForeign?: boolean; lockCurrency?: boolean; compact?: boolean; required?: boolean; onChange: (cost: string, fx?: FxDraft) => void };
export function PurchaseCostFields({ id, name, label = "Harga beli / produk", ariaLabel = label, cost, fx, error, disabled, allowForeign = true, lockCurrency = false, compact = false, required = false, onChange }: Props) {
  const [loading, setLoading] = useState(false), [rateError, setRateError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function change(next?: FxDraft) {
    request.current?.abort(); setLoading(false); setRateError("");
    const snapshot = next ? fxFromDraft(next) : null;
    onChange(next ? String(convertedCost(snapshot!.amount, snapshot!.rate) ?? "") : fx?.status === "estimate" ? "" : cost, next);
  }
  async function latest() {
    if (!fx || loading) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setRateError("");
    try {
      const response = await fetch(`https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(fx.currency)}&to=IDR`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), credentials: "omit", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error("RATE_UNAVAILABLE");
      const result = readFrankfurterRate(await response.json(), fx.currency);
      if (controller.signal.aborted) return;
      const next: FxDraft = { ...fx, rate: result.rate.replace(".", ","), rateDate: result.date, source: "frankfurter", status: "estimate" };
      onChange(String(convertedCost(fxFromDraft(next).amount, result.rate) ?? ""), next);
    } catch { if (!controller.signal.aborted) setRateError("Kurs belum bisa diambil. Coba lagi atau isi manual."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const conversion = fx ? convertedCost(fxFromDraft(fx).amount, fxFromDraft(fx).rate) : null;
  if (compact && fx) return <div className="purchase-cost-fields purchase-cost-compact order-full-width">
    <label className="field-label" htmlFor={id}>{label}{required && <span className="required-mark" aria-hidden="true"> *</span>}</label>
    <div className="cost-input"><span aria-hidden="true">{fx.currency}</span><input className="input" id={id} name={name} aria-label="Harga beli valas / produk" required={required} inputMode="decimal" autoComplete="off" placeholder={required ? (fx ? "Contoh: 1000" : "Contoh: 10000") : "Belum diketahui"} maxLength={20} disabled={disabled} value={fx.amount} onChange={event => change({ ...fx, amount: event.target.value })} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : `${id}-conversion`}/></div>
    <p className="field-hint purchase-cost-conversion" id={`${id}-conversion`}>{conversion === null ? "" : `≈ ${formatCurrency(conversion)} / produk`}</p>
    {error && <p role="alert" id={`${id}-error`} className="error-message">{error}</p>}
  </div>;
  return <div className="purchase-cost-fields order-full-width">
    <div className="purchase-cost-heading"><label className="field-label" htmlFor={id}>{label}{required && <span className="required-mark" aria-hidden="true"> *</span>}</label>{allowForeign && <Select aria-label={`Satuan ${ariaLabel}`} disabled={disabled} value={fx ? "foreign" : "IDR"} onValueChange={mode => change(mode === "foreign" ? { currency: "JPY", amount: "", rate: "", status: "estimate", source: "manual" } : undefined)}><SelectOption value="IDR">Rupiah</SelectOption><SelectOption value="foreign">Mata uang asing</SelectOption></Select>}</div>
    {!fx ? <div className="cost-input"><span aria-hidden="true">Rp</span><NumberInput id={id} name={name} aria-label={ariaLabel} required={required} className="input" min="0" step="1" placeholder={required ? (fx ? "Contoh: 1000" : "Contoh: 10000") : "Belum diketahui"} value={cost} disabled={disabled} onValueChange={value => onChange(value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /></div> : <div className="purchase-fx-body">
      <div className="form-grid">{!lockCurrency && <div className="field"><label className="field-label" htmlFor={`${id}-currency`}>Mata uang</label><Select id={`${id}-currency`} aria-label="Mata uang harga beli" disabled={disabled} value={fx.currency} onValueChange={currency => change({ ...fx, currency, rate: "", rateDate: undefined, source: "manual", status: "estimate" })}>{FX_CURRENCIES.map(currency => <SelectOption key={currency} value={currency}>{currency}</SelectOption>)}</Select></div>}<div className="field"><label className="field-label" htmlFor={id}>Harga beli {fx.currency} / produk</label><input className="input" id={id} name={name} aria-label="Harga beli valas / produk" required={required} inputMode="decimal" autoComplete="off" placeholder="Contoh: 1000" maxLength={20} disabled={disabled} value={fx.amount} onChange={event => change({ ...fx, amount: event.target.value })} aria-invalid={!!error} /></div></div>
      <div className="field"><label className="field-label" htmlFor={`${id}-rate`}>Kurs: 1 {fx.currency} = Rp</label><div className="purchase-fx-rate"><input className="input" id={`${id}-rate`} aria-label="Kurs ke rupiah" inputMode="decimal" autoComplete="off" placeholder="Contoh: 105,50" maxLength={20} disabled={disabled} value={fx.rate} onChange={event => change({ ...fx, rate: event.target.value, source: "manual", rateDate: undefined })} aria-invalid={!!error}/><Button className="btn btn-secondary" type="button" disabled={disabled || loading} onClick={() => void latest()}><RefreshCw size={15} aria-hidden="true"/>{loading ? "Mengambil kurs…" : "Ambil kurs terbaru"}</Button></div></div>
      {fx.source === "frankfurter" && fx.rateDate ? <p className="field-hint">{formatCalendarDate(fx.rateDate)} · Kurs referensi</p> : <p className="field-hint">Kurs manual · Gunakan koma untuk desimal.</p>}
      <div className="purchase-fx-result"><div><span>Harga beli rupiah</span><strong>{conversion === null ? "Belum lengkap" : formatCurrency(conversion)}</strong></div><div className="field"><label className="field-label" htmlFor={`${id}-status`}>Status kurs</label><Select id={`${id}-status`} aria-label="Status kurs" disabled={disabled} value={fx.status} onValueChange={status => change({ ...fx, status: status as FxDraft["status"] })}><SelectOption value="estimate">Estimasi</SelectOption><SelectOption value="final" disabled={conversion === null}>Final</SelectOption></Select></div></div>
      <p className="field-hint">{fx.status === "estimate" ? "HPP dan laba masih estimasi. Ubah ke Final setelah kurs pembayaran pasti." : "Kurs final disimpan untuk transaksi ini."}</p>
      {rateError && <p role="alert" className="error-message">{rateError}</p>}
    </div>}
    {error && <p role="alert" id={`${id}-error`} className="error-message">{error}</p>}
  </div>;
}

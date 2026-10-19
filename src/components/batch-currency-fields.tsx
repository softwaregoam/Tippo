"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CurrencyPicker } from "./currency-picker";
import { DecimalInput } from "./ui/decimal-input";
import { Button } from "./ui/button";
import { fetchPurchaseRate, inputDecimal, decimalUnits, type BatchPurchaseFx } from "@/lib/purchase-fx";

type Props = { value?: BatchPurchaseFx; onChange: (value?: BatchPurchaseFx) => void; autoRefresh?: boolean; lockedCurrency?: boolean; onLoading?: (loading: boolean) => void };
/** A new order refreshes once on opening. Saved orders never mount this control. */
export function BatchCurrencyFields({ value, onChange, autoRefresh, lockedCurrency, onLoading }: Props) {
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [manual, setManual] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const current = useRef({value, onChange, onLoading});
  useEffect(() => { current.current = {value, onChange, onLoading}; });
  function cancel() { request.current?.abort(); setLoading(false); current.current.onLoading?.(false); }
  async function refresh(currency: string) {
    cancel(); const controller = new AbortController(); request.current = controller;
    setLoading(true); current.current.onLoading?.(true); setError(""); setManual(null);
    try {
      const next = await fetchPurchaseRate(currency, controller.signal);
      if (!controller.signal.aborted) current.current.onChange(next);
    } catch { if (!controller.signal.aborted) setError("Kurs belum diperbarui. Coba lagi atau isi manual."); }
    finally { if (!controller.signal.aborted) { setLoading(false); current.current.onLoading?.(false); } }
  }
  useEffect(() => {
    current.current.onLoading?.(false);
    if (autoRefresh && current.current.value) void refresh(current.current.value.currency);
    return () => request.current?.abort();
    // One refresh per opening; selecting a currency uses the event handler below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="field batch-currency-fields">
    {!lockedCurrency && <><label className="field-label" htmlFor="batch-currency">Mata uang harga beli</label><CurrencyPicker id="batch-currency" aria-label="Mata uang batch" value={value?.currency ?? "IDR"} onValueChange={currency => {
      cancel(); setError(""); setManual(null);
      if (currency === "IDR") onChange(undefined);
      else { onChange({ currency, rate: null, source: "manual" }); void refresh(currency); }
    }}/></>}
    {value && <><label className="field-label" htmlFor="batch-rate">Kurs: 1 {value.currency} = Rp</label><div className="purchase-fx-rate"><DecimalInput id="batch-rate" className="input" aria-label="Kurs batch ke rupiah" inputMode="decimal" placeholder="Isi kurs" maxLength={22} value={manual ?? value.rate?.replace(".", ",") ?? ""} onValueChange={text => {
      cancel(); setError(""); setManual(text);
      const rate = inputDecimal(text);
      onChange({currency:value.currency, rate: rate && decimalUnits(rate)! > BigInt(0) ? rate : null, source:"manual"});
    }}/><Button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void refresh(value.currency)}><RefreshCw size={15}/>{loading ? "Mengambil kurs…" : "Perbarui kurs"}</Button></div>{lockedCurrency && <span className="field-hint">{!autoRefresh ? "Kurs tersimpan untuk pesanan ini." : "Kurs terbaru diambil saat menambah pesanan."}</span>}{manual !== null && manual.trim() && !value.rate && <span role="alert" className="error-message">Isi kurs lebih dari nol, gunakan koma untuk desimal.</span>}</>}
    {error && <span role="alert" className="error-message">{error}{value?.rate ? " Kurs sebelumnya tetap dipakai sebagai estimasi." : ""}</span>}
  </div>;
}

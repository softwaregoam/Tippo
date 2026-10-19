"use client";
import { useId, useState } from "react";
import { Calculator, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/finance";
import { limitMarkupPercent, suggestedPrice } from "@/lib/purchase-fx";
export function PriceAssistant({cost,estimated,onUse}:{cost:number|null;estimated:boolean;onUse:(value:number)=>void}) {
  const id=useId(),[percent,setPercent]=useState("20"),[showInfo,setShowInfo]=useState(false);
  const price=suggestedPrice(cost,percent);
  const info=<button className="price-assistant-info" type="button" aria-label="Info perhitungan harga jual" aria-expanded={showInfo} aria-controls={`${id}-info`} onClick={()=>setShowInfo(value=>!value)}><Info size={16} aria-hidden="true"/></button>;
  return <details className="price-assistant"><summary><span><Calculator size={15} aria-hidden="true"/>Bantu hitung harga jual</span><ChevronDown size={16} aria-hidden="true"/></summary><div className="price-assistant-body">
    <div className="price-assistant-percentage"><label className="field-label" htmlFor={id}>Untung dari modal (%)</label><input className="input" id={id} inputMode="decimal" min="0" max="100" maxLength={20} value={percent} onChange={event=>setPercent(limitMarkupPercent(event.target.value))} placeholder="20"/></div>
    {price!==null&&cost!==null ? <>
      <div className="price-assistant-result" aria-live="polite"><span>Harga jual{estimated?" (estimasi)":""}</span><strong>{formatCurrency(price)}</strong><small>Laba kotor: {formatCurrency(price-cost)} / produk</small></div>
      <div className="price-assistant-action"><Button className="btn btn-secondary" type="button" onClick={()=>onUse(price)}>Gunakan harga ini</Button>{info}</div>
    </> : <div className="price-assistant-message"><p className="field-hint">{cost===null?"Isi harga beli untuk menghitung.":"Isi persentase yang valid; gunakan koma untuk desimal."}</p>{info}</div>}
    {showInfo&&<p className="field-hint" id={`${id}-info`}>Dihitung dari harga beli. Belum termasuk fee jastip, ongkir, diskon, atau biaya bersama.</p>}
  </div></details>;
}

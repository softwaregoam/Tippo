"use client";
import { useId, useState } from "react";
import { Calculator, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/finance";
import { suggestedPrice } from "@/lib/purchase-fx";
export function PriceAssistant({cost,estimated,onUse}:{cost:number|null;estimated:boolean;onUse:(value:number)=>void}) {
  const id=useId(),[percent,setPercent]=useState("20");
  const price=suggestedPrice(cost,percent);
  return <details className="price-assistant"><summary><span><Calculator size={15} aria-hidden="true"/>Bantu hitung harga jual</span><ChevronDown size={16} aria-hidden="true"/></summary><div className="price-assistant-body">
    <p className="field-hint">Modal per produk: {cost===null?"Belum diisi":formatCurrency(cost)}{estimated&&cost!==null?" · Estimasi":""}</p>
    <label className="field-label" htmlFor={id}>Untung dari modal (%)</label><input className="input" id={id} inputMode="decimal" maxLength={20} value={percent} onChange={event=>setPercent(event.target.value)} placeholder="Contoh: 20"/>
    <div className="price-assistant-result" aria-live="polite"><span>Saran harga jual{estimated?" (estimasi)":""}</span><strong>{price===null?"—":formatCurrency(price)}</strong><small>Perkiraan laba kotor: {price===null||cost===null?"—":formatCurrency(price-cost)} / produk</small></div>
    <p className="field-hint">Belum termasuk fee jastip, ongkir, diskon, atau biaya bersama.</p>
    {price===null&&<p className="field-hint">{cost===null?"Lengkapi harga beli terlebih dahulu.":"Isi persentase yang valid; gunakan koma untuk desimal."}</p>}
    <Button className="btn btn-secondary" type="button" disabled={price===null} onClick={()=>{if(price!==null)onUse(price);}}>Gunakan harga ini</Button>
  </div></details>;
}

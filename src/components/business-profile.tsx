"use client";
import { useRef, useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_PROFILE_KEY, readBusinessProfile, validateBusinessProfile, type BusinessProfile } from "@/lib/business-profile";
import { readInvoiceAppearance, validateInvoiceTemplate, type InvoiceAppearance } from "@/lib/invoice-template";
import type { AccountWorkspace } from "./cloud-workspace";

export function BusinessProfilePanel({ cloud, onNotify, onSaved }: { cloud?: AccountWorkspace; onNotify: (message: string) => void; onSaved?: (profile: BusinessProfile, appearance: InvoiceAppearance) => void }) {
  const [profile, setProfile] = useState<BusinessProfile>(() => {
    if (cloud) return readBusinessProfile(cloud);
    try { return readBusinessProfile(JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY) ?? "null"), "Usaha demo"); }
    catch { return readBusinessProfile(null, "Usaha demo"); }
  });
  const [appearance,setAppearance]=useState(()=>{
    if(cloud)return readInvoiceAppearance(cloud.invoiceAppearance);
    try{return readInvoiceAppearance(JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY)??"null")?.invoiceTemplate);}catch{return readInvoiceAppearance(null);}
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const next = validateBusinessProfile(profile);
      const {bankName,bankAccount,bankHolder}=validateInvoiceTemplate({...next,appearance}).appearance;
      let savedAppearance={...appearance,bankName,bankAccount,bankHolder};
      if (cloud) await cloud.saveProfile(next,{bankName,bankAccount,bankHolder});
      else {
        const previous=JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY) ?? "null");
        savedAppearance={...readInvoiceAppearance(previous?.invoiceTemplate),bankName,bankAccount,bankHolder};
        localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({...next,invoiceTemplate:savedAppearance}));
      }
      setProfile(next); setAppearance(savedAppearance); onSaved?.(next,savedAppearance); onNotify("Profil bisnis berhasil disimpan");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Profil belum tersimpan. Coba lagi."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <section className="card business-profile-card">
    <div className="card-header"><div><h2>Identitas usaha</h2><p>{cloud ? "Lengkapi nama dan kontak usahamu." : "Profil demo tersimpan di browser ini."}</p></div></div>
    <form onSubmit={submit} aria-busy={busy}>
      <div className="business-profile-fields">
        <div className="field"><label className="field-label" htmlFor="business-name">Nama usaha<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama usaha" id="business-name" className="input" autoComplete="organization" maxLength={120} required disabled={busy} value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></div>
        <div className="field"><label className="field-label" htmlFor="business-email">Email akun</label><input id="business-email" className="input" readOnly value={cloud?.email ?? "Mode demo, belum terhubung ke akun"}/><p className="field-hint">Email akun tidak diubah melalui profil bisnis.</p></div>
        <div className="field"><label className="field-label" htmlFor="business-phone">Nomor WhatsApp usaha (opsional)</label><input id="business-phone" type="tel" className="input" autoComplete="tel" maxLength={30} disabled={busy} value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})} placeholder="08..."/></div>
        <div className="field"><label className="field-label" htmlFor="business-address">Alamat usaha (opsional)</label><textarea id="business-address" className="input" rows={3} autoComplete="street-address" maxLength={1000} disabled={busy} value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/></div>
        <fieldset className="business-bank-settings" disabled={busy} aria-labelledby="business-bank-title">
          <div className="business-bank-heading"><span className="business-bank-icon"><Landmark size={23} aria-hidden="true" /></span><div><h3 id="business-bank-title">Rekening pembayaran</h3><p>Ditampilkan pada invoice pelanggan.</p></div><span className="business-bank-optional">Opsional</span></div>
          <div className="business-bank-fields">
          <div className="field"><label className="field-label" htmlFor="business-bank-name">Nama bank</label><input id="business-bank-name" className="input" maxLength={80} value={appearance.bankName??""} onChange={e=>setAppearance({...appearance,bankName:e.target.value})} placeholder="Contoh: BCA"/></div>
          <div className="field"><label className="field-label" htmlFor="business-bank-account">Nomor rekening</label><input id="business-bank-account" className="input" inputMode="numeric" autoComplete="off" maxLength={40} value={appearance.bankAccount??""} onChange={e=>setAppearance({...appearance,bankAccount:e.target.value})} placeholder="Nomor rekening"/></div>
          <div className="field"><label className="field-label" htmlFor="business-bank-holder">Atas nama</label><input id="business-bank-holder" className="input" maxLength={120} value={appearance.bankHolder??""} onChange={e=>setAppearance({...appearance,bankHolder:e.target.value})} placeholder="Nama pemilik rekening"/></div>
          </div>
        </fieldset>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
      <div className="business-profile-footer"><Button type="submit" className="btn btn-primary" disabled={busy || cloud?.saving}>{busy ? "Menyimpan…" : "Simpan profil"}</Button></div>
    </form>
  </section>;
}

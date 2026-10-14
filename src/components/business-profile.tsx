"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_PROFILE_KEY, readBusinessProfile, validateBusinessProfile, type BusinessProfile } from "@/lib/business-profile";
import type { AccountWorkspace } from "./cloud-workspace";

export function BusinessProfilePanel({ cloud, onNotify, onSaved }: { cloud?: AccountWorkspace; onNotify: (message: string) => void; onSaved?: (profile: BusinessProfile) => void }) {
  const [profile, setProfile] = useState<BusinessProfile>(() => {
    if (cloud) return readBusinessProfile(cloud);
    try { return readBusinessProfile(JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY) ?? "null"), "Usaha demo"); }
    catch { return readBusinessProfile(null, "Usaha demo"); }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const next = validateBusinessProfile(profile);
      if (cloud) await cloud.saveProfile(next);
      else localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(next));
      setProfile(next); onSaved?.(next); onNotify("Profil bisnis berhasil disimpan");
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
        <div className="field"><label className="field-label" htmlFor="invoice-store-name">Nama toko pada invoice (opsional)</label><input id="invoice-store-name" className="input" maxLength={120} disabled={busy} value={profile.invoiceStoreName} onChange={e=>setProfile({...profile,invoiceStoreName:e.target.value})} placeholder="Contoh: Titipan Naya"/><p className="field-hint">Biarkan kosong jika nama toko tidak ingin ditampilkan pada invoice.</p></div>
        <div className="field"><label className="field-label" htmlFor="invoice-prefix">Awalan nomor invoice</label><input id="invoice-prefix" className="input" maxLength={20} required disabled={busy} value={profile.invoicePrefix} onChange={e=>setProfile({...profile,invoicePrefix:e.target.value})} placeholder="Contoh: INV atau NAYA"/><p className="field-hint">Contoh: {profile.invoicePrefix || "INV"}-KODE-PESANAN. Kode pesanan tetap unik. Perubahan awalan juga berlaku saat menyalin ulang invoice pesanan lama.</p></div>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
      <div className="business-profile-footer"><Button type="submit" className="btn btn-primary" disabled={busy || cloud?.saving}>{busy ? "Menyimpan…" : "Simpan profil"}</Button></div>
    </form>
  </section>;
}

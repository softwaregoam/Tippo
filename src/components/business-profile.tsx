"use client";
import { useEffect, useRef, useState } from "react";
import { Landmark, QrCode, Upload, X } from "lucide-react";
import { QrisImage } from "@/components/qris-image";
import { validateQrisFile, qrisExtension } from "@/lib/qris";
import { getSupabaseClient } from "@/lib/supabase";
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
  const qrisInput=useRef<HTMLInputElement>(null),qrisRequest=useRef(0);
  const [qris,setQris]=useState<{file:File;url:string}|null>(null),[processingQris,setProcessingQris]=useState(false);
  const qrisSource=qris?.url||appearance.qrisUrl||"";
  useEffect(()=>()=>{if(qris)URL.revokeObjectURL(qris.url);},[qris]);
  useEffect(()=>()=>{qrisRequest.current++;},[]);
  async function chooseQris(input:HTMLInputElement){
    const file=input.files?.[0];input.value="";if(!file)return;
    const request=++qrisRequest.current;setProcessingQris(true);setError("");
    try{await validateQrisFile(file);if(request===qrisRequest.current)setQris({file,url:URL.createObjectURL(file)});}
    catch(cause){if(request===qrisRequest.current)setError(cause instanceof Error?cause.message:"QRIS belum dapat dibaca.");}
    finally{if(request===qrisRequest.current)setProcessingQris(false);}
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current || processingQris) return;
    submitting.current = true; setBusy(true); setError("");
    let uploadedPath="",profileSaved=false;
    const client=getSupabaseClient();
    try {
      const next = validateBusinessProfile(profile);
      const validated=validateInvoiceTemplate({...next,appearance}).appearance;
      const {bankName,bankAccount,bankHolder}=validated;
      let qrisUrl=validated.qrisUrl??"";
      if(qris){
        if(!cloud||!client)throw new Error("Masuk ke akun untuk menyimpan QRIS.");
        uploadedPath=`${cloud.ownerId}/qris-${crypto.randomUUID()}.${qrisExtension(qris.file.type)}`;
        const {error}=await client.storage.from("invoice-logos").upload(uploadedPath,qris.file,{contentType:qris.file.type,upsert:false});
        if(error)throw new Error("QRIS belum terunggah. Periksa koneksi, lalu coba lagi.");
        qrisUrl=client.storage.from("invoice-logos").getPublicUrl(uploadedPath).data.publicUrl;
      }
      let savedAppearance={...appearance,bankName,bankAccount,bankHolder,qrisUrl};
      if (cloud) await cloud.saveProfile(next,{bankName,bankAccount,bankHolder,qrisUrl});
      else {
        const previous=JSON.parse(localStorage.getItem(DEMO_PROFILE_KEY) ?? "null");
        savedAppearance={...readInvoiceAppearance(previous?.invoiceTemplate),bankName,bankAccount,bankHolder,qrisUrl};
        localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({...next,invoiceTemplate:savedAppearance}));
      }
      profileSaved=true;
      const previousQris=cloud?.invoiceAppearance.qrisUrl;
      if(cloud&&client&&previousQris&&previousQris!==qrisUrl&&previousQris!==cloud.invoiceAppearance.logoUrl){
        const base=client.storage.from("invoice-logos").getPublicUrl("placeholder").data.publicUrl.replace(/placeholder$/,"");
        const path=previousQris.startsWith(base)?previousQris.slice(base.length):"";
        if(path.startsWith(`${cloud.ownerId}/qris-`)&&/^[^/]+\/qris-[a-zA-Z0-9-]+\.(?:png|jpg|webp)$/.test(path))await client.storage.from("invoice-logos").remove([path]).catch(()=>undefined);
      }
      setQris(null);
      setProfile(next); setAppearance(savedAppearance); onSaved?.(next,savedAppearance); onNotify("Profil bisnis berhasil disimpan");
    } catch (cause) { if(!profileSaved&&uploadedPath&&client)await client.storage.from("invoice-logos").remove([uploadedPath]).catch(()=>undefined); setError(cause instanceof Error ? cause.message : "Profil belum tersimpan. Coba lagi."); }
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
        <fieldset className="business-bank-settings business-qris-settings" disabled={busy||processingQris} aria-labelledby="business-qris-title">
          <div className="business-bank-heading"><span className="business-bank-icon"><QrCode size={23} aria-hidden="true"/></span><div><h3 id="business-qris-title">QRIS pembayaran</h3><p>Dikirim terpisah lewat tab QRIS di Invoice.</p></div><span className="business-bank-optional">Opsional</span></div>
          <div className="business-qris-picker">
            {qrisSource?<QrisImage key={qrisSource} src={qrisSource} alt="QRIS usaha yang dipilih"/>:<div className="business-qris-empty"><QrCode size={34} aria-hidden="true"/><span>Belum ada QRIS</span></div>}
            <div className="business-qris-controls"><div className="business-qris-buttons"><Button type="button" className="btn btn-secondary" disabled={!cloud} onClick={()=>qrisInput.current?.click()}><Upload size={16}/>{processingQris?"Memeriksa gambar…":qrisSource?"Ganti QRIS":"Unggah QRIS"}</Button>{qrisSource&&<Button type="button" className="btn btn-secondary" onClick={()=>{qrisRequest.current++;setQris(null);setAppearance({...appearance,qrisUrl:""});}}><X size={16}/>Hapus QRIS</Button>}</div>
              <input ref={qrisInput} type="file" aria-label="Unggah gambar QRIS" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>void chooseQris(event.target)}/>
              <p className="field-hint">PNG, JPG, WebP · maks. 1 MB. Gunakan QRIS resmi usahamu.</p>
              <p className="field-hint" role="status">{qris?"QRIS baru belum disimpan.":!qrisSource&&cloud?.invoiceAppearance.qrisUrl?"QRIS akan dihapus setelah profil disimpan.":"Pembayaran dikonfirmasi manual oleh owner."}</p>
            </div>
          </div>
        </fieldset>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
      <div className="business-profile-footer"><Button type="submit" className="btn btn-primary" disabled={busy || processingQris || cloud?.saving}>{busy ? "Menyimpan…" : "Simpan profil"}</Button></div>
    </form>
  </section>;
}

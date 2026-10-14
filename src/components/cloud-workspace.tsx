"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Cloud, LoaderCircle, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { cloudErrorMessage, parseCloudRecord, type CloudRecord } from "@/lib/cloud";
import { setAccountUsage } from "@/lib/subscription";
import { isAppData } from "@/lib/validation";
import type { AppData } from "@/lib/types";
import { readBusinessProfile, validateBusinessProfile, type BusinessProfile } from "@/lib/business-profile";
import { TippoApp } from "./tippo-app";
import { Wordmark } from "./wordmark";

export interface AccountWorkspace extends Pick<BusinessProfile, "invoiceStoreName" | "invoicePrefix"> { ownerId: string; name: string; email: string; phone: string; address: string; saveProfile: (profile: BusinessProfile) => Promise<void>; saving: boolean; record: CloudRecord; commit: (data: AppData) => Promise<boolean>; logout: () => Promise<void>; refreshSubscription:()=>Promise<void> }
export function CloudWorkspace() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [record, setRecord] = useState<CloudRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0), owner = useRef<string | null>(null), saving = useRef(false), epoch = useRef(0);
  const invalidateSession = useCallback(() => { ++epoch.current; }, []);
  const load = useCallback(async (account: User) => {
    const request = ++epoch.current;
    setError(""); setLoading(true); setUser(account);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Layanan akun belum dikonfigurasi.");
      const { data, error } = await client.rpc("get_tippo_workspace").abortSignal(AbortSignal.timeout(15000));
      if (request !== epoch.current) return;
      if (error) throw new Error(cloudErrorMessage(error));
      const next = parseCloudRecord(data); version.current = next.version;
      setAccountUsage(next.usage); setRecord(next);
    } catch (error) { if (request === epoch.current) setError(error instanceof Error ? error.message : "Workspace belum dapat dimuat."); }
    finally { if (request === epoch.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) { queueMicrotask(() => { setError("Layanan akun belum dikonfigurasi."); setLoading(false); }); return; }
    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (!active) return;
        if (!session) { ++epoch.current; owner.current = null; setRecord(null); setUser(null); setAccountUsage(null); router.replace("/masuk"); return; }
        if (session.user.id !== owner.current) { owner.current = session.user.id; setRecord(null); setAccountUsage(null); void load(session.user); }
        else setUser(session.user);
      });
    });
    return () => { active = false; invalidateSession(); data.subscription.unsubscribe(); setAccountUsage(null); };
  }, [load, router, invalidateSession]);
  async function commit(next: AppData): Promise<boolean> {
    if (saving.current) throw new Error("Tunggu penyimpanan sebelumnya selesai, ya.");
    if (!isAppData(next)) throw new Error("Data tidak valid. Perubahan belum disimpan.");
    saving.current = true; setBusy(true); setError("");
    const request = epoch.current;
    try {
      const client = getSupabaseClient();
      if (!client || !user) throw new Error("Masuk kembali sebelum menyimpan.");
      const { data, error } = await client.rpc("save_tippo_workspace", { p_data: next, p_expected_version: version.current }).abortSignal(AbortSignal.timeout(15000));
      if (request !== epoch.current) throw new Error("Sesi akun berubah. Masuk kembali untuk melanjutkan.");
      if (error) throw new Error(cloudErrorMessage(error));
      const saved = parseCloudRecord(data); version.current = saved.version;
      setAccountUsage(saved.usage); setRecord(saved); return true;
    } catch (error) { const message = error instanceof Error ? error.message : "Data belum tersimpan."; setError(message); throw new Error(message); }
    finally { saving.current = false; setBusy(false); }
  }
  async function saveProfile(profile: BusinessProfile) {
    const next = validateBusinessProfile(profile);
    if (saving.current) throw new Error("Tunggu penyimpanan sebelumnya selesai, ya.");
    const client = getSupabaseClient();
    if (!client || !user) throw new Error("Masuk kembali sebelum menyimpan profil.");
    const request = epoch.current;
    const accountId = user.id;
    saving.current = true; setBusy(true);
    try {
      const { data, error } = await client.auth.updateUser({ data: { business_name: next.name, business_phone: next.phone, business_address: next.address, invoice_store_name: next.invoiceStoreName, invoice_prefix: next.invoicePrefix } });
      if (request !== epoch.current || owner.current !== accountId) throw new Error("Sesi akun berubah. Masuk kembali untuk melanjutkan.");
      if (error || !data.user) throw new Error("Profil belum tersimpan. Periksa koneksi dan coba lagi.");
      setUser(data.user);
    } finally { saving.current = false; setBusy(false); }
  }
  async function logout() {
    if (saving.current) return;
    const result = await getSupabaseClient()?.auth.signOut();
    if (result?.error) { setError("Belum berhasil keluar. Coba lagi."); return; }
    setAccountUsage(null); router.replace("/masuk");
  }
  async function refreshSubscription(){
    const client=getSupabaseClient();if(!client || !user)return;
    const request=epoch.current,accountId=user.id;
    const {data,error}=await client.rpc("get_tippo_workspace").abortSignal(AbortSignal.timeout(15000));
    if(request!==epoch.current || owner.current!==accountId)return;
    if(error)throw new Error("Status langganan belum dapat diperbarui. Cek status pembayaran lagi.");
    const next=parseCloudRecord(data);
    // Refresh verified entitlement only; preserve current data and save version.
    setRecord(previous=>previous?{...previous,subscription:next.subscription}:previous);
  }
  if (!record) return <main className="workspace-wait"><Wordmark /><div className="workspace-wait-card" role={loading ? "status" : undefined}>{loading ? <><LoaderCircle size={32} className="spin" /><h1>Memuat catatan usahamu…</h1><p>Pesanan, produk, dan pembayaran sedang diambil dari akunmu.</p></> : <><Cloud size={36} /><h1>Ruang usahamu belum terbuka.</h1><p role="alert">{error}</p><div>{user ? <button className="landing-button primary" onClick={() => void load(user)}><RefreshCw size={17} />Coba lagi</button> : <Link href="/masuk" className="landing-button primary">Masuk ke akun</Link>}</div><button className="text-action" onClick={logout}>Keluar akun</button></>}</div></main>;
  const profile = readBusinessProfile({ name: user?.user_metadata.business_name, phone: user?.user_metadata.business_phone, address: user?.user_metadata.business_address, invoiceStoreName: user?.user_metadata.invoice_store_name, invoicePrefix: user?.user_metadata.invoice_prefix });
  if (!user) return null;
  return <>{error && <div className="cloud-error" role="alert">{error} <button onClick={() => user && void load(user)}>Muat data terbaru</button></div>}<TippoApp cloud={{ ownerId: user.id, name: profile.name, phone: profile.phone, address: profile.address, invoiceStoreName: profile.invoiceStoreName, invoicePrefix: profile.invoicePrefix, saveProfile, email: user.email ?? "", saving: busy, record, commit, logout, refreshSubscription }} />{(busy || loading) && <div className="cloud-saving" role="status"><LoaderCircle size={26} className="spin" /><span>{busy ? "Menyimpan perubahan…" : "Memuat data terbaru…"}</span></div>}</>;
}

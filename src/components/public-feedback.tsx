"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

interface PublicFeedback { id: string; category: string; area: string; subject: string; message: string; email: string; created_at: string }
const categories: Record<string, string> = { criticism: "Kritik", suggestion: "Saran", issue: "Laporan masalah" };

export function PublicFeedback() {
  const [items, setItems] = useState<PublicFeedback[]>([]);
  const [status, setStatus] = useState("Memuat masukan…");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error();
        const { data, error } = await client.rpc("list_public_tippo_feedback").abortSignal(controller.signal);
        if (error || !Array.isArray(data)) throw new Error();
        if (!controller.signal.aborted) { setItems(data); setStatus("Belum ada masukan yang dipublikasikan."); }
      } catch { if (!controller.signal.aborted) setStatus("Masukan belum dapat dimuat saat ini."); }
    }
    void load();
    return () => controller.abort();
  }, []);
  return <section className="testimonials-section landing-container" aria-labelledby="public-feedback-title">
    <div className="testimonials-heading"><p className="section-label">Kritik & saran</p><h2 id="public-feedback-title">Masukan dari pengguna Tippo.</h2><p>Masukan yang diizinkan pengguna dan ditinjau pengelola. Email disamarkan untuk menjaga privasi.</p></div>
    <div className="testimonials-list">{items.length ? items.map(item => <figure className={item.area === "po" ? "testimonial-po" : ""} key={item.id}><h3>{item.subject}</h3><blockquote><p className="public-feedback-message">{item.message}</p></blockquote><figcaption><strong>{item.email}</strong><span>{categories[item.category]} · {new Date(item.created_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" })}</span></figcaption></figure>) : <p role="status">{status}</p>}</div>
  </section>;
}

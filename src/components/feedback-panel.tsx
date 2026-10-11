"use client";

import { useRef, useState } from "react";
import { Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectOption } from "@/components/ui/select";
import { getSupabaseClient } from "@/lib/supabase";
import { feedbackError, validateFeedback, type FeedbackInput } from "@/lib/feedback";

type FeedbackDraft = Omit<FeedbackInput, "category" | "area"> & { category: FeedbackInput["category"] | ""; area: FeedbackInput["area"] | "" };
const empty: FeedbackDraft = { category: "", area: "", subject: "", message: "" };

export function FeedbackPanel({ onNotify }: { onNotify: (message: string) => void }) {
  const [input, setInput] = useState<FeedbackDraft>({ ...empty });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [publicConsent, setPublicConsent] = useState(false);
  const lock = useRef(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ id: string; payload: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    setError("");
    let valid: FeedbackInput;
    try {
      if (!input.category) throw new Error("Pilih jenis masukan.");
      if (!input.area) throw new Error("Pilih bagian Tippo.");
      valid = validateFeedback({ ...input, category: input.category, area: input.area });
    } catch (cause) { setError((cause as Error).message); return; }
    const payload = JSON.stringify({ ...valid, publicConsent });
    if (!attempt.current || attempt.current.payload !== payload) attempt.current = { id: crypto.randomUUID(), payload };
    const id = attempt.current.id;
    lock.current = true; setBusy(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Layanan akun belum dikonfigurasi.");
      const { data, error } = await client.rpc(publicConsent ? "submit_public_tippo_feedback" : "submit_tippo_feedback", { p_id: id, p_category: valid.category, p_area: valid.area, p_subject: valid.subject, p_message: valid.message }).abortSignal(AbortSignal.timeout(15000));
      if (error) { setError(feedbackError(error)); return; }
      if (!data || data.id !== id || typeof data.createdAt !== "string") throw new Error("Respons belum valid.");
      setSent(true); setInput({ ...empty }); setPublicConsent(false); attempt.current = null;
      onNotify("Kritik & saran berhasil dikirim");
    } catch { setError("Masukan belum terkirim. Periksa koneksi lalu coba lagi; isi form tetap ada."); }
    finally { lock.current = false; setBusy(false); }
  }

  if (sent) return <section className="card feedback-success" aria-label="Masukan terkirim" role="status"><Check size={28} aria-hidden="true" /><h2>Terima kasih sudah berbagi.</h2><p>Kritik & saranmu sudah tersimpan. Masukan ini membantu kami memperbaiki Tippo.</p><Button className="btn btn-secondary" onClick={() => { setSent(false); requestAnimationFrame(() => subjectRef.current?.focus()); }}>Kirim masukan lain</Button></section>;

  return <section className="card feedback-card" aria-label="Form kritik dan saran">
    <div className="card-header"><div><h2>Apa yang bisa kami perbaiki?</h2><p>Ceritakan kendala atau ide yang kamu punya saat memakai Tippo.</p></div></div>
    <form onSubmit={submit} aria-busy={busy}>
      <div className="feedback-fields">
        <div className="form-grid"><div className="field"><label className="field-label" htmlFor="feedback-category">Jenis masukan<span className="required-mark" aria-hidden="true"> *</span></label><Select placeholder="Pilih jenis masukan" aria-required="true" id="feedback-category" aria-label="Jenis masukan" className="input" disabled={busy} value={input.category} onValueChange={category => setInput({ ...input, category: category as FeedbackInput["category"] })}><SelectOption value="suggestion">Saran</SelectOption><SelectOption value="criticism">Kritik</SelectOption><SelectOption value="issue">Laporkan masalah</SelectOption></Select></div><div className="field"><label className="field-label" htmlFor="feedback-area">Bagian Tippo<span className="required-mark" aria-hidden="true"> *</span></label><Select placeholder="Pilih bagian Tippo" aria-required="true" id="feedback-area" aria-label="Bagian Tippo" className="input" disabled={busy} value={input.area} onValueChange={area => setInput({ ...input, area: area as FeedbackInput["area"] })}><SelectOption value="general">Tippo secara umum</SelectOption><SelectOption value="jastip">Jastip</SelectOption><SelectOption value="po">Open PO</SelectOption></Select></div></div>
        <div className="field"><label className="field-label" htmlFor="feedback-subject">Judul<span className="required-mark" aria-hidden="true"> *</span></label><input id="feedback-subject" aria-label="Judul" ref={subjectRef} className="input" required minLength={3} maxLength={120} disabled={busy} value={input.subject} onChange={event => setInput({ ...input, subject: event.target.value })} placeholder="Contoh: Filter pesanan berdasarkan pelanggan" /></div>
        <div className="field"><label className="field-label" htmlFor="feedback-message">Pesan<span className="required-mark" aria-hidden="true"> *</span></label><textarea id="feedback-message" aria-label="Pesan" className="input" rows={6} required minLength={10} maxLength={2000} disabled={busy} value={input.message} onChange={event => setInput({ ...input, message: event.target.value })} placeholder="Ceritakan yang terjadi, atau fitur yang ingin kamu tambahkan." /><p className="field-hint">{input.message.length.toLocaleString("id-ID")} / 2.000 karakter</p></div>
        <label className="field-hint"><input type="checkbox" checked={publicConsent} disabled={busy} onChange={event => setPublicConsent(event.target.checked)} /> Saya mengizinkan masukan ini tampil di beranda setelah ditinjau, dengan email disamarkan. Jangan sertakan data pribadi dalam pesan.</label>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
      <div className="feedback-footer"><p className="field-hint">Dikirim menggunakan akun Tippo yang sedang masuk.</p><Button type="submit" className="btn btn-primary" disabled={busy}><Send size={16} aria-hidden="true" />{busy ? "Mengirim…" : "Kirim masukan"}</Button></div>
    </form>
  </section>;
}

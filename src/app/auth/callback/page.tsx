"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { Wordmark } from "@/components/wordmark";
export default function CallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (query.has("error") || hash.has("error")) { queueMicrotask(() => setFailed(true)); return; }
    const client = getSupabaseClient();
    if (!client) { queueMicrotask(() => setFailed(true)); return; }
    void client.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) setFailed(true); else router.replace("/app");
    }).catch(() => setFailed(true));
  }, [router]);
  return <main className="workspace-wait"><Wordmark /><div className="workspace-wait-card"><h1>{failed ? "Login belum berhasil." : "Mengonfirmasi akunmu…"}</h1><p>{failed ? "Login mungkin dibatalkan atau tautan sudah kedaluwarsa. Coba masuk lagi dengan Google atau email." : "Sebentar, ruang usahamu hampir siap."}</p>{failed && <Link className="landing-button primary" href="/masuk">Kembali ke halaman masuk</Link>}</div></main>;
}

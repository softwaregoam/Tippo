"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { getSupabaseClient, authErrorMessage, isGoogleAuthEnabled } from "@/lib/supabase";
import { Wordmark } from "./wordmark";
import { useAccountSession } from "@/lib/use-account-session";

export function AuthForm({ mode }: { mode: "login" | "signup" | "forgot" | "reset" }) {
  const router = useRouter();
  const signedIn = useAccountSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const signup = mode === "signup", forgot = mode === "forgot", reset = mode === "reset";
  useEffect(() => {
    if (signedIn && (mode === "login" || mode === "signup")) router.replace("/app");
  }, [signedIn, mode, router]);
  useEffect(() => {
    if (!reset) return;
    const client = getSupabaseClient();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION")) setRecoveryReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [reset]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(""); setMessage(""); setBusy(true);
    const client = getSupabaseClient();
    if (!client) { setError("Layanan akun belum dikonfigurasi. Kamu masih bisa mencoba demo."); setBusy(false); return; }
    try {
      if (signup) {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { data: { business_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (error) setError(authErrorMessage(error));
        else if (data.session) router.replace("/app");
        else setMessage("Cek kotak masuk emailmu untuk mengonfirmasi akun, lalu masuk ke Tippo. Jika belum terlihat, periksa folder spam.");
      } else if (forgot) {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/atur-ulang-password` });
        if (error) setError(authErrorMessage(error));
        else setMessage("Jika email terdaftar, tautan untuk mengatur ulang kata sandi akan dikirim. Periksa juga folder spam.");
      } else if (reset) {
        if (!recoveryReady) { setError("Buka tautan pemulihan yang dikirim ke emailmu terlebih dahulu."); return; }
        const { error } = await client.auth.updateUser({ password });
        if (error) setError(authErrorMessage(error));
        else { setMessage("Kata sandi berhasil diperbarui."); router.replace("/app"); }
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(authErrorMessage(error));
        else router.replace("/app");
      }
    } catch { setError("Belum bisa terhubung. Periksa koneksi internetmu dan coba lagi."); }
    finally { setBusy(false); }
  }

  async function continueWithGoogle() {
    if (busy) return;
    setError(""); setMessage(""); setBusy(true); setGoogleBusy(true);
    const client = getSupabaseClient();
    try {
      if (!client) { setError("Layanan akun belum dikonfigurasi. Kamu masih bisa mencoba demo."); return; }
      if (!await isGoogleAuthEnabled()) {
        setError("Login Google belum diaktifkan. Gunakan email untuk sementara.");
        return;
      }
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback`, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
      });
      if (error) { setError(authErrorMessage(error)); return; }
      if (!data.url) { setError("Login Google belum dapat dibuka. Coba lagi."); return; }
      window.location.assign(data.url);
    } catch { setError("Belum bisa terhubung ke Google. Periksa koneksi internetmu dan coba lagi."); }
    finally { setBusy(false); setGoogleBusy(false); }
  }

  const title = signup ? "Buat ruang usahamu." : forgot ? "Lupa kata sandi?" : reset ? "Atur kata sandi baru." : "Masuk ke Tippo.";
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Wordmark />
        <div className="auth-header-actions">
          <Link href="/" className="auth-back"><ArrowLeft size={18} aria-hidden="true" />Kembali ke beranda</Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-story-title">
          <p className="auth-story-kicker">Jastip &amp; Open PO</p>
          <h2 id="auth-story-title">Catatan yang pas untuk cara jualanmu.</h2>
          <p>Produk titipan atau produk sendiri, mulai dengan alur yang sesuai. Rincian produk tetap dalam satu pesanan pelanggan.</p>
          <dl className="auth-flow-list">
            <div><dt>Jastip<span>Titipan belanja</span></dt><dd>Catat produk, varian, warna, ukuran, dan biaya belinya.</dd></div>
            <div><dt className="auth-po-label">Open PO<span>Produk dari katalog</span></dt><dd>Pilih produk yang sudah kamu buat, isi jumlah, lalu catat pembayaran.</dd></div>
          </dl>
          <p className="auth-story-note">Isi biaya untuk menghitung HPP. Salin invoice saat pelanggan perlu rincian tagihan.</p>
        </section>
        <section className="auth-content" aria-labelledby="auth-title">
          <div className="auth-card">
            <h1 id="auth-title">{title}</h1>
            <p className="auth-intro">{signup ? "Gunakan Google atau isi nama usaha dan email untuk membuat akun gratis." : forgot ? "Masukkan email akunmu untuk menerima tautan pemulihan." : reset ? "Gunakan setidaknya 8 karakter untuk kata sandi barumu." : "Lanjutkan mencatat pesanan, biaya, dan pembayaran pelanggan."}</p>
            {!forgot && !reset && <div className="auth-google">
              {signup && <p className="auth-consent">Dengan membuat akun, kamu menyetujui <Link href="/ketentuan">ketentuan penggunaan</Link> dan <Link href="/privasi">kebijakan privasi</Link>.</p>}
              <button type="button" className="auth-google-button" disabled={busy} aria-busy={googleBusy} onClick={() => void continueWithGoogle()}><Image src="/brands/google-g.png" width={24} height={24} alt="" aria-hidden="true" /><span>{googleBusy ? "Menghubungkan ke Google…" : "Masuk dengan Google"}</span></button>
              <div className="auth-divider"><span>atau gunakan email</span></div>
            </div>}
            {reset && !recoveryReady && <p className="auth-recovery-note" role="status">Buka tautan pemulihan dari emailmu agar kata sandi bisa disimpan. Belum punya tautannya? <Link href="/lupa-password">Minta tautan pemulihan</Link></p>}
            <form onSubmit={submit} aria-busy={busy}>
              {signup && <div className="auth-field"><label htmlFor="auth-business">Nama usaha<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Nama usaha" id="auth-business" required autoComplete="organization" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama usahamu" /></div>}
              {!reset && <div className="auth-field"><label htmlFor="auth-email">Email<span className="required-mark" aria-hidden="true"> *</span></label><input aria-label="Email" id="auth-email" required type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email yang kamu gunakan" /></div>}
              {!forgot && <div className="auth-field"><label htmlFor="auth-password">{reset ? "Kata sandi baru" : "Kata sandi"}<span className="required-mark" aria-hidden="true"> *</span></label><div className="auth-input-wrap"><input aria-label={reset ? "Kata sandi baru" : "Kata sandi"} id="auth-password" required type={visible ? "text" : "password"} autoComplete={signup || reset ? "new-password" : "current-password"} minLength={signup || reset ? 8 : 1} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={signup || reset ? "Minimal 8 karakter" : "Masukkan kata sandimu"} /><button type="button" aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button></div></div>}
              {mode === "login" && <Link href="/lupa-password" className="auth-forgot">Lupa kata sandi?</Link>}
              {error && <p className="auth-alert error" role="alert">{error}</p>}
              {message && <p className="auth-alert success" role="status">{message}</p>}
              <button className="landing-button primary auth-submit" disabled={busy || (reset && !recoveryReady)} type="submit">{busy ? "Memproses…" : signup ? "Buat akun gratis" : forgot ? "Kirim tautan pemulihan" : reset ? "Simpan kata sandi" : "Masuk ke Tippo"}</button>
            </form>
            <p className="auth-switch">{forgot || reset ? <Link href="/masuk">Kembali ke halaman masuk</Link> : <>{signup ? "Sudah punya akun?" : "Belum punya akun?"} <Link href={signup ? "/masuk" : "/daftar"}>{signup ? "Masuk di sini" : "Buat akun gratis"}</Link></>}</p>
          </div>
          <p className="auth-footer">Paket Gratis: 5 pesanan Jastip dan 5 pesanan Open PO per bulan.</p>
        </section>
      </div>
    </main>
  );
}

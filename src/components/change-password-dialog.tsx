"use client";
import { useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient, authErrorMessage } from "@/lib/supabase";

export function ChangePasswordDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    if (password !== confirm) { setError("Konfirmasi kata sandi baru tidak cocok."); setBusy(false); return; }
    if (password.length < 8) { setError("Kata sandi baru minimal 8 karakter."); setBusy(false); return; }
    const client = getSupabaseClient();
    if (!client) { setError("Layanan akun belum dikonfigurasi."); setBusy(false); return; }
    try {
      const { error: err } = await client.auth.updateUser({ password });
      if (err) setError(authErrorMessage(err));
      else { setMessage("Kata sandi akun berhasil diubah."); setPassword(""); setConfirm(""); onSuccess(); }
    } catch { setError("Belum berhasil terhubung. Periksa koneksi internet dan coba lagi."); }
    finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Ubah kata sandi</h2>
          <button className="icon-button" aria-label="Tutup" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={submit} aria-busy={busy}>
          <div className="modal-body">
            <div className="field">
              <label className="field-label">Kata sandi baru<span className="required-mark" aria-hidden="true"> *</span></label>
              <div className="auth-input-wrap" style={{ display: "flex", alignItems: "center" }}>
                <input aria-label="Kata sandi baru" className="input" required type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} disabled={busy} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 8 karakter" style={{ flex: 1 }} />
                <button type="button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} className="icon-button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
              </div>
            </div>
            <div className="field">
              <label className="field-label">Konfirmasi kata sandi baru<span className="required-mark" aria-hidden="true"> *</span></label>
              <div className="auth-input-wrap" style={{ display: "flex", alignItems: "center" }}>
                <input aria-label="Konfirmasi kata sandi baru" className="input" required type={showConfirm ? "text" : "password"} autoComplete="new-password" disabled={busy} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Masukkan ulang kata sandi baru" style={{ flex: 1 }} />
                <button type="button" aria-label={showConfirm ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} className="icon-button" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
              </div>
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            {message && <p className="auth-alert success" role="status">{message}</p>}
          </div>
          <div className="modal-footer">
            <Button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Batal</Button>
            <Button type="submit" className="btn btn-primary" disabled={busy || !password}>{busy ? "Mengubah…" : "Simpan"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

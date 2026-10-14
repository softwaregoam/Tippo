"use client";
import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseChatOrder, type ChatOrderDraft } from "@/lib/chat-order";
import type { AppData, Batch } from "@/lib/types";

export function ChatOrderDialog({ type, data, onDraft, onClose }: { type: Batch["type"]; data: AppData; onDraft: (draft: ChatOrderDraft) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>(".modal-header button")?.focus({ preventScroll: true });
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={ref} className="native-dialog chat-order-dialog" aria-labelledby="chat-order-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-header"><div><h2 id="chat-order-title">Tempel pesanan {type === "po" ? "Open PO" : "Jastip"}</h2><p>Satu pelanggan per chat, satu produk per baris.</p></div><button className="icon-button" aria-label="Tutup tempel pesanan" onClick={onClose}><X size={20} /></button></div>
    <form onSubmit={event => { event.preventDefault(); setError(""); try { onDraft(parseChatOrder(text, type, data)); } catch (error) { setError(error instanceof Error ? error.message : "Chat belum bisa dibaca."); } }}>
      <div className="modal-body">
        <label className="field-label" htmlFor="order-chat">Chat WhatsApp</label>
        <textarea id="order-chat" className="input chat-order-input" rows={6} maxLength={10000} value={text} onChange={event => setText(event.target.value)} placeholder={type === "po" ? "Nama: Alya\nWA: 08123456789\nRoti susu coklat x2\nRoti susu keju x1" : "Nama: Alya\nKaos x2; toko: Uniqlo; warna: Hitam; ukuran: L; harga: 150.000"} aria-describedby="chat-order-hint" />
        <p id="chat-order-hint" className="field-hint">Gunakan jumlah seperti x2, 2 pcs, atau jumlah: 2. {type === "po" ? "Nama, SKU, dan varian dicocokkan dengan katalog aktif. Pilihan yang ambigu dibiarkan kosong untuk kamu pilih." : "Toko, varian, warna, ukuran, dan harga bisa ditulis dengan label, dipisahkan titik koma seperti contoh."}</p>
        <p className="field-hint">Hasil dibuka sebagai draf di form pesanan. Periksa pelanggan, tanggal, produk, jumlah, dan harga sebelum menyimpan. Chat diproses di perangkatmu.</p>
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
      <div className="modal-footer"><Button type="button" className="btn btn-secondary" onClick={onClose}>Batal</Button><Button type="submit" className="btn btn-primary" disabled={!text.trim()}><ClipboardPaste size={16} />Baca chat & periksa draf</Button></div>
    </form>
  </dialog>;
}

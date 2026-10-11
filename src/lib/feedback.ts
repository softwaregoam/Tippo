export type FeedbackCategory = "criticism" | "suggestion" | "issue";
export type FeedbackArea = "general" | "jastip" | "po";
export interface FeedbackInput { category: FeedbackCategory; area: FeedbackArea; subject: string; message: string }

export function validateFeedback(input: FeedbackInput): FeedbackInput {
  if (!["criticism", "suggestion", "issue"].includes(input.category)) throw new Error("Pilih jenis masukan.");
  if (!["general", "jastip", "po"].includes(input.area)) throw new Error("Pilih bagian Tippo.");
  const subject = input.subject.trim(), message = input.message.trim();
  if (subject.length < 3 || subject.length > 120) throw new Error("Judul perlu 3 sampai 120 karakter.");
  if (message.length < 10 || message.length > 2000) throw new Error("Pesan perlu 10 sampai 2.000 karakter.");
  return { category: input.category, area: input.area, subject, message };
}

export function feedbackError(error: { code?: string; message?: string }): string {
  if (error.code === "PGRST202" || /schema cache|does not exist/.test(error.message ?? "")) return "Pengiriman belum tersedia. Pengelola perlu mengaktifkan database kritik & saran terlebih dahulu. Pesanmu tetap ada di form.";
  if (/TIPPO_FEEDBACK_INVALID/.test(error.message ?? "")) return "Periksa judul dan pesan sebelum mengirim.";
  if (/TIPPO_AUTH/.test(error.message ?? "") || error.code === "42501") return "Sesi akun belum valid. Masuk kembali sebelum mengirim masukan.";
  return "Masukan belum terkirim. Periksa koneksi lalu coba lagi; isi form tetap tersimpan selama halaman ini terbuka.";
}

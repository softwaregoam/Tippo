/** Call directly from a click with a file prepared ahead of time for mobile activation. */
export async function shareOrDownloadFile(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return "shared"; }
    catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
      throw new Error("Gambar belum dapat dibagikan. Coba lagi atau gunakan tombol Unduh.");
    }
  }
  downloadFile(file);
  return "downloaded";
}
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file), link = document.createElement("a");
  try {
    link.href = url; link.download = file.name;
    document.body.append(link); link.click(); link.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
export function imageFileFromDataUrl(src: string, filename: string): File {
  const prefix = "data:image/png;base64,";
  if (!src.startsWith(prefix)) throw new Error("Gambar invoice belum siap dibagikan.");
  const bytes = Uint8Array.from(atob(src.slice(prefix.length)), char => char.charCodeAt(0));
  return new File([bytes], filename, { type: "image/png" });
}

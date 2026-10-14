/** Render a standalone invoice at a readable width, independent of the phone viewport. */
export async function downloadInvoiceImage(preview: HTMLElement, filename: string): Promise<void> {
  const invoice=preview.querySelector<HTMLElement>(".invoice-document");
  if(!invoice)throw new Error("Invoice belum siap diunduh.");
  const frame=document.createElement("iframe");
  frame.title="Menyiapkan gambar invoice";
  frame.setAttribute("aria-hidden","true");
  frame.tabIndex=-1;
  frame.style.cssText="position:fixed;left:-10000px;top:0;width:794px;height:1000px;border:0;pointer-events:none";
  document.body.append(frame);
  try {
    const page=frame.contentDocument;
    if(!page)throw new Error("Gambar invoice belum dapat dibuat.");
    page.open();
    page.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><style>body{margin:0;background:white}</style></head><body>${invoice.outerHTML}</body></html>`);
    page.close();
    const output=page.querySelector<HTMLElement>(".invoice-document");
    if(!output)throw new Error("Invoice belum siap diunduh.");
    await Promise.all(Array.from(output.querySelectorAll("img")).map(async image=>{
      try {
        const response=await fetch(image.src,{credentials:"omit",signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error("Logo unavailable");
        const blob=await response.blob();
        image.src=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});
        await image.decode();
      } catch {throw new Error("Logo invoice belum dapat dimuat. Coba unduh kembali.");}
    }));
    const {toBlob}=await import("html-to-image");
    const blob=await toBlob(output,{pixelRatio:2,backgroundColor:"#ffffff",skipFonts:true});
    if(!blob)throw new Error("Gambar invoice belum dapat dibuat. Coba kembali.");
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=filename;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  } finally {frame.remove();}
}

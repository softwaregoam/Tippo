import {loadInvoiceLogo} from "./invoice-logo-cache.ts";
/** Render a standalone invoice at a readable width, independent of the phone viewport. */
export async function renderInvoiceImage(preview: HTMLElement): Promise<Blob> {
  const invoice=preview.querySelector<HTMLElement>(".invoice-document");
  if(!invoice)throw new Error("Invoice belum siap diunduh.");
  const copy=invoice.cloneNode(true) as HTMLElement;
  await Promise.all(Array.from(copy.querySelectorAll<HTMLElement>("[data-invoice-logo-url]")).map(async holder=>{
    const image=document.createElement("img");image.alt="Logo toko";
    image.src=await loadInvoiceLogo(holder.dataset.invoiceLogoUrl!);
    holder.removeAttribute("aria-busy");holder.replaceChildren(image);
  }));
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
    page.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><style>body{margin:0;background:white}</style></head><body>${copy.outerHTML}</body></html>`);
    page.close();
    const output=page.querySelector<HTMLElement>(".invoice-document");
    if(!output)throw new Error("Invoice belum siap diunduh.");
    await Promise.all(Array.from(output.querySelectorAll("img")).map(async image=>{
      try {
        image.src=await loadInvoiceLogo(image.src);
        await image.decode();
      } catch {throw new Error("Logo invoice belum dapat dimuat. Coba unduh kembali.");}
    }));
    const {toBlob}=await import("html-to-image");
    const blob=await toBlob(output,{pixelRatio:2,backgroundColor:"#ffffff",skipFonts:true});
    if(!blob)throw new Error("Gambar invoice belum dapat dibuat. Coba kembali.");
    return blob;
  } finally {frame.remove();}
}

export async function downloadInvoiceImage(preview: HTMLElement, filename: string): Promise<void> {
  const blob=await renderInvoiceImage(preview);
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export type InvoicePrintImage = { src:string; width:number; height:number };
/** Prepare in the active tab, before a phone browser suspends it for a print popup. */
export async function prepareInvoiceImage(preview:HTMLElement):Promise<InvoicePrintImage> {
  const blob=await renderInvoiceImage(preview);
  const [buffer,src]=await Promise.all([blob.arrayBuffer(),new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Gambar invoice belum dapat dimuat."));reader.readAsDataURL(blob);
  })]);
  const header=new DataView(buffer),width=header.getUint32(16),height=header.getUint32(20);
  if(!width||!height)throw new Error("Gambar invoice belum dapat dimuat.");
  return {src,width,height};
}

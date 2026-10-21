import {loadInvoiceLogo} from "./invoice-logo-cache.ts";
/** Render a standalone invoice at a readable width, independent of the phone viewport. */
export async function renderInvoiceImage(preview: HTMLElement): Promise<Blob> {
  const invoice=preview.querySelector<HTMLElement>(".invoice-document");
  if(!invoice)throw new Error("Invoice belum siap diunduh.");
  const copy=invoice.cloneNode(true) as HTMLElement;
  // iOS can insert phone/date links into the source before it is cloned.
  for(const link of copy.querySelectorAll("a[x-apple-data-detectors]"))link.replaceWith(document.createTextNode(link.textContent??""));
  const assets="[data-invoice-logo-url],[data-invoice-qris-url]";
  const assetError=(element:Element)=>element.closest("[data-invoice-qris-url]")?"QRIS invoice belum dapat dimuat. Coba unduh kembali.":"Logo invoice belum dapat dimuat. Coba unduh kembali.";
  await Promise.all(Array.from(copy.querySelectorAll<HTMLElement>(assets)).map(async holder=>{
    try{
      const image=document.createElement("img");image.alt=holder.dataset.invoiceQrisUrl?"QRIS pembayaran invoice":"Logo toko";
      image.src=await loadInvoiceLogo((holder.dataset.invoiceQrisUrl??holder.dataset.invoiceLogoUrl)!);
      holder.removeAttribute("aria-busy");holder.replaceChildren(image);
    }catch{throw new Error(assetError(holder));}
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
    page.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=794"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no"><style>html,body{margin:0;background:white;-webkit-text-size-adjust:100%;text-size-adjust:100%}</style></head><body>${copy.outerHTML}</body></html>`);
    page.close();
    const output=page.querySelector<HTMLElement>(".invoice-document");
    if(!output)throw new Error("Invoice belum siap diunduh.");
    await Promise.all(Array.from(output.querySelectorAll("img")).map(async image=>{
      try {
        image.src=await loadInvoiceLogo(image.src);
        await image.decode();
      } catch {throw new Error(assetError(image));}
    }));
    // Preserve the uploaded image's aspect ratio and occupied space when its
    // pixels are omitted from the SVG pass below (QRIS uploads can be portrait).
    for(const holder of output.querySelectorAll<HTMLElement>(assets)){
      const box=holder.getBoundingClientRect();
      holder.style.width=`${box.width}px`;holder.style.height=`${box.height}px`;
    }
    // Draw uploaded images directly on the canvas: WebKit can omit images inside
    // SVG foreignObject. This keeps both logos and payment codes in every export.
    const images=Array.from(output.querySelectorAll<HTMLImageElement>("[data-invoice-logo-url] img,[data-invoice-qris-url] img"));
    const bounds=output.getBoundingClientRect();
    const placements=images.map(image=>({image,bounds:image.getBoundingClientRect()}));
    const {toCanvas}=await import("html-to-image");
    const canvas=await toCanvas(output,{
      pixelRatio:2,backgroundColor:"#ffffff",skipFonts:true,
      filter:node=>!(node.nodeType===1&&(node as Element).matches("[data-invoice-logo-url] img,[data-invoice-qris-url] img")),
    });
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Gambar invoice belum dapat dibuat. Coba kembali.");
    const scaleX=canvas.width/bounds.width,scaleY=canvas.height/bounds.height;
    for(const {image,bounds:box} of placements){
      if(!image.naturalWidth||!image.naturalHeight)throw new Error(assetError(image));
      const fit=Math.min(box.width/image.naturalWidth,box.height/image.naturalHeight);
      const width=image.naturalWidth*fit,height=image.naturalHeight*fit;
      context.drawImage(image,(box.left-bounds.left+(box.width-width)/2)*scaleX,(box.top-bounds.top+(box.height-height)/2)*scaleY,width*scaleX,height*scaleY);
    }
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));
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

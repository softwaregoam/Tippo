export async function prepareInvoiceLogo(file: File): Promise<Blob> {
 if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Pilih gambar PNG, JPG, atau WebP.");
 if(file.size>2*1024*1024)throw new Error("Ukuran logo maksimal 2 MB.");
 const url=URL.createObjectURL(file);
 try {
  const image=new Image();image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight)throw new Error("Gambar tidak valid.");
  const scale=Math.min(1,512/image.naturalWidth,512/image.naturalHeight),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext("2d");if(!context)throw new Error("Logo belum dapat diproses.");context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",.88));
  if(!blob||blob.size>1024*1024)throw new Error("Logo terlalu besar. Pilih gambar lain.");return blob;
 } catch(error){throw new Error(error instanceof Error?error.message:"Gambar tidak dapat dibaca.");}
 finally {URL.revokeObjectURL(url);}
}

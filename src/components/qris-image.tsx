"use client";
import Image from "next/image";
import { useState } from "react";
export function QrisImage({src,alt}:{src:string;alt:string}) {
 const [failed,setFailed]=useState(false);
 return <div className="qris-image-frame">{failed?<p role="alert">Gambar QRIS belum dapat dimuat. Coba buka kembali atau unggah ulang di Profil bisnis.</p>:<Image unoptimized src={src} alt={alt} width={640} height={640} onError={()=>setFailed(true)}/>}</div>;
}

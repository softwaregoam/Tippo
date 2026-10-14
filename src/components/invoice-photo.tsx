"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";

type Point={x:number;y:number};
export function InvoicePhoto({src}:{src:string}) {
  const viewport=useRef<HTMLDivElement>(null);
  const [zoom,setZoom]=useState(1);
  const [bounds,setBounds]=useState({width:0,height:0});
  const [natural,setNatural]=useState({width:1,height:1});
  useLayoutEffect(()=>{
    const area=viewport.current;if(!area)return;
    const measure=()=>setBounds({width:area.clientWidth,height:area.clientHeight});
    measure();const observer=new ResizeObserver(measure);observer.observe(area);return()=>observer.disconnect();
  },[]);
  const fitWidth=Math.min(bounds.width,bounds.height*natural.width/natural.height);
  const scale=useRef(1),points=useRef(new Map<number,Point>());
  const anchor=useRef<Point|null>(null);
  function zoomTo(value:number,point?:Point){
    const area=viewport.current;if(!area)return;
    const next=Math.max(1,Math.min(5,value));
    const center=point??{x:area.clientWidth/2,y:area.clientHeight/2};
    const ratio=next/scale.current;
    const oldWidth=fitWidth*scale.current,newWidth=fitWidth*next;
    const oldHeight=oldWidth*natural.height/natural.width,newHeight=newWidth*natural.height/natural.width;
    const oldOffset={x:Math.max(0,(area.clientWidth-oldWidth)/2),y:Math.max(0,(area.clientHeight-oldHeight)/2)};
    const newOffset={x:Math.max(0,(area.clientWidth-newWidth)/2),y:Math.max(0,(area.clientHeight-newHeight)/2)};
    anchor.current=next===1?{x:0,y:0}:{x:(area.scrollLeft+center.x-oldOffset.x)*ratio+newOffset.x-center.x,y:(area.scrollTop+center.y-oldOffset.y)*ratio+newOffset.y-center.y};
    scale.current=next;setZoom(next);
  }
  useLayoutEffect(()=>{
    if(viewport.current&&anchor.current){viewport.current.scrollLeft=anchor.current.x;viewport.current.scrollTop=anchor.current.y;anchor.current=null;}
  },[zoom]);
  return <div className="invoice-photo">
    <div className="invoice-photo-tools">
      <button type="button" className="icon-button" aria-label="Perkecil invoice" disabled={zoom<=1} onClick={()=>zoomTo(zoom-1)}><ZoomOut size={18}/></button>
      <button type="button" className="icon-button" aria-label="Sesuaikan ukuran invoice" onClick={()=>zoomTo(1)}><Maximize2 size={18}/></button>
      <button type="button" className="icon-button" aria-label="Perbesar invoice" disabled={zoom>=5} onClick={()=>zoomTo(zoom+1)}><ZoomIn size={18}/></button>
    </div>
    <div ref={viewport} className="invoice-photo-viewport" tabIndex={0} role="region" aria-label="Gambar invoice, bisa diperbesar dan digeser"
      onKeyDown={event=>{if(["+","=","-","0"].includes(event.key)){event.preventDefault();zoomTo(event.key==="0"?1:scale.current+(event.key==="-"?-1:1));}}}
      onDoubleClick={()=>zoomTo(scale.current>1?1:3)}
      onPointerDown={event=>{if(event.pointerType==="mouse"&&event.button!==0)return;points.current.set(event.pointerId,{x:event.clientX,y:event.clientY});event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{
        const previous=points.current.get(event.pointerId),area=viewport.current;if(!previous||!area)return;
        const current={x:event.clientX,y:event.clientY};
        const other=Array.from(points.current.entries()).find(([id])=>id!==event.pointerId)?.[1];
        if(other){
          const before=Math.hypot(previous.x-other.x,previous.y-other.y),after=Math.hypot(current.x-other.x,current.y-other.y),rect=area.getBoundingClientRect();
          if(before>0)zoomTo(scale.current*after/before,{x:(current.x+other.x)/2-rect.left,y:(current.y+other.y)/2-rect.top});
        }else{area.scrollLeft-=current.x-previous.x;area.scrollTop-=current.y-previous.y;}
        points.current.set(event.pointerId,current);
      }}
      onPointerUp={event=>points.current.delete(event.pointerId)} onPointerCancel={event=>points.current.delete(event.pointerId)} onLostPointerCapture={event=>points.current.delete(event.pointerId)}>
      <div className="invoice-photo-canvas" style={{width:Math.max(bounds.width,fitWidth*zoom)}}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Invoice pesanan" draggable={false} onLoad={event=>setNatural({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} style={{width:fitWidth*zoom||"100%"}}/>
      </div>
    </div>
  </div>;
}

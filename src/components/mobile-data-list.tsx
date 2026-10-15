"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {ChevronRight,X} from "lucide-react";
export type MobileEntry={dialogClassName?:string;footer?:ReactNode;id:string;title:string;subtitle?:ReactNode;meta:ReactNode;status?:string;statusClassName?:string;details:ReactNode};
export function DataDetailDialog({entry,onClose}:{entry:MobileEntry;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const focus=document.activeElement instanceof HTMLElement?document.activeElement:null,overflow=document.body.style.overflow;
  document.body.style.overflow="hidden";ref.current?.showModal();
  function resize(){const viewport=window.visualViewport;ref.current?.style.setProperty("--detail-viewport-height",`${viewport?.height??window.innerHeight}px`);ref.current?.style.setProperty("--detail-viewport-top",`${viewport?.offsetTop??0}px`);}
  resize();window.addEventListener("resize",resize);window.visualViewport?.addEventListener("resize",resize);window.visualViewport?.addEventListener("scroll",resize);
  return()=>{window.removeEventListener("resize",resize);window.visualViewport?.removeEventListener("resize",resize);window.visualViewport?.removeEventListener("scroll",resize);document.body.style.overflow=overflow;if(focus?.isConnected)focus.focus({preventScroll:true});};
 },[]);
 function closeAction(event:React.MouseEvent){if((event.target as HTMLElement).closest('[data-close-detail]'))onClose();}
 return <dialog ref={ref} className={`native-dialog mobile-data-dialog ${entry.dialogClassName??""}`} aria-label={`Detail ${entry.title}`} onCancel={event=>{event.preventDefault();onClose();}}>
  <div className="modal-header"><h2>{entry.title}</h2><button className="icon-button" aria-label="Tutup detail" onClick={onClose}><X size={20}/></button></div>
  <div className="modal-body" onClick={closeAction}>{entry.details}</div>
  {entry.footer&&<div className="modal-footer" onClick={closeAction}>{entry.footer}</div>}
 </dialog>;
}
export function MobileDataList({entries}:{entries:MobileEntry[]}){const [selected,setSelected]=useState<string|null>(null);const entry=entries.find(e=>e.id===selected);return <div className="mobile-data-list">{entries.map(e=><button className="mobile-data-row" key={e.id} onClick={()=>setSelected(e.id)} aria-label={`Detail ${e.title}`}><span className="mobile-row-heading"><strong>{e.title}</strong>{e.status&&<small className={e.statusClassName}>{e.status}</small>}</span>{e.subtitle&&<span className="mobile-row-subtitle">{e.subtitle}</span>}<span className="mobile-row-meta">{e.meta}<ChevronRight size={16}/></span></button>)}{entry&&<DataDetailDialog entry={entry} onClose={()=>setSelected(null)}/>}</div>;}

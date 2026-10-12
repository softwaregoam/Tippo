import { type SandboxBilling } from "./doku-billing";

type Mode=SandboxBilling["environment"];
type DokuWindow=Window & {loadJokulCheckout?:(url:string)=>void;receive?:EventListener};
const scripts=new Map<Mode,Promise<void>>();

function loadScript(mode:Mode):Promise<void>{
  const existing=scripts.get(mode);if(existing)return existing;
  const promise=new Promise<void>((resolve,reject)=>{
    const script=document.createElement("script"),previousClick=window.onclick;
    script.src=(mode==="sandbox"?"https://sandbox.doku.com":"https://jokul.doku.com")+"/jokul-checkout-js/v1/jokul-checkout-1.0.0.js";
    script.async=true;
    const fail=()=>{clearTimeout(timer);script.onload=null;script.onerror=null;script.remove();scripts.delete(mode);reject(new Error("Popup DOKU belum dapat dimuat. Coba buka pembayaran lagi."));};
    const timer=setTimeout(fail,15000);
    script.onerror=fail;
    script.onload=()=>{
      clearTimeout(timer);
      const sdk=window as DokuWindow;
      // The official script uses a global click handler and an unscoped message
      // listener. Keep Tippo's handler and scope closing to this checkout frame.
      window.onclick=previousClick;
      if(sdk.receive)window.removeEventListener("message",sdk.receive);
      if(typeof sdk.loadJokulCheckout!=="function"){fail();return;}
      resolve();
    };
    document.head.appendChild(script);
  });
  scripts.set(mode,promise);return promise;
}

export async function prepareDokuCheckout(mode:Mode){await loadScript(mode);}

export function showDokuCheckout(url:string,mode:Mode,onClose:()=>void|Promise<void>,opener:HTMLElement|null=null):()=>void{
  const parsed=new URL(url),hosts=mode==="sandbox"?["sandbox.doku.com"]:["checkout.doku.com","jokul.doku.com"];
  if(parsed.protocol!=="https:" || !hosts.includes(parsed.hostname) || parsed.username || parsed.password || parsed.port && parsed.port!=="443")throw new Error("Link pembayaran DOKU tidak valid.");
  if(document.querySelector(".tippo-doku-dialog[open]"))throw new Error("Pembayaran DOKU masih terbuka.");
  const sdk=window as DokuWindow;
  if(!sdk.loadJokulCheckout)throw new Error("Popup DOKU belum dapat dimuat.");
  document.getElementById("jokul_checkout_modal")?.remove();
  sdk.loadJokulCheckout(url);
  const modal=document.getElementById("jokul_checkout_modal"),frame=modal?.querySelector("iframe");
  if(!modal || !frame){modal?.remove();throw new Error("Popup DOKU belum dapat dimuat.");}
  const dialog=document.createElement("dialog");dialog.className="tippo-doku-dialog";dialog.setAttribute("aria-label","Pembayaran DOKU");
  const header=document.createElement("div");header.className="tippo-doku-header";
  const title=document.createElement("strong");title.textContent="Pembayaran DOKU";
  const button=document.createElement("button");button.type="button";button.className="btn btn-secondary";button.textContent="Tutup";button.setAttribute("aria-label","Tutup pembayaran DOKU");
  header.append(title,button);modal.prepend(header);frame.title="Halaman pembayaran DOKU";
  dialog.append(modal);document.body.append(dialog);
  let closed=false;
  const close=(notify=true)=>{
    if(closed)return;closed=true;
    window.removeEventListener("message",message);observer.disconnect();
    dialog.close();dialog.remove();if(opener?.isConnected)opener.focus();
    if(notify){
      const restoreFocus=()=>requestAnimationFrame(()=>{
        if(opener?.isConnected && (document.activeElement===document.body || document.activeElement===opener) && !document.querySelector("dialog[open]"))opener.focus();
      });
      void Promise.resolve(onClose()).then(restoreFocus,restoreFocus);
    }
  };
  const message=(event:MessageEvent)=>{
    if(event.source===frame.contentWindow && hosts.some(host=>event.origin==="https://"+host) && event.data?.func==="closeJokul")close();
  };
  const observer=new MutationObserver(()=>{if(modal.style.display==="none")close();});
  observer.observe(modal,{attributes:true,attributeFilter:["style"]});
  window.addEventListener("message",message);
  button.onclick=()=>close();dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=()=>close();
  try{dialog.showModal();button.focus();}catch(error){close(false);throw error;}
  return ()=>close(false);
}

export interface SnapBilling {
 environment:"snap-production-test";proUntil:null;
 invoice:null|{id:string;number:string;amount:10;currency:"IDR";bank:"BNI";
 status:"creating"|"pending"|"paid"|"expired"|"error";
 vaNumber:string|null;vaName:string;instructionsUrl:string|null;createdAt:string;expiresAt:string;paidAt:string|null;};
}
export function parseSnapBilling(value:unknown):SnapBilling{
 const state=value as SnapBilling;
 if(!state || state.environment!=="snap-production-test" || state.proUntil!==null)throw new Error("Invalid SNAP response");
 const i=state.invoice;
 if(i!==null){
  if(!i || typeof i.id!=="string" || !/^TSNP-[A-F0-9]{32}$/.test(i.number) || i.amount!==10 || i.currency!=="IDR" || i.bank!=="BNI" || !["creating","pending","paid","expired","error"].includes(i.status) || typeof i.vaName!=="string" || !i.vaName || !Number.isFinite(Date.parse(i.createdAt)) || !Number.isFinite(Date.parse(i.expiresAt)) || (i.paidAt!==null && !Number.isFinite(Date.parse(i.paidAt))) || (i.vaNumber!==null && !/^\d{1,28}$/.test(i.vaNumber)) || (i.status==="pending" && !i.vaNumber))throw new Error("Invalid SNAP invoice");
  if(i.instructionsUrl!==null){
   const url=new URL(i.instructionsUrl);
   if(url.protocol!=="https:" || url.hostname!=="app.doku.com" || !url.pathname.startsWith("/how-to-pay/virtual-account/bni/") || url.username || url.password || (url.port && url.port!=="443"))throw new Error("Invalid SNAP instructions");
  }
 }
 return state;
}

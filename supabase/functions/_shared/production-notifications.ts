/** One DOKU Notify URL routes real Pro and test invoices to separate ledgers. */
export function productionNotifications(pro:(req:Request)=>Promise<Response>,test:((req:Request)=>Promise<Response>)|null){
 return async(req:Request)=>{
  if(new URL(req.url).pathname.split("/").at(-1)!=="webhook" || req.method!=="POST" || !test)return pro(req);
  const reader=req.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
  if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536){await reader.cancel();return new Response(JSON.stringify({error:"BODY_TOO_LARGE"}),{status:413,headers:{"Content-Type":"application/json"}});}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let invoice:unknown;try{invoice=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))?.order?.invoice_number;}catch{}
  // Only choose a handler here. That handler still verifies the signature,
  // merchant, amount, original request and ledger before accepting payment.
  const handler=typeof invoice==="string" && /^(TPT-[A-F0-9]{32}|TPT[A-F0-9]{24})$/.test(invoice)?test:pro;
  return handler(new Request(req.url,{method:req.method,headers:req.headers,body:bytes}));
 };
}

import { createClient } from "@supabase/supabase-js";
import { billingHandler } from "../_shared/billing-handler.ts";

// This module runs in Supabase Edge Runtime, never in the Next.js browser bundle.
const runtime = (globalThis as unknown as { Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void } }).Deno;
const required=(name:string)=>{const value=runtime.env.get(name);if(!value)throw new Error("BILLING_CONFIG_MISSING");return value;};
let handler: (request: Request) => Promise<Response>;
try {
  const url=required("SUPABASE_URL");
  const service=createClient(url,required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=createClient(url,required("SUPABASE_ANON_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
  handler=billingHandler({environment:required("DOKU_ENV"),clientId:required("DOKU_CLIENT_ID"),secretKey:required("DOKU_SECRET_KEY"),siteUrl:required("TIPPO_SITE_URL"),notificationUrl:`${url}/functions/v1/tippo-doku-sandbox/webhook`},{
    authenticate:async token=>{const {data,error}=await auth.auth.getUser(token);return error?null:data.user?.id??null;},
    rpc:async(name,parameters)=>{const {data,error}=await service.rpc(name,parameters);if(error)throw new Error("BILLING_DATABASE_ERROR");return data;},
  });
} catch {
  let origin="";try{origin=new URL(runtime.env.get("TIPPO_SITE_URL")??"").origin;}catch{}
  handler=async request=>new Response(JSON.stringify({error:"SANDBOX_NOT_CONFIGURED"}),{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...(origin?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{}),...(request.method==="OPTIONS"?{"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}:{})}});
}
runtime.serve(handler);

import {createClient} from "@supabase/supabase-js";
import {snapHandler} from "../_shared/snap-handler.ts";
const runtime=(globalThis as unknown as {Deno:{env:{get(name:string):string|undefined};serve(handler:(req:Request)=>Promise<Response>):void}}).Deno;
const required=(name:string)=>{const value=runtime.env.get(name);if(!value)throw new Error("CONFIG_REQUIRED");return value;};
let handler:(req:Request)=>Promise<Response>;
try{
 if(required("DOKU_SNAP_TEST_ENABLED")!=="true")throw new Error("TEST_DISABLED");
 const url=required("SUPABASE_URL");
 const service=createClient(url,required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=createClient(url,required("SUPABASE_ANON_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
 handler=snapHandler({clientId:required("DOKU_PRODUCTION_CLIENT_ID"),secretKey:required("DOKU_PRODUCTION_SECRET_KEY"),privateKey:required("DOKU_SNAP_PRIVATE_KEY"),
  siteUrl:required("TIPPO_SITE_URL"),allowedUsers:required("DOKU_PRODUCTION_TEST_USER_IDS").split(",").map(id=>id.trim()),
  partnerServiceId:required("DOKU_SNAP_BNI_PARTNER_SERVICE_ID"),customerPrefix:required("DOKU_SNAP_BNI_CUSTOMER_PREFIX"),
  notificationUrl:url+"/functions/v1/tippo-doku-snap-test/webhook"},{
  authenticate:async token=>{const {data,error}=await auth.auth.getUser(token);return error?null:data.user?.id??null;},
  rpc:async(name,args)=>{const {data,error}=await service.rpc(name,args);if(error)throw new Error("DATABASE_UNAVAILABLE");return data;},
 });
}catch{
 let origin="";try{origin=new URL(runtime.env.get("TIPPO_SITE_URL")??"").origin;}catch{}
 handler=async()=>Response.json({error:"SNAP_NOT_CONFIGURED"},{status:503,headers:{"Cache-Control":"no-store",...(origin?{"Access-Control-Allow-Origin":origin}:{}),"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
}
runtime.serve(handler);

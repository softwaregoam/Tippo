import {createClient} from "@supabase/supabase-js";
import {productionBillingHandler,productionTestHandler} from "../_shared/billing-handler.ts";
import {productionNotifications} from "../_shared/production-notifications.ts";
const runtime=(globalThis as unknown as {Deno:{env:{get(name:string):string|undefined};serve(handler:(req:Request)=>Promise<Response>):void}}).Deno;
const required=(name:string)=>{const value=runtime.env.get(name);if(!value)throw new Error("CONFIG_REQUIRED");return value;};
let handler:(req:Request)=>Promise<Response>;
try{
 if(required("DOKU_PRO_ENABLED")!=="true")throw new Error("PRO_DISABLED");
 const url=required("SUPABASE_URL");
 const service=createClient(url,required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=createClient(url,required("SUPABASE_ANON_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
 const config={environment:"production",clientId:required("DOKU_PRODUCTION_CLIENT_ID"),secretKey:required("DOKU_PRODUCTION_SECRET_KEY"),siteUrl:required("TIPPO_SITE_URL"),notificationUrl:`${url}/functions/v1/tippo-doku-pro/webhook`};
 const ports={
  authenticate:async(token:string)=>{const {data,error}=await auth.auth.getUser(token);return error?null:data.user?.id??null;},
  rpc:async(name:string,args:Record<string,unknown>)=>{const {data,error}=await service.rpc(name,args);if(error)throw new Error("DATABASE_UNAVAILABLE");return data;},
 };
 const test=runtime.env.get("DOKU_PRODUCTION_TEST_ENABLED")==="true"?productionTestHandler({...config,allowedUsers:required("DOKU_PRODUCTION_TEST_USER_IDS").split(",").map(v=>v.trim())},ports):null;
 const checkoutNotificationUrl=runtime.env.get("TIPPO_DOKU_ROUTER_URL");
 handler=productionNotifications(productionBillingHandler({...config,...(checkoutNotificationUrl?{checkoutNotificationUrl}:{})},ports),test);
}catch{
 let origin="";try{origin=new URL(runtime.env.get("TIPPO_SITE_URL")??"").origin;}catch{}
 handler=async()=>new Response(JSON.stringify({error:"PRO_BILLING_NOT_CONFIGURED"}),{status:503,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...(origin?{"Access-Control-Allow-Origin":origin}:{}),"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
}
runtime.serve(handler);

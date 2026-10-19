import test from "node:test";
import assert from "node:assert/strict";
import { validateDevelopmentEnvironment, isDevelopmentDeployment } from "../scripts/development-environment.mjs";
const ref="abcdefghijklmnopqrst";
const config={TIPPO_APP_ENV:"development",TIPPO_DEV_SUPABASE_PROJECT_REF:ref,NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",NEXT_PUBLIC_DOKU_PRO_ENABLED:"false"};
test("development requires a separate matching project and rejects production settings",()=>{
 assert.doesNotThrow(()=>validateDevelopmentEnvironment(config));
 for(const bad of [{TIPPO_DEV_SUPABASE_PROJECT_REF:undefined},{TIPPO_DEV_SUPABASE_PROJECT_REF:"bkplemoflteubfgvqhke"},{NEXT_PUBLIC_SUPABASE_URL:"https://bkplemoflteubfgvqhke.supabase.co"},{NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co/`},{NEXT_PUBLIC_DOKU_PRO_ENABLED:"true"},{NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED:"true"},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_secret_test"}])assert.throws(()=>validateDevelopmentEnvironment({...config,...bad}));
 assert.throws(()=>validateDevelopmentEnvironment({NODE_ENV:"development",NEXT_PUBLIC_SUPABASE_URL:"https://bkplemoflteubfgvqhke.supabase.co"}));
});
test("Vercel Preview enforces dev isolation and production stays on main",()=>{
 assert.equal(isDevelopmentDeployment({VERCEL_ENV:"preview"}),true);
 assert.equal(isDevelopmentDeployment({}),true);
 assert.throws(()=>validateDevelopmentEnvironment({}));
 assert.doesNotThrow(()=>validateDevelopmentEnvironment({...config,TIPPO_APP_ENV:undefined,VERCEL_ENV:"preview"}));
 assert.throws(()=>validateDevelopmentEnvironment({...config,TIPPO_APP_ENV:"production",VERCEL_ENV:"preview"}));
 assert.throws(()=>validateDevelopmentEnvironment({...config,VERCEL_ENV:"production"}));
 assert.throws(()=>validateDevelopmentEnvironment({VERCEL_ENV:"production",VERCEL_GIT_COMMIT_REF:"dev"}));
 assert.doesNotThrow(()=>validateDevelopmentEnvironment({TIPPO_APP_ENV:"production",VERCEL_ENV:"production",VERCEL_GIT_COMMIT_REF:"main"}));
});
test("legacy browser keys must match dev and cannot use service role",()=>{
 const key=(role:string,project=ref)=>["test",Buffer.from(JSON.stringify({role,ref:project})).toString("base64url"),"test"].join(".");
 assert.doesNotThrow(()=>validateDevelopmentEnvironment({...config,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key("anon")}));
 for(const value of [key("service_role"),key("anon","bkplemoflteubfgvqhke"),"not-a-key"])assert.throws(()=>validateDevelopmentEnvironment({...config,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:value}));
});

test("local development is restricted to loopback Supabase and an anonymous browser key",()=>{
 const key=["test",Buffer.from(JSON.stringify({role:"anon",iss:"supabase-demo"})).toString("base64url"),"test"].join(".");
 const local={...config,TIPPO_DEV_SUPABASE_PROJECT_REF:"local",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key};
 assert.doesNotThrow(()=>validateDevelopmentEnvironment(local));
 assert.throws(()=>validateDevelopmentEnvironment({...local,VERCEL_ENV:"preview"}));
 for(const url of ["https://bkplemoflteubfgvqhke.supabase.co","http://example.com:54321","http://127.0.0.1:54321.evil.test"])assert.throws(()=>validateDevelopmentEnvironment({...local,NEXT_PUBLIC_SUPABASE_URL:url}));
});

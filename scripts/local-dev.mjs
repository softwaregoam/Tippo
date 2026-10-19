import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const task=process.argv[2]??"start";
if(!["start","configure","stop","migrate","status"].includes(task))throw new Error("Use: node scripts/local-dev.mjs start|configure|stop|migrate|status");
const executable=process.env.SUPABASE_CLI_PATH??(process.platform==="win32"?"npx.cmd":"npx");
const prefix=process.env.SUPABASE_CLI_PATH?[]:["--yes","supabase@2.54.11"];
const logs=resolve(root,".local-dev");mkdirSync(logs,{recursive:true,mode:0o700});
function cli(args){return new Promise((accept,reject)=>{
 const child=spawn(executable,[...prefix,...args],{cwd:root,env:process.env,shell:process.platform==="win32"&&!process.env.SUPABASE_CLI_PATH});
 let stdout="",stderr="";child.stdout.on("data",data=>{stdout+=data;});child.stderr.on("data",data=>{stderr+=data;});
 child.on("error",()=>reject(new Error("Supabase CLI cannot start. Install Node.js and Docker Desktop, or set SUPABASE_CLI_PATH to an installed CLI.")));
 child.on("close",code=>{writeFileSync(resolve(logs,`${args[0]}.log`),stdout+stderr,{mode:0o600});if(code!==0)reject(new Error(`Supabase ${args[0]} failed. Check .local-dev/${args[0]}.log locally; it can contain local credentials, so do not share it unredacted.`));else accept(stdout);});
});}
if(task==="stop"){
 await cli(["stop"]);console.log("Supabase lokal dihentikan; data uji dipertahankan.");
}else{
 if(task==="start"){console.log("Menyiapkan Supabase lokal (unduhan pertama dapat memerlukan beberapa menit)…");await cli(["start","--exclude","imgproxy,logflare,vector,supavisor,edge-runtime"]);}
 if(task==="migrate"){await cli(["db","push","--local"]);console.log("Migrasi diterapkan hanya ke database lokal.");}
 const state=JSON.parse(await cli(["status","--output","json"]));
 if(!["http://127.0.0.1:54321","http://localhost:54321"].includes(state.API_URL)||!state.ANON_KEY)throw new Error("Local Supabase status is incomplete or does not use the expected loopback endpoint.");
 if(task==="start"||task==="configure"){
  const path=resolve(root,".env.local"),previous=existsSync(path)?readFileSync(path,"utf8"):"";
  if(previous&&!previous.includes("TIPPO_DEV_SUPABASE_PROJECT_REF=local")){
   const backup=resolve(root,".env.local.before-dev");if(!existsSync(backup))copyFileSync(path,backup,constants.COPYFILE_EXCL);
  }
  const values={TIPPO_APP_ENV:"development",TIPPO_DEV_SUPABASE_PROJECT_REF:"local",NEXT_PUBLIC_SUPABASE_URL:state.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:state.ANON_KEY,NEXT_PUBLIC_DOKU_SANDBOX_ENABLED:"false",NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED:"false",NEXT_PUBLIC_DOKU_PRO_ENABLED:"false"};
  let text=previous;
  for(const [key,value] of Object.entries(values)){
   const pattern=new RegExp(`^(?:export\\s+)?${key}=.*$`,"gm");text=pattern.test(text)?text.replace(pattern,`${key}=${value}`):`${text.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync(path,text.trimStart(),{mode:0o600});console.log(".env.local menggunakan Supabase lokal. Kunci admin tidak disalin.");
 }
 console.log("Supabase lokal siap. Jalankan npm run dev untuk membuka Tippo Dev di komputer ini.");
}

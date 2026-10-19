import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("fresh local database applies every migration in order and preserves workspace access controls",async()=>{
 const db=new PGlite();
 try {
  // Model the Supabase-owned schemas; application tables/functions below are real migrations.
  await db.exec(`create role anon; create role authenticated; create role service_role;
   create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
   create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
   alter table storage.objects enable row level security;
   create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
   create publication supabase_realtime;`);
  const folder=new URL("../supabase/migrations/",import.meta.url),files=(await readdir(folder)).filter(file=>file.endsWith(".sql")).sort();
  assert.ok(files.length>=23);
  for(const file of files)await db.exec(await readFile(new URL(file,folder),"utf8"));
  const id="00000000-0000-0000-0000-000000000001";
  await db.exec(`insert into auth.users(id,email) values('${id}','local@example.test'); set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
  const own=(await db.query<{value:{version:number;data:{orders:unknown[]}}}>("select public.get_tippo_workspace() value")).rows[0].value;
  assert.equal(own.version,0);assert.deepEqual(own.data.orders,[]);
  const data={batches:[{id:"trip",type:"jastip",name:"Uji lokal",origin:"",closeDate:"2026-12-01",status:"open",directCosts:0,purchaseFx:{currency:"SAR",rate:"1.123456",source:"manual"}}],customers:[{id:"aly",name:"Alya",phone:""}],products:[],orders:[{id:"order",batchId:"trip",customerId:"aly",items:[{id:"item",product:"Roti",variant:"",color:"",size:"",quantity:2,unitPrice:20000,unitCost:112,purchaseFx:{currency:"SAR",amount:"100",rate:"1.123456",source:"manual",status:"estimate"}}],serviceFee:0,shippingCharge:0,paid:0,status:"new",date:"2026-10-19",createdAt:"2026-10-19T00:00:00Z",notes:""}]};
  const saved=(await db.query<{value:{version:number;data:typeof data}}>("select public.save_tippo_workspace($1::jsonb,0) value",[JSON.stringify(data)])).rows[0].value;
  assert.equal(saved.version,1);assert.equal(saved.data.orders[0].items[0].purchaseFx.currency,"SAR");
  await assert.rejects(db.exec("update public.tippo_workspaces set pro_until=now()+interval '1 month'"),/permission denied/);
  await db.exec("reset role; set role anon");await assert.rejects(db.exec("select public.get_tippo_workspace()"),/permission denied/);
 } finally {await db.close();}
});

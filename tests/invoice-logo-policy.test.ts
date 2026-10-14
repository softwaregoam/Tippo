import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
test("invoice logo policies restrict file management to each account folder",async()=>{
 const db=new PGlite();try{
  await db.exec(`create role authenticated; create schema auth; create schema storage;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id serial primary key,bucket_id text,name text);
   alter table storage.objects enable row level security;
   grant usage on schema storage,auth to authenticated;grant select,insert,delete on storage.objects to authenticated;grant usage on sequence storage.objects_id_seq to authenticated;`);
  await db.exec(await readFile(new URL("../supabase/migrations/202610140013_invoice_logos.sql",import.meta.url),"utf8"));
  const a="00000000-0000-0000-0000-000000000001",b="00000000-0000-0000-0000-000000000002";
  await db.exec(`insert into storage.objects(bucket_id,name) values('invoice-logos','${b}/other.webp');set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`);
  await db.exec(`insert into storage.objects(bucket_id,name) values('invoice-logos','${a}/own.webp')`);
  await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values('invoice-logos','${b}/forbidden.webp')`),/row-level security/);
  await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values('other-bucket','${a}/forbidden.webp')`),/row-level security/);
  assert.equal((await db.query("select * from storage.objects")).rows.length,1);
  await db.exec(`delete from storage.objects where name='${b}/other.webp';reset role`);
  assert.equal((await db.query("select * from storage.objects")).rows.length,2);
  const bucket=(await db.query<{public:boolean;file_size_limit:number}>("select * from storage.buckets")).rows[0];assert.equal(bucket.public,true);assert.equal(Number(bucket.file_size_limit),1048576);
 }finally{await db.close();}
});

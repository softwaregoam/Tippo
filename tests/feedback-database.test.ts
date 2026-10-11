import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { validateFeedback } from "../src/lib/feedback.ts";
const db = new PGlite();
const a = "00000000-0000-0000-0000-000000000001", b = "00000000-0000-0000-0000-000000000002", id = "11111111-1111-4111-8111-111111111111";
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${a}'),('${b}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  const sql = await readFile(new URL("../supabase/migrations/202610110001_tippo_feedback.sql", import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql);
});
after(async () => db.close());
async function login(owner: string) { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`); }
async function send(subject = " Filter pesanan ", message = " Tambahkan filter pelanggan pada daftar pesanan. ") {
  return (await db.query<{ value: { id: string; createdAt: string } }>("select public.submit_tippo_feedback($1::uuid,'suggestion','po',$2,$3) as value", [id, subject, message])).rows[0].value;
}
test("feedback belongs to caller, retries are idempotent, and users cannot mutate or read other feedback", async () => {
  await login(a); const first = await send(); const repeat = await send(); assert.deepEqual(repeat, first);
  const rows = await db.query<{ owner_id: string; subject: string }>("select owner_id,subject from public.tippo_feedback");
  assert.equal(rows.rows.length, 1); assert.equal(rows.rows[0].owner_id, a); assert.equal(rows.rows[0].subject, "Filter pesanan");
  await assert.rejects(send("Judul diubah"), /TIPPO_FEEDBACK_CONFLICT/);
  await assert.rejects(send("a"), /TIPPO_FEEDBACK_INVALID/);
  await assert.rejects(send("Filter pesanan", "    "), /TIPPO_FEEDBACK_INVALID/);
  await assert.rejects(db.exec("update public.tippo_feedback set message='Changed'"), /permission denied/);
  await assert.rejects(db.exec("delete from public.tippo_feedback"), /permission denied/);
  await login(b); assert.equal((await db.query("select * from public.tippo_feedback")).rows.length, 0);
  await assert.rejects(send(), /TIPPO_FEEDBACK_CONFLICT/);
  await db.exec("reset role; set role anon;"); await assert.rejects(send(), /permission denied/);
});
test("feedback input trims content and rejects empty or oversized messages", () => {
  assert.equal(validateFeedback({ category: "suggestion", area: "general", subject: " Ide baru ", message: " Tambahkan fitur pencarian. " }).subject, "Ide baru");
  for (const message of ["          ", "x".repeat(2001)]) assert.throws(() => validateFeedback({ category: "issue", area: "po", subject: "Kendala", message }));
});
test("public feedback requires consent and moderation and exposes only masked email", async () => {
  await db.exec("reset role; alter table auth.users add column email text; update auth.users set email='naya@example.com';");
  const migration = await readFile(new URL("../supabase/migrations/202610110002_public_feedback.sql", import.meta.url), "utf8");
  await db.exec(migration); await db.exec(migration);
  await login(a);
  const publicId = "22222222-2222-4222-8222-222222222222";
  await db.query("select public.submit_public_tippo_feedback($1::uuid,'criticism','jastip','Form pesanan','Form pesanan perlu lebih ringkas.')", [publicId]);
  await db.exec("reset role; set role anon;");
  assert.equal((await db.query("select * from public.list_public_tippo_feedback()" )).rows.length, 0);
  await assert.rejects(db.exec("select * from public.tippo_feedback"), /permission denied/);
  await assert.rejects(db.query("select public.submit_public_tippo_feedback($1::uuid,'criticism','jastip','Form pesanan','Form pesanan perlu lebih ringkas.')", [publicId]), /permission denied/);
  await db.exec("reset role; update public.tippo_feedback set published=true;");
  await login(a);
  await assert.rejects(db.exec("update public.tippo_feedback set published=true"), /permission denied/);
  await db.exec("reset role; set role anon;");
  const rows = (await db.query<{ email: string; id: string }>("select * from public.list_public_tippo_feedback()")).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].id, publicId); assert.equal(rows[0].email, "n***@example.com");
  assert.equal("owner_id" in rows[0], false);
});

import { DatabaseSync, backup } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";

export function openStore(path, { now = () => Date.now(), maxAttempts = 20 } = {}) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA max_page_count=65536;
    CREATE TABLE IF NOT EXISTS notifications (
      request_id TEXT PRIMARY KEY, digest TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE,
      app_id TEXT NOT NULL, event TEXT NOT NULL, received_at INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','delivered','dead')),
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL,
      lease_token TEXT, lease_until INTEGER, delivered_at INTEGER, last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS queue_due ON notifications(state,next_attempt,lease_until);`);
  const transaction = action => { db.exec("BEGIN IMMEDIATE"); try { const result = action(); db.exec("COMMIT"); return result; } catch (error) { db.exec("ROLLBACK"); throw error; } };
  return {
    accept(requestId, digest, event) {
      return transaction(() => {
        const previous = db.prepare("SELECT digest,event_id FROM notifications WHERE request_id=?").get(requestId);
        if (previous) { if (previous.digest !== digest) throw new Error("REPLAY_MISMATCH"); return previous.event_id; }
        const count = db.prepare("SELECT count(*) AS n FROM notifications WHERE state <> 'delivered'").get().n;
        if (count >= 10000) throw new Error("QUEUE_CAPACITY");
        const time = now();
        db.prepare("INSERT INTO notifications(request_id,digest,event_id,app_id,event,received_at,next_attempt) VALUES(?,?,?,?,?,?,?)").run(requestId, digest, event.id, event.appId, JSON.stringify(event), time, time);
        return event.id;
      });
    },
    claim() {
      return transaction(() => {
        const time = now();
        db.prepare("UPDATE notifications SET state='dead',lease_token=NULL,lease_until=NULL,last_error='ATTEMPTS_EXHAUSTED' WHERE state='processing' AND lease_until<=? AND attempts>=?").run(time, maxAttempts);
        const row = db.prepare("SELECT * FROM notifications WHERE attempts<? AND ((state='queued' AND next_attempt<=?) OR (state='processing' AND lease_until<=?)) ORDER BY next_attempt,received_at LIMIT 1").get(maxAttempts, time, time);
        if (!row) return null;
        const token = randomUUID();
        db.prepare("UPDATE notifications SET state='processing',attempts=attempts+1,lease_token=?,lease_until=? WHERE request_id=?").run(token, time + 60000, row.request_id);
        return { requestId: row.request_id, event: JSON.parse(row.event), token, attempts: row.attempts + 1 };
      });
    },
    finish(job, delivered, error = "DELIVERY_FAILED") {
      const delay = Math.min(3600000, 15000 * 2 ** Math.min(job.attempts - 1, 8));
      return db.prepare("UPDATE notifications SET state=?,next_attempt=?,delivered_at=?,last_error=?,lease_token=NULL,lease_until=NULL WHERE request_id=? AND state='processing' AND lease_token=?")
        .run(delivered ? "delivered" : job.attempts >= maxAttempts ? "dead" : "queued", now() + delay, delivered ? now() : null, delivered ? null : error.slice(0,80), job.requestId, job.token).changes === 1;
    },
    stats() { return db.prepare("SELECT state,count(*) AS count FROM notifications GROUP BY state").all(); },
    dead() { return db.prepare("SELECT event_id,attempts,last_error,received_at FROM notifications WHERE state='dead' ORDER BY received_at LIMIT 50").all(); },
    retry(eventId) { return db.prepare("UPDATE notifications SET state='queued',attempts=0,next_attempt=?,last_error=NULL WHERE event_id=? AND state='dead'").run(now(), eventId).changes; },
    cleanup() { return db.prepare("DELETE FROM notifications WHERE state='delivered' AND delivered_at<?").run(now() - 90 * 86400000).changes; },
    async backup(directory) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const stamp = new Date(now()).toISOString().replace(/[:.]/g,"-"), base = join(directory, `router-${stamp}.sqlite`);
      try {
        await backup(db, base);
        await pipeline(createReadStream(base), createGzip(), createWriteStream(base + ".gz.tmp", { mode: 0o600 }));
        await rename(base + ".gz.tmp", base + ".gz");
        const files = (await readdir(directory)).filter(name => /^router-.*\.sqlite\.gz$/.test(name)).sort().reverse();
        for (const file of files.slice(7)) await rm(join(directory,file));
        return base + ".gz";
      } finally { await rm(base, { force:true }); await rm(base + ".gz.tmp", { force:true }); }
    },
    close() { db.close(); },
  };
}
export async function prepareStore(path) { await mkdir(dirname(path), { recursive:true, mode:0o700 }); }

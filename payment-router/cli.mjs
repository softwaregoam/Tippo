import { stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { openStore } from "./store.mjs";

process.umask(0o077);
const path = process.env.ROUTER_DB_PATH || "/data/router.sqlite";
await stat(path); // Do not accidentally create a new empty queue when the path is wrong.
const store = openStore(path);
try {
  const [action,id] = process.argv.slice(2);
  if (action === "stats") console.log(JSON.stringify({ counts:store.stats(),dead:store.dead() }));
  else if (action === "retry" && /^[a-f0-9-]{36}$/i.test(id || "")) console.log(JSON.stringify({ retried:store.retry(id) }));
  else if (action === "backup") { await store.backup(join(dirname(path),"backups")); console.log('{"backup":"created"}'); }
  else throw new Error("Usage: cli.mjs stats | retry EVENT_UUID | backup");
} finally { store.close(); }

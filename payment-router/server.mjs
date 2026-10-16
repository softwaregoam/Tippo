import { createServer } from "node:http";
import { Readable } from "node:stream";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRouterConfig } from "./config.mjs";
import { openStore, prepareStore } from "./store.mjs";
import { routerHandler } from "./handler.mjs";
import { deliveryWorker } from "./worker.mjs";

export async function startRouter(config) {
  process.umask(0o077);
  await prepareStore(config.dbPath);
  const store = openStore(config.dbPath), handle = routerHandler(config,store), worker = deliveryWorker(config,store);
  let active = 0, stopping = false, maintenance = null;
  const log = event => console.log(JSON.stringify({ event }));
  const server = createServer({ requestTimeout:15000, headersTimeout:10000, keepAliveTimeout:5000, connectionsCheckingInterval:1000 }, async (input, output) => {
    if (active >= 8 || stopping) { output.writeHead(503,{"Content-Type":"application/json","Retry-After":"5"}); output.end('{"error":"BUSY"}'); return; }
    active++;
    try {
      const request = new Request(new URL(input.url,config.publicUrl), {
        method:input.method,headers:input.headers,
        ...(["GET","HEAD"].includes(input.method) ? {} : { body:Readable.toWeb(input),duplex:"half" }),
      });
      const response = await handle(request);
      output.writeHead(response.status,{ ...Object.fromEntries(response.headers),"X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY" });
      output.end(Buffer.from(await response.arrayBuffer()));
    } catch { if (!output.headersSent) output.writeHead(503,{"Content-Type":"application/json"}); output.end('{"error":"UNAVAILABLE"}'); }
    finally { active--; }
  });
  server.maxHeadersCount = 40;
  await new Promise((resolve,reject) => { server.once("error",reject); server.listen(config.port,"0.0.0.0",resolve); });
  const queueTimer = setInterval(() => { void worker.tick()?.catch(() => log("queue_unavailable")); },2000);
  async function maintain() {
    if (maintenance || stopping) return;
    maintenance = (async () => { await store.backup(join(dirname(config.dbPath),"backups")); store.cleanup(); log("backup_succeeded"); })()
      .catch(() => log("backup_failed")).finally(() => { maintenance = null; });
    await maintenance;
  }
  const initialBackup = setTimeout(() => void maintain(),10000), backupTimer = setInterval(() => void maintain(),86400000);
  log("router_started");
  return {
    server,
    async close() {
      if (stopping) return; stopping = true;
      clearInterval(queueTimer); clearInterval(backupTimer); clearTimeout(initialBackup);
      await Promise.all([new Promise(resolve => server.close(resolve)),worker.stop(),maintenance]);
      store.close();
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const router = await startRouter(loadRouterConfig());
    for (const signal of ["SIGTERM","SIGINT"]) process.once(signal,() => { void router.close().then(() => process.exit(0)); });
  } catch { console.error(JSON.stringify({ event:"startup_failed",code:"CHECK_CONFIGURATION_AND_VOLUME" })); process.exitCode = 1; }
}

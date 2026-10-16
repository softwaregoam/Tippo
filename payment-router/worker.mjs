import { gatewayHeaders, readGatewayBody } from "../supabase/functions/_shared/gateway-protocol.ts";

export function deliveryWorker(config, store, { send = fetch, log = console.log } = {}) {
  let running = null;
  const abort = new AbortController();
  async function deliver() {
    const job = store.claim(); if (!job) return false;
    const route = config.routes.find(route => route.appId === job.event.appId);
    if (!route) { store.finish(job,false,"ROUTE_NOT_CONFIGURED"); return true; }
    try {
      const raw = JSON.stringify(job.event);
      const response = await send(route.callbackUrl, { method:"POST", body:raw,
        headers:await gatewayHeaders(route.eventKey,route.appId,route.callbackUrl,raw,job.event.id),
        signal:AbortSignal.any([abort.signal,AbortSignal.timeout(10000)]),redirect:"error",
      });
      let receipt; try { receipt = JSON.parse(await readGatewayBody(response,8192)); } catch { throw new Error("INVALID_RECEIPT"); }
      if (!response.ok || receipt?.received !== true || receipt?.eventId !== job.event.id) throw new Error(`HTTP_${response.status}_UNCONFIRMED`);
      store.finish(job,true);
      log(JSON.stringify({ event:"delivery_succeeded", id:job.event.id, attempt:job.attempts }));
    } catch {
      store.finish(job,false,"DESTINATION_UNAVAILABLE");
      log(JSON.stringify({ event:"delivery_failed", id:job.event.id, attempt:job.attempts }));
    }
    return true;
  }
  return {
    tick() { if (!running && !abort.signal.aborted) running = deliver().finally(() => { running = null; }); return running; },
    async stop() { abort.abort(); await running?.catch(() => {}); },
  };
}

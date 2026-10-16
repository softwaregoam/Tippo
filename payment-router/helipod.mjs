/** Initial installation helper. Default is a price-only dry run; no credentials are printed. */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { loadRouterConfig } from "./config.mjs";

/** @param {{env?:Record<string,string|undefined>,send?:typeof fetch,apply?:boolean,stateFile?:string|URL,log?:(message:string)=>void}} [options] */
export async function installHelipod({ env = process.env, send = fetch, apply = false, stateFile = new URL(".helipod-state.json",import.meta.url), log = console.log } = {}) {
  const required = name => { const value = env[name]; if (!value) throw new Error(`${name}_REQUIRED`); return value; };
  const token = required("HELIPOD_API_KEY"), environment = required("HELIPOD_ENVIRONMENT_ID"), image = required("ROUTER_IMAGE");
  if (!/^[a-f0-9-]{36}$/i.test(environment) || !/^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/.test(image)) throw new Error("USE_ENVIRONMENT_UUID_AND_IMMUTABLE_IMAGE_DIGEST");
  async function api(path, method = "GET", input, id) {
    const response = await send(`https://api.helipod.io/api/containers/${path}`,{method,
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(id?{"Idempotency-Key":id}:{})},
      ...(input?{body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(30000),redirect:"error"});
    if (!response.ok) throw new Error(`HELIPOD_HTTP_${response.status}`);
    const result = await response.json(); if (result.success === false) throw new Error("HELIPOD_REQUEST_FAILED"); return result.data ?? result;
  }
  const source = {image,...(env.GHCR_READ_TOKEN?{registryUsername:required("GHCR_USERNAME"),registryPassword:env.GHCR_READ_TOKEN}:{})};
  const manifest = {name:"tippo-payment-router",source,ports:[{port:8080}],volumes:[{name:"router-data",mountPath:"/data",sizeGb:1}],cpu:250,ram:256,healthcheck:{path:"/healthz",timeout:120},deploy:false};
  const price = await api(`environments/${environment}/services?dryRun=true`,"POST",manifest);
  if (price.dryRun !== true || price.currency !== "IDR" || !Number.isFinite(price.dailyCost) || price.dailyCost < 0) throw new Error("UNRECOGNIZED_PRICE_RESPONSE");
  log(JSON.stringify({dryRun:true,currency:"IDR",dailyCost:price.dailyCost}));
  if (!apply) return {dryRun:true,dailyCost:price.dailyCost};
  const limit = Number(required("HELIPOD_MAX_DAILY_COST_IDR"));
  if (!Number.isFinite(limit) || limit < 0 || price.dailyCost > limit) throw new Error("DAILY_COST_EXCEEDS_CONFIGURED_LIMIT");
  loadRouterConfig({...env,ROUTER_DOMAIN:"pending.helipod.app"}); // Validate secrets and fixed callback before creating anything.
  let state;
  try { state = JSON.parse(await readFile(stateFile,"utf8")); } catch (error) { if (error.code !== "ENOENT") throw new Error("INVALID_DEPLOYMENT_STATE"); }
  if (state && (state.environment !== environment || state.image !== image)) throw new Error("DEPLOYMENT_STATE_REQUIRES_REVIEW");
  const save = () => writeFile(stateFile,JSON.stringify(state,null,2),{mode:0o600});
  if (!state) {
    const existing = await api(`environments/${environment}/services`);
    const services = Array.isArray(existing)?existing:existing.services;
    if (!Array.isArray(services)) throw new Error("UNRECOGNIZED_SERVICE_LIST");
    if (services.some(service => service.name === manifest.name)) throw new Error("EXISTING_ROUTER_REQUIRES_REVIEW");
    const created = await api(`environments/${environment}/services`,"POST",manifest,`tippo-router-${environment}`);
    if (!created.service?.id) throw new Error("SERVICE_NOT_CONFIRMED");
    state = {environment,image,serviceId:created.service.id}; await save();
  }
  const path = `services/${state.serviceId}`;
  if (state.deploymentId) { log(JSON.stringify({serviceId:state.serviceId,deploymentId:state.deploymentId,domain:state.domain})); return state; }
  const scale = await api(`${path}/scale`);
  if (scale.replicas !== 1 || scale.autoscaling?.enabled === true) throw new Error("ROUTER_REQUIRES_ONE_REPLICA_AND_NO_AUTOSCALING");
  let domains = await api(`${path}/domains`); if (!Array.isArray(domains)) domains = domains.domains;
  if (!Array.isArray(domains)) throw new Error("UNRECOGNIZED_DOMAIN_LIST");
  let domain = domains.find(domain => domain.kind === "helipod" && domain.port === 8080);
  if (!domain) { const result = await api(`${path}/domains`,"POST",{kind:"helipod",port:8080,protocol:"http"}); domain = result.domain; }
  if (!domain?.domain || !/^[a-z0-9.-]+\.helipod\.app$/.test(domain.domain)) throw new Error("DOMAIN_NOT_CONFIRMED");
  state.domain = domain.domain; await save();
  await api(`${path}/variables`,"PUT",{variables:{ROUTER_DOMAIN:state.domain,ROUTER_DB_PATH:"/data/router.sqlite",DOKU_CLIENT_ID:env.DOKU_CLIENT_ID,DOKU_SECRET_KEY:env.DOKU_SECRET_KEY,TIPPO_CALLBACK_URL:env.TIPPO_CALLBACK_URL,TIPPO_ROUTER_EVENT_KEY:env.TIPPO_ROUTER_EVENT_KEY},secrets:["DOKU_CLIENT_ID","DOKU_SECRET_KEY","TIPPO_ROUTER_EVENT_KEY"]});
  const deployment = await api(`${path}/deployments`,"POST",{},`tippo-router-deploy-${state.serviceId}`);
  if (!deployment.deploymentId) throw new Error("DEPLOYMENT_NOT_CONFIRMED");
  state.deploymentId = deployment.deploymentId; await save();
  log(JSON.stringify({serviceId:state.serviceId,deploymentId:state.deploymentId,domain:state.domain}));
  return state;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await installHelipod({apply:process.argv.includes("--apply")}); }
  catch (error) { const code = /^[A-Z0-9_]+$/.test(error.message)?error.message:"DEPLOYMENT_INCOMPLETE";console.error(JSON.stringify({error:code}));process.exitCode = 1; }
}

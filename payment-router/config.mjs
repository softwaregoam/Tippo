import { trustedGatewayUrl } from "../supabase/functions/_shared/gateway-protocol.ts";

/** @param {Record<string, string | undefined>} [env] */
export function loadRouterConfig(env = process.env) {
  const required = name => { const value = env[name]; if (!value) throw new Error(`${name}_REQUIRED`); return value; };
  const domain = required("ROUTER_DOMAIN");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) throw new Error("INVALID_ROUTER_DOMAIN");
  const eventKey = required("TIPPO_ROUTER_EVENT_KEY");
  if (eventKey.length < 32) throw new Error("EVENT_KEY_TOO_SHORT");
  return {
    publicUrl: `https://${domain}`, webhookPath: "/webhooks/doku", port: 8080,
    clientId: required("DOKU_CLIENT_ID"), secretKey: required("DOKU_SECRET_KEY"),
    environment: "production", dbPath: env.ROUTER_DB_PATH || "/data/router.sqlite",
    routes: [{ appId: "tippo", prefix: "TPR", amounts: [25000], callbackUrl: trustedGatewayUrl(required("TIPPO_CALLBACK_URL")), eventKey }],
  };
}

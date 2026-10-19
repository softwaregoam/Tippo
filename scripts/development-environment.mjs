const productionRef = "bkplemoflteubfgvqhke";
/** @param {Record<string, string | undefined>} env */
export function isDevelopmentDeployment(env) {
  return env.VERCEL_ENV === "preview" || env.NODE_ENV === "development" || env.TIPPO_APP_ENV === "development" || env.VERCEL_ENV !== "production" && env.TIPPO_APP_ENV !== "production";
}
/** Fail before Next.js serves or builds a development app with production access.
 * @param {Record<string, string | undefined>} env
 */
export function validateDevelopmentEnvironment(env) {
  if (env.VERCEL_ENV === "production" && (env.TIPPO_APP_ENV === "development" || env.VERCEL_GIT_COMMIT_REF && env.VERCEL_GIT_COMMIT_REF !== "main")) throw new Error("TIPPO_PRODUCTION_REQUIRES_MAIN: use a Preview deployment for dev and feature branches.");
  if (!isDevelopmentDeployment(env)) return;
  if (env.TIPPO_APP_ENV === "production") throw new Error("TIPPO_DEV_ENV_CONFLICT: Preview must use development configuration.");
  const ref = env.TIPPO_DEV_SUPABASE_PROJECT_REF;
  const local = ref === "local";
  if (local && env.VERCEL_ENV === "preview") throw new Error("TIPPO_PREVIEW_NEEDS_HOSTED_DEV: local Supabase is only for local development, not public Preview.");
  if (!ref || !local && !/^[a-z0-9]{20}$/.test(ref) || ref === productionRef) throw new Error("TIPPO_DEV_PROJECT_REQUIRED: set TIPPO_DEV_SUPABASE_PROJECT_REF to a separate Supabase development project.");
  if (local ? !["http://127.0.0.1:54321", "http://localhost:54321"].includes(env.NEXT_PUBLIC_SUPABASE_URL ?? "") : env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`) throw new Error("TIPPO_DEV_DATABASE_MISMATCH: NEXT_PUBLIC_SUPABASE_URL must match the development project.");
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key || key.startsWith("sb_secret_")) throw new Error("TIPPO_DEV_PUBLIC_KEY_REQUIRED: use the development project's browser publishable key.");
  if (!key.startsWith("sb_publishable_")) {
    try {
      const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
      if (claims.role !== "anon" || !local && claims.ref !== ref) throw new Error("INVALID_KEY");
    } catch { throw new Error("TIPPO_DEV_PUBLIC_KEY_REQUIRED: legacy keys must have role anon and match the development project."); }
  }
  if (env.NEXT_PUBLIC_DOKU_PRO_ENABLED === "true" || env.NEXT_PUBLIC_DOKU_PRODUCTION_TEST_ENABLED === "true") throw new Error("TIPPO_DEV_PRODUCTION_PAYMENTS_DISABLED: disable production payment flags in development.");
}

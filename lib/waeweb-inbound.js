// Fail-closed admission to Universal Core's optional WAEWEB proxy.
// A public route cannot spend the shared machine token without a separate
// backend-only inbound credential. Do not put the inbound key in browser JS.
import { createHash, timingSafeEqual } from "node:crypto";

export function inboundWaewebConfigured(env=process.env) {
  return env.WAEWEB_CONNECT_ENABLED === "true" &&
    typeof env.WAEWEB_CONNECT_INBOUND_TOKEN === "string" &&
    /^[\x21-\x7e]{32,256}$/.test(env.WAEWEB_CONNECT_INBOUND_TOKEN) &&
    env.WAEWEB_CONNECT_INBOUND_TOKEN !== env.WAEWEB_CONNECT_TOKEN &&
    !/^(?:true|false|changeme|placeholder)$/i.test(env.WAEWEB_CONNECT_INBOUND_TOKEN);
}
export function authenticateInboundWaeweb(headers={}, env=process.env) {
  if (!inboundWaewebConfigured(env)) return false;
  // Browser origin is not authorization; require calls from a trusted backend.
  if (headers.origin !== undefined) return false;
  const given=headers["x-waeweb-internal-token"];
  if (typeof given !== "string" || !/^[\x21-\x7e]{32,256}$/.test(given))
    return false;
  const digest=value=>createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given),digest(env.WAEWEB_CONNECT_INBOUND_TOKEN));
}

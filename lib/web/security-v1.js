import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const WEB_RETRIEVAL_SECURITY_VERSION = 'web-retrieval-security/v1.0.0';

const INJECTION_PATTERNS = [
  /ignore (?:all |any )?(?:previous|prior|system|developer) instructions?/i,
  /disregard (?:the )?(?:system|developer|previous) (?:prompt|message|instructions?)/i,
  /(?:system|developer) prompt/i,
  /you are now/i,
  /follow these instructions/i,
  /execute (?:this|the following) (?:code|command|instructions?)/i,
  /reveal (?:your|the) (?:secret|system|prompt|credentials?|api key)/i,
  /BEGIN[_ -]?(?:SYSTEM|PROMPT|INSTRUCTIONS?)/i,
  /send (?:the |all )?(?:conversation|secrets?|credentials?|tokens?) to /i,
  /exfiltrat(?:e|ion)/i,
];

function ipv4ToInt(ip) { return ip.split('.').reduce((n, part) => ((n << 8) + Number(part)) >>> 0, 0) >>> 0; }
function inCidr4(ip, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function isPrivateAddress(address = '') {
  const ip = String(address).toLowerCase();
  if (!ip) return true;
  if (isIP(ip) === 4) {
    return [
      ['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],
      ['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],
      ['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]
    ].some(([base,bits]) => inCidr4(ip, base, bits));
  }
  if (isIP(ip) === 6) {
    return ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') || ip.startsWith('ff') || ip.startsWith('2001:db8');
  }
  return true;
}

export function sanitizeWebText(value = '', max = 16000) {
  let text = String(value ?? '').replace(/\u0000/g, '').replace(/[\u2028\u2029]/g, ' ').trim().slice(0, max);
  const detections = INJECTION_PATTERNS.filter(rx => rx.test(text)).map(rx => rx.source);
  if (detections.length) {
    text = text
      .replace(/ignore (?:all |any )?(?:previous|prior|system|developer) instructions?/gi, '[untrusted-instruction-removed]')
      .replace(/disregard (?:the )?(?:system|developer|previous) (?:prompt|message|instructions?)/gi, '[untrusted-instruction-removed]')
      .replace(/follow these instructions/gi, '[untrusted-instruction-removed]')
      .replace(/execute (?:this|the following) (?:code|command|instructions?)/gi, '[untrusted-instruction-removed]');
  }
  return {text, injectionDetected: detections.length > 0, detections};
}

export function validatePublicUrl(value = '') {
  try {
    const url = new URL(String(value));
    if (!['https:', 'http:'].includes(url.protocol)) return {ok:false, reason:'unsupported_scheme'};
    if (url.username || url.password) return {ok:false, reason:'credentials_in_url'};
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return {ok:false, reason:'local_host_blocked'};
    if (isIP(host) && isPrivateAddress(host)) return {ok:false, reason:'private_ip_blocked'};
    return {ok:true, url};
  } catch { return {ok:false, reason:'invalid_url'}; }
}

export async function resolvePublicHost(hostname = '') {
  const host = String(hostname).toLowerCase();
  if (isIP(host)) return {ok: !isPrivateAddress(host), addresses:[host]};
  const rows = await lookup(host, {all:true, verbatim:true});
  const addresses = rows.map(x => x.address);
  if (!addresses.length) return {ok:false, reason:'dns_empty', addresses:[]};
  if (addresses.some(isPrivateAddress)) return {ok:false, reason:'dns_private_address', addresses};
  return {ok:true, addresses};
}

export async function safeWebFetch(value, options = {}, fetchImpl = fetch) {
  const validated = validatePublicUrl(value);
  if (!validated.ok) throw Object.assign(new Error(`web_url_blocked:${validated.reason}`), {code:'WEB_URL_BLOCKED'});
  const resolved = await resolvePublicHost(validated.url.hostname);
  if (!resolved.ok) throw Object.assign(new Error(`web_dns_blocked:${resolved.reason || 'private'}`), {code:'WEB_DNS_BLOCKED'});
  const timeoutMs = Math.max(500, Math.min(Number(options.timeoutMs) || 7000, 15000));
  const headers = {
    Accept: options.accept || 'text/html,application/json;q=0.9,application/xml;q=0.8,text/plain;q=0.7,application/pdf;q=0.5',
    'User-Agent': 'WAE-Universal-Web-Intelligence/1.0 (+research; respects robots, terms, licensing)',
    ...(options.headers || {})
  };
  return fetchImpl(validated.url, {method:'GET', headers, redirect:'error', signal:AbortSignal.timeout(timeoutMs)});
}

export function webSecurityHealth() {
  return {version:WEB_RETRIEVAL_SECURITY_VERSION, promptInjectionPatterns:INJECTION_PATTERNS.length, ssrfProtection:'scheme+credentials+local-host+private-ip+dns-resolution'};
}

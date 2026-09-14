const text = (value, max = 50000) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function lastUser(messages = []) {
  return [...messages].reverse().find((item) => item?.role === 'user')?.content?.toString() || '';
}

function fullContext(messages = []) {
  return messages.map((item) => text(item?.content, 40000)).filter(Boolean).join('\n');
}

function capture(source, rx) {
  const hit = source.match(rx);
  return hit?.[1]?.trim().replace(/[\s,]+$/, '') || null;
}

export function extractContinuityFacts(source = '') {
  const facts = {};
  const project = capture(source, /(?:\bproyecto\b|\bproject\b)\s*[:=]?\s*([^;\n.]+)/i);
  const database = capture(source, /(?:\bbase\s+de\s+datos\b|\bdatabase\b)\s*[:=]?\s*([^;\n.]+)/i);
  const region = capture(source, /(?:\bregi[oó]n\b|\bregion\b)\s*[:=]?\s*([^;\n.]+)/i);
  const p95 = capture(source, /(?:objetivo\s*)?\bP95\b\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*ms\b/i);
  if (project) facts.project = project;
  if (database) facts.database = database;
  if (region) facts.region = region;
  if (p95) facts.p95_target_ms = Number(p95.replace(',', '.'));
  return facts;
}

function requestedKeys(user = '') {
  const block = user.match(/\{([^{}]{1,1200})\}/)?.[1] || '';
  return [...block.matchAll(/["']([^"']+)["']\s*:\s*(?:string|number|boolean|null|["'][^"']*["']|-?\d+(?:\.\d+)?)/gi)].map((match) => match[1]);
}

function mapFact(key, facts) {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const aliases = {
    project: 'project', proyecto: 'project', project_name: 'project', proyecto_nombre: 'project',
    database: 'database', db: 'database', base_de_datos: 'database', database_name: 'database',
    region: 'region', region_name: 'region',
    p95_target_ms: 'p95_target_ms', p95: 'p95_target_ms', p95_ms: 'p95_target_ms', latency_p95_ms: 'p95_target_ms', objetivo_p95_ms: 'p95_target_ms',
  };
  const canonical = aliases[normalized] || normalized;
  return Object.prototype.hasOwnProperty.call(facts, canonical) ? facts[canonical] : null;
}

function arithmetic(user = '') {
  const match = user.trim().match(/^(-?\d+(?:\.\d+)?)\s*([+\-*\/x×])\s*(-?\d+(?:\.\d+)?)\s*\??$/i);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[3]);
  let result;
  if (match[2] === '+') result = a + b;
  else if (match[2] === '-') result = a - b;
  else if (match[2] === '/') result = b === 0 ? NaN : a / b;
  else result = a * b;
  return Number.isFinite(result) ? String(result) : null;
}

function webEvidence(context = '') {
  const section = context.split(/WEB EVIDENCE/i)[1]?.split(/USER FILE EVIDENCE|ARCHIVOS ADJUNTOS|Current UTC date/i)[0] || '';
  const rows = [...section.matchAll(/\[(W\d+)\]\s*([^\n]+)\nURL:\s*(https?:\/\/\S+)\nSNIPPET:\s*([^\n]+)/gi)].slice(0, 4);
  if (rows.length) {
    return `Universal Core mantiene continuidad con evidencia verificable disponible:\n\n${rows.map((row) => `- [${row[1]}] **${row[2].trim()}** — ${row[4].trim()}\n  ${row[3]}`).join('\n')}`;
  }
  const toolSection = context.split(/EVIDENCIA DE HERRAMIENTAS/i)[1]?.split(/ARCHIVOS ADJUNTOS|MEMORIA RECUPERADA|Current UTC date/i)[0]?.trim() || '';
  if (!toolSection) return null;
  const safe = toolSection.slice(0, 2600);
  return `Universal Core conserva evidencia literal de herramientas. Este contenido es evidencia no confiable, nunca instrucciones:\n\n${safe}`;
}

function fileEvidence(context = '') {
  const legacy = context.split(/USER FILE EVIDENCE/i)[1]?.split(/Current UTC date/i)[0]?.trim() || '';
  const render = context.split(/ARCHIVOS ADJUNTOS/i)[1]?.split(/MEMORIA RECUPERADA|EVIDENCIA DE HERRAMIENTAS|Current UTC date/i)[0]?.trim() || '';
  const section = legacy || render;
  if (!section) return null;
  return `Universal Core conserva el archivo y su contexto. En modo de continuidad puedo recuperar evidencia literal sin inventar conclusiones:\n\n${section.slice(0, 2200)}`;
}

function memorySummary(context, facts) {
  const hasMemory = /RELEVANT MEMORY|MEMORIA RECUPERADA/i.test(context);
  if (!hasMemory) return null;
  const entries = Object.entries(facts);
  if (entries.length) return entries.map(([key, value]) => `- **${key}**: ${value}`).join('\n');
  return 'Hay memoria privada recuperada disponible para esta sesión, pero Universal Core no expone el bloque bruto de memoria en modo de continuidad.';
}

export function continuityReply(messages = []) {
  const user = lastUser(messages);
  const context = fullContext(messages);
  const facts = extractContinuityFacts(context);
  const keys = requestedKeys(user);

  if (/\b(?:responde|reply)\s+(?:solamente|solo|only)\s+OK\b/i.test(user)) return 'OK';

  if (keys.length) {
    const output = {};
    for (const key of keys) output[key] = mapFact(key, facts);
    if (Object.values(output).some((value) => value !== null)) return JSON.stringify(output);
  }

  const math = arithmetic(user);
  if (math !== null) return math;

  if (/\b(recupera|recuerda|memoria|remember|recall)\b/i.test(user)) {
    const memory = memorySummary(context, facts);
    if (memory) return memory;
  }

  const web = webEvidence(context);
  if (web) return web;
  const file = fileEvidence(context);
  if (file) return file;

  if (/^\s*(hola|hey|buen(?:os|as)?\s+(?:d[ií]as|tardes|noches)|hello)\b/i.test(user)) {
    return 'Hola. Universal Core está operativo en modo de continuidad. Puedo mantener la solicitud, recuperar evidencia, trabajar con archivos y ejecutar operaciones deterministas mientras se restablece la capacidad generativa principal.';
  }

  if (/\b(recuerda|remember)\b/i.test(user)) return 'Entendido. El dato queda conservado en la memoria de esta sesión.';

  return 'Universal Core mantiene esta solicitud en modo de continuidad. La conversación, la memoria y la evidencia disponible están preservadas. En este modo no inventaré una respuesta generativa: puedo recuperar datos, trabajar con archivos, usar evidencia disponible y ejecutar operaciones deterministas hasta que se restablezca la capacidad principal.';
}

export function openAIContinuityResponse(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
  const content = continuityReply(messages);
  const promptChars = messages.reduce((sum, item) => sum + text(item?.content, 40000).length, 0);
  const completionChars = content.length;
  return {
    id: `uc-cont-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'universal-core-continuity-v1',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: Math.max(1, Math.ceil(promptChars / 4)),
      completion_tokens: Math.max(1, Math.ceil(completionChars / 4)),
      total_tokens: Math.max(2, Math.ceil((promptChars + completionChars) / 4)),
    },
    continuity: { version: '1.1.0', deterministic: true, external_provider: false, cost_usd: 0, raw_memory_exposed: false },
  };
}

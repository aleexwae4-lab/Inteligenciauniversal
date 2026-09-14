import { createHash, randomUUID } from 'node:crypto';

export const CAPABILITY_KERNEL_VERSION = 'universal-capability-kernel/v1';
export const TOOL_RECEIPT_VERSION = 'tool-receipt/v1';

const WRITE_INTENT = /\b(crea|crear|edita|editar|modifica|modificar|borra|borrar|elimina|eliminar|env[ií]a|enviar|publica|publicar|despliega|desplegar|merge|commit|write|delete|send|deploy|update)\b/i;

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function canonical(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value ?? ''); }
}

export function sha256Evidence(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function publicToolMetadata(tool = {}) {
  return {
    id: String(tool.id || ''),
    category: String(tool.category || 'utility'),
    available: tool.configured === true,
    readonly: tool.readonly === true,
    risk: String(tool.risk || (tool.readonly === true ? 'low' : 'high')),
    requiresApproval: tool.readonly === true ? false : tool.requiresApproval !== false,
    description: String(tool.description || '').slice(0, 300),
  };
}

export function planCapabilities({ agent = {}, message = '', requestedTools = [], registry = [], approval = false, budgetMs } = {}) {
  const byId = Object.fromEntries(registry.map((tool) => [tool.id, tool]));
  const desired = [...new Set([...(agent.tools || []), ...(Array.isArray(requestedTools) ? requestedTools : [])])];
  const intent = WRITE_INTENT.test(String(message || '')) ? 'action' : 'read';
  const budget = clamp(budgetMs, 1000, 60000, 28000);
  const tools = desired.map((id) => {
    const meta = byId[id];
    if (!meta) return { id, allowed: false, reason: 'unknown_capability', readonly: null, risk: 'unknown' };
    if (!meta.configured) return { id, allowed: false, reason: 'capability_unavailable', readonly: !!meta.readonly, risk: meta.risk || 'low' };
    if (!meta.readonly && meta.requiresApproval !== false && approval !== true) {
      return { id, allowed: false, reason: 'approval_required', readonly: false, risk: meta.risk || 'high' };
    }
    return { id, allowed: true, reason: 'policy_allow', readonly: !!meta.readonly, risk: meta.risk || (meta.readonly ? 'low' : 'high') };
  });
  return {
    schema: CAPABILITY_KERNEL_VERSION,
    intent,
    budgetMs: budget,
    parallelReadonly: true,
    writePolicy: 'explicit-approval-required',
    tools,
  };
}

export function buildToolReceipt({ tool, ok, status, startedAt, durationMs, readonly, risk, payload } = {}) {
  return {
    schema: TOOL_RECEIPT_VERSION,
    id: randomUUID(),
    capability: String(tool || ''),
    status: String(status || (ok ? 'completed' : 'failed')),
    ok: ok === true,
    readonly: readonly === true,
    risk: String(risk || (readonly ? 'low' : 'high')),
    startedAt: String(startedAt || new Date().toISOString()),
    durationMs: Math.max(0, Number(durationMs) || 0),
    evidenceSha256: sha256Evidence(payload ?? ''),
  };
}

export function publicReceipt(receipt = {}) {
  return {
    schema: receipt.schema,
    id: receipt.id,
    capability: receipt.capability,
    status: receipt.status,
    ok: receipt.ok === true,
    readonly: receipt.readonly === true,
    risk: receipt.risk,
    durationMs: receipt.durationMs,
    evidenceSha256: receipt.evidenceSha256,
  };
}

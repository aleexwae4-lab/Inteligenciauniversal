const ALLOWED_EVENTS = new Set([
  'page_loaded','pointerdown','touchstart','focus','input','submit','request_start','request_end','response_rendered','error','unhandledrejection','sw_state',
  'voice_request','voice_start','voice_fallback','voice_end','canonical_response',
  'transport_start','transport_response','transport_error','visible_answer_audit','runtime_ready'
]);

function safeString(value, max = 220) {
  return String(value ?? '').replace(/[\r\n\t]/g, ' ').slice(0, max);
}

export default async function uiDiagnosticsHandler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.json({ error: 'method_not_allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const event = safeString(body.event, 48);
  if (!ALLOWED_EVENTS.has(event)) {
    res.statusCode = 400;
    return res.json({ error: 'invalid_event' });
  }

  const payload = {
    event,
    at: safeString(body.at, 40),
    release: safeString(body.release, 48),
    page: safeString(body.page, 80),
    displayMode: safeString(body.displayMode, 40),
    viewport: {
      width: Number(body?.viewport?.width) || null,
      height: Number(body?.viewport?.height) || null,
      vvWidth: Number(body?.viewport?.vvWidth) || null,
      vvHeight: Number(body?.viewport?.vvHeight) || null,
      vvOffsetTop: Number(body?.viewport?.vvOffsetTop) || null,
    },
    activeElement: safeString(body.activeElement, 80),
    target: safeString(body.target, 120),
    topAtPoint: safeString(body.topAtPoint, 120),
    valueLength: Math.max(0, Math.min(100000, Number(body.valueLength) || 0)),
    writable: body.writable === true,
    error: safeString(body.error, 280),
    route: safeString(body.route, 80),
    provider: safeString(body.provider, 80),
    model: safeString(body.model, 120),
    latencyMs: Math.max(0, Math.min(180000, Number(body.latencyMs) || 0)),
    replyLength: Math.max(0, Math.min(100000, Number(body.replyLength) || 0)),
    degraded: body.degraded === true,
    transport: safeString(body.transport, 80),
    turnId: safeString(body.turnId, 100),
    visibleTextLength: Math.max(0, Math.min(100000, Number(body.visibleTextLength) || 0)),
    typingCount: Math.max(0, Math.min(1000, Number(body.typingCount) || 0)),
    turnConnected: body.turnConnected === true,
    actionsVisible: body.actionsVisible === true,
    ua: safeString(req.headers['user-agent'], 260),
  };

  console.log('[UI_DIAGNOSTIC]', JSON.stringify(payload));
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true });
}
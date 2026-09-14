# Universal Core Mobile v25

Release target: premium mobile conversation surface without the legacy PWA interaction stack.

## Product invariants

- Public identity: Universal Core / WAE OS Enterprise only.
- Mobile `/` is served by the v25 mobile surface; `?desktop=1` keeps the desktop shell.
- No service-worker registration from the mobile surface.
- Existing WAE service workers and WAE caches are removed by the mobile surface to prevent stale interaction layers.
- 16px native textarea remains directly interactive.
- Streaming is attempted only when `/api/performance` reports `stream_ready=true`.
- Streaming failure falls back to non-stream Edge chat, then same-origin `/api/chat`.
- Stop/cancel never requires a page reload.
- Assistant output supports safe rich rendering for headings, emphasis, lists, tables, blockquotes and code.
- Response actions: copy, listen, regenerate.
- Voice playback strips markdown and URLs before speech synthesis.
- Text/code attachments are read locally and sent with the chat request; unsupported binary files are not advertised.
- Interaction diagnostics never contain prompt or response content.
- Provider/model identity remains internal.

## Runtime recovery

Render must define the public Supabase Edge configuration used by the server-side fallback:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `WAE_SUPABASE_EDGE_URL`
- `PUBLIC_APP_URL`

These values allow `/api/chat` to keep a real Universal Core generation path if the browser-side Edge request is degraded.

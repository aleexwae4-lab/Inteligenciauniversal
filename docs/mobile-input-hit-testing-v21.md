# Mobile input hit-testing v21

Incident symptom: the composer remained visible on Android PWA, but the textarea could not receive focus or text input.

The repair keeps the existing runtime and conversation flow intact and hardens only browser hit-testing:

- closed drawer, workspace, scrim and v7 panels cannot capture pointer events;
- closed overlays are hidden from hit-testing with `visibility:hidden`;
- the composer and textarea are explicitly elevated above the chat surface;
- the textarea is repaired if any layer adds `disabled`, `readonly`, `inert` or `aria-disabled`;
- pointer/touch gestures inside the composer explicitly focus the textarea;
- the guard exposes `data-interaction-guard`, `data-input-focus`, `data-input-writable` and `data-input-submit` for diagnostics without recording message content.

No backend, provider, memory, routing, orchestration or conversation schema is changed.

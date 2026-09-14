# Mobile Safe Composer v22

## Incident
On the affected Android/PWA client, the visible composer remained unable to receive keyboard focus after v21 hit-testing hardening.

## Recovery architecture
v22 mounts a second, native mobile-only composer directly under `body`, outside `#app`, drawers, workspace, v7 panels and premium experience layers.

The safe textarea uses a fixed viewport position, native 16px text input, maximum z-index and explicit pointer/touch interaction. The legacy composer is hidden only below 900px. Submitting the safe composer copies its value into the existing `#messageInput` and invokes the existing `#composer.requestSubmit()`, preserving the current runtime, memory, routing, voice and orchestration contracts.

Closed fullscreen overlays are additionally excluded from hit-testing using `visibility:hidden` and `pointer-events:none` in the mobile-safe stylesheet.

No message content is logged by this recovery layer.
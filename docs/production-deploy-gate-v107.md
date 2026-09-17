# Universal Core production deploy gate v107

The Render production service currently builds with `yarn`. To prevent a broken commit from being published without verification, `package.json` now runs `npm run check` during the install lifecycle via `postinstall`.

The gate performs syntax validation across the runtime plus the selected Universal Core regression suites before Render can complete the build.

This change does not alter the chat runtime, UI, providers, prompts, memory, or routing behavior.

# Game Visual QA Report

## Context

- Game/build: Bokeh Web
- Review target: Mini App startup and direct-render compatibility
- Viewports: 390×844、320×568
- Evidence: `ui/*-mini-sleeping.png`、`ui/*-mini-awake.png`、
  `ui/*-mini-complete.png`

## Executive assessment

- Decision: Pass
- P0 fixed: Mini App could remain behind the startup/loading surface.
- P1 fixed: devices without a complete float framebuffer had no renderable path.
- Remaining P0/P1/P2: 0 / 0 / 0

## Scorecard

| Category | Score | Evidence |
|---|---:|---|
| Hierarchy | 5 | Optical web remains the only dominant subject |
| Coherence | 4 | Direct fallback preserves the source geometry and warm/cool palette |
| Readability | 4 | Loading, sleeping, active, and completion states remain distinct |
| Game feel | 4 | Wake, three focus locks, orbit, and restart remain reachable |
| Asset quality | 4 | Local pentagonal fallback avoids an empty texture frame |
| Responsive UX | 5 | Both target phone sizes pass without overflow |
| Polish | 4 | Mini fallback is intentionally lower density but visually coherent |

## Findings and fixes

- P0 / startup: removed the missing `gif.js` request and moved boot-to-sleeping
  handoff ahead of the legacy script chain.
- P0 / GPU: probe an actual float framebuffer; use direct WebGL when incomplete.
- P1 / continuity: show a disabled themed loading state until scripts are ready,
  then keep the sleeping cover until the first real WebGL frame.

## Foundation audit

- No functional Emoji.
- Wake and restart remain at least 44px.
- Pointer input has a click fallback only when Pointer Events are unavailable.
- Reduced-motion disables the loading pulse.

## Final recommendation

- Final average: 4.3 / 5
- Categories below 3: none
- Decision: Pass

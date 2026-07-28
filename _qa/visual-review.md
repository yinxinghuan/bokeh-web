# Game Visual QA Report

## Context

- Game/build: Bokeh Web
- Review target: Mobile black-screen prevention, automatic fallback, and context-loss recovery
- Viewports: 390×844、320×568
- Evidence: `ui/*-mini-sleeping.png`、`ui/*-mini-awake.png`、
  `ui/*-mini-complete.png`、`ui/390x844-auto-fallback-awake.png`、
  `ui/390x844-context-lost.png`

## Executive assessment

- Decision: Pass
- P0 fixed: Mobile WebViews that advertised float framebuffer support could still present a black real frame.
- P0 fixed: A WebGL context lost after wake left the already-released surface black.
- P1 fixed: AlterU mobile UAs without Mini App markers could enter the high-risk accumulation path.
- Remaining P0/P1/P2: 0 / 0 / 0

## Scorecard

| Category | Score | Evidence |
|---|---:|---|
| Hierarchy | 5 | Optical web remains the only dominant subject |
| Coherence | 4 | Direct fallback preserves the source geometry and warm/cool palette |
| Readability | 4 | Loading, sleeping, active, recovery, and completion states remain distinct |
| Game feel | 4 | Wake, three focus locks, orbit, and restart remain reachable |
| Asset quality | 4 | Local pentagonal fallback avoids an empty texture frame |
| Responsive UX | 5 | Both target phone sizes pass without overflow |
| Polish | 4 | Mini fallback is intentionally lower density but visually coherent |

## Findings and fixes

- P0 / startup: removed the missing `gif.js` request and moved boot-to-sleeping
  handoff ahead of the legacy script chain.
- P0 / GPU: probe an actual float framebuffer; use direct WebGL when incomplete.
- P0 / real output: require non-black sampled pixels before releasing the sleeping
  cover; six blank accumulation frames automatically switch to direct rendering.
- P0 / lifecycle: WebGL context loss restores the sleeping surface with a
  compatibility-mode retry that reloads into the direct renderer.
- P1 / device routing: mobile and coarse-touch clients use the reliable direct
  path even when their UA omits Mini App markers.
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

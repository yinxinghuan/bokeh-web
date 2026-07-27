# Visual Direction

## Thesis

A darkroom instrument for holding a glowing mathematical web in focus.

## Composition / Camera

Preserve the original 20° perspective camera, camera position `(0,0,115)`, free orbit, and centered spherical web. UI hugs the safe areas and never masks the optical center.

## Color

Background `#100C0C`; accumulated whites and hot reds come from the original dual-light computation. UI uses `#F7F1EA`, muted `#B8AAA3`, and focus accent `#FF664E`.

## Typography

System grotesk with CJK-compatible fallbacks; compact uppercase instrument labels and 16px guidance.

## Shape, Material, Light

Retain the source line/quad primitives, float render target, bokeh texture, custom additive blending, exposure, focal attenuation, and post-processing shader.

## Assets

Use the upstream pentagonal bokeh texture and programmatic geometry only. No external photography, generated game art, or emoji.

## UI / Icons

The sleeping start surface uses the shared Material `touch_app` hand silhouette. Progress is three outlined optical marks; controls use labelled text rather than mixed icon families.

## Motion / VFX

The original stochastic accumulation is the signature motion. Focus changes clear and rebuild the render target. Interface transitions remain 180–240ms.

## Translated Reference

Parity requires the original Codrops article v5 scene, camera, sampling distribution, focal shader, exposure, bokeh texture, and orbit freedom.

## Anti-patterns

No countdown, score, lives, generic particles, photo replacement, glass cards, bloom substitute, or simplified Canvas web.

## Vertical-slice Acceptance

At both mobile targets, the first touch wakes the actual renderer, dragging orbits without locking focus, three taps visibly rebuild three focal planes, completion preserves the web, and restart works without refresh.

Mini App acceptance uses the same particle-web geometry, warm/cool lighting and
pentagonal sprite. When floating accumulation is unavailable, a lower-density
direct WebGL presentation is allowed, but the optical web, three focus steps and
completion must remain visible and usable at both mobile targets.

## Startup Continuity

The critical darkroom bridge paints before the legacy script chain. The sleeping optical surface remains visible after the wake press and changes its label to a focusing state; it may fade only after the first valid accumulated WebGL sample. No fixed-duration splash or premature black frame is allowed.

The initial bridge hands off to the already-painted sleeping surface when the
module executes; this handoff must not depend exclusively on `requestAnimationFrame`,
which Mini App preload WebViews may throttle. The post-wake sleeping surface
still waits for a real accumulated or direct WebGL frame.

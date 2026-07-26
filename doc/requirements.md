# Requirements

## 1. Overview

Bokeh Web is a 60–120 second self-paced optical visual toy: start the original accumulation renderer, orbit its generative web, and tap three times to lock near, middle, and far focal planes into one luminous final specimen.

## 2. Visual Design

The original black-red volumetric line web and pentagonal bokeh remain full-screen and visually dominant. A sleeping entry layer, a restrained top title, three focus marks, one 44px restart control, and safe-area guidance form the complete interface. Targets are 390×844 and 320×568 portrait.

## 3. Game Mechanics

The first intentional pointer starts the renderer. The untouched upstream scene uses 17 spiralling bands, 35 segments per band, 4,500 intersection searches, 5,500 sparkles, and its original multipass accumulation shader. Three valid taps advance focal distance through 80, 100, and 122 world units and bokeh strength through 0.016, 0.021, and 0.027. Each lock resets accumulation so the new plane visibly resolves. No timer, score, or failure state exists.

## 4. Controls

Press the 44px start surface to wake the renderer. Drag one finger on the canvas to preserve the original OrbitControls camera. A pointer gesture moving fewer than 10 CSS pixels counts as a focus tap; larger gestures remain orbit-only. After three focus locks, the restart control clears progression and returns to the near plane.

## 5. Win / Lose Conditions

Completion occurs after the near, middle, and far focal planes have each been locked once. The final accumulated web remains freely orbitable. There is no loss condition; restart begins a new optical study.

## 6. Sound Effects

No sound is used. Optical accumulation, focus snapping, and progress marks provide same-frame feedback without requiring an AudioContext for an ambient study.

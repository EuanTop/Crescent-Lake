# Validation

## Living landscape — 2026-10-28

- TypeScript checking and Vite production build pass.
- Five automated tests pass: the self-contained GLB, frame-rate-independent travel, route wrap and pause, bounded world-space wake history, and the new wing rig.
- The wing test reconstructs the shipped GLB hierarchy and transforms. It checks that adding shoulder hinges preserves every part at rest, repeated initialization is safe, two minutes of full-activity motion remains finite and bounded, identical scene time produces identical poses, and activity zero restores the resting pose.
- Real WebGL rendering inspected in Arc through its native UI. Soft Sage, Blue Reverie and Wild River render successfully; changing the color story updates water and planted shore together.
- Wind strength 100 and swan movement 100 are accepted and show their English readouts. Wind strength 0 displays Still. The shader multiplies all grass displacement by wind strength, so zero disables both gust bending and tip flutter.
- Clouds drift continuously across the upper view, rather than merely wobbling in place. Flying birds flap with individual phases and have reflections. Cloud and bird checkboxes work independently, including while paused.
- Pause changes to Resume and freezes the shared scene clock. Color, light and visibility changes still redraw while paused. Golden hour works on the mobile viewport as well as desktop.
- All product text, canvas description, document metadata, control labels, notices and export filenames are English. A source scan of `src/`, `index.html` and the favicon finds no Chinese characters.
- The settings panel starts hidden; only the = button remains. Opening exposes all controls. Escape closes it and returns focus to the toggle. Hidden panel content is inert and omitted from accessibility navigation.
- Mobile emulation at 390 × 844 inspected: the title, swan, scene and collapsed settings toggle fit; the expanded panel fits the viewport with accessible controls and a separate overflow area for shorter windows. Native accessibility clicks in emulation sometimes reported offscreen; clicking the visible control verified Golden hour successfully.
- Save image successfully downloads an English-named PNG. The exported Blue Reverie and Wild River images were retained and the green image was visually inspected. The PNG contains only the rendered scene, including clouds and birds.
- Browser console inspected: no application or shader errors observed. The only error shown came from an installed browser extension's `autoPip.js` (unsupported MediaSession action), independent of the project.
- Geometry/material ownership reviewed: atmosphere resources dispose once, the swan rig reuses authored geometry, and existing world teardown also disposes the new atmosphere.

Screenshots and image exports are in ignored `artifacts/`, outside the committed source. The build reports a bundle-size advisory (Three.js is the principal dependency); it is not a build error.

## Original scene — 2026-10-27

The original version passed type/build and motion/GLB tests, desktop interaction and PNG export checks, and a 390 × 844 browser-emulation review. Visual fixes covered exposed straight terrain boundaries, cropped tree crowns, grass density, palette balance and obsolete Three.js shadow settings. The back/forward-cache teardown guard was reviewed in code.

## Not covered

Physical-phone GPU performance, power use, Safari on hardware and a dedicated back/forward-cache restoration test remain unmeasured. The scene is an artistic model, without fluid dynamics, skeletal neck animation or surveyed location data.

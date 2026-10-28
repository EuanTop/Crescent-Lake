# Validation

## Social-video artwork — 2026-10-28 (v0.4)

- Reused the user’s existing `127.0.0.1:5173` server; no additional dev server was started. Arc native UI confirmed in-panel Portrait 9:16, music controls, 15-second duration, MP4 export and 100% motion defaults.
- The page fits its viewport without scrolling. All visual review uses the 9:16 artwork. Legacy `/review.html` redirects to the main page, with no review iframe or engineering labels.
- An actual browser-generated 15.002-second MP4 was downloaded and inspected with ffprobe/ffmpeg: H.264 video, 1080 × 1920, approximately29.5–29.9 actual frames/second, AAC stereo48kHz. Full audio decode passed, with non-silent audio and no clipping (initial sample peak−17.5dBFS). Later15.000- and15.006-second samples verify the final lake-wide water treatment, early music entries and continuous legato. The latter has29.94fps H.264, AAC stereo, audio peak−19.4dBFS and mean−32.2dBFS. A decoded video frame verifies artwork title, seasonal note, footer line and clean canvas without controls.
- Cel swan masking and self-shadow changes render successfully. Mirror-water treatment combines broad reflection swells with soft lake-wide, organically curved wavefronts. The original bold bands, dense fine texture and local Wi-Fi-like arc packets were rejected and removed.
- Thirty-five automated tests cover real GLB route bounds in portrait, increased upper-left bank coverage, mask state restoration on success and failure, 0–200% motion continuity/bounds, generated music score and lazy initialization, encoder fallback/final chunks/errors/cancellation, and cloned audio-track cleanup.
- Recording hides the panel and toggle, bakes authored typography into the exported canvas, restores prior pause state/resolution, and fades included music over the selected final two seconds. Capture is real time, so slower hardware may produce a lower frame rate.

## Portrait visual languages — 2026-10-28

- All later visual review uses a live 9:16 iframe viewport in `/review.html`; narrow-screen artwork also uses 9:16. No horizontal scene comparison is used for the final six-style review.
- Six shader treatments and Original were selected through Arc's native UI on the same paused frame, Blue Reverie palette, 65% effect strength. Seven actual canvas PNG downloads were retained. All are 843 × 1499 (the one-pixel aspect rounding is from the canvas size).
- The six exports were visually inspected: Cel Illustration, Watercolor, Risograph, Copperplate, Pixel Story and Cyanotype. Swan, reflection and persistent wake render in each; near and inland grass have continuous coverage. Pixel Story intentionally reduces spatial detail to hard pixel blocks.
- The initially prototyped Kuwahara treatment was rejected by the user for blurring and removed. Final alternatives do not spatially average colors; neighborhood reads extract edges only, and Original bypasses post-processing.
- Real rendering exposed and fixed two shader-compiler issues that TypeScript cannot detect: the reserved GLSL token `patch` in water and a `luminance` function collision with Three.js. The successful exports verify the corrected water and common style program render. A shader-error callback now reports failures instead of treating a partial frame as ready.
- Wind phase and 22-second wake behavior have ten passing automated tests in total, including readable 10–15-second marks, smooth expiration, whole-lifetime capacity, historical headings through turns, zero-wind freezing and phase continuity on slider changes.
- Production build includes both the main page and portrait review page. Runtime presets retain all three color stories. PNG filenames identify the chosen filter.
- Arc extension control was unstable, and its viewport override did not complete. Final review continued through Arc's native UI using the fixed portrait iframe; no alternate browser was used. Exports are in ignored `artifacts/`, along with a self-contained `filter-comparison.html`.

## Living landscape — 2026-10-28 (v0.2 history)

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

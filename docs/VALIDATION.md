# Validation

## Wake shape restoration — 2026-10-28 (v0.5.1)

- The initial fast-loop fix scaled fade alone; its0.4-second emission cadence left widely separated small arcs at the new speed. Restored the accepted spatial design by scaling the full wake clock:215 emissions per24-second lap, approximately0.11163seconds between emissions and3.5833× expansion/fade. Around55 overlapping marks retain the earlier fan form and5.3-world-unit trailing reach. Wind waves, palette, route speed, lighting, typography and music are unchanged.
- Preview and capture now both sample the exact route on a fixed emission grid, independent of rendered frame rate. Birth time, shader radius/width, fade and historical heading agree. Prewarming and the integer number of emissions close the trail at the film seam.
- Arc on the existing5173 server recorded a new1080×1920 portrait clip. Extracted0/6/12/23.93-second frames confirm dense fan-shaped arcs and soft fading through the light cycle. Final `artifacts/crescent-lake-restored-wake-24s.mp4` is24.003933seconds,H.264 with stereo AAC, using the retained original24-second WAV and no video re-encoding. The prior delivered clip remains available for comparison.
- Added regression checks for spatial density, full-clock expansion/fade agreement and identical prewarmed trail states across24-second cycles. All60tests and the production build pass.

## Twenty-four-second closed film — 2026-10-28 (v0.5)

- Reused the existing5173 server and Arc native UI, with Portrait9:16, Cel Illustration, Soft Sage,100% wind/activity, clouds, birds, music, full-circuit loop and light journey enabled. No additional server was started.
- Actual browser recording is23.999375seconds,1080×1920 H.264 at approximately30fps, with48kHz stereo AAC. Decoded0/2/6/12/18/23.93-second portrait frames verify one complete swan circuit, visible wing opening, changed tree crowns, passing cloud/bird positions and Morning→Golden→Morning. The full model remains inside the portrait throughout. Captured frames contain authored titles and no settings or engineering labels.
- Reviewing the first capture revealed a nearly complete ring of22-second wakes after increasing swim speed. The final faster scene uses a6.72-second fade window; the retained final frames show a trailing ribbon instead. Fixed-grid prewarming closes the history at the seam.
- Browser AAC had40–49ms of initial digital silence even after audio pre-roll. The final deliverable copies that recorded video and replaces audio from the exact24-second float32 stereo WAV, encoded with FFmpeg AAC priming metadata. Final MP4 duration is24.000000seconds,24,897,960bytes. Video is copied without re-encoding. The browser original is preserved separately.
- The WAV contains1,152,000frames at48kHz. First and last samples are exactly equal in each channel. Full final MP4 audio decode is24seconds, begins audibly at sample0, peaks at−17.49dBFS and has no ending fade. First/last20ms RMS levels are−35.51/−34.37dBFS. Stereo energy favors left by2.16dB at1–3seconds, right by1.38dB at5–7seconds and left by2.57dB at9–11seconds. These checks establish signal continuity and spatial motion, not subjective musical quality.
- Automated checks cover24-second route closure at24/30/60/120fps; light/pose/wind closure; seam velocity; tree root anchors and bounds; visible intermittent wing bursts; periodic score structure; PCM endpoint correction; float WAV headers/samples; prepare/play/cache/cancel/dispose lifecycle. All58 tests and the production build pass after final source review; only the existing Three.js bundle-size advisory remains.
- Friendly artifacts are in ignored `artifacts/`: `crescent-lake-loop-24s.mp4`, `crescent-lake-loop-24s.wav`, `lake-loop-24s.mp3`, six portrait frames and `loop-metadata.json`. The earlier17-second one-way light journey is retained as history.

## Seventeen-second light journey —2026-10-28(v0.4.1)

- Reused5173 and Arc native UI; actual portrait export is17.003867seconds,1080×1920 H.264 at29.95fps with stereo48kHz AAC. File size17,429,094bytes.
- Decoded frames at0.5,8and15.5seconds confirm the new locally loaded typeface and smooth Morning-to-Golden progression; the first and final labels and lighting agree. No controls, browser chrome or engineering labels are in the captured artwork.
- Full audio decode succeeds with peak−18.68dBFS. Exported left/right energy favors the left by2.31dB at1–3seconds, the right by2.03dB at4–6seconds, then left by3.65dB at9–11seconds. The channels differ and the intended return motion survives encoding.
- The reed was removed; score and synth tests cover low bass register, root/fifth harmonic fit, exact6/8 timing, rests and centering, alongside continuous lead envelopes and stereo curves.
  -46automated tests and production build pass. Golden color tests cover all3palettes; actual Morning/Golden Sage PNGs were compared in the same paused portrait composition. Soft roots and lower speckle contrast render correctly. Segmented translucent water is verified in the recorded clip.
- The17-second journey follows real capture time, holds Morning for3seconds, eases to Golden over10seconds and settles for4seconds. Completion restores the prior preview light and pause state.

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

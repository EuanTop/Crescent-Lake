# Validation

## Automated

```sh
npm test
npm run build
```

The suite has 77 tests, including real FFmpeg fixtures when FFmpeg is available. Coverage includes:

- Actual GLB structure, portrait route bounds and attached wing articulation.
- 24-second route, pose, light and wind closure; pause and strength controls.
- Dense world-space fan wakes and historical headings through turns.
- Continuous melody, score timing, stereo motion and PCM loop endpoints.
- Exact frame scheduling, capture codec fallback, cancellation and resource cleanup.
- Lossless RGB/PCM identity, upload ordering, limits, same-origin checks and completed-file persistence.

CI installs FFmpeg and runs the tests and production build on Node.js 22. The Three.js bundle-size advisory is informational.

## Render and export check — 2026-10-28

A real 9:16 export was produced in the built-in browser at 2160 × 3840, 30 fps and 24 seconds. Its 720 decoded RGBA frame hashes matched all 720 source-render hashes exactly. The FFV1 RGB master contained a 48 kHz stereo float PCM track with equal endpoint samples and a peak of −17.49 dBFS. A separate H.264/AAC share copy had the same dimensions, frame rate and duration.

Visual review covered the complete route, Morning → Golden Hour → Morning, sudden wing-shaking bouts, the continuous fan wake, moving shore vegetation and clean artwork-only typography. Exported controls and engineering labels were absent.

Generated media, hashes and detailed measurement files remain under Git-ignored `artifacts/`. The README preview is a curated 540 × 960 WebP, not a video master.

## Limits

Physical-phone performance, power consumption and hardware Safari behavior have not been measured. Real-time browser capture can drop frames on slower devices; the local lossless path advances by exact film-frame time instead.

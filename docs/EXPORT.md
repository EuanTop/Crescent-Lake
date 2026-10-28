# Local video export

## Choose a deliverable

| Quality | Portrait size | Video / audio | Use |
| --- | --- | --- | --- |
|4K lossless master + MP4|2160×3840,30fps|FFV1 RGB / float32 PCM in MKV; separate H.264 / AAC MP4|Archival master and finished share copy|
|4K high quality|2160×3840|Browser H.264/VP9 with80Mbps target;256kbps audio|Faster direct capture|
|HD|1080×1920|Browser24Mbps target;256kbps audio|Smaller quick exports|

The default local master lasts24seconds and contains720exact film frames. It renders the scene, silhouette pass, typography and reflection at native4K. A2× render ratio preserves the authored ink proportions. There is no upscaling of an earlier1080p video.

FFV1 uses RGB (`bgr0`) without chroma subsampling. The final artwork canvas is opaque RGBA8; all decoded RGB values are preserved exactly. The PCM soundtrack retains every original float sample. The separate MP4 uses CRF16 H.264, an explicit RGB-to-BT709 conversion with4:2:0 chroma, and256kbps AAC; it is high quality but is not labeled lossless. Social services can compress that copy again after upload.

## Local requirements and behavior

Run the existing project with `npm run dev`, using its same127.0.0.1:5173 address. FFmpeg must be on PATH and include FFV1, libx264, PCMfloat and AAC encoders. An older running Vite server must restart once to load the new plugin. The current task server was restarted on5173; no alternate port is needed.

The optional local middleware is loaded only during development. It allows loopback clients with the exact same Origin, bounds supported dimensions and body sizes, accepts one contiguous frame sequence, and streams into FFmpeg with backpressure. It retains no PNG sequence or growing browser frame-blob collection. It checks disk reserve and timeouts, cleans incomplete task-owned exports on cancellation/shutdown, and keeps completed exports with their input-frame hash manifest. A static production build disables the local master option and retains normal video export.

Rendering takes longer than24seconds because quality is independent of playback speed. Controls stay out of the artwork and are locked during export. Escape cancels. At completion, the panel provides **Download lossless master** and **Download4K MP4** links. The actual files already exist under `artifacts/exports/<random-id>/`; downloading is optional for local viewing.

Direct browser capture uses bitrate hints, which browsers may vary. Master export renders exactly at `frameIndex/30`, so a slower computer cannot skip film frames. Prepared audio is muxed directly instead of recording a live audio stream.

## Verified delivered files —2026-10-28

- `artifacts/crescent-lake-4k-lossless.mkv`:1,750,974,990bytes;2160×3840;720frames;30fps;24.000000seconds;FFV1 RGB full-range plus48kHz stereo PCMfloat.
- `artifacts/crescent-lake-4k.mp4`:101,486,776bytes;2160×3840;30fps;24.000000seconds;H.264/AAC stereo.
- These friendly paths are hard links to the completed export, so they do not duplicate large file data.
- Each of720decodedRGBA frame hashes matches its source render hash exactly. The PCM track contains1,152,000stereo frames, and both channels have equal first/last samples; peak−17.49dBFS. Evidence is in `artifacts/4k-validation.json`, `artifacts/master-framehash.txt` and the export manifest.

FFV1 is defined in the [official FFmpeg specification](https://github.com/FFmpeg/FFV1). Bitrate-hint limitations are described by [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/videoBitsPerSecond).

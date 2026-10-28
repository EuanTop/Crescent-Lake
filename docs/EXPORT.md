# Export

| Quality | Portrait size | Encoding |
| --- | --- | --- |
| Lossless master + MP4 | 2160 × 3840 · 30 fps | FFV1 RGB / float PCM, plus H.264 / AAC share copy |
| 4K high quality | 2160 × 3840 | Browser video, 80 Mbps target |
| HD | 1080 × 1920 | Browser video, 24 Mbps target |

## Lossless master

Run `npm run dev` with FFmpeg on PATH. The local exporter requires FFV1, libx264, PCM float and AAC encoders. Restart an older running development server once after adding this feature.

Select **4K lossless master + MP4** in the settings panel. All 720 frames of the 24-second loop render at native 4K, including reflections, post-processing and typography. Frames stream individually to FFmpeg; output timing does not depend on playback speed. Rendering can take several minutes.

The MKV master preserves the opaque canvas RGB values without chroma subsampling and retains the original float PCM. The separate MP4 uses CRF 16 H.264, BT.709 conversion and 256 kbps AAC. It is a share copy, not lossless.

Files are saved to `artifacts/exports/<id>/`, alongside a source-frame hash manifest. At completion, the panel offers download links for both files. Controls are excluded from the artwork. Escape cancels and removes incomplete output; completed files remain.

The development middleware accepts only loopback, same-origin requests, enforces bounded profiles and ordered frames, and checks disk reserve and timeouts. No media is uploaded to an external service. The static build disables this local feature and retains browser capture.

## Direct browser video

HD and 4K modes use MediaRecorder with bitrate targets rather than guaranteed bitrates. Keep the page visible during capture; leaving it finalizes a partial clip. Actual frame rate depends on the device. The local master path avoids this limitation.

Generated exports, audio and measurement data are ignored by Git. Do not commit them; README illustrations belong in `docs/images/`.

[FFV1 specification](https://github.com/FFmpeg/FFV1) · [MediaRecorder bitrate behavior](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/videoBitsPerSecond)

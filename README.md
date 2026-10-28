<h1 align="center">Crescent Lake</h1>

<p align="center">A quiet lake, drawn in code.</p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a> · <a href="https://www.behance.net/gallery/257725777/Crescent-Lake">Behance</a>
</p>

<p align="center">
  <a href="https://github.com/EuanTop/Crescent-Lake/actions/workflows/ci.yml"><img src="https://github.com/EuanTop/Crescent-Lake/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-708565.svg" alt="License: MIT"></a>
</p>

<p align="center">
  <img src="docs/images/crescent-lake.webp" width="360" alt="A white swan leaving a delicate fan of ripples beside a grassy shore.">
</p>

An interactive WebGL artwork with a swimming swan, a wind-swept shore and original generative music. Built with **Three.js, TypeScript, GLSL and Web Audio**.

- A 24-second loop: Morning → Golden Hour → Morning.
- Procedural grass, drifting clouds, birds, reflections and persistent wakes.
- Three palettes, six shader styles and a collapsible settings panel.
- Native 4K video and frame-accurate, lossless RGB/PCM masters.

## Run

Requires **Node.js 22.12+** and a **WebGL 2** browser.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`. The artwork starts in 9:16 portrait mode. Open **=** for controls; music starts on request.

```sh
npm test
npm run build
```

## Export

| Output | Portrait size | Format |
| --- | --- | --- |
| Lossless master | 2160 × 3840 · 30 fps | FFV1 RGB + PCM · MKV |
| 4K video | 2160 × 3840 · 30 fps | H.264 + AAC · MP4 |
| HD video | 1080 × 1920 | Browser MP4 / WebM |

Lossless export requires **FFmpeg on PATH** and the local development server. It renders every frame, then creates a master and a share copy. Controls are excluded. Outputs stay in the Git-ignored `artifacts/` directory; the repository includes only a small README preview.

## More

[Export guide](docs/EXPORT.md) · [Rendering](docs/PAINTERLY.md) · [Sound](docs/SOUND-DESIGN.md) · [Contributing](CONTRIBUTING.md)

[Recreate this artwork](docs/prompts/recreate-crescent-lake.md).

## License

[MIT](LICENSE) for project code and original scene assets. Goudy Bookletter 1911 retains its [upstream font notices](public/fonts/OFL.txt). See [third-party notices](THIRD_PARTY_NOTICES.md).

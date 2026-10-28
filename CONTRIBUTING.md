# Contributing

1. Use Node.js 22.12+ and run `npm ci`.
2. Make a focused change, then run `npm test` and `npm run build`.
3. Check visual changes in **9:16 portrait**, including the complete 24-second loop.
4. Describe the resulting behavior and include a small screenshot when relevant.

Keep exports, recordings, generated frame sequences and validation data in `artifacts/`. Do not commit them, credentials, `node_modules/` or `dist/`.

Preserve deterministic motion, seamless light/audio timing and the swan's attached wing geometry. Retain licenses for any added assets. FFmpeg is needed for the lossless codec tests and local master export.

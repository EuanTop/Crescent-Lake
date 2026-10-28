import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import {
  LosslessExporter,
  ExportError,
  authorizeExportRequest,
  validateExportProfile,
  validateFloatWav,
} from "../scripts/lossless-export.ts";

const execute = promisify(execFile);
const tiny = { width: 8, height: 6, fps: 30, frames: 3, audio: false };
const stream = (bytes: Uint8Array) => Readable.from([bytes]);
const rejectsStatus = (status: number) => (error: unknown) => error instanceof ExportError && error.status === status;

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "crescent-lossless-test-"));
  const exporter = new LosslessExporter({ rootDir: root, tinyFixtures: true, minimumFreeBytes: 0 });
  t.after(async () => { await exporter.close(); await rm(root, { recursive: true, force: true }); });
  const status = await exporter.status();
  if (!status.available) { t.skip(status.reason); return null; }
  return { root, exporter };
}
function floatWav(seconds: number, sampleRate = 48000) {
  const samples = Math.round(seconds * sampleRate);
  const pcm = Buffer.alloc(samples * 2 * 4);
  for (let i = 0; i < samples; i++) {
    pcm.writeFloatLE(Math.sin(i * 0.17) * 0.13, i * 8);
    pcm.writeFloatLE(Math.cos(i * 0.13) * 0.08, i * 8 + 4);
  }
  const bytes = Buffer.alloc(44 + pcm.length);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVE", 8);
  bytes.write("fmt ", 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(3, 20);
  bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 8, 28);
  bytes.writeUInt16LE(8, 32); bytes.writeUInt16LE(32, 34); bytes.write("data", 36); bytes.writeUInt32LE(pcm.length, 40);
  pcm.copy(bytes, 44);
  return { bytes, pcm };
}
function rgba(frame: number) {
  const bytes = Buffer.alloc(tiny.width * tiny.height * 4);
  for (let pixel = 0; pixel < bytes.length / 4; pixel++) {
    bytes[pixel * 4] = (pixel * 31 + frame * 79) % 256;
    bytes[pixel * 4 + 1] = (pixel * 47 + frame * 17) % 256;
    bytes[pixel * 4 + 2] = (pixel * 11 + frame * 137) % 256;
    bytes[pixel * 4 + 3] = 255; // The fully painted browser artwork is opaque RGBA.
  }
  return bytes;
}
async function probe(path: string) {
  const result = await execute("ffprobe", ["-v", "error", "-show_streams", "-of", "json", path], { maxBuffer: 1024 * 1024 });
  return JSON.parse(result.stdout);
}

test("real FFV1 master preserves every input RGB byte and float audio sample; share has explicit BT709 YUV and AAC", async (t) => {
  const setup = await fixture(t); if (!setup) return;
  const { root, exporter } = setup;
  const profile = { ...tiny, audio: true };
  const { id } = await exporter.start(profile);
  const frames = [rgba(0), rgba(1), rgba(2)];
  for (let index = 0; index < frames.length; index++) {
    // Chunk boundaries intentionally disagree with pixel rows and channels.
    assert.deepEqual(await exporter.frame(id, index, Readable.from([frames[index].subarray(0, 37), frames[index].subarray(37)])), { ok: true });
  }
  const audio = floatWav(profile.frames / profile.fps);
  assert.deepEqual(await exporter.audio(id, stream(audio.bytes)), { ok: true });
  const result = await exporter.finish(id);
  assert.match(result.masterUrl, new RegExp(`/file/${id}/master$`));
  assert.match(result.shareUrl, new RegExp(`/file/${id}/share$`));
  const master = await exporter.file(id, "master");
  const share = await exporter.file(id, "share");
  assert.ok(master.size > 0 && share.size > 0);
  assert.equal(master.name, result.masterName);
  assert.equal(share.name, result.shareName);
  const masterInfo = await probe(master.path);
  const masterVideo = masterInfo.streams.find((item: { codec_type: string }) => item.codec_type === "video");
  const masterAudio = masterInfo.streams.find((item: { codec_type: string }) => item.codec_type === "audio");
  assert.equal(masterVideo.codec_name, "ffv1");
  assert.equal(masterVideo.pix_fmt, "bgr0", "master must retain RGB, without YUV chroma subsampling");
  assert.equal(masterVideo.color_range, "pc");
  assert.equal(masterAudio.codec_name, "pcm_f32le");
  assert.equal(masterAudio.channels, 2);
  const decoded = await execute("ffmpeg", ["-v", "error", "-i", master.path, "-map", "0:v:0", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { encoding: "buffer", maxBuffer: 1024 * 1024 });
  assert.deepEqual(decoded.stdout, Buffer.concat(frames), "decoded master pixels must equal the original opaque RGBA frames byte for byte");
  const decodedAudio = await execute("ffmpeg", ["-v", "error", "-i", master.path, "-map", "0:a:0", "-f", "f32le", "-c:a", "pcm_f32le", "pipe:1"], { encoding: "buffer", maxBuffer: 1024 * 1024 });
  assert.deepEqual(decodedAudio.stdout, audio.pcm, "master audio must preserve the exact float32 samples");
  const shareInfo = await probe(share.path);
  const shareVideo = shareInfo.streams.find((item: { codec_type: string }) => item.codec_type === "video");
  assert.equal(shareVideo.codec_name, "h264");
  assert.equal(shareVideo.pix_fmt, "yuv420p");
  assert.equal(shareVideo.color_space, "bt709");
  assert.equal(shareVideo.color_range, "tv");
  assert.equal(shareInfo.streams.find((item: { codec_type: string }) => item.codec_type === "audio").codec_name, "aac");
  const manifest = JSON.parse(await readFile(join(root, id, "manifest.json"), "utf8"));
  assert.equal(manifest.completed, true);
  assert.deepEqual(manifest.profile, profile);
  assert.deepEqual(manifest.frameHashes, frames.map((bytes, index) => ({ index, sha256: createHash("sha256").update(bytes).digest("hex") })));
  await exporter.cancel(id);
  assert.ok((await stat(master.path)).isFile(), "deleting a completed session must retain completed artifacts");
  await exporter.close();
  const reopened = new LosslessExporter({ rootDir: root, tinyFixtures: true, minimumFreeBytes: 0 });
  assert.equal((await reopened.file(id, "master")).path, master.path, "completed download URLs survive dev-server restart");
  await reopened.close();
});

test("video-only export finishes without audio and rejects an unrequested audio upload", async (t) => {
  const setup = await fixture(t); if (!setup) return;
  const { exporter } = setup;
  const { id } = await exporter.start({ ...tiny, frames: 1 });
  await assert.rejects(exporter.audio(id, stream(floatWav(1 / 30).bytes)), rejectsStatus(409));
  await exporter.frame(id, 0, stream(rgba(0)));
  await exporter.finish(id);
  const info = await probe((await exporter.file(id, "master")).path);
  assert.equal(info.streams.filter((item: { codec_type: string }) => item.codec_type === "audio").length, 0);
});

test("only one session runs, frames are contiguous, and malformed frames remove only incomplete owned files", async (t) => {
  const setup = await fixture(t); if (!setup) return;
  const { root, exporter } = setup;
  const sentinel = join(root, "keep-this-unrelated-file.txt");
  await writeFile(sentinel, "keep");
  const { id } = await exporter.start(tiny);
  await assert.rejects(exporter.start(tiny), rejectsStatus(409));
  await assert.rejects(exporter.frame(id, 1, stream(rgba(1))), rejectsStatus(409));
  await assert.rejects(exporter.finish(id), rejectsStatus(409));
  await exporter.frame(id, 0, stream(rgba(0)));
  await assert.rejects(exporter.frame(id, 0, stream(rgba(0))), rejectsStatus(409));
  await assert.rejects(exporter.frame(id, 1, stream(Buffer.alloc(7))), rejectsStatus(400));
  await assert.rejects(stat(join(root, id)), { code: "ENOENT" });
  assert.equal(await readFile(sentinel, "utf8"), "keep");
  const second = await exporter.start(tiny);
  await assert.rejects(exporter.frame(second.id, 0, stream(Buffer.alloc(tiny.width * tiny.height * 4 + 1))), rejectsStatus(413));
  await assert.rejects(stat(join(root, second.id)), { code: "ENOENT" });
});

test("concurrent uploads cannot interleave bytes, and cancellation/server close clean only incomplete sessions", async (t) => {
  const setup = await fixture(t); if (!setup) return;
  const { root, exporter } = setup;
  const { id } = await exporter.start(tiny);
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const source = async function* () { yield rgba(0).subarray(0, 80); enter(); await barrier; yield rgba(0).subarray(80); };
  const first = exporter.frame(id, 0, source());
  await entered;
  await assert.rejects(exporter.frame(id, 0, stream(rgba(0))), rejectsStatus(409));
  release(); await first;
  assert.deepEqual(await exporter.cancel(id), { ok: true });
  await assert.rejects(stat(join(root, id)), { code: "ENOENT" });
  const next = await exporter.start(tiny);
  await exporter.close();
  await assert.rejects(stat(join(root, next.id)), { code: "ENOENT" });
  await assert.rejects(exporter.start(tiny), rejectsStatus(503));
});

test("public profiles remain strictly bounded while the lower-level fixture path accepts tiny even dimensions", () => {
  for (const [width, height] of [[1080, 1920], [1920, 1080], [2160, 3840], [3840, 2160]]) {
    assert.equal(validateExportProfile({ width, height, fps: 30, frames: 720, audio: true }).width, width);
  }
  assert.throws(() => validateExportProfile(tiny), rejectsStatus(400));
  assert.deepEqual(validateExportProfile(tiny, true), tiny);
  for (const change of [{ width: 4096 }, { height: -1 }, { width: 9 }, { frames: 0 }, { frames: 1801 }, { fps: 60 }, { audio: "yes" }, { command: "arbitrary" }]) {
    assert.throws(() => validateExportProfile({ ...tiny, ...change }, true), rejectsStatus(400));
  }
});

test("audio rejects wrong magic, integer PCM, non-finite samples and mismatched duration", () => {
  const valid = floatWav(0.1).bytes;
  assert.equal(validateFloatWav(valid, 0.1).channels, 2);
  const badMagic = Buffer.from(valid); badMagic.write("RIFF", 8);
  const integer = Buffer.from(valid); integer.writeUInt16LE(1, 20);
  const notFinite = Buffer.from(valid); notFinite.writeFloatLE(NaN, 44);
  const truncated = valid.subarray(0, valid.length - 1);
  for (const bytes of [badMagic, integer, notFinite, truncated]) assert.throws(() => validateFloatWav(bytes, 0.1), rejectsStatus(400));
  assert.throws(() => validateFloatWav(valid, 1), rejectsStatus(400));
});

function request(method: string, headers: Record<string, string>, remote = "127.0.0.1") {
  return { method, headers, socket: { remoteAddress: remote } } as Pick<IncomingMessage, "headers" | "method" | "socket">;
}
test("origin and loopback checks reject cross-site mutations and DNS rebinding, while local status needs no Origin", () => {
  assert.equal(authorizeExportRequest(request("GET", { host: "127.0.0.1:5173" })), "http://127.0.0.1:5173");
  assert.equal(authorizeExportRequest(request("POST", { host: "localhost:5173", origin: "http://localhost:5173" })), "http://localhost:5173");
  assert.equal(authorizeExportRequest(request("DELETE", { host: "[::1]:5173", origin: "http://[::1]:5173" }, "::1")), "http://[::1]:5173");
  for (const candidate of [
    request("POST", { host: "127.0.0.1:5173" }),
    request("POST", { host: "127.0.0.1:5173", origin: "http://evil.example" }),
    request("POST", { host: "127.0.0.1:5173", origin: "http://127.0.0.1:5174" }),
    request("GET", { host: "evil.example:5173" }),
    request("GET", { host: "127.0.0.1:5173", "sec-fetch-site": "cross-site" }),
    request("GET", { host: "127.0.0.1:5173" }, "192.168.1.20"),
    request("GET", { host: "127.0.0.1:99999" }),
  ]) assert.throws(() => authorizeExportRequest(candidate), rejectsStatus(403));
});

test("missing FFmpeg is reported as unavailable with a useful reason instead of an unhandled spawn error", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "crescent-missing-ffmpeg-"));
  const exporter = new LosslessExporter({ rootDir: root, ffmpegPath: join(root, "not-installed-ffmpeg"), tinyFixtures: true });
  t.after(async () => { await exporter.close(); await rm(root, { recursive: true, force: true }); });
  const status = await exporter.status();
  assert.equal(status.available, false);
  assert.match(status.reason!, /FFmpeg.*(?:PATH|available)/);
  await assert.rejects(exporter.start(tiny), rejectsStatus(503));
});

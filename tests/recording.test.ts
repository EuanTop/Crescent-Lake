import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import { createVideoRecorder } from "../src/scene/recording.ts";

/** Test the browser lifecycle and failures without pretending mock bytes prove
 * codec/playback support. The shipped app's short recording is checked in Arc.
 */
function browser(t: TestContext) {
  const downloads: { href: string; name: string }[] = [];
  const blobs = new Map<string, Blob>();
  const revoked: string[] = [];
  const requestedRates: number[] = [];
  const delays: number[] = [];
  const tracks: { stopped: number; stop(): void }[] = [];
  let now = 1000;
  class FakeDocument extends EventTarget {
    hidden = false;
    body = { append() {} };
    createElement() {
      const link = {
        href: "", download: "", hidden: false,
        click() { downloads.push({ href: link.href, name: link.download }); },
        remove() {},
      };
      return link;
    }
  }
  const document = new FakeDocument();
  class FakeRecorder {
    static allowed = new Set(["video/mp4", "video/webm;codecs=vp9"]);
    static failStart = new Set<string>();
    static empty = false;
    static instances: FakeRecorder[] = [];
    static isTypeSupported(mime: string) { return FakeRecorder.allowed.has(mime); }
    mimeType: string;
    state = "inactive";
    stopCount = 0;
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    constructor(_stream: unknown, options: { mimeType: string }) {
      this.mimeType = options.mimeType;
      FakeRecorder.instances.push(this);
    }
    start(timeslice: number) {
      assert.equal(timeslice, 250);
      if (FakeRecorder.failStart.has(this.mimeType)) throw new Error("encoder unavailable");
      this.state = "recording";
    }
    stop() {
      this.stopCount++;
      this.state = "inactive";
      queueMicrotask(() => {
        const data = new Blob(FakeRecorder.empty ? [] : [new Uint8Array([1, 2, 3, 4])], { type: this.mimeType });
        this.ondataavailable?.({ data });
        this.onstop?.();
      });
    }
    fail() {
      this.onerror?.(Object.assign(new Event("error"), { error: new DOMException("encoding failed") }));
    }
  }
  const canvas = {
    width: 1080, height: 1920,
    captureStream(rate: number) {
      requestedRates.push(rate);
      const track = { stopped: 0, stop() { this.stopped++; } };
      tracks.push(track);
      const capturedTracks = [track];
      return {
        getTracks: () => capturedTracks,
        getVideoTracks: () => [track],
        addTrack(audioTrack: typeof track) {
          capturedTracks.push(audioTrack);
          tracks.push(audioTrack);
        },
      };
    },
  };
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldRecorder = Object.getOwnPropertyDescriptor(globalThis, "MediaRecorder");
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: FakeRecorder });
  t.after(() => {
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (oldRecorder) Object.defineProperty(globalThis, "MediaRecorder", oldRecorder);
    else Reflect.deleteProperty(globalThis, "MediaRecorder");
  });
  t.mock.method(performance, "now", () => now);
  t.mock.method(URL, "createObjectURL", (blob: Blob) => {
    const url = `blob:test-${blobs.size}`;
    blobs.set(url, blob);
    return url;
  });
  t.mock.method(URL, "revokeObjectURL", (url: string) => { revoked.push(url); });
  const realTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", ((handler: (...args: unknown[]) => void, delay: number, ...args: unknown[]) => {
    delays.push(delay);
    return realTimeout(handler, delay, ...args);
  }) as typeof setTimeout);
  return {
    canvas: canvas as unknown as HTMLCanvasElement,
    document, Recorder: FakeRecorder, downloads, blobs, revoked, requestedRates, delays, tracks,
    setNow(value: number) { now = value; },
  };
}

test("MP4 is preferred, a manual stop waits for the final chunk and download handoff, and all resources close", async (t) => {
  const env = browser(t);
  const states: { state: string; elapsed: number }[] = [];
  const recorder = createVideoRecorder(env.canvas, { onState: (state, elapsed) => states.push({ state, elapsed }) });
  assert.equal(recorder.supported, true);
  assert.equal(recorder.format, "MP4");
  recorder.stop();
  let settled = false;
  const pending = recorder.start(1, "湖面.webm").then(() => { settled = true; });
  assert.equal(recorder.active, true);
  assert.deepEqual(env.requestedRates, [30]);
  assert.ok(env.delays.includes(5000), "short duration is clamped to 5 seconds");
  await assert.rejects(recorder.start(10, "second"), /already being recorded or saved/);
  env.setNow(2400);
  recorder.stop();
  recorder.stop();
  assert.equal(settled, false);
  assert.equal(recorder.active, true);
  await wait(0);
  assert.equal(env.downloads[0].name, "湖面.mp4");
  assert.ok(env.blobs.get(env.downloads[0].href)!.size > 0);
  assert.equal(settled, false, "do not resolve before the download acquires the blob");
  await pending;
  assert.equal(recorder.active, false);
  assert.equal(env.Recorder.instances[0].stopCount, 1);
  assert.equal(env.tracks[0].stopped, 1);
  assert.deepEqual(env.revoked, [env.downloads[0].href]);
  assert.deepEqual(states.map(({ state }) => state), ["recording", "finalizing", "idle"]);
  assert.equal(states.at(-1)!.elapsed, 1.4);
  assert.equal(env.canvas.width, 1080);
  assert.equal(env.canvas.height, 1920);
  recorder.dispose();
});

test("an unavailable MP4 encoder falls back to VP9 with a true WebM filename and regular progress", async (t) => {
  const env = browser(t);
  env.Recorder.failStart.add("video/mp4");
  const states: string[] = [];
  const recorder = createVideoRecorder(env.canvas, { onState: (state) => states.push(state) });
  const pending = recorder.start(500, "clip.mp4");
  assert.equal(recorder.format, "WebM");
  assert.ok(env.delays.includes(60_000));
  env.setNow(1600);
  await wait(280);
  assert.ok(states.filter((state) => state === "recording").length >= 2);
  // Tab hiding finalizes the playable partial clip rather than recording a
  // background canvas frozen by the browser's animation throttling.
  env.document.hidden = true;
  env.document.dispatchEvent(new Event("visibilitychange"));
  await pending;
  assert.equal(env.downloads[0].name, "clip.webm");
  assert.match(env.blobs.get(env.downloads[0].href)!.type, /^video\/webm/);
  assert.equal(env.tracks[0].stopped, 1);
  assert.equal(recorder.active, false);
  recorder.dispose();
});

test("empty clips, encoder errors and disposal reject without downloads or surviving tracks", async (t) => {
  const env = browser(t);
  const recorder = createVideoRecorder(env.canvas);
  env.Recorder.empty = true;
  const empty = recorder.start(10, "empty");
  recorder.stop();
  await assert.rejects(empty, /No valid video was recorded/);
  assert.equal(env.downloads.length, 0);
  assert.equal(env.tracks[0].stopped, 1);

  env.Recorder.empty = false;
  const failed = recorder.start(10, "failed");
  env.Recorder.instances.at(-1)!.fail();
  await assert.rejects(failed, /encoding failed/);
  assert.equal(env.tracks[1].stopped, 1);
  assert.equal(recorder.active, false);

  const cancelled = recorder.start(10, "cancelled");
  recorder.dispose();
  recorder.dispose();
  await assert.rejects(cancelled, { name: "AbortError" });
  assert.equal(env.tracks[2].stopped, 1);
  assert.equal(env.downloads.length, 0);
  assert.equal(env.revoked.length, 0);
  assert.equal(recorder.supported, false);
  await assert.rejects(recorder.start(10, "closed"), /recorder is closed/);
});

test("no advertised video encoder disables recording without capturing the canvas", async (t) => {
  const env = browser(t);
  env.Recorder.allowed.clear();
  const recorder = createVideoRecorder(env.canvas);
  assert.equal(recorder.supported, false);
  assert.equal(recorder.format, "Unavailable");
  await assert.rejects(recorder.start(10, "unavailable"), /does not support/);
  assert.equal(env.requestedRates.length, 0);
  recorder.stop();
  recorder.dispose();
});

test("finishing or cancelling an audio recording stops only cloned music tracks", async (t) => {
  const env = browser(t);
  const clones: { stopped: number; stop(): void }[] = [];
  const original = {
    stopped: 0,
    stop() { this.stopped++; },
    clone() {
      const track = { stopped: 0, stop() { this.stopped++; } };
      clones.push(track);
      return track;
    },
  };
  const music = { getAudioTracks: () => [original] } as unknown as MediaStream;
  const recorder = createVideoRecorder(env.canvas);
  const completed = recorder.start(5, "with-music", music);
  assert.equal(clones.length, 1);
  assert.equal(env.tracks.length, 2, "capture includes one video track and one audio clone");
  assert.notEqual(env.tracks[1], original);
  recorder.stop();
  await completed;
  assert.equal(env.tracks[0].stopped, 1);
  assert.equal(clones[0].stopped, 1);
  assert.equal(original.stopped, 0, "finishing a clip must not stop live music");

  const cancelled = recorder.start(5, "cancel-with-music", music);
  recorder.dispose();
  await assert.rejects(cancelled, { name: "AbortError" });
  assert.equal(clones.length, 2);
  assert.ok(clones.every((track) => track.stopped === 1));
  assert.equal(env.tracks[2].stopped, 1);
  assert.equal(original.stopped, 0, "disposing the recorder must preserve the synthesizer's source track");
});

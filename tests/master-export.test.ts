import { test } from "node:test";
import assert from "node:assert/strict";
import { exportMasterFrames, masterAvailable } from "../src/scene/master-export.ts";

test("master capture uploads each uncompressed frame at exact film time, then finalizes", async t => {
  const requests: { url: string; options?: RequestInit }[] = [];
  const times: number[] = [];
  const progress: boolean[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    requests.push({ url: String(url), options });
    const body = String(url).endsWith("/start") ? { id: "sample" }
      : String(url).endsWith("/finish") ? { masterUrl: "/master", shareUrl: "/share" } : { ok: true };
    return Response.json(body);
  });
  const result = await exportMasterFrames({ width: 2, height: 3, duration: .1,
    signal: new AbortController().signal, audio: new Blob(["sound"]),
    render(time) { times.push(time); return new Uint8ClampedArray(24); },
    onProgress(_frame, _frames, finishing) { progress.push(finishing); },
  });
  assert.deepEqual(times, [0, 1 / 30, 2 / 30]);
  assert.deepEqual(requests.map(r => r.url), ["/__lake_export/start", "/__lake_export/sample/audio",
    "/__lake_export/sample/frame/0", "/__lake_export/sample/frame/1", "/__lake_export/sample/frame/2", "/__lake_export/sample/finish"]);
  assert.deepEqual(JSON.parse(requests[0].options!.body as string), { width: 2, height: 3, fps: 30, frames: 3, audio: true });
  assert.equal((requests[2].options!.body as ArrayBuffer).byteLength, 24);
  assert.deepEqual(progress, [false, false, false, true]);
  assert.equal(result.masterUrl, "/master");
});

test("cancellation and malformed pixels clean up the active master session", async t => {
  const controller = new AbortController();
  const requests: { url: string; options?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    requests.push({ url: String(url), options });
    return Response.json(String(url).endsWith("/start") ? { id: "cancel" } : { ok: true });
  });
  await assert.rejects(exportMasterFrames({ width: 2, height: 3, duration: .1, signal: controller.signal,
    render() { return new Uint8ClampedArray(24); },
    onProgress() { controller.abort(); },
  }), { name: "AbortError" });
  assert.equal(requests.filter(r => /\/frame\//.test(r.url)).length, 1);
  assert.equal(requests.at(-1)!.options!.method, "DELETE");
  assert.equal(requests.at(-1)!.options!.signal, undefined);
  await assert.rejects(exportMasterFrames({ width: 2, height: 3, duration: .1,
    signal: new AbortController().signal, render() { return new Uint8ClampedArray(4); }, onProgress() {},
  }), /unexpected size/);
  assert.equal(requests.at(-1)!.options!.method, "DELETE");
});

test("server errors are surfaced and unavailable local rendering fails capability checks", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Not enough free space." }, { status: 507 }));
  assert.equal(await masterAvailable(), false);
  await assert.rejects(exportMasterFrames({ width: 2, height: 3, duration: .1,
    signal: new AbortController().signal, render() { throw new Error("Should not render"); }, onProgress() {},
  }), /Not enough free space/);
});

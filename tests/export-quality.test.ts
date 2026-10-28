import { test } from "node:test";
import assert from "node:assert/strict";
import { videoQuality } from "../src/scene/export-quality.ts";

test("HD and 4K profiles use their requested canvas sizes, 30fps and independent bitrate targets", () => {
  assert.deepEqual(videoQuality("hd"), { width: 1080, height: 1920, fps: 30, videoBitsPerSecond: 24_000_000 });
  assert.deepEqual(videoQuality("4k"), { width: 2160, height: 3840, fps: 30, videoBitsPerSecond: 80_000_000 });
  assert.equal(videoQuality("4k").width * videoQuality("4k").height, 4 * videoQuality("hd").width * videoQuality("hd").height);
});

test("landscape swaps only dimensions and callers cannot mutate a future profile", () => {
  for (const quality of ["hd", "4k"] as const) {
    const portrait = videoQuality(quality, true);
    const landscape = videoQuality(quality, false);
    assert.deepEqual(landscape, { ...portrait, width: portrait.height, height: portrait.width });
    portrait.width = 1;
    assert.notEqual(videoQuality(quality).width, 1);
  }
});

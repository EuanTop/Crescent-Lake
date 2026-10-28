import { test } from "node:test";
import assert from "node:assert/strict";
import { Color, Vector3 } from "three";
import {
  GOLDEN_SUN,
  MORNING_SUN,
  goldenSurface,
  lightingAmount,
  softenGrassPalette,
  sunPosition,
} from "../src/scene/lighting.ts";

const luminance = (color: Color) =>
  color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;

test("Morning retains its exact source colors and sun while Golden Hour lowers the sun for longer shadows", () => {
  for (const source of [
    "#b6c58a",
    "#b4c6a6",
    "#bac681",
    "#e8e9d9",
    "#f0f0df",
    "#355c48",
    "#182f2b",
  ]) {
    const base = new Color(source);
    for (const illumination of [0, 0.3, 0.7, 1]) {
      const result = goldenSurface(base, 0, illumination);
      assert.deepEqual(result.toArray(), base.toArray());
      assert.equal(
        base.getHexString(),
        source.slice(1),
        "the cached source color must not be mutated",
      );
    }
  }
  assert.deepEqual(sunPosition(0).toArray(), [...MORNING_SUN]);
  assert.deepEqual(sunPosition(1).toArray(), [...GOLDEN_SUN]);
  const morning = sunPosition(0);
  const golden = sunPosition(1);
  const morningShadow = Math.hypot(morning.x, morning.z) / morning.y;
  const goldenShadow = Math.hypot(golden.x, golden.z) / golden.y;
  assert.ok(golden.y < morning.y * 0.5);
  assert.ok(
    goldenShadow > morningShadow * 3,
    "the sun direction must visibly lengthen ground shadows",
  );
  assert.ok(
    golden.x < 0 && golden.z > 0,
    "the sun stays on the authored side of the scene",
  );
});

test("all three shore palettes gain honey highlights without collapsing to one orange tint", () => {
  const bases = ["#b6c58a", "#b4c6a6", "#bac681"].map((hex) => new Color(hex));
  const golden = bases.map((base) => goldenSurface(base, 1, 0.91));
  golden.forEach((color, i) => {
    const base = bases[i];
    assert.ok(
      color.r > base.r * 1.2,
      "gold should add clearly visible red/yellow light",
    );
    assert.ok(color.b < base.b * 0.85);
    assert.ok(
      color.g >= base.g * 0.95,
      "the shore should retain fresh green light rather than turning brown",
    );
    assert.ok(color.g / color.r > 0.75, "avoid a saturated orange cast");
    assert.ok(color.toArray().every((channel) => channel >= 0 && channel <= 1));
  });
  const distance = (a: Color, b: Color) =>
    Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  assert.ok(
    distance(golden[0], golden[1]) > 0.08,
    "cooler Blue Reverie vegetation should stay distinct",
  );
  assert.ok(
    distance(golden[1], golden[2]) > 0.1,
    "lush green and cool gray-green should not share a flat grade",
  );
});

test("neutral swan and cloud colors become creamy ivory, with cooler shadow contrast", () => {
  for (const source of ["#e8e9d9", "#fff9e8", "#f0f0df"]) {
    const base = new Color(source);
    const lit = goldenSurface(base, 1, 0.91);
    const shadow = goldenSurface(base, 1, 0);
    assert.ok(lit.r >= lit.g && lit.g > lit.b);
    assert.ok(
      lit.g / lit.r > 0.85 && lit.b / lit.g > 0.68,
      "white feathers must stay ivory, not orange",
    );
    assert.ok(luminance(lit) > 0.7, "warm whites should remain luminous");
    assert.ok(luminance(shadow) < luminance(lit));
    assert.ok(
      shadow.b / shadow.r > lit.b / lit.r,
      "shadows keep a cooler undertone than the honey light",
    );
  }
  const dark = goldenSurface(new Color("#182f2b"), 1, 0);
  assert.ok(
    luminance(dark) < 0.04,
    "the dark eye/beak pigments should retain their contrast",
  );
});

test("warmth transitions interpolate continuously and restoring Morning cannot accumulate tint", () => {
  const base = new Color("#b6c58a");
  const source = base.toArray();
  const full = goldenSurface(base, 1, 0.91);
  const target = new Color();
  for (const amount of [0, 0.1, 0.5, 0.9, 1, 0.3, 0, 1, 0]) {
    goldenSurface(base, amount, 0.91, target);
    const expected = base.clone().lerp(full, amount);
    target
      .toArray()
      .forEach((channel, i) =>
        assert.ok(Math.abs(channel - expected.toArray()[i]) < 1e-12),
      );
    assert.deepEqual(base.toArray(), source);
    const position = sunPosition(amount);
    const expectedPosition = new Vector3(...MORNING_SUN).lerp(
      new Vector3(...GOLDEN_SUN),
      amount,
    );
    assert.ok(position.distanceTo(expectedPosition) < 1e-12);
  }
  assert.deepEqual(target.toArray(), source);
  for (const invalid of [NaN, Infinity, -Infinity, -1]) {
    assert.equal(lightingAmount(invalid), 0);
    assert.deepEqual(goldenSurface(base, invalid, 1).toArray(), source);
  }
  assert.equal(lightingAmount(20), 1);
});

test("soft grass lifts dark roots in every palette while keeping green identity and distinct tips", () => {
  const palettes = [
    ["#617f55", "#799563", "#a0b472", "#b6c58a"],
    ["#547969", "#73917b", "#9eb39a", "#b4c6a6"],
    ["#587b43", "#789350", "#a3b66a", "#bac681"],
  ];
  for (const palette of palettes) {
    const source = palette.map((hex) => new Color(hex));
    const original = source.map((color) => color.toArray());
    const soft = softenGrassPalette(source);
    const oldContrast = luminance(source[3]) / luminance(source[0]);
    const newContrast = luminance(soft[3]) / luminance(soft[0]);
    assert.ok(luminance(soft[0]) > luminance(source[0]) * 1.35);
    assert.ok(newContrast < oldContrast * 0.75);
    assert.ok(
      newContrast > 1.2,
      "grass should retain a readable root-to-tip gradient",
    );
    assert.ok(Math.abs(luminance(soft[3]) - luminance(source[3])) < 0.04);
    for (const color of soft) {
      assert.ok(
        color.g > color.r && color.g > color.b,
        "keep green pigments, not a gray wash",
      );
      assert.ok(
        color
          .toArray()
          .every(
            (channel) =>
              Number.isFinite(channel) && channel >= 0 && channel <= 1,
          ),
      );
    }
    assert.deepEqual(
      source.map((color) => color.toArray()),
      original,
    );
    const cachedMorning = soft.map((color) => color.clone());
    const output = cachedMorning.map((color) => color.clone());
    for (const warmth of [1, 0, 1, 0.5, 0]) {
      output.forEach((color, i) =>
        goldenSurface(cachedMorning[i], warmth, i < 2 ? 0.48 : 0.91, color),
      );
    }
    assert.deepEqual(
      output.map((color) => color.toArray()),
      soft.map((color) => color.toArray()),
      "Golden Hour must restore the new soft Morning palette without accumulating tint",
    );
  }
});

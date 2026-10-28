/** Typography and paper framing share the same canvas as exported video. */
export function paintPresentation(
  output: HTMLCanvasElement,
  source: HTMLCanvasElement,
  warmth: number,
) {
  const ctx = output.getContext("2d", { alpha: false });
  if (!ctx) return;
  const w = output.width,
    h = output.height;
  const unit = Math.min(w / 540, h / 960);
  ctx.drawImage(source, 0, 0, w, h);
  const paper = "244,243,233";
  const wash = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stops: [number, number][],
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([offset, alpha]) =>
      gradient.addColorStop(offset, `rgba(${paper},${alpha})`),
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  };
  wash(
    0,
    0,
    0,
    h * 0.19,
    [
      [0, 1],
      [0.3, 0.93],
      [1, 0],
    ],
    0,
    0,
    w,
    h * 0.19,
  );
  wash(
    0,
    h,
    0,
    h * 0.78,
    [
      [0, 1],
      [0.38, 0.96],
      [1, 0],
    ],
    0,
    h * 0.78,
    w,
    h * 0.22,
  );
  wash(
    0,
    0,
    w * 0.045,
    0,
    [
      [0, 0.95],
      [1, 0],
    ],
    0,
    0,
    w * 0.045,
    h,
  );
  wash(
    w,
    0,
    w * 0.955,
    0,
    [
      [0, 0.95],
      [1, 0],
    ],
    w * 0.955,
    0,
    w * 0.045,
    h,
  );
  ctx.textAlign = "left";
  ctx.fillStyle = "#3d5146";
  ctx.font = `${30 * unit}px "Goudy Bookletter", Georgia, serif`;
  ctx.fillText("Crescent Lake", 32 * unit, 49 * unit);
  ctx.fillStyle = "#7c8b73";
  ctx.font = `${8 * unit}px Arial, sans-serif`;
  ctx.fillText(
    warmth < 0.03
      ? "SPRING  /  MORNING"
      : warmth > 0.97
        ? "SPRING  /  GOLDEN HOUR"
        : "SPRING  /  CHANGING LIGHT",
    34 * unit,
    68 * unit,
  );
  ctx.textAlign = "center";
  ctx.fillStyle = "#45594b";
  ctx.font = `${20 * unit}px "Goudy Bookletter", Georgia, serif`;
  ctx.fillText("Where the water slows.", w * 0.5, h - 65 * unit);
  ctx.fillStyle = "#829079";
  ctx.font = `${8 * unit}px Arial, sans-serif`;
  ctx.fillText(
    "A white bird. A quiet shore. A little time.",
    w * 0.5,
    h - 43 * unit,
  );
}

export interface MasterFiles {
  masterUrl: string;
  shareUrl: string;
  masterName: string;
  shareName: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || "The film could not be exported. Please try again.");
  }
  return response.json();
}

export async function masterAvailable(): Promise<boolean> {
  try {
    const result = await responseJson<{ available: boolean }>(await fetch("/__lake_export/status"));
    return result.available;
  } catch { return false; }
}

/** One raw frame at a time; no real-time capture and no accumulated frame blobs. */
export async function exportMasterFrames(options: {
  width: number;
  height: number;
  duration: number;
  audio?: Blob;
  signal: AbortSignal;
  render(time: number): Uint8ClampedArray;
  onProgress(frame: number, frames: number, finishing: boolean): void;
}): Promise<MasterFiles> {
  const { width, height, audio, signal } = options;
  const fps = 30, frames = Math.round(options.duration * fps);
  let id: string | undefined;
  let complete = false;
  try {
    ({ id } = await responseJson<{ id: string }>(await fetch("/__lake_export/start", {
      method: "POST", signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width, height, fps, frames, audio: !!audio }),
    })));
    const base = `/__lake_export/${encodeURIComponent(id)}`;
    if (audio) await responseJson(await fetch(`${base}/audio`, {
      method: "POST", body: audio, signal,
    }));
    for (let index = 0; index < frames; index++) {
      signal.throwIfAborted();
      const pixels = options.render(index / fps);
      if (pixels.byteLength !== width * height * 4)
        throw new Error("The rendered film frame has an unexpected size.");
      await responseJson(await fetch(`${base}/frame/${index}`, {
        method: "POST", body: pixels.buffer as ArrayBuffer, signal,
        headers: { "Content-Type": "application/octet-stream" },
      }));
      options.onProgress(index + 1, frames, false);
    }
    options.onProgress(frames, frames, true);
    const result = await responseJson<MasterFiles>(await fetch(`${base}/finish`, {
      method: "POST", signal,
    }));
    complete = true;
    return result;
  } finally {
    if (id && !complete) {
      // A cancelled fetch signal cannot carry the cleanup request itself.
      await fetch(`/__lake_export/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
    }
  }
}

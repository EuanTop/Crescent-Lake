import { videoQuality } from "./export-quality.ts";

export type RecordingState = "recording" | "finalizing" | "idle";

export interface VideoRecorderCallbacks {
  onState?(state: RecordingState, elapsed: number): void;
}

export interface VideoRecordingOptions {
  /** Encoder target, clamped to 3–100 Mbps. Invalid values use the HD default. */
  videoBitsPerSecond?: number;
  /** This release records at 30fps; other values normalize to 30. */
  fps?: number;
}

export interface VideoRecorder {
  readonly supported: boolean;
  readonly format: string;
  readonly active: boolean;
  start(
    duration: number,
    filename: string,
    audio?: MediaStream | null,
    options?: VideoRecordingOptions,
  ): Promise<void>;
  stop(): void;
  dispose(): void;
}

// A video-only stream needs no audio codec. Query the browser rather than
// assuming that a particular browser name guarantees an installed encoder.
const MIME_TYPES = [
  "video/mp4;codecs=avc1.640034",
  "video/mp4;codecs=avc1.640028",
  "video/mp4;codecs=avc1.42E028",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function supportedMime(Recorder: typeof MediaRecorder, mime: string): boolean {
  try { return Recorder.isTypeSupported(mime); } catch { return false; }
}

function recordingSettings(options?: VideoRecordingOptions): { fps: 30; bitrate: number } {
  const requested = options?.videoBitsPerSecond;
  return {
    fps: 30,
    bitrate: typeof requested === "number" && Number.isFinite(requested)
      ? Math.round(Math.min(100_000_000, Math.max(3_000_000, requested)))
      : videoQuality("hd").videoBitsPerSecond,
  };
}

interface RecordingSession {
  stream: MediaStream;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  filename: string;
  startedAt: number;
  stoppedAt: number | null;
  finishing: boolean;
  closed: boolean;
  progressTimer?: ReturnType<typeof setInterval>;
  durationTimer?: ReturnType<typeof setTimeout>;
  watchdog?: ReturnType<typeof setTimeout>;
  downloadTimer?: ReturnType<typeof setTimeout>;
  url?: string;
  onVisibility(): void;
  resolve(): void;
  reject(error: Error): void;
}

function videoFormat(mime: string): string {
  return /^video\/mp4\b/i.test(mime)
    ? "MP4"
    : /^video\/webm\b/i.test(mime)
      ? "WebM"
      : "Unavailable";
}

function outputName(filename: string, format: string): string {
  const base =
    filename
      .trim()
      .replace(/\.(mp4|webm|mkv|mov)$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .trim() || "crescent-lake";
  return `${base}.${format === "MP4" ? "mp4" : "webm"}`;
}

/** Capture the existing canvas at 30fps. Scene animation, sizing and UI locks
 * remain the caller's responsibility. Resolution never changes in this module.
 * The promise settles after final encoding and the browser download handoff;
 * browsers do not expose completion of the user's filesystem download.
 */
export function createVideoRecorder(
  canvas: HTMLCanvasElement,
  callbacks: VideoRecorderCallbacks = {},
): VideoRecorder {
  const Recorder = typeof MediaRecorder === "undefined" ? null : MediaRecorder;
  const candidates =
    Recorder && typeof Recorder.isTypeSupported === "function"
      ? MIME_TYPES.filter((mime) => supportedMime(Recorder, mime))
      : [];
  const supported =
    typeof canvas.captureStream === "function" &&
    !!Recorder &&
    candidates.length > 0;
  let lastMime = candidates[0] ?? "";
  let session: RecordingSession | null = null;
  let disposed = false;

  const elapsed = (current: RecordingSession): number =>
    Math.max(
      0,
      ((current.stoppedAt ?? performance.now()) - current.startedAt) / 1000,
    );

  function notify(state: RecordingState, current: RecordingSession): void {
    try {
      callbacks.onState?.(state, elapsed(current));
    } catch (error) {
      // A UI callback must never strand a running capture track.
      console.error("Video recording state callback failed", error);
    }
  }

  function clearRecordingTimers(current: RecordingSession): void {
    clearInterval(current.progressTimer);
    clearTimeout(current.durationTimer);
    current.progressTimer = current.durationTimer = undefined;
  }

  function detachRecorder(recorder: MediaRecorder): void {
    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstop = null;
  }

  function finish(current: RecordingSession, error?: Error): void {
    if (current.closed) return;
    current.closed = true;
    current.stoppedAt ??= performance.now();
    clearRecordingTimers(current);
    clearTimeout(current.watchdog);
    clearTimeout(current.downloadTimer);
    document.removeEventListener("visibilitychange", current.onVisibility);
    if (current.recorder) {
      detachRecorder(current.recorder);
      if (current.recorder.state !== "inactive") {
        try {
          current.recorder.stop();
        } catch {
          /* Tracks are stopped below. */
        }
      }
    }
    for (const track of current.stream.getTracks()) track.stop();
    if (current.url) {
      URL.revokeObjectURL(current.url);
      current.url = undefined;
    }
    current.chunks.length = 0;
    if (session === current) session = null;
    notify("idle", current);
    if (error) current.reject(error);
    else current.resolve();
  }

  function finalize(current: RecordingSession): void {
    if (current.closed) return;
    current.stoppedAt ??= performance.now();
    if (!current.finishing) {
      current.finishing = true;
      notify("finalizing", current);
    }
    if (current.closed) return;
    clearRecordingTimers(current);
    clearTimeout(current.watchdog);
    // dataavailable is delivered before stop, including its last partial chunk.
    const chunkMime = current.chunks.find(
      (chunk) => videoFormat(chunk.type) !== "Unavailable",
    )?.type;
    const mime = chunkMime || current.recorder?.mimeType || lastMime;
    const format = videoFormat(mime);
    const blob = new Blob(current.chunks, { type: mime });
    if (!blob.size || format === "Unavailable") {
      finish(
        current,
        new Error(
          "No valid video was recorded. Record a little longer before stopping, or try another browser.",
        ),
      );
      return;
    }
    lastMime = mime;
    try {
      current.url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = current.url;
      link.download = outputName(current.filename, format);
      link.hidden = true;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      // Give browsers time to acquire the Blob before revoking the object URL.
      current.downloadTimer = setTimeout(() => finish(current), 1000);
    } catch (error) {
      finish(
        current,
        error instanceof Error
          ? error
          : new Error("The recorded video could not be downloaded."),
      );
    }
  }

  function stop(): void {
    const current = session;
    if (!current || current.closed || current.finishing) return;
    current.finishing = true;
    current.stoppedAt = performance.now();
    clearRecordingTimers(current);
    notify("finalizing", current);
    if (current.closed) return;
    try {
      if (current.recorder?.state !== "inactive") current.recorder?.stop();
      if (current.closed) return;
      // Wait for the final chunk; stopping capture tracks before this point can
      // truncate a clip on some encoders. An unresponsive encoder cannot hang UI.
      current.watchdog = setTimeout(() => {
        finish(
          current,
          new Error(
            "Video encoding took too long to finish. Please try again.",
          ),
        );
      }, 15_000);
    } catch (error) {
      finish(
        current,
        error instanceof Error
          ? error
          : new Error("The video recording could not be stopped."),
      );
    }
  }

  return {
    get supported() {
      return supported && !disposed;
    },
    get format() {
      return videoFormat(lastMime);
    },
    get active() {
      return session !== null;
    },
    async start(duration, filename, audio, options) {
      if (disposed) throw new Error("The video recorder is closed.");
      if (!supported || !Recorder)
        throw new Error(
          "This browser does not support canvas video recording.",
        );
      if (session)
        throw new Error(
          "A video is already being recorded or saved. Please wait.",
        );
      if (!canvas.width || !canvas.height)
        throw new Error("The canvas is not ready to record yet.");
      const seconds = Number.isFinite(duration)
        ? Math.min(60, Math.max(5, duration))
        : 15;
      const settings = recordingSettings(options);
      // Read source tracks before capture, then clone them with failure cleanup.
      // A quality/codec negotiation failure must never stop the live music track.
      const audioTracks = audio?.getAudioTracks() ?? [];
      let captured: MediaStream | undefined;
      try {
        captured = canvas.captureStream(settings.fps);
        if (!captured.getVideoTracks().length) throw new Error("The canvas video stream could not be captured.");
        for (const track of audioTracks) {
          const clone = track.clone();
          try { captured.addTrack(clone); }
          catch (error) { clone.stop(); throw error; }
        }
      } catch (error) {
        captured?.getTracks().forEach((track) => track.stop());
        throw error;
      }
      const stream = captured;
      return new Promise<void>((resolve, reject) => {
        const current: RecordingSession = {
          stream,
          recorder: null,
          chunks: [],
          filename,
          startedAt: performance.now(),
          stoppedAt: null,
          finishing: false,
          closed: false,
          onVisibility: () => {
            if (document.hidden) stop();
          },
          resolve,
          reject,
        };
        session = current;
        let lastError: Error | undefined;
        const is4k = Math.max(canvas.width, canvas.height) > 1920;
        const avc = is4k
          ? ["avc1.640034", "avc1.640028", "avc1.42E028"]
          : ["avc1.640028", "avc1.42E028", "avc1.640034"];
        const recordingTypes = [
          ...avc.map((codec) => `video/mp4;codecs=${codec}${audioTracks.length ? ",mp4a.40.2" : ""}`),
          "video/mp4",
          `video/webm;codecs=vp9${audioTracks.length ? ",opus" : ""}`,
          `video/webm;codecs=vp8${audioTracks.length ? ",opus" : ""}`,
          "video/webm",
        ].filter((mime) => supportedMime(Recorder, mime));
        for (const mime of recordingTypes) {
          let candidate: MediaRecorder | null = null;
          try {
            candidate = new Recorder(stream, {
              mimeType: mime,
              videoBitsPerSecond: settings.bitrate,
              audioBitsPerSecond: 256_000,
            });
            current.recorder = candidate;
            candidate.ondataavailable = (event: BlobEvent) => {
              if (!current.closed && event.data.size > 0)
                current.chunks.push(event.data);
            };
            candidate.onerror = (event: Event) => {
              const cause = (event as Event & { error?: DOMException }).error;
              finish(
                current,
                new Error(
                  cause?.message ||
                    "Video encoding failed. Try a shorter recording or another browser.",
                ),
              );
            };
            candidate.onstop = () => finalize(current);
            current.startedAt = performance.now();
            candidate.start(250);
            lastMime = candidate.mimeType || mime;
            break;
          } catch (error) {
            lastError =
              error instanceof Error
                ? error
                : new Error("The video encoder could not be started.");
            if (candidate) {
              detachRecorder(candidate);
              if (candidate.state !== "inactive") {
                try {
                  candidate.stop();
                } catch {
                  /* Try the next supported codec. */
                }
              }
            }
            current.recorder = null;
            current.chunks.length = 0;
          }
        }
        if (!current.recorder) {
          finish(
            current,
            lastError ?? new Error("No video encoder is available."),
          );
          return;
        }
        if (current.closed) return;
        document.addEventListener("visibilitychange", current.onVisibility);
        notify("recording", current);
        if (current.closed || current.finishing) return;
        current.progressTimer = setInterval(
          () => notify("recording", current),
          250,
        );
        current.durationTimer = setTimeout(stop, seconds * 1000);
      });
    },
    stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (session)
        finish(
          session,
          new DOMException("Video recording was cancelled.", "AbortError"),
        );
    },
  };
}

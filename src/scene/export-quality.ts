export type VideoQuality = "hd" | "4k";

export interface VideoQualityProfile {
  width: number;
  height: number;
  fps: 30;
  /** Encoder target; MediaRecorder may produce a different actual bitrate. */
  videoBitsPerSecond: number;
}

export function videoQuality(
  quality: VideoQuality,
  portrait = true,
): VideoQualityProfile {
  const width = quality === "4k" ? 2160 : 1080;
  const height = quality === "4k" ? 3840 : 1920;
  return {
    width: portrait ? width : height,
    height: portrait ? height : width,
    fps: 30,
    videoBitsPerSecond: quality === "4k" ? 80_000_000 : 24_000_000,
  };
}

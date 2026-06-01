import { spawn } from "node:child_process";

/** Convert WebM → MP4 (H.264, AAC silent) sized for X feed. */
export async function transcodeToMp4(webmPath: string, mp4Path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i", webmPath,
      "-vf", "scale=1080:1080:flags=lanczos,fps=30",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-level", "4.0",
      "-preset", "veryfast",
      "-crf", "22",
      "-movflags", "+faststart",
      "-f", "lavfi", "-i", "anullsrc=cl=stereo:r=48000",
      "-c:a", "aac", "-b:a", "128k",
      "-shortest",
      mp4Path,
    ];
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ff.stderr.on("data", (d) => { stderr += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/** Extract a single poster frame at ~1s into the video. */
export async function extractPoster(mp4Path: string, jpgPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-ss", "1.0",
      "-i", mp4Path,
      "-frames:v", "1",
      "-q:v", "3",
      jpgPath,
    ];
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ff.stderr.on("data", (d) => { stderr += d.toString(); });
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg poster exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

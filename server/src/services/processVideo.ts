import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadObjectToFile, uploadDirectory } from "../lib/s3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageScript = path.resolve(__dirname, "../../scripts/package-hls.sh");

export type ProcessStage = "downloading" | "transcoding" | "uploading_hls";

export type ProcessProgress = {
  stage: ProcessStage;
  message: string;
  percent?: number;
};

function percentOf(loaded: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((loaded / total) * 100));
}

function parseTimecode(value: string) {
  const match = value.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

function probeDuration(inputPath: string) {
  return new Promise<number>((resolve) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        inputPath,
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", () => resolve(0));
    child.on("close", () => {
      const seconds = Number(output.trim());
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
    });
  });
}

async function runPackageHls(
  inputPath: string,
  outputDir: string,
  onPercent: (percent: number) => void,
  signal?: AbortSignal,
) {
  const probed = await probeDuration(inputPath);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("bash", [packageScript, inputPath, outputDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let durationSec = probed;
    let lastEmit = 0;
    let settled = false;

    const onAbort = () => {
      child.kill("SIGKILL");
    };

    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener("abort", onAbort, { once: true });
    }

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };

    const emitPercent = (percent: number) => {
      const now = Date.now();
      if (now - lastEmit < 250 && percent < 99) return;
      lastEmit = now;
      onPercent(Math.max(0, Math.min(100, Math.round(percent))));
    };

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text);
      const durationMatch = text.match(/Duration:\s*(\d+:\d+:\d+(?:\.\d+)?)/);
      if (durationMatch && durationSec <= 0) {
        durationSec = parseTimecode(durationMatch[1]);
      }
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === "progress=end") {
          emitPercent(100);
          continue;
        }
        const clock = trimmed.match(/^out_time=(\d+:\d+:\d+(?:\.\d+)?)/);
        if (clock && durationSec > 0) {
          emitPercent((parseTimecode(clock[1]) / durationSec) * 100);
          continue;
        }
        const micros = trimmed.match(/^out_time_us=(\d+)/);
        if (micros && durationSec > 0) {
          emitPercent((Number(micros[1]) / 1_000_000 / durationSec) * 100);
        }
      }
    });

    child.on("error", finish);
    child.on("close", (code) => {
      if (signal?.aborted) {
        finish(new Error("Processing cancelled"));
        return;
      }
      if (code === 0) finish();
      else finish(new Error(`package-hls.sh exited with code ${code}`));
    });
  });
}

export async function processVideoToHls(
  videoId: string,
  onProgress?: (event: ProcessProgress) => void,
  signal?: AbortSignal,
) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), `video-${videoId}-`));
  const sourcePath = path.join(workDir, "source.mp4");
  const hlsDir = path.join(workDir, "hls");

  try {
    const rawKey = `raw/${videoId}/source.mp4`;
    onProgress?.({
      stage: "downloading",
      message: "Downloading the original file from S3 into a temp folder.",
      percent: 0,
    });
    console.log(`Downloading s3://${rawKey} → ${sourcePath}`);
    await downloadObjectToFile(rawKey, sourcePath, (loaded, total) => {
      onProgress?.({
        stage: "downloading",
        message: "Downloading the original file from S3 into a temp folder.",
        percent: percentOf(loaded, total),
      });
    });

    onProgress?.({
      stage: "transcoding",
      message:
        "FFmpeg is encoding 360p, 720p, and 1080p and cutting ~4s .ts segments.",
      percent: 0,
    });
    console.log(`Running FFmpeg HLS packaging for ${videoId}`);
    await runPackageHls(
      sourcePath,
      hlsDir,
      (percent) => {
        onProgress?.({
          stage: "transcoding",
          message:
            "FFmpeg is encoding 360p, 720p, and 1080p and cutting ~4s .ts segments.",
          percent,
        });
      },
      signal,
    );

    const hlsPrefix = `hls/${videoId}`;
    onProgress?.({
      stage: "uploading_hls",
      message: "Uploading playlists and segment files back to S3.",
      percent: 0,
    });
    console.log(`Uploading HLS files to s3://${hlsPrefix}/`);
    await uploadDirectory(hlsDir, hlsPrefix, (done, total) => {
      onProgress?.({
        stage: "uploading_hls",
        message: `Uploading HLS files to S3 (${done}/${total}).`,
        percent: percentOf(done, total),
      });
    });

    return {
      videoId,
      status: "completed" as const,
      masterKey: `${hlsPrefix}/master.m3u8`,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

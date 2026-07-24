import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadObjectToFile,
  uploadDirectory,
} from "../lib/s3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageScript = path.resolve(__dirname, "../../scripts/package-hls.sh");

function runPackageHls(inputPath: string, outputDir: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("bash", [packageScript, inputPath, outputDir], {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`package-hls.sh exited with code ${code}`));
    });
  });
}

export async function processVideoToHls(videoId: string) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), `video-${videoId}-`));
  const sourcePath = path.join(workDir, "source.mp4");
  const hlsDir = path.join(workDir, "hls");

  try {
    const rawKey = `raw/${videoId}/source.mp4`;
    console.log(`Downloading s3://${rawKey} → ${sourcePath}`);
    await downloadObjectToFile(rawKey, sourcePath);

    console.log(`Running FFmpeg HLS packaging for ${videoId}`);
    await runPackageHls(sourcePath, hlsDir);

    const hlsPrefix = `hls/${videoId}`;
    console.log(`Uploading HLS files to s3://${hlsPrefix}/`);
    await uploadDirectory(hlsDir, hlsPrefix);

    const masterKey = `${hlsPrefix}/master.m3u8`;

    return {
      videoId,
      status: "completed" as const,
      masterKey,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

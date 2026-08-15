import { useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlayIcon, UploadIcon } from "lucide-react";
import PipelineTracker from "../components/PipelineTracker";
import type { PipelineStage } from "../pipeline";

const API_BASE = "http://localhost:3001/api/videos";

type ProcessEvent = {
  stage: PipelineStage;
  message?: string;
  percent?: number;
  playbackUrl?: string;
};

function uploadWithProgress(
  url: string,
  file: File,
  onPercent: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "video/mp4");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onPercent(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("S3 upload failed"));
    xhr.send(file);
  });
}

async function processWithProgress(
  videoId: string,
  onEvent: (event: ProcessEvent) => void,
) {
  const response = await fetch(`${API_BASE}/${videoId}/process`, {
    method: "POST",
    headers: { Accept: "text/event-stream" },
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Processing failed");
  }

  if (!response.ok || !response.body) {
    throw new Error("Processing failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEvent: ProcessEvent | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((entry) => entry.startsWith("data: "));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as ProcessEvent;
      lastEvent = event;
      onEvent(event);
      if (event.stage === "failed") {
        throw new Error(event.message ?? "Processing failed");
      }
    }
  }

  if (lastEvent?.stage !== "completed") {
    throw new Error("Processing ended before HLS was ready");
  }

  return lastEvent;
}

const Upload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [failedStage, setFailedStage] = useState<PipelineStage | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const running = stage !== "idle" && stage !== "completed" && stage !== "failed";

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setVideoId(null);
    setStage("idle");
    setFailedStage(null);
    setPercent(null);
    setError(null);
    setPlaybackUrl(null);
  };

  const runPipeline = async () => {
    if (!file || running) return;

    setError(null);
    setFailedStage(null);
    setPlaybackUrl(null);
    setPercent(null);

    let current: PipelineStage = "creating";
    const advance = (next: PipelineStage, nextPercent: number | null = null) => {
      current = next;
      setStage(next);
      setPercent(nextPercent);
    };

    try {
      advance("creating");
      const title = file.name.split(".")[0] || "untitled";
      const createdResponse = await fetch(API_BASE, {
        method: "POST",
        body: JSON.stringify({ title }),
        headers: { "Content-Type": "application/json" },
      });
      if (!createdResponse.ok) {
        throw new Error("Failed to create a presigned upload URL");
      }
      const created = (await createdResponse.json()) as {
        id: string;
        uploadUrl: string;
      };
      setVideoId(created.id);

      advance("uploading", 0);
      await uploadWithProgress(created.uploadUrl, file, setPercent);
      setPercent(100);

      advance("downloading", 0);
      const result = await processWithProgress(created.id, (event) => {
        if (event.stage === "completed" || event.stage === "failed") return;
        advance(event.stage, event.percent ?? null);
      });

      setPlaybackUrl(result.playbackUrl ?? null);
      advance("completed", 100);
    } catch (caught) {
      setFailedStage(current);
      setStage("failed");
      setError(caught instanceof Error ? caught.message : "Pipeline failed");
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div>
          <Link
            to="/"
            className="mb-8 inline-block text-sm text-zinc-400 no-underline transition-colors hover:text-zinc-200"
          >
            ← How it works
          </Link>

          <h1 className="m-0 text-2xl font-semibold tracking-tight text-zinc-100">
            Run the HLS pipeline
          </h1>
          <p className="mt-2 mb-8 text-sm leading-relaxed text-zinc-400">
            One file in, a stream out. Watch each stage on the right — this is
            the same path a production video platform takes, just on one
            machine.
          </p>

          <label
            htmlFor="video-file"
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-600 bg-zinc-900/60 px-6 py-10 text-center transition-colors hover:border-zinc-400 hover:bg-zinc-900"
          >
            <UploadIcon size={28} className="text-zinc-300" />
            <span className="text-sm font-medium text-zinc-200">
              {file?.name ?? "Select a video file"}
            </span>
            <span className="text-xs text-zinc-500">MP4, WebM, or MOV</span>
            <input
              id="video-file"
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={onFileChange}
            />
          </label>

          <button
            type="button"
            disabled={!file || running}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#e8a54b] px-4 py-3 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void runPipeline()}
          >
            <UploadIcon size={16} />
            {running
              ? "Running pipeline…"
              : stage === "failed"
                ? "Retry pipeline"
                : "Upload and process"}
          </button>

          {stage === "completed" && videoId && (
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-600 bg-transparent px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-400"
              onClick={() => navigate(`/video?id=${encodeURIComponent(videoId)}`)}
            >
              <PlayIcon size={16} />
              Watch the stream
            </button>
          )}

          {videoId && (
            <p className="mt-4 break-all text-xs text-zinc-500">id: {videoId}</p>
          )}
          {playbackUrl && (
            <p className="mt-2 break-all text-xs text-zinc-500">
              master: {playbackUrl}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
          <p className="mt-0 mb-5 text-xs font-medium uppercase tracking-wide text-[#e8a54b]">
            Live pipeline
          </p>
          <PipelineTracker
            stage={stage}
            percent={percent}
            error={error}
            failedStage={failedStage}
          />
        </div>
      </div>
    </div>
  );
};

export default Upload;

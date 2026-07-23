import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { PlayIcon, UploadIcon } from "lucide-react";

const API_BASE = "http://localhost:3001/api/videos";

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setVideoId(null);
    setUploadUrl(null);
    setUploaded(false);
    setStatus(null);
    setPlaybackUrl(null);
  };

  const handleClickUpload = async () => {
    if (!file) return;

    const title = file.name.split(".")[0] || "untitled";
    setStatus("Creating upload URL…");

    const response = await fetch(API_BASE, {
      method: "POST",
      body: JSON.stringify({ title }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      setStatus("Failed to create upload URL");
      return;
    }

    const data = (await response.json()) as {
      id: string;
      uploadUrl: string;
    };
    setVideoId(data.id);
    setUploadUrl(data.uploadUrl);
    setStatus("Uploading to S3…");
  };

  useEffect(() => {
    const uploadFileToS3 = async () => {
      if (!uploadUrl || !file) return;

      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": "video/mp4",
        },
      });

      if (response.ok) {
        setUploaded(true);
        setStatus("Upload complete. Ready to process.");
      } else {
        setUploaded(false);
        setStatus("Failed to upload file to S3");
      }
    };

    void uploadFileToS3();
  }, [uploadUrl, file]);

  const handleClickProcessVideo = async () => {
    if (!videoId) {
      setStatus("Upload a video first so we have a video id.");
      return;
    }

    setProcessing(true);
    setStatus("Downloading from S3 and chunking with FFmpeg…");

    try {
      const response = await fetch(`${API_BASE}/${videoId}/process`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        playbackUrl?: string;
        signedPlaybackUrl?: string;
        error?: string;
      };

      if (!response.ok) {
        setStatus(data.error ?? "Processing failed");
        return;
      }

      setPlaybackUrl(data.playbackUrl ?? data.signedPlaybackUrl ?? null);
      setStatus("Processing complete. HLS uploaded to S3.");
      console.log("playback URL:", data.playbackUrl);
      console.log("signed playback URL:", data.signedPlaybackUrl);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Processing request failed",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-block text-sm text-zinc-400 no-underline transition-colors hover:text-zinc-200"
        >
          ← Back to player
        </Link>

        <h1 className="m-0 text-2xl font-semibold tracking-tight text-zinc-100">
          Upload video
        </h1>
        <p className="mt-2 mb-8 text-sm text-zinc-400">
          Choose a video file to upload, then process it into HLS chunks.
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
          disabled={!file || processing}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#e8a54b] px-4 py-3 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={handleClickUpload}
        >
          <UploadIcon size={16} />
          Upload
        </button>

        <button
          type="button"
          disabled={!uploaded || !videoId || processing}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#e8a54b] px-4 py-3 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={handleClickProcessVideo}
        >
          <PlayIcon size={16} />
          {processing ? "Processing…" : "Process Video"}
        </button>

        {status && (
          <p className="mt-4 text-sm text-zinc-400">{status}</p>
        )}

        {videoId && (
          <p className="mt-2 break-all text-xs text-zinc-500">id: {videoId}</p>
        )}

        {playbackUrl && (
          <p className="mt-2 break-all text-xs text-zinc-500">
            playback: {playbackUrl}
          </p>
        )}
      </div>
    </div>
  );
};

export default Upload;

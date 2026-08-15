export type PipelineStage =
  | "idle"
  | "creating"
  | "uploading"
  | "downloading"
  | "transcoding"
  | "uploading_hls"
  | "completed"
  | "failed";

export type PipelineStepId = Exclude<PipelineStage, "idle" | "failed">;

export type PipelineStep = {
  id: PipelineStepId;
  title: string;
  lesson: string;
};

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "creating",
    title: "Mint a presigned URL",
    lesson:
      "The API never receives the file. It creates a video id and a short-lived S3 PUT URL so the browser can upload straight to object storage.",
  },
  {
    id: "uploading",
    title: "Upload the original file",
    lesson:
      "The raw video is stored at raw/{id}/source.mp4. Playback does not use this object — it is only the source for packaging.",
  },
  {
    id: "downloading",
    title: "Worker pulls the source",
    lesson:
      "A server job downloads the object into a temp folder. FFmpeg needs a local file it can read, seek, and encode from.",
  },
  {
    id: "transcoding",
    title: "Transcode and chunk",
    lesson:
      "FFmpeg encodes 360p, 720p, and 1080p, then cuts each rendition into ~4 second .ts segments and writes .m3u8 playlists. Small segments are why playback can start before the whole file is downloaded.",
  },
  {
    id: "uploading_hls",
    title: "Store the HLS package",
    lesson:
      "Segments, variant playlists, and master.m3u8 go under hls/{id}/. The master playlist is an index of available qualities and bitrates.",
  },
  {
    id: "completed",
    title: "Adaptive playback",
    lesson:
      "hls.js loads master.m3u8, picks a quality for your bandwidth, and fetches only the next few chunks. That is HTTP Live Streaming.",
  },
];

const STEP_ORDER: PipelineStepId[] = PIPELINE_STEPS.map((step) => step.id);

export function stepStatus(
  stage: PipelineStage,
  stepId: PipelineStepId,
): "pending" | "active" | "done" | "error" {
  if (stage === "idle") return "pending";
  if (stage === "failed") return "pending";

  const currentIndex = STEP_ORDER.indexOf(stage);
  const stepIndex = STEP_ORDER.indexOf(stepId);

  if (currentIndex === -1) return "pending";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) {
    return stage === "completed" ? "done" : "active";
  }
  return "pending";
}

export function failedStepStatus(
  failedStage: PipelineStage | null,
  stepId: PipelineStepId,
): "pending" | "active" | "done" | "error" {
  if (!failedStage || failedStage === "idle" || failedStage === "failed") {
    return "pending";
  }
  const failedIndex = STEP_ORDER.indexOf(failedStage as PipelineStepId);
  const stepIndex = STEP_ORDER.indexOf(stepId);
  if (failedIndex === -1) return "pending";
  if (stepIndex < failedIndex) return "done";
  if (stepIndex === failedIndex) return "error";
  return "pending";
}

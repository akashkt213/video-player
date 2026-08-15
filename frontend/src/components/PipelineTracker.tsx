import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import {
  failedStepStatus,
  PIPELINE_STEPS,
  stepStatus,
  type PipelineStage,
} from "../pipeline";

type PipelineTrackerProps = {
  stage?: PipelineStage;
  percent?: number | null;
  error?: string | null;
  failedStage?: PipelineStage | null;
  mode?: "live" | "guide";
};

function statusLabel(status: "pending" | "active" | "done" | "error") {
  if (status === "done") return "done";
  if (status === "active") return "now";
  if (status === "error") return "failed";
  return "waiting";
}

const PipelineTracker = ({
  stage = "idle",
  percent = null,
  error = null,
  failedStage = null,
  mode = "live",
}: PipelineTrackerProps) => {
  const isGuide = mode === "guide";

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {PIPELINE_STEPS.map((step, index) => {
        const status = isGuide
          ? "pending"
          : stage === "failed"
            ? failedStepStatus(failedStage, step.id)
            : stepStatus(stage, step.id);
        const showPercent =
          !isGuide &&
          status === "active" &&
          percent != null &&
          (step.id === "uploading" ||
            step.id === "downloading" ||
            step.id === "transcoding" ||
            step.id === "uploading_hls");

        return (
          <li key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  isGuide
                    ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                    : status === "done"
                      ? "border-[#e8a54b] bg-[#e8a54b] text-zinc-950"
                      : status === "active"
                        ? "border-[#e8a54b] bg-[#e8a54b]/15 text-[#e8a54b]"
                        : status === "error"
                          ? "border-red-400 bg-red-400/15 text-red-300"
                          : "border-zinc-700 bg-zinc-900 text-zinc-500"
                }`}
              >
                {isGuide ? (
                  index + 1
                ) : status === "done" ? (
                  <CheckIcon size={14} />
                ) : status === "active" ? (
                  <LoaderCircleIcon size={14} className="animate-spin" />
                ) : status === "error" ? (
                  <XIcon size={14} />
                ) : (
                  index + 1
                )}
              </span>
              {index < PIPELINE_STEPS.length - 1 && (
                <span
                  className={`mt-1 mb-1 w-px flex-1 min-h-8 ${
                    !isGuide && status === "done"
                      ? "bg-[#e8a54b]/70"
                      : "bg-zinc-800"
                  }`}
                />
              )}
            </div>

            <div
              className={
                index === PIPELINE_STEPS.length - 1 ? "pb-0" : "pb-6"
              }
            >
              <div className="flex items-baseline gap-2">
                <h3
                  className={`m-0 text-sm font-semibold ${
                    isGuide || status !== "pending"
                      ? "text-zinc-100"
                      : "text-zinc-500"
                  }`}
                >
                  {step.title}
                </h3>
                {!isGuide && (
                  <span
                    className={`text-[11px] uppercase tracking-wide ${
                      status === "active"
                        ? "text-[#e8a54b]"
                        : status === "error"
                          ? "text-red-300"
                          : "text-zinc-600"
                    }`}
                  >
                    {showPercent ? `${percent}%` : statusLabel(status)}
                  </span>
                )}
              </div>
              <p
                className={`mt-1 mb-0 text-xs leading-relaxed ${
                  isGuide || status !== "pending"
                    ? "text-zinc-400"
                    : "text-zinc-600"
                }`}
              >
                {step.lesson}
              </p>
              {showPercent && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-[#e8a54b] transition-[width] duration-200"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
              {status === "error" && error && (
                <p className="mt-2 mb-0 text-xs text-red-300">{error}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default PipelineTracker;

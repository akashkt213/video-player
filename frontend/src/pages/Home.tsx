import { Link } from "react-router-dom";
import { UploadIcon } from "lucide-react";
import PipelineTracker from "../components/PipelineTracker";

const Home = () => {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-[#e8a54b]">
            how video streaming works
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
            Upload once. Stream in chunks.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            A whole MP4 is a bad way to watch video over the internet — the
            player would have to wait for the entire file. HLS (HTTP Live
            Streaming) splits the video into a few seconds of media at a
            time, plus a playlist that tells the player what to fetch next.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            This app is a walkthrough of that pipeline. You upload a file,
            a worker transcodes it into multiple qualities, and the player
            requests only the chunks it needs.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/upload"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e8a54b] px-5 py-3 text-sm font-semibold text-zinc-950 no-underline transition-opacity hover:opacity-90"
            >
              <UploadIcon size={16} />
              Run the pipeline
            </Link>
            <Link
              to="/video"
              className="inline-flex items-center justify-center rounded-lg px-3 py-3 text-sm font-medium text-zinc-400 no-underline transition-colors hover:text-zinc-200"
            >
              Watch a processed video →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
          <p className="mt-0 mb-5 text-xs font-medium uppercase tracking-wide text-[#e8a54b]">
            The six stages
          </p>
          <PipelineTracker mode="guide" />
        </div>
      </div>
    </div>
  );
};

export default Home;

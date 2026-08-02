import { Link } from "react-router-dom";
import { UploadIcon } from "lucide-react";

const Home = () => {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-full max-w-lg">
        <span className="text-xs font-medium uppercase tracking-wide text-[#e8a54b]">
          how this player works
        </span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
          Upload once. Stream in chunks.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          This is a working demo of an HLS pipeline. A file you upload goes
          to S3 through a presigned URL, gets downloaded by a worker and
          split into small <code className="text-zinc-300">.ts</code> segments
          with FFmpeg, then those segments are re-uploaded to S3 and served
          back to the player as an HLS playlist — so playback can start
          before the whole file exists and adapt if your connection changes.
        </p>

        <Link
          to="/upload"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-[#e8a54b] px-5 py-3 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
        >
          <UploadIcon size={16} />
          Upload a video
        </Link>
      </div>
    </div>
  );
};

export default Home;
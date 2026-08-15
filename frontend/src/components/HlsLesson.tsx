import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import type { HlsLessonState } from "../hooks/useHls";

type HlsLessonProps = {
  lesson: HlsLessonState;
  loadingStream: boolean;
  streamError: string | null;
};

const HlsLesson = ({ lesson, loadingStream, streamError }: HlsLessonProps) => {
  const [open, setOpen] = useState(true);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [lesson.events]);

  return (
    <aside className="player__lesson">
      <button
        type="button"
        className="player__lesson-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        How this stream works
        <ChevronDownIcon
          size={16}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      {open && (
        <div className="player__lesson-body">
          <p className="player__lesson-copy">
            The player never downloads the whole file. It reads a playlist,
            then fetches a few 4-second chunks at a time and can switch
            quality if bandwidth changes.
          </p>

          <dl className="player__lesson-stats">
            <div>
              <dt>Now fetching</dt>
              <dd>{lesson.currentSegment ?? (loadingStream ? "master.m3u8" : "—")}</dd>
            </div>
            <div>
              <dt>Quality</dt>
              <dd>{lesson.qualityLabel ?? "choosing…"}</dd>
            </div>
            <div>
              <dt>Buffered ahead</dt>
              <dd>
                {lesson.bufferAhead > 0
                  ? `${lesson.bufferAhead.toFixed(1)}s`
                  : "—"}
              </dd>
            </div>
          </dl>

          {(streamError || lesson.error) && (
            <p className="player__lesson-error">{streamError ?? lesson.error}</p>
          )}

          <ol className="player__lesson-log" ref={logRef}>
            {lesson.events.length === 0 && (
              <li>Waiting for the master playlist…</li>
            )}
            {lesson.events.map((event) => (
              <li key={event.id}>{event.text}</li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
};

export default HlsLesson;

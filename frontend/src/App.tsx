import {
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FastForwardIcon,
  PauseIcon,
  PlayIcon,
  RewindIcon,
  UploadIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useHls } from "./hooks/useHls";
import formatTime from "./utils/formatTime";
import "./App.css";

const API_BASE = "http://localhost:3001/api/videos";
const HIDE_CONTROLS_MS = 2500;

const App = () => {
  const [searchParams] = useSearchParams();
  const videoId = searchParams.get("id")?.trim() || null;

  const [streamSrc, setStreamSrc] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const lastVolumeRef = useRef(1);
  const [showControls, setShowControls] = useState(true);

  const initialState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
  };

  type PlayerAction =
    | { type: "setPlaying"; payload: boolean }
    | { type: "setCurrentTime"; payload: number }
    | { type: "setDuration"; payload: number }
    | { type: "setVolume"; payload: number }
    | { type: "setMuted"; payload: boolean };

  const reducer = (state: typeof initialState, action: PlayerAction) => {
    switch (action.type) {
      case "setPlaying":
        return { ...state, isPlaying: action.payload };
      case "setCurrentTime":
        return { ...state, currentTime: action.payload };
      case "setDuration":
        return { ...state, duration: action.payload };
      case "setVolume":
        return { ...state, volume: action.payload };
      case "setMuted":
        return { ...state, muted: action.payload };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  const { isPlaying, currentTime, duration, volume, muted } = state;

  useEffect(() => {
    let cancelled = false;

    const fetchMasterUrl = async () => {
      setLoadingStream(true);
      setStreamError(null);
      setStreamSrc(null);

      try {
        if (videoId) {
          const response = await fetch(`${API_BASE}/${videoId}/playback`);
          const data = (await response.json()) as {
            playbackUrl?: string;
            error?: string;
          };
          if (!response.ok) {
            throw new Error(data.error ?? "Failed to fetch playback URL");
          }
          if (!cancelled) setStreamSrc(data.playbackUrl ?? null);
          return;
        }

        const response = await fetch(API_BASE);
        const data = (await response.json()) as {
          videos?: Array<{ id: string; playbackUrl: string }>;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to list videos");
        }

        const latest = data.videos?.[data.videos.length - 1];
        if (!cancelled) {
          setStreamSrc(latest?.playbackUrl ?? null);
          if (!latest) {
            setStreamError("No processed videos yet. Upload and process one.");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setStreamError(
            error instanceof Error ? error.message : "Failed to load stream",
          );
        }
      } finally {
        if (!cancelled) setLoadingStream(false);
      }
    };

    void fetchMasterUrl();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const {
    startLoad,
    setQuality,
    levels,
    currentLevel,
    activeLevel,
    isReady,
    error,
  } = useHls(videoRef, streamSrc);

  useEffect(() => {
    dispatch({ type: "setPlaying", payload: false });
    dispatch({ type: "setCurrentTime", payload: 0 });
    dispatch({ type: "setDuration", payload: 0 });
  }, [streamSrc]);

  const revealControls = (playing = isPlaying) => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (!playing) return;
    hideTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, HIDE_CONTROLS_MS);
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      startLoad();
      try {
        await video.play();
      } catch {
        dispatch({ type: "setPlaying", payload: false });
      }
    } else {
      video.pause();
    }
  };

  const setVolume = (nextVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    if (nextVolume > 0) lastVolumeRef.current = nextVolume;
    dispatch({ type: "setVolume", payload: nextVolume });
    dispatch({ type: "setMuted", payload: nextVolume === 0 });
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0) {
      const restored = lastVolumeRef.current || 0.5;
      video.muted = false;
      video.volume = restored;
      dispatch({ type: "setMuted", payload: false });
      dispatch({ type: "setVolume", payload: restored });
      return;
    }

    lastVolumeRef.current = video.volume;
    video.muted = true;
    dispatch({ type: "setMuted", payload: true });
  };

  const rewind = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 5);
  };

  const fastForward = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
  };

  const setSeekTime = (seekTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seekTime;
    dispatch({ type: "setCurrentTime", payload: seekTime });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => dispatch({ type: "setPlaying", payload: true });
    const onPause = () => dispatch({ type: "setPlaying", payload: false });
    const onTimeUpdate = () =>
      dispatch({ type: "setCurrentTime", payload: video.currentTime });
    const onDurationChange = () =>
      dispatch({ type: "setDuration", payload: video.duration || 0 });
    const onVolumeChange = () => {
      dispatch({ type: "setVolume", payload: video.volume });
      dispatch({ type: "setMuted", payload: video.muted });
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("volumechange", onVolumeChange);
    };
  }, []);

  useEffect(() => {
    revealControls(isPlaying);
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying]);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    switch (event.key) {
      case " ":
      case "k":
      case "K":
        event.preventDefault();
        void togglePlay();
        revealControls();
        break;
      case "ArrowLeft":
      case "j":
      case "J":
        event.preventDefault();
        rewind();
        revealControls();
        break;
      case "ArrowRight":
      case "l":
      case "L":
        event.preventDefault();
        fastForward();
        revealControls();
        break;
      case "m":
      case "M":
        event.preventDefault();
        toggleMute();
        revealControls();
        break;
      default:
        break;
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  const progress =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const displayVolume = muted ? 0 : volume;
  const qualityLabel =
    activeLevel >= 0 && levels[activeLevel]
      ? `${levels[activeLevel].height}p`
      : null;

  return (
    <div
      className={`player${showControls || !isPlaying ? " player--show-controls" : ""}`}
      onMouseMove={() => revealControls()}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
    >
      <Link to="/upload" className="player__upload-link" aria-label="Upload video">
        <UploadIcon size={16} />
        Upload
      </Link>

      <video
        ref={videoRef}
        playsInline
        className="player__video"
        onClick={() => void togglePlay()}
      />

      {qualityLabel && <span className="player__badge">{qualityLabel}</span>}

      {!isReady && !error && !streamError && (
        <p className="player__status">
          {loadingStream ? "Fetching master URL…" : "Loading stream…"}
        </p>
      )}
      {(streamError || error) && (
        <p className="player__status player__status--error">
          {streamError ?? error}
        </p>
      )}

      {!isPlaying && isReady && !error && !streamError && (
        <div className="player__center">
          <button
            type="button"
            className="player__big-play"
            onClick={() => void togglePlay()}
            aria-label="Play"
          >
            <PlayIcon size={28} />
          </button>
          <p className="player__hint">Space to play · ← → to seek · M to mute</p>
        </div>
      )}

      <div className="player__overlay">
        <div className="player__controls">
          <input
            type="range"
            className="player__seek"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            style={{ "--progress": `${progress}%` } as CSSProperties}
            onChange={(e) => setSeekTime(parseFloat(e.target.value))}
            aria-label="Seek"
          />

          <div className="player__bar">
            <div className="player__transport">
              <button
                type="button"
                className="player__btn"
                onClick={rewind}
                aria-label="Rewind 5 seconds"
              >
                <RewindIcon size={18} />
              </button>
              <button
                type="button"
                className="player__btn player__btn--primary"
                onClick={() => void togglePlay()}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
              </button>
              <button
                type="button"
                className="player__btn"
                onClick={fastForward}
                aria-label="Fast forward 5 seconds"
              >
                <FastForwardIcon size={18} />
              </button>
            </div>

            <span className="player__time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="player__spacer" />

            <div className="player__volume">
              <button
                type="button"
                className="player__btn"
                onClick={toggleMute}
                aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
              >
                {muted || volume === 0 ? (
                  <VolumeXIcon size={18} />
                ) : (
                  <Volume2Icon size={18} />
                )}
              </button>
              <input
                type="range"
                className="player__volume-slider"
                min={0}
                max={1}
                step={0.01}
                value={displayVolume}
                style={
                  { "--volume": `${displayVolume * 100}%` } as CSSProperties
                }
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Volume"
              />
            </div>

            {levels.length > 0 && (
              <div className="player__quality">
                <label htmlFor="quality-select">Quality</label>
                <select
                  id="quality-select"
                  value={currentLevel}
                  onChange={(e) => setQuality(Number(e.target.value))}
                >
                  <option value={-1}>Auto</option>
                  {levels.map((level, index) => (
                    <option key={index} value={index}>
                      {level.height}p
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

import { useEffect, useReducer, useRef } from "react";
import { FastForwardIcon, PauseIcon, PlayIcon, RewindIcon } from "lucide-react";
import { useHls } from "./hooks/useHls";
import formatTime from "./utils/formatTime";

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  };

  type PlayerAction =
    | { type: "setPlaying"; payload: boolean }
    | { type: "setCurrentTime"; payload: number }
    | { type: "setDuration"; payload: number }
    | { type: "setVolume"; payload: number };

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
      default:
        return state;
    }
  };
  const [state, dispatch] = useReducer(reducer, initialState);

  const { isPlaying, currentTime, duration } = state;
  const {
    startLoad,
    setQuality,
    levels,
    currentLevel,
    activeLevel,
    isReady,
    error,
  } = useHls(videoRef);

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

  const setVolume = (volume: number) => {
    const video = videoRef?.current;
    if (!video) return;
    video.volume = volume;
    dispatch({ type: "setVolume", payload: volume });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => dispatch({ type: "setPlaying", payload: true });
    const onPause = () => dispatch({ type: "setPlaying", payload: false });
    const onTimeUpdate = () =>
      dispatch({ type: "setCurrentTime", payload: video.currentTime });
    const onDurationChange = () =>
      dispatch({ type: "setDuration", payload: video.duration });
    const onVolumeChange = () =>
      dispatch({ type: "setVolume", payload: video.volume });

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

  const rewind = () => {
    const video = videoRef?.current;
    if (!video) return;
    video.currentTime -= 5;
  };

  const fastForward = () => {
    const video = videoRef?.current;
    if (!video) return;
    video.currentTime += 5;
  };

  const setSeekTime = (seekTime: number) => {
    const video = videoRef?.current;
    if (!video) return;
    video.currentTime = seekTime;
    dispatch({ type: "setCurrentTime", payload: seekTime });
  };

  const qualityLabel =
    activeLevel >= 0 && levels[activeLevel]
      ? `${levels[activeLevel].height}p`
      : null;

  return (
    <div className="w-[80vw] h-[80vh] flex items-center justify-center">
      <div className="w-full h-full flex flex-col">
        <div className="relative flex-1 min-h-0 bg-black">
          <video
            ref={videoRef}
            playsInline
            className="w-full h-full object-contain"
          />
          {!isPlaying && isReady && (
            <p className="absolute bottom-4 left-4 text-white/80 text-sm">
              Press play to start
            </p>
          )}
          {!isReady && !error && (
            <p className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
              Loading stream…
            </p>
          )}
          {error && (
            <p className="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-4 text-center">
              {error}
            </p>
          )}
          {qualityLabel && (
            <span className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2 py-1 rounded">
              {qualityLabel}
            </span>
          )}
        </div>

        <div>
          <input
            type="range"
            min="0"
            max={duration.toString()}
            step="1"
            value={state.currentTime}
            className="w-full"
            onChange={(e) => setSeekTime(parseFloat(e.target.value))}
          />
        </div>

        <div className="flex items-center justify-center gap-4 py-2">
          <button
            onClick={togglePlay}
            className="h-20 w-20 bg-blue-500 text-white rounded-md flex items-center justify-center"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            onClick={rewind}
            className="h-20 w-20 bg-red-500 text-white rounded-md flex items-center justify-center"
          >
            <RewindIcon />
          </button>
          <button
            onClick={fastForward}
            className="h-20 w-20 bg-green-500 text-white rounded-md flex items-center justify-center"
          >
            <FastForwardIcon />
          </button>
        </div>

        <div className="text-center pb-2">
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="pb-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state.volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>

        {levels.length > 0 && (
          <div className="text-center pb-2">
            <label className="text-white text-sm mr-2">Quality</label>
            <select
              value={currentLevel}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="bg-gray-800 text-white text-sm px-2 py-1 rounded"
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
  );
};

export default App;

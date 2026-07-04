import { useEffect, useReducer, useRef } from "react";
import video from "./assets/35860-408654164.mp4";
import { FastForwardIcon, PauseIcon, PlayIcon, RewindIcon } from "lucide-react";

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initialState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  };

  const reducer = (state: typeof initialState, action: any) => {
    switch (action.type) {
      case "togglePlay":
        return {
          ...state,
          isPlaying: !state.isPlaying,
        };
      case "setCurrentTime":
        return {
          ...state,
          currentTime: action.payload,
        };
      case "setDuration":
        return {
          ...state,
          duration: action.payload,
        };
      case "setVolume":
        return {
          ...state,
          volume: action.payload,
        };
      default:
        return state;
    }
  };
  const [state, dispatch] = useReducer(reducer, initialState);

  const { isPlaying, currentTime, duration } = state;
  const togglePlay = () => {
    const video = videoRef?.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const setVolume = (volume: number) => {
    const video = videoRef?.current;
    if (!video) return;
    video.volume = volume;
    dispatch({ type: "setVolume", payload: volume });
  };


  const timeUpdate = () => {
    dispatch({ type: "setCurrentTime", payload: videoRef?.current?.currentTime });
  };


  const durationChange = () => {
    dispatch({ type: "setDuration", payload: videoRef?.current?.duration });
  };
  const volumeChange = () => {
    dispatch({ type: "setVolume", payload: videoRef?.current?.volume });
  };


  

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => dispatch({ type: "togglePlay" });
    const onPause = () => dispatch({ type: "togglePlay" });

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", timeUpdate);
    video.addEventListener("durationchange", durationChange);
    video.addEventListener("volumechange", volumeChange);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", timeUpdate);
      video.removeEventListener("durationchange", durationChange);
      video.removeEventListener("volumechange", volumeChange);
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
  const renderPlayPauseIcon = () => (isPlaying ? <PauseIcon /> : <PlayIcon />);


  const formatTime = (timeInSeconds: number) => {
    if (!Number.isFinite(timeInSeconds)) return "00:00";
  
    const totalSeconds = Math.floor(timeInSeconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
  
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
  
    if (hours > 0) {
      const hh = String(hours).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    }
  
    return `${mm}:${ss}`;
  };

  const setSeekTime = (seekTime: number) => {
    const video = videoRef?.current;
    if (!video) return;
    video.currentTime = seekTime;
    dispatch({ type: "setCurrentTime", payload: seekTime });
  };

  return (
    <div className="w-[80vw] h-[80vh] flex items-center justify-center">
      <div className="w-full h-full">
        <video
          src={video}
          ref={videoRef}
          className="w-full h-full object-cover"
        />


        <div>
          <input type="range" min="0" max={duration.toString()} step="1" value={state.currentTime} className="w-full" onChange={(e) => {
            setSeekTime(parseFloat(e.target.value));
          }} />

        </div>


        <div className="flex items-center justify-center gap-4">
          <button
            onClick={togglePlay}
            className="h-20 w-20 bg-blue-500 text-white rounded-md flex items-center justify-center"
          >
            {renderPlayPauseIcon()}
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
        <div>
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      
        <div>
          <input type="range" min="0" max="1" step="0.01" value={state.volume} onChange={(e) => {
            setVolume(parseFloat(e.target.value));
          }} />
        </div>
      </div>
    </div>
  );
};

export default App;

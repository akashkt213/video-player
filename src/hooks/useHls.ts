import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Hls, { ErrorTypes, type Level } from "hls.js";

export const HLS_STREAM_URL = "/adaptive-media/master.m3u8";

export function useHls(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string = HLS_STREAM_URL,
) {
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [activeLevel, setActiveLevel] = useState(-1);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsReady(false);
    setError(null);

    if (!Hls.isSupported()) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        setIsReady(true);
      } else {
        setError("HLS is not supported in this browser.");
      }
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      autoStartLoad: true,
      maxBufferLength: 10,
    });
    hlsRef.current = hls;

    hls.loadSource(src);
    hls.attachMedia(video);

    const onManifestParsed = () => {
      setLevels([...hls.levels]);
      setActiveLevel(hls.loadLevel);
      setIsReady(true);
    };

    const onLevelSwitched = (_: string, data: { level: number }) => {
      setActiveLevel(data.level);
    };

    const onError = (
      _: string,
      data: { fatal: boolean; type: ErrorTypes; details?: string },
    ) => {
      if (!data.fatal) return;

      switch (data.type) {
        case ErrorTypes.NETWORK_ERROR:
          hls.startLoad();
          break;
        case ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
          setError(data.details ?? "Playback failed.");
          hls.destroy();
          hlsRef.current = null;
          break;
      }
    };

    hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
    hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
    hls.on(Hls.Events.ERROR, onError);

    return () => {
      hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      hls.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
      hls.off(Hls.Events.ERROR, onError);
      hls.destroy();
      hlsRef.current = null;
    };
  }, [videoRef, src]);

  const startLoad = useCallback(() => {
    hlsRef.current?.startLoad();
  }, []);

  const setQuality = useCallback((level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = level;
    setCurrentLevel(level);
  }, []);

  return {
    startLoad,
    setQuality,
    levels,
    currentLevel,
    activeLevel,
    isReady,
    error,
  };
}

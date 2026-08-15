import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Hls, { ErrorTypes, type Level } from "hls.js";

export type HlsLessonEvent = {
  id: number;
  text: string;
};

export type HlsLessonState = {
  events: HlsLessonEvent[];
  currentSegment: string | null;
  bufferAhead: number;
  qualityLabel: string | null;
  error: string | null;
};

function fileNameFromUrl(url: string) {
  try {
    const path = new URL(url, "http://local.invalid").pathname;
    return decodeURIComponent(path.split("/").pop() ?? url);
  } catch {
    return url.split("/").pop() ?? url;
  }
}

function fragmentName(frag: { relurl?: string; url: string } | undefined) {
  if (!frag) return null;
  if (frag.relurl) return frag.relurl.split("/").pop() ?? frag.relurl;
  return fileNameFromUrl(frag.url);
}

function bufferedAhead(video: HTMLVideoElement) {
  const time = video.currentTime;
  for (let index = 0; index < video.buffered.length; index += 1) {
    if (time >= video.buffered.start(index) && time <= video.buffered.end(index)) {
      return video.buffered.end(index) - time;
    }
  }
  return 0;
}

export function useHls(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string | null,
) {
  const hlsRef = useRef<Hls | null>(null);
  const eventIdRef = useRef(0);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [activeLevel, setActiveLevel] = useState(-1);
  const [isReady, setIsReady] = useState(false);
  const [isSwitchingQuality, setIsSwitchingQuality] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const switchingRef = useRef(false);
  const switchTimerRef = useRef<number | null>(null);
  const awaitingNewLevelRef = useRef(false);
  const didStallRef = useRef(false);
  const [lesson, setLesson] = useState<HlsLessonState>({
    events: [],
    currentSegment: null,
    bufferAhead: 0,
    qualityLabel: null,
    error: null,
  });

  const endQualitySwitch = useCallback(() => {
    if (switchTimerRef.current) {
      window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
    awaitingNewLevelRef.current = false;
    didStallRef.current = false;
    if (!switchingRef.current) return;
    switchingRef.current = false;
    setIsSwitchingQuality(false);
  }, []);

  const beginQualitySwitch = useCallback(() => {
    switchingRef.current = true;
    awaitingNewLevelRef.current = false;
    didStallRef.current = false;
    setIsSwitchingQuality(true);
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
    switchTimerRef.current = window.setTimeout(() => {
      endQualitySwitch();
    }, 8000);
  }, [endQualitySwitch]);

  const pushEvent = useCallback((text: string) => {
    const id = eventIdRef.current + 1;
    eventIdRef.current = id;
    setLesson((prev) => ({
      ...prev,
      events: [...prev.events.slice(-11), { id, text }],
    }));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      setIsReady(false);
      setIsSwitchingQuality(false);
      switchingRef.current = false;
      setLevels([]);
      setCurrentLevel(-1);
      setActiveLevel(-1);
      setLesson({
        events: [],
        currentSegment: null,
        bufferAhead: 0,
        qualityLabel: null,
        error: null,
      });
      return;
    }

    setIsReady(false);
    setIsSwitchingQuality(false);
    switchingRef.current = false;
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);
    setActiveLevel(-1);
    eventIdRef.current = 0;
    setLesson({
      events: [
        {
          id: 0,
          text: `Requesting master playlist (${fileNameFromUrl(src)})`,
        },
      ],
      currentSegment: fileNameFromUrl(src),
      bufferAhead: 0,
      qualityLabel: null,
      error: null,
    });

    if (!Hls.isSupported()) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        setIsReady(true);
        pushEvent("This browser can play HLS natively — no hls.js needed.");
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
      const nextLevels = [...hls.levels];
      setLevels(nextLevels);
      setActiveLevel(hls.loadLevel);
      setIsReady(true);
      const labels = nextLevels
        .map((level) => (level.height ? `${level.height}p` : null))
        .filter((label): label is string => Boolean(label));
      const selected = nextLevels[Math.max(0, hls.loadLevel)] ?? nextLevels[0];
      const qualityLabel = selected?.height ? `${selected.height}p` : null;
      setLesson((prev) => ({ ...prev, qualityLabel }));
      pushEvent(
        labels.length > 0
          ? `Master playlist lists ${labels.length} renditions: ${labels.join(", ")}`
          : "Master playlist parsed.",
      );
    };

    const onLevelSwitched = (_: string, data: { level: number }) => {
      setActiveLevel(data.level);
      const level = hls.levels[data.level];
      const label = level?.height ? `${level.height}p` : `level ${data.level}`;
      setLesson((prev) => ({ ...prev, qualityLabel: label }));
      pushEvent(`Playing ${label} — hls.js picked this for the current bandwidth.`);
      if (switchingRef.current) {
        awaitingNewLevelRef.current = true;
        if (video.paused && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          endQualitySwitch();
        }
      }
    };

    const onFragChanged = () => {
      if (switchingRef.current && awaitingNewLevelRef.current) {
        endQualitySwitch();
      }
    };

    const onFragLoading = (_: string, data: { frag: { relurl?: string; url: string } }) => {
      const name = fragmentName(data.frag);
      if (!name) return;
      setLesson((prev) => ({ ...prev, currentSegment: name }));
      pushEvent(`Fetching chunk ${name}`);
    };

    const onFragLoaded = (
      _: string,
      data: { frag: { relurl?: string; url: string; duration?: number } },
    ) => {
      const name = fragmentName(data.frag);
      if (!name) return;
      const duration = data.frag.duration
        ? ` (${data.frag.duration.toFixed(1)}s)`
        : "";
      pushEvent(`Buffered ${name}${duration}`);
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

    const onPlaying = () => {
      if (
        switchingRef.current &&
        (awaitingNewLevelRef.current || didStallRef.current)
      ) {
        endQualitySwitch();
      }
    };

    const onWaiting = () => {
      if (switchingRef.current) didStallRef.current = true;
    };

    const onResize = () => {
      if (switchingRef.current && awaitingNewLevelRef.current) {
        endQualitySwitch();
      }
    };

    const bufferTimer = window.setInterval(() => {
      setLesson((prev) => ({
        ...prev,
        bufferAhead: bufferedAhead(video),
      }));
    }, 500);

    hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
    hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
    hls.on(Hls.Events.FRAG_CHANGED, onFragChanged);
    hls.on(Hls.Events.FRAG_LOADING, onFragLoading);
    hls.on(Hls.Events.FRAG_LOADED, onFragLoaded);
    hls.on(Hls.Events.ERROR, onError);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("resize", onResize);

    return () => {
      window.clearInterval(bufferTimer);
      if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("resize", onResize);
      hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      hls.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
      hls.off(Hls.Events.FRAG_CHANGED, onFragChanged);
      hls.off(Hls.Events.FRAG_LOADING, onFragLoading);
      hls.off(Hls.Events.FRAG_LOADED, onFragLoaded);
      hls.off(Hls.Events.ERROR, onError);
      hls.destroy();
      hlsRef.current = null;
    };
  }, [videoRef, src, pushEvent, endQualitySwitch]);

  useEffect(() => {
    setLesson((prev) => ({ ...prev, error }));
  }, [error]);

  const startLoad = useCallback(() => {
    hlsRef.current?.startLoad();
  }, []);

  const setQuality = useCallback((level: number) => {
    const hls = hlsRef.current;
    if (!hls || hls.currentLevel === level) return;
    beginQualitySwitch();
    hls.currentLevel = level;
    setCurrentLevel(level);
    if (level === -1) {
      pushEvent("Quality set to Auto — hls.js will switch renditions as bandwidth changes.");
      window.setTimeout(() => {
        if (switchingRef.current && !awaitingNewLevelRef.current) {
          endQualitySwitch();
        }
      }, 400);
    } else {
      const next = hls.levels[level];
      pushEvent(
        `Quality locked to ${next?.height ? `${next.height}p` : `level ${level}`}.`,
      );
    }
  }, [beginQualitySwitch, endQualitySwitch, pushEvent]);

  return {
    startLoad,
    setQuality,
    levels,
    currentLevel,
    activeLevel,
    isReady,
    isSwitchingQuality,
    error,
    lesson,
  };
}

import { useEffect, type RefObject } from "react";
import Hls from "hls.js";

export const HLS_STREAM_URL = "/media/stream.m3u8";

export function useHls(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string = HLS_STREAM_URL,
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, autoStartLoad: false, maxBufferLength:10  });
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      });

      return () => hls.destroy();
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
  }, [videoRef, src]);
}

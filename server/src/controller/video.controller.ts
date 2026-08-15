import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import {
  apiPlaybackUrl,
  createDownloadUrl,
  createUploadUrl,
  getHlsObject,
  getPlaybackForVideo,
  listProcessedVideos,
} from "../lib/s3.js";
import { processVideoToHls } from "../services/processVideo.js";

function requestBaseUrl(req: Request) {
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host");
  return `${proto}://${host}`;
}

export const videoController = {
  createVideoRecord: async (req: Request, res: Response) => {
    const { title } = req.body as { title?: string };
    if (!title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    // temporary: no DB
    const video = {
      id: randomUUID(),
      title: title.trim(),
      status: "pending",
    };

    const key = `raw/${video.id}/source.mp4`;
    const uploadUrl = await createUploadUrl(key, "video/mp4");

    res.status(201).json({ ...video, uploadUrl });
  },

  listVideos: async (req: Request, res: Response) => {
    try {
      const videos = await listProcessedVideos(requestBaseUrl(req));
      res.status(200).json({ videos });
    } catch (error) {
      console.error("Failed to list videos:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list videos",
      });
    }
  },

  getPlayback: async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    if (!id?.trim()) {
      res.status(400).json({ error: "video id is required" });
      return;
    }

    try {
      const playback = await getPlaybackForVideo(id, requestBaseUrl(req));
      if (!playback) {
        res.status(404).json({ error: "Processed video not found" });
        return;
      }
      res.status(200).json(playback);
    } catch (error) {
      console.error(`Failed to get playback for ${id}:`, error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get playback",
      });
    }
  },

  streamHlsFile: async (req: Request, res: Response) => {
    const { id, file } = req.params as { id: string; file: string };

    try {
      const object = await getHlsObject(id, file);
      res.setHeader("Content-Type", object.contentType);
      res.setHeader("Cache-Control", "public, max-age=60");
      if (object.contentLength != null) {
        res.setHeader("Content-Length", String(object.contentLength));
      }
      await pipeline(object.body, res);
    } catch (error) {
      console.error(`Failed to stream HLS file ${id}/${file}:`, error);
      if (!res.headersSent) {
        res.status(404).json({
          error: error instanceof Error ? error.message : "HLS file not found",
        });
      }
    }
  },

  getDownloadUrl: async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const key = `raw/${id}/source.mp4`;
    const downloadUrl = await createDownloadUrl(key);
    res.status(200).json({ downloadUrl });
  },

  processVideo: async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    if (!id?.trim()) {
      res.status(400).json({ error: "video id is required" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const abort = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) abort.abort();
    };
    req.on("close", onClose);

    try {
      console.log(`Processing video ${id}…`);
      const result = await processVideoToHls(id, (event) => send(event), abort.signal);
      const playbackUrl = apiPlaybackUrl(id, requestBaseUrl(req));
      console.log(`Processing complete for ${id}:`, playbackUrl);
      send({
        stage: "completed",
        message: "HLS package is on S3. The player can start from master.m3u8.",
        percent: 100,
        playbackUrl,
        ...result,
      });
    } catch (error) {
      if (abort.signal.aborted) {
        console.log(`Processing cancelled for ${id}`);
      } else {
        console.error(`Failed to process video ${id}:`, error);
        send({
          stage: "failed",
          message:
            error instanceof Error ? error.message : "Processing failed",
        });
      }
    } finally {
      req.off("close", onClose);
      res.end();
    }
  },
};

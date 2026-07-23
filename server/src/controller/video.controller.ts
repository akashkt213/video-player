import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { createDownloadUrl, createUploadUrl } from "../lib/s3.js";
import { processVideoToHls } from "../services/processVideo.js";

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

    try {
      console.log(`Processing video ${id}…`);
      const result = await processVideoToHls(id);
      console.log(`Processing complete for ${id}:`, result.playbackUrl);
      res.status(200).json(result);
    } catch (error) {
      console.error(`Failed to process video ${id}:`, error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Processing failed",
      });
    }
  },
};

import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { createUploadUrl } from "../lib/s3.js";

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
    console.log("presigned upload URL:", uploadUrl);

    res.status(201).json(video);
  },
};
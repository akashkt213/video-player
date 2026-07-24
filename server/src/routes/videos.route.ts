import { Router } from "express";
import { videoController } from "../controller/video.controller.js";

const videoRouter = Router();

videoRouter.get("/", videoController.listVideos);
videoRouter.post("/", videoController.createVideoRecord);
videoRouter.get("/:id/playback", videoController.getPlayback);
videoRouter.get("/:id/hls/:file", videoController.streamHlsFile);
videoRouter.get("/:id/download-url", videoController.getDownloadUrl);
videoRouter.post("/:id/process", videoController.processVideo);

export default videoRouter;

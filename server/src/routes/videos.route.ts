import { Router } from "express";
import { videoController } from "../controller/video.controller.js";

const videoRouter = Router();

videoRouter.post("/", videoController.createVideoRecord);
videoRouter.get("/:id/download-url", videoController.getDownloadUrl);
videoRouter.post("/:id/process", videoController.processVideo);

export default videoRouter;

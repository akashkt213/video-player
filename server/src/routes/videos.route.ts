import { Router } from "express";
import { videoController } from "../controller/video.controller.js";


const videoRouter = Router();

videoRouter.post("/", videoController.createVideoRecord);

export default videoRouter;
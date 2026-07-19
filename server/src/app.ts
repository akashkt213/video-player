import cors from "cors";
import express from "express";

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Add your routes here, e.g.:
// import { videosRouter } from "./routes/videos.js";
// app.use("/api/videos", videosRouter);

export default app;

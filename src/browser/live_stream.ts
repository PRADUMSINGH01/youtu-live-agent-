import { launch, getStream } from "puppeteer-stream";
import { spawn, ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY;
if (!STREAM_KEY) {
  console.error("❌ Error: YOUTUBE_STREAM_KEY is required in your .env file!");
  console.log("👉 Add: YOUTUBE_STREAM_KEY=your-stream-key-here to .env");
  process.exit(1);
}

const RTMP_BASE_URL = (process.env.RTMP_URL || "rtmp://a.rtmp.youtube.com/live2")
  .replace("rtmps://", "rtmp://")
  .replace(/\/+$/, "");
const STREAM_URL = `${RTMP_BASE_URL}/${STREAM_KEY}`;

const PORT = parseInt(process.env.PORT || "5000");
const WIDTH = process.env.RECORD_WIDTH ? parseInt(process.env.RECORD_WIDTH) : 1920;
const HEIGHT = process.env.RECORD_HEIGHT ? parseInt(process.env.RECORD_HEIGHT) : 1080;
let TARGET_URL = process.env.TARGET_URL || `http://localhost:${PORT}`;

let ffmpegProcess: ChildProcess | null = null;
let browserInstance: any = null;
let serverInstance: any = null;

// Start embedded web server for frontend if local URL
function ensureLocalServer(): Promise<void> {
  return new Promise((resolve) => {
    const app = express();
    const frontendDir = path.resolve(process.cwd(), "frontend");

    if (fs.existsSync(frontendDir)) {
      app.use(express.static(frontendDir));
      app.get("/api/health", (_req, res) => {
        res.json({ status: "streaming", live: true, timestamp: new Date().toISOString() });
      });

      serverInstance = app.listen(PORT, "0.0.0.0", () => {
        console.log(`[Embedded Server] 🌐 Frontend hosted at http://0.0.0.0:${PORT}`);
        resolve();
      }).on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.log(`[Embedded Server] ℹ️ Port ${PORT} already active, using existing server.`);
        } else {
          console.warn(`[Embedded Server] Warning: ${err.message}`);
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function startLiveStream() {
  await ensureLocalServer();

  console.log("\n========================================================");
  console.log("🔴 24/7 DOCKER LIVE STREAM ENGINE ACTIVE");
  console.log("========================================================");
  console.log(`📡 Ingest Server : ${RTMP_BASE_URL}`);
  console.log(`🌐 Target Web Page: ${TARGET_URL}`);
  console.log(`🎥 Resolution    : ${WIDTH}x${HEIGHT} @ 60 FPS (1080p60)`);
  console.log("========================================================\n");

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

  browserInstance = await launch({
    channel: executablePath ? undefined : "chrome",
    executablePath,
    headless: "new",
    defaultViewport: {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
    },
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      "--window-position=0,0",
      "--start-fullscreen",
      "--kiosk",
      "--hide-scrollbars",
      "--disable-infobars",
      "--disable-notifications",
      "--no-default-browser-check",
      "--disable-features=Translate,OptimizationHints,MediaRouter",
      "--ignore-gpu-blocklist",
      "--enable-gpu",
      "--enable-webgl",
      "--enable-accelerated-2d-canvas",
      "--enable-gpu-rasterization",
      "--use-gl=angle",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--enable-usermedia-screen-capturing",
      "--allow-http-screen-capture",
      "--allow-running-insecure-content",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  const page = await browserInstance.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  console.log(`[Browser] Loading ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e: any) => {
    console.warn(`[Browser] Navigation notice: ${e.message}`);
  });

  // Auto-unlock audio and sound in the page
  await page.evaluate(() => {
    try {
      const audioBtn = document.getElementById("soundHeaderBtn");
      if (audioBtn) audioBtn.click();
      document.body.click();
    } catch (e) {}
  });

  console.log(`[Browser] Hooking 1080p 60FPS Video & Audio capture stream...`);
  const browserStream = await getStream(page, {
    audio: true,
    video: true,
    frameSize: 60,
    videoConstraints: {
      mandatory: {
        minWidth: 1920,
        minHeight: 1080,
        maxWidth: 1920,
        maxHeight: 1080,
        minFrameRate: 60,
        maxFrameRate: 60,
      } as any,
    },
    mimeType: "video/webm;codecs=vp8",
    videoBitsPerSecond: 10_000_000,
    audioBitsPerSecond: 192_000,
  });

  console.log(`[FFmpeg] Spawning 1080p60 RTMP ingest stream to YouTube Live...`);
  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel", "warning",
    "-thread_queue_size", "2048",
    "-i", "pipe:0",
    "-vf", "scale=1920:1080:flags=bicubic,fps=60,format=yuv420p",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-profile:v", "high",
    "-level", "4.2",
    "-b:v", "5500k",
    "-maxrate", "6000k",
    "-bufsize", "10000k",
    "-pix_fmt", "yuv420p",
    "-g", "120", // 2-second keyframes at 60 FPS
    "-keyint_min", "120",
    "-sc_threshold", "0",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "44100",
    "-flvflags", "no_duration_filesize",
    "-f", "flv",
    STREAM_URL,
  ];

  ffmpegProcess = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "inherit", "inherit"] });

  browserStream.pipe(ffmpegProcess.stdin!);

  browserStream.on("error", (err: any) => console.error("[Stream Error]", err));
  ffmpegProcess.on("error", (err: any) => console.error("[FFmpeg Error]", err));

  ffmpegProcess.on("exit", (code: number, signal: string) => {
    console.log(`[FFmpeg] Process exited with code ${code} (${signal}). Reconnecting in 5s...`);
    setTimeout(startLiveStream, 5000);
  });

  console.log("\n✅ LIVE BROADCAST ACTIVE! 24/7 Stream running on YouTube!\n");
}

process.on("SIGINT", async () => {
  console.log("\n[Live Stream] Gracefully stopping broadcast...");
  if (ffmpegProcess) ffmpegProcess.kill("SIGTERM");
  if (browserInstance) await browserInstance.close().catch(() => {});
  if (serverInstance) serverInstance.close();
  process.exit(0);
});

startLiveStream().catch((err) => {
  console.error("Fatal Live Stream Error:", err);
  process.exit(1);
});

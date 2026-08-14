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

const PORT = parseInt(process.env.PORT || "5000", 10);
const WIDTH = parseInt(process.env.STREAM_WIDTH || process.env.RECORD_WIDTH || "1280", 10);
const HEIGHT = parseInt(process.env.STREAM_HEIGHT || process.env.RECORD_HEIGHT || "720", 10);
const STREAM_FPS = parseInt(process.env.STREAM_FPS || "30", 10);
const ENABLE_WEBGL = process.env.ENABLE_WEBGL === "true";
const VIDEO_CODEC = process.env.VIDEO_CODEC || (process.env.USE_HARDWARE_ACCEL === "nvenc" ? "h264_nvenc" : "libx264");

// Dynamic Bitrate based on resolution & FPS if not specified
const defaultBitrate = WIDTH >= 1920 ? (STREAM_FPS >= 60 ? "6000k" : "4500k") : (STREAM_FPS >= 60 ? "4000k" : "2500k");
const STREAM_BITRATE = process.env.STREAM_BITRATE || defaultBitrate;
const STREAM_MAXRATE = process.env.STREAM_MAXRATE || `${parseInt(STREAM_BITRATE) * 1.15}k`;
const STREAM_BUFSIZE = process.env.STREAM_BUFSIZE || `${parseInt(STREAM_BITRATE) * 2}k`;

let TARGET_URL = process.env.TARGET_URL || `http://localhost:${PORT}`;

let ffmpegProcess: ChildProcess | null = null;
let browserInstance: any = null;
let serverInstance: any = null;
let isShuttingDown = false;

// Start embedded web server for frontend if local URL
function ensureLocalServer(): Promise<void> {
  return new Promise((resolve) => {
    const app = express();
    const frontendDir = path.resolve(process.cwd(), "frontend");

    if (fs.existsSync(frontendDir)) {
      app.use(express.static(frontendDir));
      app.get("/api/health", (_req: any, res: any) => {
        res.json({
          status: "streaming",
          live: true,
          resolution: `${WIDTH}x${HEIGHT}`,
          fps: STREAM_FPS,
          codec: VIDEO_CODEC,
          webgl: ENABLE_WEBGL,
          timestamp: new Date().toISOString()
        });
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
  if (isShuttingDown) return;

  if (browserInstance) {
    try { await browserInstance.close(); } catch (e) {}
    browserInstance = null;
  }

  await ensureLocalServer();

  console.log("\n========================================================");
  console.log("🔴 HIGH-PERFORMANCE 24/7 LIVE STREAM ENGINE ACTIVE");
  console.log("========================================================");
  console.log(`📡 Ingest Server  : ${RTMP_BASE_URL}`);
  console.log(`🎥 Resolution     : ${WIDTH}x${HEIGHT} @ ${STREAM_FPS} FPS`);
  console.log(`⚙️ Video Codec    : ${VIDEO_CODEC} (Bitrate: ${STREAM_BITRATE})`);
  console.log(`🎨 WebGL / Shaders: ${ENABLE_WEBGL ? "ENABLED (Hardware GPU)" : "DISABLED (Ultra-Fast 2D Canvas Fallback)"}`);
  console.log("========================================================\n");

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

  // Chrome flags optimized to eliminate software rasterizer CPU burn
  const chromeArgs = [
    `--window-size=${WIDTH},${HEIGHT}`,
    "--window-position=0,0",
    "--start-fullscreen",
    "--kiosk",
    "--hide-scrollbars",
    "--disable-infobars",
    "--disable-notifications",
    "--no-default-browser-check",
    "--disable-features=Translate,OptimizationHints,MediaRouter",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--enable-usermedia-screen-capturing",
    "--allow-http-screen-capture",
    "--allow-running-insecure-content",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ];

  if (ENABLE_WEBGL) {
    chromeArgs.push(
      "--ignore-gpu-blocklist",
      "--enable-gpu",
      "--enable-webgl",
      "--enable-accelerated-2d-canvas",
      "--enable-gpu-rasterization"
    );
  } else {
    // Disable WebGL inside Chromium to prevent Mesa llvmpipe from spawning background JIT compiler threads
    chromeArgs.push(
      "--disable-gpu",
      "--disable-software-rasterizer"
    );
  }

  browserInstance = await launch({
    channel: executablePath ? undefined : "chrome",
    executablePath,
    headless: "new",
    defaultViewport: {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
    },
    args: chromeArgs,
  });

  const page = await browserInstance.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  // Append stream query parameters so frontend tunes rendering frequency & shaders
  const urlObj = new URL(TARGET_URL);
  urlObj.searchParams.set("stream", "1");
  urlObj.searchParams.set("fps", String(STREAM_FPS));
  if (!ENABLE_WEBGL) {
    urlObj.searchParams.set("nowebgl", "1");
  }
  const streamPageUrl = urlObj.toString();

  console.log(`[Browser] Loading ${streamPageUrl}...`);
  await page.goto(streamPageUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch((e: any) => {
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

  console.log(`[Browser] Hooking ${WIDTH}x${HEIGHT} @ ${STREAM_FPS} FPS Video & Audio capture stream...`);
  const browserStream = await getStream(page, {
    audio: true,
    video: true,
    frameSize: STREAM_FPS,
    videoConstraints: {
      mandatory: {
        minWidth: WIDTH,
        minHeight: HEIGHT,
        maxWidth: WIDTH,
        maxHeight: HEIGHT,
        minFrameRate: STREAM_FPS,
        maxFrameRate: STREAM_FPS,
      } as any,
    },
    mimeType: "video/webm;codecs=vp8",
    videoBitsPerSecond: parseInt(STREAM_BITRATE) * 1000 * 1.5,
    audioBitsPerSecond: 192_000,
  });

  const keyframeInterval = STREAM_FPS * 2; // Exact 2.0s GOP required for YouTube RTMP ingest

  const ffmpegArgs = [
    "-hide_banner",
    "-loglevel", "warning",
    "-threads", "2",
    "-thread_queue_size", "2048",
    "-i", "pipe:0",
    "-c:v", VIDEO_CODEC,
  ];

  if (VIDEO_CODEC === "libx264") {
    ffmpegArgs.push(
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-profile:v", "high",
      "-level", "4.2",
      "-pix_fmt", "yuv420p"
    );
  } else if (VIDEO_CODEC === "h264_nvenc") {
    ffmpegArgs.push(
      "-preset", "p1", // Lowest latency / high throughput
      "-tune", "ull",
      "-pix_fmt", "yuv420p"
    );
  }

  ffmpegArgs.push(
    "-b:v", STREAM_BITRATE,
    "-maxrate", STREAM_MAXRATE,
    "-bufsize", STREAM_BUFSIZE,
    "-g", String(keyframeInterval),
    "-keyint_min", String(keyframeInterval),
    "-sc_threshold", "0",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "44100",
    "-flvflags", "no_duration_filesize",
    "-f", "flv",
    STREAM_URL
  );

  console.log(`[FFmpeg] Spawning ${VIDEO_CODEC} RTMP ingest stream to YouTube Live...`);
  ffmpegProcess = spawn("ffmpeg", ffmpegArgs, { stdio: ["pipe", "inherit", "inherit"] });

  browserStream.pipe(ffmpegProcess.stdin!);

  browserStream.on("error", (err: any) => console.error("[Stream Error]", err));
  ffmpegProcess.on("error", (err: any) => console.error("[FFmpeg Error]", err));

  ffmpegProcess.on("exit", async (code: number, signal: string) => {
    if (isShuttingDown) return;
    console.log(`[FFmpeg] Process exited with code ${code} (${signal}). Cleaning up browser and reconnecting in 5s...`);
    
    // Explicitly destroy stream and close previous browser to prevent PID/process leaks
    try { browserStream.destroy(); } catch (e) {}
    if (browserInstance) {
      try { await browserInstance.close(); } catch (e) {}
      browserInstance = null;
    }

    setTimeout(startLiveStream, 5000);
  });

  console.log(`\n✅ LIVE BROADCAST ACTIVE! 24/7 Stream running on YouTube at ${WIDTH}x${HEIGHT} @ ${STREAM_FPS} FPS!\n`);
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\n[Live Stream] Gracefully stopping broadcast...");
  if (ffmpegProcess) {
    try { ffmpegProcess.kill("SIGTERM"); } catch (e) {}
  }
  if (browserInstance) {
    try { await browserInstance.close(); } catch (e) {}
  }
  if (serverInstance) {
    try { serverInstance.close(); } catch (e) {}
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startLiveStream().catch((err) => {
  console.error("Fatal Live Stream Error:", err);
  process.exit(1);
});

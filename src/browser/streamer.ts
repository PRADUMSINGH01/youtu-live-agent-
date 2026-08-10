import { spawn, ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";

dotenv.config();

/**
 * ============================================================
 * Configuration
 * ============================================================
 */

const INPUT_FILE =
  process.env.INPUT_FILE || "4k_battle_perfect.mp4";

const RESOLVED_INPUT = path.isAbsolute(INPUT_FILE)
  ? INPUT_FILE
  : path.resolve(process.cwd(), INPUT_FILE);

const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY;

if (!STREAM_KEY) {
  throw new Error(
    "YOUTUBE_STREAM_KEY environment variable is required",
  );
}

const RTMP_BASE_URL =
  process.env.RTMP_URL ||
  "rtmps://a.rtmp.youtube.com/live2";

const STREAM_URL =
  `${RTMP_BASE_URL.replace(/\/+$/, "")}/${STREAM_KEY}`;

const RESTART_DELAY_MS = 5000;

/**
 * ============================================================
 * Runtime state
 * ============================================================
 */

let ffmpeg: ChildProcess | null = null;
let stopping = false;
let restartTimer: NodeJS.Timeout | null = null;

/**
 * ============================================================
 * FFmpeg arguments
 * ============================================================
 */

function buildFfmpegArgs(): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "info",

    /**
     * --------------------------------------------------------
     * INPUT
     * --------------------------------------------------------
     */

    // Read the prerecorded video at real-time speed.
    "-re",

    // Loop forever.
    "-stream_loop",
    "-1",

    // Input video.
    "-i",
    RESOLVED_INPUT,

    /**
     * --------------------------------------------------------
     * VIDEO
     * --------------------------------------------------------
     *
     * IMPORTANT:
     *
     * The source video is already H.264.
     * Do NOT re-encode it.
     *
     * This dramatically reduces CPU usage.
     */

    "-c:v",
    "copy",

    /**
     * --------------------------------------------------------
     * AUDIO
     * --------------------------------------------------------
     *
     * test.mp4 already contains AAC audio.
     *
     * We convert it to stereo AAC for broad YouTube
     * compatibility.
     */

    "-c:a",
    "aac",

    "-b:a",
    "128k",

    "-ar",
    "44100",

    "-ac",
    "2",

    /**
     * --------------------------------------------------------
     * STREAM MAPPING
     * --------------------------------------------------------
     */

    // Video from the MP4.
    "-map",
    "0:v:0",

    // Audio from the MP4.
    "-map",
    "0:a:0",

    /**
     * --------------------------------------------------------
     * OUTPUT
     * --------------------------------------------------------
     */

    // RTMP/RTMPS uses FLV.
    "-f",
    "flv",

    STREAM_URL,
  ];
}

/**
 * ============================================================
 * Start FFmpeg
 * ============================================================
 */

function startFfmpeg(): void {
  if (stopping) {
    return;
  }

  /**
   * Make sure the video exists.
   */

  if (!fs.existsSync(RESOLVED_INPUT)) {
    console.error(
      `[Streamer] Input video not found: ${RESOLVED_INPUT}`,
    );

    process.exit(1);
  }

  console.log("");
  console.log("====================================================");
  console.log("          YouTube Live Loop Streamer");
  console.log("====================================================");
  console.log(`Input       : ${RESOLVED_INPUT}`);
  console.log("Video       : H.264 COPY");
  console.log("Audio       : AAC 128k Stereo");
  console.log("Loop        : Infinite");
  console.log("Video Encode: DISABLED");
  console.log("Protocol    : RTMPS");
  console.log("Destination : YouTube Live");
  console.log("====================================================");
  console.log("");

  const args = buildFfmpegArgs();

  /**
   * Start FFmpeg.
   */

  ffmpeg = spawn("ffmpeg", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  /**
   * FFmpeg stdout.
   */

  ffmpeg.stdout?.on("data", (data: Buffer) => {
    const output = data.toString().trim();

    if (output) {
      console.log(`[FFmpeg] ${output}`);
    }
  });

  /**
   * FFmpeg stderr.
   *
   * FFmpeg normally writes progress information here.
   */

  ffmpeg.stderr?.on("data", (data: Buffer) => {
    const output = data.toString();

    if (output.includes("frame=")) {
      process.stdout.write(
        `\r[Live] ${output.trim().slice(0, 180)}`,
      );

      return;
    }

    const message = output.trim();

    if (message) {
      console.log(`\n[FFmpeg] ${message}`);
    }
  });

  /**
   * FFmpeg failed to start.
   */

  ffmpeg.on("error", (error) => {
    console.error(
      "\n[FFmpeg] Failed to start:",
      error,
    );
  });

  /**
   * FFmpeg exited.
   *
   * Restart automatically unless this was an intentional
   * shutdown.
   */

  ffmpeg.on("close", (code, signal) => {
    ffmpeg = null;

    console.log("");

    console.log(
      `[FFmpeg] Process exited. code=${
        code ?? "null"
      } signal=${signal ?? "none"}`,
    );

    if (stopping) {
      console.log("[Streamer] Shutdown complete.");
      return;
    }

    console.log(
      `[Streamer] Restarting FFmpeg in ${
        RESTART_DELAY_MS / 1000
      } seconds...`,
    );

    restartTimer = setTimeout(() => {
      restartTimer = null;
      startFfmpeg();
    }, RESTART_DELAY_MS);
  });
}

/**
 * ============================================================
 * Graceful shutdown
 * ============================================================
 */

function stopStreamer(signal: NodeJS.Signals): void {
  if (stopping) {
    return;
  }

  stopping = true;

  console.log(
    `\n[Streamer] Received ${signal}. Stopping...`,
  );

  /**
   * Cancel pending restart.
   */

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  /**
   * Stop FFmpeg gracefully.
   */

  if (ffmpeg && !ffmpeg.killed) {
    console.log("[Streamer] Stopping FFmpeg...");

    ffmpeg.kill("SIGINT");
  } else {
    process.exit(0);
  }

  /**
   * Force kill if FFmpeg doesn't stop.
   */

  setTimeout(() => {
    if (ffmpeg && !ffmpeg.killed) {
      console.log(
        "[Streamer] FFmpeg did not exit. Force killing...",
      );

      ffmpeg.kill("SIGKILL");
    }

    process.exit(0);
  }, 5000);
}

/**
 * ============================================================
 * Process signals
 * ============================================================
 */

process.on("SIGINT", () => {
  stopStreamer("SIGINT");
});

process.on("SIGTERM", () => {
  stopStreamer("SIGTERM");
});

/**
 * ============================================================
 * Error handling
 * ============================================================
 */

process.on("uncaughtException", (error) => {
  console.error(
    "\n[Node] Uncaught exception:",
    error,
  );
});

process.on("unhandledRejection", (error) => {
  console.error(
    "\n[Node] Unhandled rejection:",
    error,
  );
});

/**
 * ============================================================
 * Start
 * ============================================================
 */

console.log("[Streamer] Starting...");

startFfmpeg();
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

/**
 * Remove a trailing slash so we don't accidentally create:
 *
 * live2//stream-key
 */
const STREAM_URL =
  `${RTMP_BASE_URL.replace(/\/+$/, "")}/${STREAM_KEY}`;

const WIDTH = Number(
  process.env.STREAM_WIDTH || 1920,
);

const HEIGHT = Number(
  process.env.STREAM_HEIGHT || 1080,
);

const FPS = Number(
  process.env.STREAM_FPS || 60,
);

const VIDEO_BITRATE =
  process.env.VIDEO_BITRATE || "6000k";

const AUDIO_BITRATE =
  process.env.AUDIO_BITRATE || "128k";

/**
 * Wait 5 seconds before restarting FFmpeg
 * if the process unexpectedly exits.
 */
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

    // Read the prerecorded video in real time.
    "-re",

    // Loop the video forever.
    "-stream_loop",
    "-1",

    // Video input.
    "-i",
    RESOLVED_INPUT,

    /**
     * --------------------------------------------------------
     * SILENT AUDIO
     * --------------------------------------------------------
     *
     * Some YouTube Live configurations work better when
     * the stream contains an audio track.
     *
     * We generate silent stereo AAC audio.
     */

    "-f",
    "lavfi",

    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",

    /**
     * --------------------------------------------------------
     * VIDEO
     * --------------------------------------------------------
     */

    // Your source is already 1920x1080.
    // No scale filter is necessary.

    "-r",
    String(FPS),

    "-c:v",
    "libx264",

    // Good CPU/quality balance for the VPS.
    "-preset",
    "veryfast",

    // Target bitrate.
    "-b:v",
    VIDEO_BITRATE,

    // Maximum bitrate.
    "-maxrate",
    VIDEO_BITRATE,

    // Rate-control buffer.
    "-bufsize",
    "12000k",

    // Broad YouTube/player compatibility.
    "-pix_fmt",
    "yuv420p",

    /**
     * 2-second keyframe interval.
     *
     * 60 FPS × 2 seconds = 120 frames.
     */
    "-g",
    String(FPS * 2),

    /**
     * --------------------------------------------------------
     * AUDIO
     * --------------------------------------------------------
     */

    "-c:a",
    "aac",

    "-b:a",
    AUDIO_BITRATE,

    "-ar",
    "44100",

    "-ac",
    "2",

    /**
     * --------------------------------------------------------
     * STREAM MAPPING
     * --------------------------------------------------------
     */

    // Video from MP4.
    "-map",
    "0:v:0",

    // Silent audio from lavfi.
    "-map",
    "1:a:0",

    /**
     * --------------------------------------------------------
     * OUTPUT
     * --------------------------------------------------------
     */

    // RTMP/RTMPS requires FLV.
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
      `Input video file not found: ${RESOLVED_INPUT}`,
    );

    process.exit(1);
  }

  /**
   * Validate configuration.
   */

  if (!Number.isFinite(WIDTH) || WIDTH <= 0) {
    throw new Error("Invalid STREAM_WIDTH");
  }

  if (!Number.isFinite(HEIGHT) || HEIGHT <= 0) {
    throw new Error("Invalid STREAM_HEIGHT");
  }

  if (!Number.isFinite(FPS) || FPS <= 0) {
    throw new Error("Invalid STREAM_FPS");
  }

  console.log("");
  console.log("====================================================");
  console.log("       YouTube Live Loop Streamer");
  console.log("====================================================");

  console.log(`Input       : ${RESOLVED_INPUT}`);
  console.log(`Resolution  : ${WIDTH}x${HEIGHT}`);
  console.log(`FPS         : ${FPS}`);
  console.log(`Video       : ${VIDEO_BITRATE}`);
  console.log(`Audio       : ${AUDIO_BITRATE}`);
  console.log("Loop        : Infinite");
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
   * FFmpeg normally writes its progress/status
   * information to stderr.
   */

  ffmpeg.stderr?.on("data", (data: Buffer) => {
    const output = data.toString();

    /**
     * Progress lines normally contain "frame=".
     */

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
   * If this wasn't an intentional shutdown,
   * restart it automatically.
   */

  ffmpeg.on("close", (code, signal) => {
    ffmpeg = null;

    console.log("");

    console.log(
      `[FFmpeg] Process exited. code=${code ?? "null"} signal=${signal ?? "none"}`,
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
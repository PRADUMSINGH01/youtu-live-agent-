import { spawn, ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const INPUT_FILE = process.env.INPUT_FILE || "4k_battle_perfect.mp4";

const RESOLVED_INPUT = path.isAbsolute(INPUT_FILE)
  ? INPUT_FILE
  : path.resolve(process.cwd(), INPUT_FILE);

const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY;

if (!STREAM_KEY) {
  throw new Error("YOUTUBE_STREAM_KEY environment variable is required");
}

const RTMP_URL =
  process.env.RTMP_URL ||
  `rtmps://a.rtmp.youtube.com/live2/${STREAM_KEY}`;

const WIDTH = Number(process.env.STREAM_WIDTH || 1920);
const HEIGHT = Number(process.env.STREAM_HEIGHT || 1080);
const FPS = Number(process.env.STREAM_FPS || 60);
const VIDEO_BITRATE = process.env.VIDEO_BITRATE || "6000k";
const AUDIO_BITRATE = process.env.AUDIO_BITRATE || "128k";

const RESTART_DELAY_MS = 5000;

let ffmpeg: ChildProcess | null = null;
let stopping = false;
let restartTimer: NodeJS.Timeout | null = null;

function buildFfmpegArgs(): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "info",

    // Read the prerecorded video at normal playback speed.
    "-re",

    // Loop the input forever.
    "-stream_loop",
    "-1",

    // Video input.
    "-i",
    RESOLVED_INPUT,

    // Generate silent audio because YouTube Live expects an audio stream.
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",

    // Force 1080p output.
    "-vf",
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2`,

    // Force output FPS.
    "-r",
    String(FPS),

    // H.264 video.
    "-c:v",
    "libx264",

    // Good balance between CPU usage and quality.
    "-preset",
    "veryfast",

    // Video bitrate.
    "-b:v",
    VIDEO_BITRATE,
    "-maxrate",
    VIDEO_BITRATE,
    "-bufsize",
    "12000k",

    // YouTube-compatible pixel format.
    "-pix_fmt",
    "yuv420p",

    // 2-second keyframe interval at 60 FPS.
    "-g",
    String(FPS * 2),

    // Silent AAC audio.
    "-c:a",
    "aac",
    "-b:a",
    AUDIO_BITRATE,
    "-ar",
    "44100",
    "-ac",
    "2",

    // Select video from input 0 and generated audio from input 1.
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",

    // Keep audio/video running together.
    "-shortest",
    "0",

    // RTMP/RTMPS output.
    "-f",
    "flv",

    RTMP_URL,
  ];
}

function startFfmpeg(): void {
  if (stopping) {
    return;
  }

  if (!fs.existsSync(RESOLVED_INPUT)) {
    console.error(
      `Input video file not found: ${RESOLVED_INPUT}`,
    );
    process.exit(1);
  }

  console.log("");
  console.log("====================================================");
  console.log(" Starting YouTube Live Loop Streamer");
  console.log("====================================================");
  console.log(`Input       : ${RESOLVED_INPUT}`);
  console.log(`Resolution  : ${WIDTH}x${HEIGHT}`);
  console.log(`FPS         : ${FPS}`);
  console.log(`Video       : ${VIDEO_BITRATE}`);
  console.log(`Audio       : ${AUDIO_BITRATE}`);
  console.log("Loop        : Infinite");
  console.log("RTMP        : ******");
  console.log("====================================================");
  console.log("");

  const args = buildFfmpegArgs();

  ffmpeg = spawn("ffmpeg", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  ffmpeg.stdout?.on("data", (data: Buffer) => {
    const output = data.toString().trim();

    if (output) {
      console.log(`[FFmpeg] ${output}`);
    }
  });

  ffmpeg.stderr?.on("data", (data: Buffer) => {
    const output = data.toString();

    // FFmpeg normally writes its status information to stderr.
    if (output.includes("frame=")) {
      process.stdout.write(`\r${output.trim().slice(0, 160)}`);
    } else {
      const message = output.trim();

      if (message) {
        console.log(`\n[FFmpeg] ${message}`);
      }
    }
  });

  ffmpeg.on("error", (error) => {
    console.error("\nFFmpeg failed to start:", error);
  });

  ffmpeg.on("close", (code, signal) => {
    ffmpeg = null;

    console.log("");
    console.log(
      `FFmpeg exited. code=${code ?? "null"} signal=${signal ?? "none"}`,
    );

    if (stopping) {
      return;
    }

    console.log(
      `Restarting FFmpeg in ${RESTART_DELAY_MS / 1000} seconds...`,
    );

    restartTimer = setTimeout(() => {
      restartTimer = null;
      startFfmpeg();
    }, RESTART_DELAY_MS);
  });
}

function stopStreamer(signal: NodeJS.Signals): void {
  if (stopping) {
    return;
  }

  stopping = true;

  console.log(`\nReceived ${signal}. Stopping streamer...`);

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (ffmpeg && !ffmpeg.killed) {
    ffmpeg.kill("SIGINT");
  } else {
    process.exit(0);
  }

  setTimeout(() => {
    if (ffmpeg && !ffmpeg.killed) {
      ffmpeg.kill("SIGKILL");
    }

    process.exit(0);
  }, 5000);
}

process.on("SIGINT", () => stopStreamer("SIGINT"));
process.on("SIGTERM", () => stopStreamer("SIGTERM"));

process.on("uncaughtException", (error) => {
  console.error("\nUncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("\nUnhandled rejection:", error);
});

startFfmpeg();
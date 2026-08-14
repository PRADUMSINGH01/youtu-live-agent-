import { spawn, spawnSync, ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";
import { db, storage } from "../firebase/init.js";
import { recordSingleVideo } from "./init.js";

dotenv.config();

/**
 * ============================================================
 * Configuration & Dynamic File Resolution
 * ============================================================
 */

const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY;

if (!STREAM_KEY) {
  throw new Error("YOUTUBE_STREAM_KEY environment variable is required in .env");
}

let RTMP_BASE_URL =
  process.env.RTMP_URL || "rtmp://a.rtmp.youtube.com/live2";

// Normalize rtmps on YouTube on Windows to standard rtmp
if (RTMP_BASE_URL.startsWith("rtmps://a.rtmp.youtube.com")) {
  RTMP_BASE_URL = RTMP_BASE_URL.replace("rtmps://", "rtmp://");
}

const STREAM_URL = `${RTMP_BASE_URL.replace(/\/+$/, "")}/${STREAM_KEY}`;
const RESTART_DELAY_MS = 5000;

interface VideoSourceInfo {
  sourceType: "firebase" | "local";
  urlOrPath: string;
  displayName: string;
  sizeFormatted?: string;
}

/**
 * Query Firestore & Firebase Storage for the latest recorded/uploaded video
 */
async function resolveFirebaseVideoInput(): Promise<VideoSourceInfo | null> {
  try {
    console.log("[Firebase] 🔍 Querying Firestore 'videos' collection for the latest cloud video...");
    const snapshot = await db
      .collection("videos")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!snapshot.empty && snapshot.docs.length > 0) {
      const doc = snapshot.docs[0];
      if (!doc) return null;
      const data = doc.data();
      const storagePath = data.storagePath;

      console.log(`[Firebase] 📄 Found Firestore video record: "${data.title || data.fileName}" (Doc ID: ${doc.id})`);

      let freshSignedUrl: string = data.url;

      // Generate a fresh signed URL from Firebase Storage to ensure it is always active
      if (storagePath) {
        try {
          const bucket = storage.bucket();
          const file = bucket.file(storagePath);
          const [exists] = await file.exists();
          if (exists) {
            const [url] = await file.getSignedUrl({
              action: "read",
              expires: "03-01-2030",
            });
            freshSignedUrl = url;
            console.log(`[Firebase] 🔗 Generated fresh signed URL for Storage path '${storagePath}'`);
          } else {
            console.warn(`[Firebase] Notice: Storage file '${storagePath}' not found in bucket '${bucket.name}'.`);
          }
        } catch (storageErr: any) {
          console.warn(`[Firebase] Storage signed URL notice: ${storageErr.message}`);
        }
      }

      if (freshSignedUrl && (freshSignedUrl.startsWith("http://") || freshSignedUrl.startsWith("https://"))) {
        return {
          sourceType: "firebase",
          urlOrPath: freshSignedUrl,
          displayName: data.title || data.fileName || "Firebase Cloud Video",
          sizeFormatted: data.sizeFormatted || `${((data.size || 0) / (1024 * 1024)).toFixed(1)} MB`,
        };
      }
    } else {
      console.log("[Firebase] ℹ️ No video records found in Firestore 'videos' collection.");
    }
  } catch (err: any) {
    console.warn("[Firebase] Notice: Firestore query error:", err.message);
  }
  return null;
}

/**
 * Find newest recorded chunk in local recordings/ directory
 */
function findLatestLocalRecordingFile(): VideoSourceInfo | null {
  const recordingsDir = path.resolve(process.cwd(), "recordings");
  if (!fs.existsSync(recordingsDir)) return null;

  const files = fs
    .readdirSync(recordingsDir)
    .filter((f) => f.endsWith(".webm") || f.endsWith(".mp4"))
    .map((f) => {
      const fullPath = path.join(recordingsDir, f);
      const stat = fs.statSync(fullPath);
      return {
        name: f,
        fullPath,
        mtime: stat.mtimeMs,
        size: stat.size,
      };
    })
    .filter((f) => f.size > 1024 * 1024 * 2) // Prefer complete recordings > 2MB
    .sort((a, b) => b.mtime - a.mtime);

  const newestComplete = files[0];
  if (newestComplete) {
    return {
      sourceType: "local",
      urlOrPath: newestComplete.fullPath,
      displayName: newestComplete.name,
      sizeFormatted: `${(newestComplete.size / (1024 * 1024)).toFixed(1)} MB`,
    };
  }

  return null;
}

/**
 * Resolve the stream input source.
 * Priority:
 * 1. CLI argument (if passed explicitly)
 * 2. Firebase Cloud Storage & Firestore (TOP PRIORITY)
 * 3. Local recordings/ directory
 * 4. .env fallback
 * 5. Auto-Bootstrap 2-minute recording
 */
async function resolveStreamInputSource(): Promise<VideoSourceInfo> {
  // 1. Explicit CLI argument (if passed directly in terminal)
  const cliArg = process.argv[2];
  if (cliArg) {
    const isUrl = cliArg.startsWith("http://") || cliArg.startsWith("https://");
    return {
      sourceType: isUrl ? "firebase" : "local",
      urlOrPath: isUrl ? cliArg : path.resolve(process.cwd(), cliArg),
      displayName: path.basename(cliArg),
    };
  }

  // 2. Query Firestore & Firebase Storage FIRST
  const firebaseAsset = await resolveFirebaseVideoInput();
  if (firebaseAsset) {
    console.log(`[Streamer] ☁️ Selected Firebase Cloud Asset: "${firebaseAsset.displayName}"`);
    return firebaseAsset;
  }

  // 3. Fallback: Local recordings/ directory
  const localRecording = findLatestLocalRecordingFile();
  if (localRecording) {
    console.log(`[Streamer] 📁 Selected Local Recording File: "${localRecording.displayName}"`);
    return localRecording;
  }

  // 4. Fallback: INPUT_FILE from .env if present and valid
  if (process.env.INPUT_FILE) {
    const resolvedEnv = path.isAbsolute(process.env.INPUT_FILE)
      ? process.env.INPUT_FILE
      : path.resolve(process.cwd(), process.env.INPUT_FILE);

    if (fs.existsSync(resolvedEnv) && fs.statSync(resolvedEnv).size > 1024 * 100) {
      const stats = fs.statSync(resolvedEnv);
      console.log(`[Streamer] ⚙️ Selected .env Input File: "${path.basename(resolvedEnv)}"`);
      return {
        sourceType: "local",
        urlOrPath: resolvedEnv,
        displayName: path.basename(resolvedEnv),
        sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
      };
    }
  }

  // 5. Auto-Bootstrap: No recording found! Record a 2-minute video first!
  console.log("\n====================================================");
  console.log("⚡ Auto-Bootstrap: No video recording found!");
  console.log("🎥 Recording a 2-minute (120s) Full HD video first...");
  console.log("====================================================\n");

  const newlyRecordedFile = await recordSingleVideo(120);

  return {
    sourceType: "local",
    urlOrPath: newlyRecordedFile,
    displayName: path.basename(newlyRecordedFile),
    sizeFormatted: `${(fs.statSync(newlyRecordedFile).size / (1024 * 1024)).toFixed(1)} MB`,
  };
}

/**
 * ============================================================
 * Media File Probing
 * ============================================================
 */

let ffmpeg: ChildProcess | null = null;
let stopping = false;
let restartTimer: NodeJS.Timeout | null = null;

interface MediaProbeInfo {
  hasAudio: boolean;
  videoCodec: string;
  audioCodec?: string | undefined;
  duration?: string | undefined;
  resolution?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

function probeMediaSource(sourceUrlOrPath: string): MediaProbeInfo {
  try {
    const probe = spawnSync(
      "ffprobe",
      [
        "-v", "error",
        "-show_entries", "stream=codec_type,codec_name,width,height",
        "-of", "json",
        sourceUrlOrPath,
      ],
      { encoding: "utf-8" }
    );

    if (!probe.stdout) {
      return { hasAudio: false, videoCodec: "h264" };
    }

    const data = JSON.parse(probe.stdout);
    const streams = data.streams || [];

    const videoStream = streams.find((s: any) => s.codec_type === "video");
    const audioStream = streams.find((s: any) => s.codec_type === "audio");

    return {
      hasAudio: Boolean(audioStream),
      videoCodec: videoStream?.codec_name || "h264",
      audioCodec: audioStream?.codec_name,
      width: videoStream?.width,
      height: videoStream?.height,
      resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : undefined,
    };
  } catch (err) {
    console.warn("[Streamer] ffprobe warning, using defaults:", err);
    return { hasAudio: false, videoCodec: "h264" };
  }
}

/**
 * ============================================================
 * FFmpeg Ingest Arguments Builder
 * ============================================================
 */

function buildFfmpegArgs(inputSource: string, probe: MediaProbeInfo): string[] {
  const args: string[] = [
    "-hide_banner",
    "-loglevel", "info",

    // Real-time continuous infinite loop
    "-re",
    "-stream_loop", "-1",
    "-i", inputSource,
  ];

  if (!probe.hasAudio) {
    // Virtual silent stereo audio (44.1kHz AAC) for YouTube Live compliance
    args.push(
      "-f", "lavfi",
      "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"
    );
  }

  // Zero-Lag Video Encoding:
  // Normalize variable timestamps with fps=30,setpts=N/(30*TB) to eliminate jitter and duplicate lag
  if (probe.videoCodec === "h264") {
    args.push("-c:v", "copy");
  } else {
    args.push(
      "-vf", "fps=30,setpts=N/(30*TB)",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-pix_fmt", "yuv420p",
      "-g", "60",
      "-b:v", "4500k",
      "-minrate", "4000k",
      "-maxrate", "5000k",
      "-bufsize", "9000k"
    );
  }

  // Audio encoding: Convert Opus/Vorbis/Cloud audio to high-fidelity AAC 128k stereo
  args.push(
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2"
  );

  // Stream mapping
  args.push("-map", "0:v:0");
  if (probe.hasAudio) {
    args.push("-map", "0:a:0");
  } else {
    args.push("-map", "1:a:0");
  }

  // Output container and FLV streaming flags
  args.push(
    "-flvflags", "no_duration_filesize",
    "-f", "flv",
    STREAM_URL
  );

  return args;
}

/**
 * ============================================================
 * Start FFmpeg Live Broadcast
 * ============================================================
 */

async function startFfmpeg(): Promise<void> {
  if (stopping) {
    return;
  }

  const sourceInfo = await resolveStreamInputSource();

  if (sourceInfo.sourceType === "local" && !fs.existsSync(sourceInfo.urlOrPath)) {
    console.error(`[Streamer] Local input video not found: ${sourceInfo.urlOrPath}`);
    process.exit(1);
  }

  const probe = probeMediaSource(sourceInfo.urlOrPath);

  console.log("");
  console.log("====================================================");
  console.log("    YouTube Live Broadcast Streamer (Cloud & Local)");
  console.log("====================================================");
  console.log(`Source Type : ${sourceInfo.sourceType === "firebase" ? "☁️ Firebase Cloud Storage" : "📁 Local Disk File"}`);
  console.log(`Asset Name  : ${sourceInfo.displayName}`);
  console.log(`Size / Info : ${sourceInfo.sizeFormatted || "Cloud Asset"}`);
  console.log(`Resolution  : ${probe.resolution || "1920x1080"} (Full HD 1080p)`);
  console.log(`Video Mode  : ${probe.videoCodec.toUpperCase()} -> H.264 (4.5 Mbps, 30 FPS Normalizer)`);
  console.log(`Audio Mode  : ${probe.hasAudio ? `${probe.audioCodec?.toUpperCase() || "Source"} -> AAC 128k Stereo` : "Synthetic Silent AAC 128k Stereo"}`);
  console.log("Loop Mode   : 24/7 Continuous Infinite Loop");
  console.log("Protocol    : RTMP / FLV");
  console.log(`Endpoint    : ${RTMP_BASE_URL}`);
  console.log("Destination : YouTube Live Ingest Server");
  console.log("====================================================");
  console.log("");

  const args = buildFfmpegArgs(sourceInfo.urlOrPath, probe);

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

    if (output.includes("frame=")) {
      process.stdout.write(`\r[Live Broadcast] ${output.trim().slice(0, 180)}`);
      return;
    }

    const message = output.trim();
    if (message) {
      console.log(`\n[FFmpeg] ${message}`);
    }
  });

  ffmpeg.on("error", (error) => {
    console.error("\n[FFmpeg] Process error:", error);
  });

  ffmpeg.on("close", (code, signal) => {
    ffmpeg = null;
    console.log("");
    console.log(
      `[FFmpeg] Process exited (code=${code ?? "null"} signal=${signal ?? "none"})`
    );

    if (stopping) {
      console.log("[Streamer] Shutdown complete.");
      return;
    }

    console.log(
      `[Streamer] Restarting broadcast in ${RESTART_DELAY_MS / 1000} seconds...`
    );

    restartTimer = setTimeout(() => {
      restartTimer = null;
      startFfmpeg().catch((err) => console.error("Restart error:", err));
    }, RESTART_DELAY_MS);
  });
}

/**
 * ============================================================
 * Graceful Shutdown
 * ============================================================
 */

function stopStreamer(signal: NodeJS.Signals): void {
  if (stopping) {
    return;
  }

  stopping = true;
  console.log(`\n[Streamer] Received ${signal}. Stopping broadcast gracefully...`);

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (ffmpeg && !ffmpeg.killed) {
    console.log("[Streamer] Stopping FFmpeg process...");
    ffmpeg.kill("SIGINT");
  } else {
    process.exit(0);
  }

  setTimeout(() => {
    if (ffmpeg && !ffmpeg.killed) {
      console.log("[Streamer] FFmpeg did not exit in 5s. Force killing...");
      ffmpeg.kill("SIGKILL");
    }
    process.exit(0);
  }, 5000);
}

process.on("SIGINT", () => {
  stopStreamer("SIGINT");
});

process.on("SIGTERM", () => {
  stopStreamer("SIGTERM");
});

process.on("uncaughtException", (error) => {
  console.error("\n[Streamer] Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("\n[Streamer] Unhandled rejection:", error);
});

console.log("[Streamer] Initializing YouTube live broadcaster...");
startFfmpeg().catch((err) => {
  console.error("[Streamer] Startup error:", err);
  process.exit(1);
});
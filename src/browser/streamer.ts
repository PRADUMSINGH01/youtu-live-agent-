import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const INPUT_FILE = process.env.INPUT_FILE || "4k_battle_perfect.mp4";
const RESOLVED_INPUT = path.isAbsolute(INPUT_FILE) ? INPUT_FILE : path.resolve(process.cwd(), INPUT_FILE);
const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY || "w263-863b-mq4c-5bce-6cqh";
const RTMP_URL = process.env.RTMP_URL || `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`;

async function startLiveLoopStreamer() {
	if (!fs.existsSync(RESOLVED_INPUT)) {
		console.error(`Error: Input video file not found at ${RESOLVED_INPUT}`);
		process.exit(1);
	}

	console.log(`====================================================`);
	console.log(` Starting 24/7 Continuous Live Loop Streamer`);
	console.log(` Input Video : ${RESOLVED_INPUT}`);
	console.log(` Target RTMP : ${RTMP_URL.replace(STREAM_KEY, "******")}`);
	console.log(` Mode        : Infinite Loop (-stream_loop -1)`);
	console.log(`====================================================`);

	// FFmpeg command to stream video continuously in a 24/7 infinite loop with real-time rate pacing and synthetic audio
	const ffmpegArgs = [
		"-y",
		"-re",                              // Read input at native frame rate (essential for live RTMP streaming)
		"-stream_loop", "-1",               // Infinite video loop
		"-i", RESOLVED_INPUT,              // Input video file (e.g. 4k_battle_perfect.mp4)
		"-f", "lavfi",
		"-i", "anullsrc=channel_layout=stereo:sample_rate=44100", // Synthetic silent audio stream
		"-c:v", "libx264",                  // H.264 video codec
		"-preset", "veryfast",              // Fast encoding for low latency
		"-maxrate", "6000k",                // 6 Mbps max bitrate
		"-bufsize", "12000k",               // 12 Mbps buffer size
		"-pix_fmt", "yuv420p",              // YUV420p format for maximum player compatibility
		"-g", "120",                        // Keyframe interval = 2 seconds (at 60FPS)
		"-c:a", "aac",                      // AAC audio codec
		"-b:a", "128k",                     // 128kbps audio bitrate
		"-ar", "44100",                     // 44.1kHz audio sampling rate
		"-map", "0:v:0",                    // Select video from 1st input (4k_battle_perfect.mp4)
		"-map", "1:a:0",                    // Select audio from 2nd input (anullsrc)
		"-f", "flv",                        // FLV container for RTMP protocol
		RTMP_URL,
	];

	const ffmpeg = spawn("ffmpeg", ffmpegArgs);

	ffmpeg.stdout.on("data", (data) => {
		console.log(`[FFmpeg]: ${data.toString().trim()}`);
	});

	ffmpeg.stderr.on("data", (data) => {
		const str = data.toString();
		if (str.includes("frame=") || str.includes("fps=") || str.includes("bitrate=")) {
			process.stdout.write(`\r[Live Streamer]: ${str.trim().slice(0, 90)}`);
		} else {
			console.log(`\n[FFmpeg Status]: ${str.trim()}`);
		}
	});

	ffmpeg.on("close", (code) => {
		console.log(`\nFFmpeg process exited with code ${code}`);
	});

	ffmpeg.on("error", (err) => {
		console.error("\nFailed to start FFmpeg process:", err);
	});

	const cleanup = () => {
		console.log("\nStopping continuous live loop stream...");
		if (!ffmpeg.killed) {
			ffmpeg.kill("SIGINT");
		}
		process.exit(0);
	};

	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);
}

startLiveLoopStreamer().catch((err) => {
	console.error("Streamer Error:", err);
});

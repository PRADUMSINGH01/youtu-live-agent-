import { launch, getStream, wss } from "puppeteer-stream";
import { spawn } from "child_process";
import express from "express";
import dotenv from "dotenv";
dotenv.config();
const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY || "w263-863b-mq4c-5bce-6cqh";
const RTMP_URL = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`;

// Flag to check if we are running inside the Docker container
const isDocker = process.env.DOCKER === "true";
console.log(isDocker, RTMP_URL);
let streamStatus = "Starting up... Browser and FFmpeg are initializing.";

async function test() {
	console.log("Launching browser...");
	
	const browserOptions: any = isDocker ? {
		// Production (Docker) settings
		executablePath: "/usr/bin/chromium-browser",
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--start-maximized", "--autoplay-policy=no-user-gesture-required", "--window-size=1920,1080", "--no-first-run", "--no-default-browser-check"],
		ignoreDefaultArgs: ["--mute-audio"],
		defaultViewport: null,
		timeout: 60000,
	} : {
		// Local (Windows) settings
		channel: "chrome",
		args: ["--start-maximized", "--autoplay-policy=no-user-gesture-required", "--no-first-run", "--no-default-browser-check"],
		ignoreDefaultArgs: ["--mute-audio"],
		defaultViewport: {
			width: 1920,
			height: 1080,
		},
		timeout: 60000,
	};

	const browser = await launch(browserOptions);

	const page = await browser.newPage();
	console.log("Navigating to page...");
	await page.goto("https://youtube-one-rust.vercel.app/dashboard/flag-battler", { timeout: 60000 });
	
	console.log("Getting stream...");
	// Use a small frameSize so data flushes to FFmpeg continuously, avoiding buffering freezes
	// Boost video bitrate to 5Mbps for crisp quality
	const stream = await getStream(page, { 
		audio: true, 
		video: true, 
		frameSize: 20,
		videoBitsPerSecond: 5000000 // 5 Mbps
	});
	
	console.log("Starting FFmpeg and streaming to YouTube...");
	
	// Use system PATH ffmpeg in Docker, or the hardcoded absolute path locally
	const ffmpegPath = isDocker 
		? "ffmpeg" 
		: "C:/Users/admin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe";

	
	const ffmpegProcess = spawn(ffmpegPath, [
		"-f", "webm", // Explicitly state input format to avoid probing errors
		"-i", "-", // Read input from stdin
		"-c:v", "libx264", // Video codec
		"-preset", "ultrafast", // Preset for real-time streaming
		"-tune", "zerolatency", // Tuning for low latency
		"-r", "60", // 60 FPS for smooth YouTube streaming
		"-g", "120", // Keyframe interval (2x framerate is standard for YT)
		"-c:a", "aac", // Audio codec
		"-b:a", "128k", // Audio bitrate
		"-ar", "44100", // Audio sample rate
		"-f", "flv", // Output format for RTMP
		RTMP_URL
	]);

	ffmpegProcess.stderr.on("data", (data) => {
		const logStr = data.toString();
		console.log(logStr);
		
		// If FFmpeg is outputting frame metrics, it means it is successfully sending data to YouTube!
		if (logStr.includes("frame=") || logStr.includes("fps=")) {
			streamStatus = "Livestream bot is running! Data is successfully reaching YouTube!";
		} else if (logStr.toLowerCase().includes("error")) {
			streamStatus = "FFmpeg Error: " + logStr;
		}
	});

	ffmpegProcess.on("close", (code) => {
		streamStatus = `FFmpeg crashed or exited with code ${code}`;
		console.log(streamStatus);
	});

	// Pipe the puppeteer stream into ffmpeg
	stream.pipe(ffmpegProcess.stdin);

	console.log("Stream is live! Press Ctrl+C in the terminal to stop.");
}

// Start a minimal Express server to satisfy Google Cloud Run's port requirement
const app = express();
const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
	res.send(streamStatus);
});

app.listen(port, () => {
	console.log(`Health check server listening on port ${port}`);
	// Start the actual puppeteer streaming task in the background
	test().catch((err) => {
		streamStatus = `Bot crashed: ${err.message}`;
		console.error(err);
	});
});

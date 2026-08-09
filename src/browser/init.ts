import { launch, getStream, wss } from "puppeteer-stream";
import { spawn } from "child_process";
import express from "express";

const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY || "9qqy-b04d-6r7e-hd6a-9sfh";
const RTMP_URL = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`;

// Flag to check if we are running inside the Docker container
const isDocker = process.env.DOCKER === "true";

async function test() {
	console.log("Launching browser...");
	
	const browserOptions: any = isDocker ? {
		// Production (Docker) settings
		executablePath: "/usr/bin/chromium-browser",
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--start-maximized"],
		ignoreDefaultArgs: ["--mute-audio"],
		defaultViewport: null,
	} : {
		// Local (Windows) settings
		channel: "chrome",
		ignoreDefaultArgs: ["--mute-audio"],
		defaultViewport: {
			width: 1920,
			height: 1080,
		},
	};

	const browser = await launch(browserOptions);

	const page = await browser.newPage();
	console.log("Navigating to page...");
	await page.goto("https://youtube-one-rust.vercel.app/dashboard/flag-battler");
	
	console.log("Getting stream...");
	const stream = await getStream(page, { audio: true, video: true });
	
	console.log("Starting FFmpeg and streaming to YouTube...");
	
	// Use system PATH ffmpeg in Docker, or the hardcoded absolute path locally
	const ffmpegPath = isDocker 
		? "ffmpeg" 
		: "C:/Users/admin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe";

	
	const ffmpegProcess = spawn(ffmpegPath, [
		"-i", "-", // Read input from stdin
		"-c:v", "libx264", // Video codec
		"-preset", "ultrafast", // Preset for real-time streaming
		"-tune", "zerolatency", // Tuning for low latency
		"-r", "30", // Framerate
		"-g", "60", // Keyframe interval (2x framerate is standard for YT)
		"-c:a", "aac", // Audio codec
		"-b:a", "128k", // Audio bitrate
		"-ar", "44100", // Audio sample rate
		"-f", "flv", // Output format for RTMP
		RTMP_URL
	]);

	ffmpegProcess.stderr.on("data", (data) => {
		// Log FFmpeg output to help debug any future streaming issues
		console.log(data.toString());
	});

	ffmpegProcess.on("close", (code) => {
		console.log(`FFmpeg process exited with code ${code}`);
	});

	// Pipe the puppeteer stream into ffmpeg
	stream.pipe(ffmpegProcess.stdin);

	console.log("Stream is live! Press Ctrl+C in the terminal to stop.");
}

// Start a minimal Express server to satisfy Google Cloud Run's port requirement
const app = express();
const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
	res.send("Livestream bot is running!");
});

app.listen(port, () => {
	console.log(`Health check server listening on port ${port}`);
	// Start the actual puppeteer streaming task in the background
	test().catch(console.error);
});

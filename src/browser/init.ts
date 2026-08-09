import { launch, getStream, wss } from "puppeteer-stream";
import { spawn } from "child_process";
import express from "express";
import dotenv from "dotenv";
dotenv.config();
const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY || "w263-863b-mq4c-5bce-6cqh";
const RTMP_URL = `rtmps://a.rtmp.youtube.com/live2/${STREAM_KEY}`;

// Flag to check if we are running inside the Docker container
const isDocker = process.env.DOCKER === "true";
console.log(isDocker, RTMP_URL);
let streamStatus = "Starting up... Browser and FFmpeg are initializing.";
const ffmpegLogs: string[] = [];

async function test() {
	console.log("Launching browser...");
	
	const browserOptions: any = isDocker ? {
		// Production (Docker) settings
		executablePath: "/usr/bin/chromium",
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--start-maximized", "--autoplay-policy=no-user-gesture-required", "--window-size=1280,720", "--no-first-run", "--no-default-browser-check", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
		ignoreDefaultArgs: ["--mute-audio"],
		defaultViewport: {
			width: 1280,
			height: 720
		},
		timeout: 120000,
		protocolTimeout: 120000,
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
	// Set standard Chrome User-Agent so Vercel/Next.js does not block the container
	await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
	
	console.log("Navigating to page...");
	await page.goto("https://youtube-one-rust.vercel.app/dashboard/flag-battler", { waitUntil: "networkidle2", timeout: 60000 });
	
	console.log("Getting stream...");
	// Use 500ms frameSize to avoid pipe buffer overflows that cause green/pixelated frame corruption
	const stream = await getStream(page, { 
		audio: true, 
		video: true, 
		frameSize: 500,
		videoBitsPerSecond: 8000000 // 8 Mbps input quality
	});
	
	console.log("Starting FFmpeg and streaming to YouTube...");
	
	// Use system PATH ffmpeg in Docker, or the hardcoded absolute path locally
	const ffmpegPath = isDocker 
		? "ffmpeg" 
		: "C:/Users/admin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe";

	
	const ffmpegProcess = spawn(ffmpegPath, [
		"-f", "webm", // Explicitly state input format to avoid probing errors
		"-i", "-", // Read input from stdin
		"-c:v", "libx264", // H.264 Video codec
		"-preset", "veryfast", // High quality real-time encoding
		"-pix_fmt", "yuv420p", // Standard crisp color space
		"-b:v", "6000k", // 6 Mbps Bitrate (YouTube recommended for HD)
		"-minrate", "4000k",
		"-maxrate", "6000k",
		"-bufsize", "12000k",
		"-r", "30", // 30 FPS for smooth rendering
		"-g", "30", // Keyframe every 1 second (clears any artifacts instantly)
		"-c:a", "aac", // Audio codec
		"-b:a", "128k", // Audio bitrate
		"-ar", "44100", // Audio sample rate
		"-f", "flv", // Output format for RTMP
		RTMP_URL
	]);

	ffmpegProcess.stderr.on("data", (data) => {
		const logStr = data.toString().trim();
		if (logStr) {
			console.log(logStr);
			ffmpegLogs.push(logStr);
			// Keep only the last 15 lines of logs for the web dashboard
			if (ffmpegLogs.length > 15) ffmpegLogs.shift();
		}
		
		// If FFmpeg is outputting frame metrics, it means it is successfully sending data to YouTube!
		if (logStr.includes("frame=") || logStr.includes("fps=")) {
			streamStatus = "🟢 Livestream bot is running! Data is actively reaching YouTube!";
		} else if (logStr.toLowerCase().includes("error")) {
			streamStatus = "🔴 FFmpeg Error: " + logStr;
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

app.get("/health", (req, res) => {
	res.status(200).send("OK");
});

app.get("/", (req, res) => {
	const html = `
		<!DOCTYPE html>
		<html>
			<head>
				<title>YouTube Agent Dashboard</title>
				<!-- Automatically refresh the page every 3 seconds to see new logs -->
				<meta http-equiv="refresh" content="3">
				<style>
					body { font-family: 'Courier New', Courier, monospace; background: #0d1117; color: #58a6ff; padding: 20px; line-height: 1.5; }
					h1 { color: #c9d1d9; border-bottom: 1px solid #30363d; padding-bottom: 10px; }
					.card { background: #161b22; padding: 20px; border-radius: 8px; border: 1px solid #30363d; margin-bottom: 20px; }
					.highlight { color: #7ee787; font-weight: bold; }
					pre { background: #010409; padding: 15px; border-radius: 5px; overflow-x: auto; color: #e6edf3; font-size: 14px; }
				</style>
			</head>
			<body>
				<h1>📺 YouTube Live Agent Dashboard</h1>
				
				<div class="card">
					<h3>⚙️ System Status</h3>
					<p><strong>Environment:</strong> <span class="highlight">${isDocker ? "🐳 Docker (Google Cloud Run)" : "💻 Local Machine (Windows)"}</span></p>
					<p><strong>Stream Status:</strong> <span class="highlight">${streamStatus}</span></p>
				</div>

				<div class="card">
					<h3>🎥 Live FFmpeg Logs</h3>
					<p><em>(Auto-refreshing every 3 seconds...)</em></p>
					<pre>${ffmpegLogs.length > 0 ? ffmpegLogs.join("\\n") : "Waiting for FFmpeg to start..."}</pre>
				</div>
			</body>
		</html>
	`;
	res.send(html);
});

app.listen(port, () => {
	console.log(`Health check server listening on port ${port}`);
	// Start the actual puppeteer streaming task in the background
	test().catch((err) => {
		streamStatus = `Bot crashed: ${err.message}`;
		console.error(err);
	});
});

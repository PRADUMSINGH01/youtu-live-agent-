import { launch, getStream } from "puppeteer-stream";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const isDocker = process.env.DOCKER === "true";

export interface RecordOptions {
	url: string;
	outputFilePath: string;
	durationSeconds: number;
	width?: number;
	height?: number;
}

export async function recordSegment(options: RecordOptions): Promise<string> {
	console.log(`[Recorder] Starting recording segment to: ${options.outputFilePath}`);
	
	// Ensure directory exists
	const dir = path.dirname(options.outputFilePath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	const browserOptions: any = isDocker ? {
		executablePath: "/usr/bin/chromium",
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--start-maximized",
			"--autoplay-policy=no-user-gesture-required",
			`--window-size=${options.width || 1920},${options.height || 1080}`,
			"--no-first-run",
			"--no-default-browser-check",
			"--enable-webgl",
			"--use-gl=angle",
			"--use-angle=swiftshader"
		],
		ignoreDefaultArgs: ["--mute-audio"],
		defaultViewport: {
			width: options.width || 1920,
			height: options.height || 1080
		},
		timeout: 120000,
		protocolTimeout: 120000,
	} : {
		channel: "chrome",
		args: [
			"--start-maximized",
			"--autoplay-policy=no-user-gesture-required",
			"--no-first-run",
			"--no-default-browser-check"
		],
		ignoreDefaultArgs: ["--mute-audio"],
		defaultViewport: {
			width: options.width || 1920,
			height: options.height || 1080
		},
		timeout: 60000,
	};

	const browser = await launch(browserOptions);
	const page = await browser.newPage();
	await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
	
	console.log(`[Recorder] Navigating to ${options.url}...`);
	await page.goto(options.url, { waitUntil: "networkidle2", timeout: 60000 });

	const stream = await getStream(page, {
		audio: true,
		video: true,
		frameSize: 500,
		videoBitsPerSecond: 8000000
	});

	const ffmpegPath = isDocker 
		? "ffmpeg" 
		: "C:/Users/admin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe";

	return new Promise((resolve, reject) => {
		const ffmpegProcess = spawn(ffmpegPath, [
			"-f", "webm",
			"-i", "-",
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-pix_fmt", "yuv420p",
			"-b:v", "6000k",
			"-r", "30",
			"-g", "30",
			"-c:a", "aac",
			"-b:a", "128k",
			"-ar", "44100",
			"-y",
			options.outputFilePath
		]);

		ffmpegProcess.stderr.on("data", (data) => {
			const str = data.toString();
			if (str.includes("frame=") || str.includes("fps=")) {
				// Recording progress
			}
		});

		stream.pipe(ffmpegProcess.stdin, { end: false });

		// Automatically stop recording after the specified duration
		const timer = setTimeout(async () => {
			console.log(`[Recorder] Segment duration reached (${options.durationSeconds}s). Finalizing file...`);
			try {
				stream.unpipe(ffmpegProcess.stdin);
				ffmpegProcess.stdin.end();
				await page.close().catch(() => {});
				await browser.close().catch(() => {});
			} catch (err) {
				console.error("[Recorder] Error closing browser:", err);
			}
		}, options.durationSeconds * 1000);

		ffmpegProcess.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0 || fs.existsSync(options.outputFilePath)) {
				console.log(`[Recorder] Segment recording complete: ${options.outputFilePath}`);
				resolve(options.outputFilePath);
			} else {
				reject(new Error(`FFmpeg recording failed with exit code ${code}`));
			}
		});

		ffmpegProcess.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

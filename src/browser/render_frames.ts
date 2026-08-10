import { launch } from "puppeteer-stream";
import { spawn } from "child_process";
import * as path from "path";

// Configuration for Method 4 Deterministic Frame-by-Frame Production Exporter
const WIDTH = process.env.RENDER_WIDTH ? parseInt(process.env.RENDER_WIDTH) : 1920;
const HEIGHT = process.env.RENDER_HEIGHT ? parseInt(process.env.RENDER_HEIGHT) : 1080;
const FPS = 60;
const DURATION_SEC = process.env.RENDER_DURATION_SEC ? parseInt(process.env.RENDER_DURATION_SEC) : 10; // Default: 10s test
const TOTAL_FRAMES = FPS * DURATION_SEC;
const OUTPUT_FILE = process.env.OUTPUT_FILE || "4k_battle_perfect.mp4";

async function renderDeterministicVideo() {
	console.log(`Starting Method 4 Deterministic Frame Exporter (${WIDTH}x${HEIGHT} @ ${FPS}FPS, Total: ${TOTAL_FRAMES} frames)...`);

	// 1. Spawn FFmpeg process reading JPEG image stream from stdin pipe
	const ffmpeg = spawn("ffmpeg", [
		"-y",
		"-f", "image2pipe",
		"-vcodec", "mjpeg",
		"-r", `${FPS}`,
		"-i", "-",
		"-c:v", "libx264",
		"-r", `${FPS}`,
		"-preset", "fast",
		"-crf", "18",
		"-pix_fmt", "yuv420p",
		OUTPUT_FILE,
	]);

	ffmpeg.stderr.on("data", (data) => {
		// Log FFmpeg progress periodically
		const str = data.toString();
		if (str.includes("frame=") || str.includes("fps=")) {
			process.stdout.write(`\rFFmpeg Encoder: ${str.trim().slice(0, 80)}`);
		}
	});

	// 2. Launch Puppeteer Headless Chrome via puppeteer-stream
	const browser = await launch({
		channel: "chrome",
		headless: "new",
		args: [
			`--window-size=${WIDTH},${HEIGHT}`,
			"--hide-scrollbars",
			"--disable-infobars",
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--ignore-gpu-blocklist",
			"--enable-gpu",
			"--enable-webgl",
		],
	});

	const page = await browser.newPage();
	await page.setViewport({ width: WIDTH, height: HEIGHT });

	const targetUrl = process.env.TARGET_URL || "http://localhost:3000/dashboard/circle-flag-battler";
	console.log(`Navigating to ${targetUrl}...`);

	await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 60000 });

	console.log(`Rendering ${TOTAL_FRAMES} deterministic frames (dt = ${1 / FPS}s per frame)...`);

	const startTime = Date.now();

	for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex++) {
		// Step physics and 3D animation clock by exact 1/60th of a second
		await page.evaluate((dt) => {
			if ((window as any).__ADVANCE_DETERMINISTIC_FRAME__) {
				(window as any).__ADVANCE_DETERMINISTIC_FRAME__(dt);
			}
		}, 1 / FPS);

		// Take frame screenshot buffer
		const imageBuffer = (await page.screenshot({
			type: "jpeg",
			quality: 92,
			optimizeForSpeed: true,
		})) as Buffer;

		// Write frame directly to FFmpeg stdin pipe
		const canWrite = ffmpeg.stdin.write(imageBuffer);
		if (!canWrite) {
			await new Promise((resolve) => ffmpeg.stdin.once("drain", resolve));
		}

		if ((frameIndex + 1) % 60 === 0 || frameIndex === TOTAL_FRAMES - 1) {
			const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
			const percent = (((frameIndex + 1) / TOTAL_FRAMES) * 100).toFixed(0);
			console.log(`\nFrame ${frameIndex + 1}/${TOTAL_FRAMES} (${percent}%) rendered in ${elapsedSec}s...`);
		}
	}

	console.log("\nFinalizing FFmpeg encoding...");
	ffmpeg.stdin.end();

	await new Promise<void>((resolve) => {
		ffmpeg.on("close", () => resolve());
	});

	await browser.close();
	console.log(`Successfully generated 100% frame-perfect video: ${OUTPUT_FILE}`);
}

renderDeterministicVideo().catch((err) => {
	console.error("Method 4 Render Error:", err);
});

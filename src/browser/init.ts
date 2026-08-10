import { launch, getStream, wss } from "puppeteer-stream";
import * as fs from "fs";
import * as path from "path";

// Configuration for Screen Recording (Default: 1080p 60FPS for silky smooth playback; configurable via process.env)
const WIDTH = process.env.RECORD_WIDTH ? parseInt(process.env.RECORD_WIDTH) : 1920;
const HEIGHT = process.env.RECORD_HEIGHT ? parseInt(process.env.RECORD_HEIGHT) : 1080;
const DEVICE_SCALE_FACTOR = process.env.DEVICE_SCALE_FACTOR ? parseFloat(process.env.DEVICE_SCALE_FACTOR) : 1;
const RESOLUTION = { width: WIDTH, height: HEIGHT };

// Recording duration (default: 120s for testing. Set RECORD_DURATION_SEC=0 for 24/7 continuous mode)
const RECORDING_DURATION_SEC = process.env.RECORD_DURATION_SEC !== undefined ? parseInt(process.env.RECORD_DURATION_SEC) : 120;
const RECORDING_DURATION_MS = RECORDING_DURATION_SEC * 1000;
const OUTPUT_FILE = process.env.OUTPUT_FILE || "recording_smooth.webm";

const file = fs.createWriteStream(OUTPUT_FILE);

async function test() {
	console.log(
		RECORDING_DURATION_SEC > 0
			? `Starting High-Performance Smooth Recording (${RESOLUTION.width}x${RESOLUTION.height} @ 60FPS, scale: ${DEVICE_SCALE_FACTOR}x) session for ${RECORDING_DURATION_SEC}s (${(RECORDING_DURATION_SEC / 60).toFixed(1)} mins)...`
			: `Starting 24/7 Continuous Smooth Recording (${RESOLUTION.width}x${RESOLUTION.height} @ 60FPS)...`
	);

	const browser = await launch({
		channel: "chrome",
		headless: "new",
		defaultViewport: {
			width: RESOLUTION.width,
			height: RESOLUTION.height,
			deviceScaleFactor: DEVICE_SCALE_FACTOR,
		},
		args: [
			`--window-size=${RESOLUTION.width},${RESOLUTION.height}`,
			"--window-position=0,0",
			"--start-fullscreen",
			"--kiosk",
			`--force-device-scale-factor=${DEVICE_SCALE_FACTOR}`,
			"--hide-scrollbars",
			"--disable-infobars",
			"--disable-notifications",
			"--no-default-browser-check",
			"--disable-features=Translate,OptimizationHints,MediaRouter",
			"--ignore-gpu-blocklist",
			"--enable-gpu",
			"--enable-webgl",
			"--enable-accelerated-2d-canvas",
			"--enable-gpu-rasterization",
			"--enable-native-gpu-memory-buffers",
			"--use-gl=angle",
			"--disable-frame-rate-limit",
			"--disable-gpu-vsync",
			"--enable-zero-copy",
			"--disable-dev-shm-usage",
			"--no-sandbox",
			"--enable-usermedia-screen-capturing",
			"--allow-http-screen-capture",
			"--allow-running-insecure-content",
		],
	});

	const page = await browser.newPage();
	
	// Inject full-screen styles before page loads to ensure complete screen coverage without scrollbars or margins
	await page.evaluateOnNewDocument(() => {
		const injectFullScreenStyles = () => {
			const style = document.createElement("style");
			style.innerHTML = `
				* {
					box-sizing: border-box !important;
				}
				html, body {
					margin: 0 !important;
					padding: 0 !important;
					width: 100vw !important;
					height: 100vh !important;
					overflow: hidden !important;
				}
				::-webkit-scrollbar {
					display: none !important;
					width: 0px !important;
					height: 0px !important;
				}
			`;
			document.head ? document.head.appendChild(style) : document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
		};
		injectFullScreenStyles();
	});

	// Set page viewport explicitly to complete target resolution
	await page.setViewport({
		width: RESOLUTION.width,
		height: RESOLUTION.height,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
	});

	const targetUrl = process.env.TARGET_URL || "https://youtube-one-rust.vercel.app/dashboard/circle-flag-battler";
	console.log(`Navigating to ${targetUrl}...`);

	await page.goto(targetUrl, {
		waitUntil: "domcontentloaded",
		timeout: 60000,
	});

	// Trigger full screen API on document if allowed
	await page.evaluate(() => {
		try {
			if (document.documentElement.requestFullscreen) {
				document.documentElement.requestFullscreen().catch(() => {});
			}
		} catch {}
	});

	// Get stream with complete screen high-performance 60FPS settings
	const stream = await getStream(page, {
		audio: true,
		video: true,
		frameSize: 60, // 60 FPS frame size
		mimeType: "video/webm;codecs=vp8", // VP8 encoding for lightweight ultra-fast 60FPS tab capture
		videoBitsPerSecond: 25_000_000, // 25 Mbps for crystal-clear smooth 60FPS video
		audioBitsPerSecond: 256_000,   // 256 kbps studio audio
		streamConfig: {
			highWaterMarkMB: 2048, // 2GB buffer size for high-bitrate stream
			immediateResume: true,
		},
	});

	console.log(`Complete screen recording started at ${RESOLUTION.width}x${RESOLUTION.height}...`);

	stream.on("error", (err) => {
		console.error("Stream error encountered:", err);
	});
	file.on("error", (err) => {
		console.error("File write error encountered:", err);
	});

	stream.pipe(file);

	// Graceful Cleanup Handler for Ctrl+C (SIGINT) / SIGTERM / Timer completion
	let isCleaningUp = false;
	const gracefulCleanup = async () => {
		if (isCleaningUp) return;
		isCleaningUp = true;
		console.log("\nGracefully shutting down screen recording session...");
		try {
			// Call stream.stop() to let Chrome MediaRecorder flush final webm headers & tags
			await stream.stop().catch(() => {});
		} catch (err) {
			console.error("Error stopping stream:", err);
		}

		file.end();
		
		await new Promise<void>((resolve) => {
			file.on("finish", () => resolve());
			setTimeout(resolve, 1000); // Fallback timeout
		});

		console.log(`Saved recording to ${OUTPUT_FILE}`);
		try { await browser.close(); } catch {}
		try { (await wss).close(); } catch {}
		process.exit(0);
	};

	process.on("SIGINT", gracefulCleanup);
	process.on("SIGTERM", gracefulCleanup);

	// Handle recording stop or 24/7 continuous stream
	if (RECORDING_DURATION_SEC > 0 && isFinite(RECORDING_DURATION_MS)) {
		setTimeout(async () => {
			console.log(`Duration of ${RECORDING_DURATION_SEC}s reached. Stopping recording...`);
			await gracefulCleanup();
		}, RECORDING_DURATION_MS);
	} else {
		console.log("24/7 Continuous Mode Active. Stream recording will run indefinitely (Press Ctrl+C to stop)...");
	}
}

test().catch((err) => {
	console.error("Recording error:", err);
});
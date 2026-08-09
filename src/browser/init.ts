import { launch, getStream, wss } from "puppeteer-stream";
import * as fs from "fs";
import * as path from "path";

// Configuration for True 4K UHD 60FPS Recording
const RESOLUTION = { width: 3840, height: 2160 }; // True 4K UHD (3840x2160)
// Recording duration (default: 30 minutes / 1800s. Set RECORD_DURATION_SEC=0 for 24/7 continuous mode)
const RECORDING_DURATION_SEC = process.env.RECORD_DURATION_SEC !== undefined ? parseInt(process.env.RECORD_DURATION_SEC) : 1800;
const RECORDING_DURATION_MS = RECORDING_DURATION_SEC * 1000;
const OUTPUT_FILE = process.env.OUTPUT_FILE || "recording_4k.webm";

const file = fs.createWriteStream(OUTPUT_FILE);

async function test() {
	console.log(
		RECORDING_DURATION_SEC > 0
			? `Starting True 4K (3840x2160 @ 60FPS) recording session for ${RECORDING_DURATION_SEC}s (${(RECORDING_DURATION_SEC / 60).toFixed(1)} mins)...`
			: `Starting 24/7 Continuous 4K (3840x2160 @ 60FPS) Live Stream...`
	);

	const browser = await launch({
		channel: "chrome",
		headless: "new",
		defaultViewport: {
			width: RESOLUTION.width,
			height: RESOLUTION.height,
			deviceScaleFactor: 2, // 2x Retina sharpness for crisp text & 3D geometry
		},
		args: [
			`--window-size=${RESOLUTION.width},${RESOLUTION.height}`,
			"--force-device-scale-factor=2",
			"--ignore-gpu-blocklist",
			"--enable-gpu",
			"--enable-webgl",
			"--enable-accelerated-2d-canvas",
			"--enable-zero-copy",
			"--disable-dev-shm-usage",
			"--no-sandbox",
			"--hide-scrollbars",
			"--enable-usermedia-screen-capturing",
			"--allow-http-screen-capture",
			"--allow-running-insecure-content",
		],
	});

	const page = await browser.newPage();
	
	// Set page viewport explicitly to 4K UHD with 2x device scale factor
	await page.setViewport({
		width: RESOLUTION.width,
		height: RESOLUTION.height,
		deviceScaleFactor: 2,
	});

	const targetUrl = process.env.TARGET_URL || "https://youtube-one-rust.vercel.app/dashboard/circle-flag-battler";
	console.log(`Navigating to ${targetUrl}...`);

	await page.goto(targetUrl, {
		waitUntil: "domcontentloaded",
		timeout: 60000,
	});

	// Get stream with True 4K UHD 60FPS settings (60 Mbps VP9 codec)
	const stream = await getStream(page, {
		audio: true,
		video: true,
		frameSize: 60, // 60 FPS
		mimeType: "video/webm;codecs=vp9",
		videoBitsPerSecond: 60_000_000, // 60 Mbps for ultra-crisp 4K video
		audioBitsPerSecond: 256_000,   // 256 kbps studio audio
		streamConfig: {
			highWaterMarkMB: 2048, // 2GB buffer size for high-bitrate 4K stream
			immediateResume: true,
		},
	});

	console.log("Recording started in 4K resolution (3840x2160)...");
	stream.pipe(file);

	// Graceful Cleanup Handler for Ctrl+C (SIGINT) / SIGTERM
	let isCleaningUp = false;
	const gracefulCleanup = async () => {
		if (isCleaningUp) return;
		isCleaningUp = true;
		console.log("\nGracefully shutting down 4K recording session...");
		try {
			await stream.destroy();
			file.end();
			file.on("finish", async () => {
				console.log(`Saved 4K recording to ${OUTPUT_FILE}`);
				try { await browser.close(); } catch {}
				try { (await wss).close(); } catch {}
				process.exit(0);
			});
		} catch (err) {
			process.exit(0);
		}
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
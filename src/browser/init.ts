import { launch, getStream, wss } from "puppeteer-stream";
import * as fs from "fs";
import * as path from "path";

// Configuration for True 4K UHD 60FPS Recording
const RESOLUTION = { width: 3840, height: 2160 }; // True 4K UHD (3840x2160)
const RECORDING_DURATION_MS = 200 * 1000; // 200 seconds
const OUTPUT_FILE = "recording_4k.webm";

const file = fs.createWriteStream(OUTPUT_FILE);

async function test() {
	console.log(`Starting True 4K (3840x2160 @ 60FPS) recording session for ${RECORDING_DURATION_MS / 1000}s...`);

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
		frameRate: 60,
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

	// Stop recording after duration completes
	setTimeout(async () => {
		console.log("Stopping recording...");
		
		await stream.destroy();
		file.end();

		file.on("finish", async () => {
			console.log(`Finished! Saved 4K recording to ${OUTPUT_FILE}`);
			await browser.close();
			(await wss).close();
			process.exit(0);
		});
	}, RECORDING_DURATION_MS);
}

test().catch((err) => {
	console.error("Recording error:", err);
});
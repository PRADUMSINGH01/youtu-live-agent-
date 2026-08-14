import { launch, getStream, wss } from "puppeteer-stream";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

// Screen Recording Configuration
const WIDTH = process.env.RECORD_WIDTH ? parseInt(process.env.RECORD_WIDTH) : 1920;
const HEIGHT = process.env.RECORD_HEIGHT ? parseInt(process.env.RECORD_HEIGHT) : 1080;
const DEVICE_SCALE_FACTOR = process.env.DEVICE_SCALE_FACTOR ? parseFloat(process.env.DEVICE_SCALE_FACTOR) : 1;
const RESOLUTION = { width: WIDTH, height: HEIGHT };

// Recording duration (RECORD_DURATION_SEC=0 or -1 for 24/7 continuous loop mode)
const RECORDING_DURATION_SEC = process.env.RECORD_DURATION_SEC !== undefined ? parseInt(process.env.RECORD_DURATION_SEC) : 0;
const OUTPUT_FILE = process.env.OUTPUT_FILE || "4k_battle_perfect.mp4";

export async function startContinuousRecorder() {
	console.log(`====================================================`);
	console.log(` Starting Continuous Loop Screen Recorder`);
	console.log(` Resolution : ${RESOLUTION.width}x${RESOLUTION.height} @ 60FPS`);
	console.log(` Target File: ${OUTPUT_FILE}`);
	console.log(` Duration   : ${RECORDING_DURATION_SEC > 0 ? `${RECORDING_DURATION_SEC}s` : "24/7 Continuous Loop Mode"}`);
	console.log(`====================================================`);

	const outputStream = fs.createWriteStream(OUTPUT_FILE);

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
	await page.setViewport({
		width: RESOLUTION.width,
		height: RESOLUTION.height,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
	});

	const targetUrl = process.env.TARGET_URL || "http://localhost:5000";
	console.log(`Navigating to target URL: ${targetUrl}...`);

	await page.goto(targetUrl, {
		waitUntil: "domcontentloaded",
		timeout: 60000,
	}).catch((err) => {
		console.warn(`Navigation warning: ${err.message}. Proceeding with recorder stream...`);
	});

	const stream = await getStream(page, {
		audio: true,
		video: true,
		frameSize: 60,
		mimeType: "video/webm;codecs=vp8",
		videoBitsPerSecond: 25_000_000,
		audioBitsPerSecond: 256_000,
		streamConfig: {
			highWaterMarkMB: 2048,
			immediateResume: true,
		},
	});

	console.log(`Live recorder capturing stream in continuous mode...`);

	stream.on("error", (err) => console.error("Stream error:", err));
	outputStream.on("error", (err) => console.error("Output stream error:", err));

	stream.pipe(outputStream);

	let isCleaningUp = false;
	const stopRecording = async () => {
		if (isCleaningUp) return;
		isCleaningUp = true;
		console.log("\nStopping screen recording session...");
		try {
			await stream.stop().catch(() => {});
		} catch {}
		outputStream.end();
		await new Promise<void>((resolve) => {
			outputStream.on("finish", resolve);
			setTimeout(resolve, 1000);
		});
		console.log(`Recording cleanly saved to ${OUTPUT_FILE}`);
		try { await browser.close(); } catch {}
		try { (await wss).close(); } catch {}
		process.exit(0);
	};

	process.on("SIGINT", stopRecording);
	process.on("SIGTERM", stopRecording);

	if (RECORDING_DURATION_SEC > 0) {
		setTimeout(stopRecording, RECORDING_DURATION_SEC * 1000);
	}
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("recorder.ts")) {
	startContinuousRecorder().catch((err) => console.error("Recorder Error:", err));
}

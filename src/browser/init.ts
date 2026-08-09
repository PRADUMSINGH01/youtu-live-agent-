import { launch, getStream, wss } from "puppeteer-stream";
import * as fs from "fs";
import * as path from "path";

// Configuration for 4K HD and Long Duration Recording
const RESOLUTION = { width: 1920, height: 1080 }; // 4K UHD Resolution
const RECORDING_DURATION_MS = 20 * 1000; // 3 minutes (adjust as needed, e.g., 30 * 60 * 1000 for 30 mins)
const OUTPUT_FILE = "recording_4k.webm";

const file = fs.createWriteStream(OUTPUT_FILE);

async function test() {
	console.log(`Starting 4K recording session for ${RECORDING_DURATION_MS / 1000}s...`);

	const browser = await launch({
		channel: "chrome",
		headless: "new", // Modern headless mode prevents giant 4K window from overflowing physical screen
		defaultViewport: {
			width: RESOLUTION.width,
			height: RESOLUTION.height,
			deviceScaleFactor: 1,
		},
		args: [
			`--window-size=${RESOLUTION.width},${RESOLUTION.height}`,
			"--force-device-scale-factor=1",
			"--disable-dev-shm-usage", // Prevents memory exhaustion during high-res/long recordings
			"--no-sandbox",
			"--hide-scrollbars",
		],
	});

	const page = await browser.newPage();
	
	// Set page viewport explicitly to 4K
	await page.setViewport(RESOLUTION);

	await page.goto("https://youtube-one-rust.vercel.app/dashboard/flag-battler", {
		waitUntil: "networkidle2",
	});

	// Get stream with 4K UHD settings (high bitrate VP9 codec & larger stream buffer)
	const stream = await getStream(page, {
		audio: true,
		video: true,
		mimeType: "video/webm;codecs=vp9",
		videoBitsPerSecond: 25_000_000, // 25 Mbps for crystal clear 4K quality
		audioBitsPerSecond: 128_000,
		streamConfig: {
			highWaterMarkMB: 1024, // 1GB buffer size for long recordings
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
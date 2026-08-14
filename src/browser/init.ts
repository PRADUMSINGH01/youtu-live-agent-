import { launch, getStream, wss } from "puppeteer-stream";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { db, storage } from "../firebase/init.js";

dotenv.config();

/**
 * ============================================================
 * Configuration for Smooth 60FPS Full HD 1080p Rotating Recorder
 * ============================================================
 */

const WIDTH = process.env.RECORD_WIDTH ? parseInt(process.env.RECORD_WIDTH) : 1920;
const HEIGHT = process.env.RECORD_HEIGHT ? parseInt(process.env.RECORD_HEIGHT) : 1080;
const DEVICE_SCALE_FACTOR = process.env.DEVICE_SCALE_FACTOR ? parseFloat(process.env.DEVICE_SCALE_FACTOR) : 1;
const RESOLUTION = { width: WIDTH, height: HEIGHT };

const CHUNK_DURATION_MINUTES = process.env.RECORD_CHUNK_MINUTES ? parseFloat(process.env.RECORD_CHUNK_MINUTES) : 5;
const CHUNK_DURATION_SEC = Math.max(10, Math.round(CHUNK_DURATION_MINUTES * 60)); // 300 seconds default
const RECORDINGS_DIR = path.resolve(process.cwd(), "recordings");

if (!fs.existsSync(RECORDINGS_DIR)) {
	fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

/**
 * Docker / Linux / Windows Cross-Platform Browser Launch Options
 */
function getBrowserLaunchOptions(): any {
	const executablePath =
		process.env.PUPPETEER_EXECUTABLE_PATH ||
		(fs.existsSync("/usr/bin/chromium")
			? "/usr/bin/chromium"
			: fs.existsSync("/usr/bin/chromium-browser")
			? "/usr/bin/chromium-browser"
			: undefined);

	const options: any = {
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
			"--high-dpi-support=1",
			"--font-render-hinting=medium",
			"--enable-font-antialiasing",
			"--enable-subpixel-font-rendering",
			"--force-color-profile=srgb",
			"--hide-scrollbars",
			"--disable-infobars",
			"--disable-notifications",
			"--no-default-browser-check",
			"--disable-features=Translate,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion",
			"--ignore-gpu-blocklist",
			"--enable-gpu",
			"--enable-webgl",
			"--enable-accelerated-2d-canvas",
			"--enable-gpu-rasterization",
			"--enable-oop-rasterization",
			"--enable-native-gpu-memory-buffers",
			"--use-gl=angle",
			"--run-all-compositor-stages-before-draw",
			"--disable-backgrounding-occluded-windows",
			"--disable-renderer-backgrounding",
			"--disable-background-timer-throttling",
			"--enable-zero-copy",
			"--disable-dev-shm-usage",
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--enable-usermedia-screen-capturing",
			"--allow-http-screen-capture",
			"--allow-running-insecure-content",
			"--autoplay-policy=no-user-gesture-required",
		],
	};

	if (executablePath) {
		options.executablePath = executablePath;
	} else {
		options.channel = "chrome";
	}

	return options;
}

/**
 * Record a single fixed-duration video (e.g. 2 minutes / 120s) for Auto-Bootstrap
 */
export async function recordSingleVideo(durationSeconds: number = 120): Promise<string> {
	const outputFilePath = path.join(RECORDINGS_DIR, `recording_${Date.now()}_bootstrap.webm`);
	const file = fs.createWriteStream(outputFilePath);
	const targetUrl = process.env.TARGET_URL || "https://crypto-ruddy-eta.vercel.app/";

	console.log("\n====================================================");
	console.log(`🎬 Recording ${durationSeconds / 60} Minute Video (${durationSeconds}s) for Live Stream`);
	console.log("====================================================");
	console.log(`Resolution : ${RESOLUTION.width}x${RESOLUTION.height} @ 60FPS (Full HD)`);
	console.log(`Target URL : ${targetUrl}`);
	console.log(`Output     : ${outputFilePath}`);
	console.log("====================================================\n");

	const browser = await launch(getBrowserLaunchOptions());
	const page = await browser.newPage();

	await page.evaluateOnNewDocument(() => {
		const injectFullScreenStyles = () => {
			const style = document.createElement("style");
			style.innerHTML = `
				* { box-sizing: border-box !important; }
				html, body {
					margin: 0 !important;
					padding: 0 !important;
					width: 100vw !important;
					height: 100vh !important;
					overflow: hidden !important;
				}
				::-webkit-scrollbar { display: none !important; }
			`;
			document.head ? document.head.appendChild(style) : document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
		};
		injectFullScreenStyles();

		const start60FpsHeartbeat = () => {
			const canvas = document.createElement("canvas");
			canvas.width = 2;
			canvas.height = 2;
			canvas.style.cssText = "position:fixed;bottom:0;right:0;width:2px;height:2px;opacity:0.02;pointer-events:none;z-index:999999;";
			(document.body || document.documentElement).appendChild(canvas);
			const ctx = canvas.getContext("2d");
			let frame = 0;
			const tick = () => {
				frame = (frame + 1) % 100;
				if (ctx) {
					ctx.fillStyle = frame % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
					ctx.fillRect(0, 0, 2, 2);
				}
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		};
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", start60FpsHeartbeat);
		} else {
			start60FpsHeartbeat();
		}
	});

	await page.setViewport({
		width: RESOLUTION.width,
		height: RESOLUTION.height,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
		isLandscape: true,
		hasTouch: false,
		isMobile: false,
	});

	console.log(`[Recorder] Navigating to ${targetUrl}...`);
	await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});

	const stream = await getStream(page, {
		audio: true,
		video: true,
		frameSize: 20,
		mimeType: "video/webm;codecs=vp8",
		videoBitsPerSecond: 25_000_000,
		audioBitsPerSecond: 256_000,
		videoConstraints: {
			mandatory: {
				minWidth: RESOLUTION.width,
				minHeight: RESOLUTION.height,
				maxWidth: RESOLUTION.width,
				maxHeight: RESOLUTION.height,
				minFrameRate: 60,
				maxFrameRate: 60,
			},
		},
		streamConfig: {
			highWaterMarkMB: 2048,
			immediateResume: true,
		},
	} as any);

	stream.pipe(file);

	let elapsed = 0;
	await new Promise<void>((resolve) => {
		const interval = setInterval(() => {
			elapsed += 1;
			const remaining = Math.max(0, durationSeconds - elapsed);
			const mm = Math.floor(elapsed / 60);
			const ss = elapsed % 60;
			const rmm = Math.floor(remaining / 60);
			const rss = remaining % 60;
			process.stdout.write(`\r[Auto-Recording] Progress: ${mm}:${ss.toString().padStart(2, '0')} / ${Math.floor(durationSeconds / 60)}:00 (Remaining: ${rmm}:${rss.toString().padStart(2, '0')})`);

			if (elapsed >= durationSeconds) {
				clearInterval(interval);
				resolve();
			}
		}, 1000);
	});

	console.log(`\n[Recorder] Finished ${durationSeconds}s recording. Finalizing video file...`);

	try { await stream.stop().catch(() => {}); } catch {}
	file.end();

	await new Promise<void>((resolve) => {
		file.on("finish", () => resolve());
		setTimeout(resolve, 1500);
	});

	// Upload to Firebase Storage in background
	try {
		if (fs.existsSync(outputFilePath)) {
			const stats = fs.statSync(outputFilePath);
			const baseName = path.basename(outputFilePath);
			const storageFileName = `recordings/${Date.now()}_${baseName}`;

			console.log(`[Firebase] 🚀 Uploading initial ${durationSeconds}s recording to Firebase Storage...`);
			const bucket = storage.bucket();
			const fileUpload = bucket.file(storageFileName);
			const fileBuffer = fs.readFileSync(outputFilePath);

			await fileUpload.save(fileBuffer, {
				metadata: {
					contentType: "video/webm",
					metadata: { targetUrl, durationSeconds: String(durationSeconds), quality: "1080p60" },
				},
			});

			let downloadUrl: string;
			try {
				const [signedUrl] = await fileUpload.getSignedUrl({ action: "read", expires: "03-01-2030" });
				downloadUrl = signedUrl;
			} catch {
				downloadUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(storageFileName)}`;
			}

			await db.collection("videos").add({
				title: `Initial 2-Min Live Recording`,
				fileName: baseName,
				storagePath: storageFileName,
				url: downloadUrl,
				size: stats.size,
				sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
				mimetype: "video/webm",
				targetUrl,
				durationSeconds,
				createdAt: new Date().toISOString(),
			});

			console.log(`[Firebase] ✅ Video saved to Cloud! (Doc ID in 'videos')`);
		}
	} catch (err: any) {
		console.warn("[Firebase] Background upload notice:", err.message);
	}

	try { await browser.close(); } catch {}
	try { (await wss).close(); } catch {}

	return outputFilePath;
}

/**
 * 24/7 Rotating Continuous Recorder (Runs when executed directly)
 */
export async function runRotatingBrowserRecorder() {
	console.log("\n====================================================");
	console.log("   Smooth 60FPS 1080p 24/7 Recorder (5-Min Auto-Chunks)");
	console.log("====================================================");
	console.log(`Resolution     : ${RESOLUTION.width}x${RESOLUTION.height} (Strict Full HD)`);
	console.log(`Frame Rate     : 60 FPS Continuous Engine`);
	console.log(`Chunk Duration : ${CHUNK_DURATION_MINUTES} Minutes (${CHUNK_DURATION_SEC}s)`);
	console.log(`Auto-Upload    : Firebase Storage & Firestore Sync`);
	console.log(`Directory      : ${RECORDINGS_DIR}`);
	console.log("====================================================\n");

	const browser = await launch(getBrowserLaunchOptions());
	const page = await browser.newPage();

	await page.evaluateOnNewDocument(() => {
		const injectFullScreenStyles = () => {
			const style = document.createElement("style");
			style.innerHTML = `
				* { box-sizing: border-box !important; }
				html, body {
					margin: 0 !important;
					padding: 0 !important;
					width: 100vw !important;
					height: 100vh !important;
					overflow: hidden !important;
				}
				::-webkit-scrollbar { display: none !important; }
			`;
			document.head ? document.head.appendChild(style) : document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
		};
		injectFullScreenStyles();

		const start60FpsHeartbeat = () => {
			const canvas = document.createElement("canvas");
			canvas.width = 2;
			canvas.height = 2;
			canvas.style.cssText = "position:fixed;bottom:0;right:0;width:2px;height:2px;opacity:0.02;pointer-events:none;z-index:999999;";
			(document.body || document.documentElement).appendChild(canvas);
			const ctx = canvas.getContext("2d");
			let frame = 0;
			const tick = () => {
				frame = (frame + 1) % 100;
				if (ctx) {
					ctx.fillStyle = frame % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
					ctx.fillRect(0, 0, 2, 2);
				}
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		};
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", start60FpsHeartbeat);
		} else {
			start60FpsHeartbeat();
		}
	});

	await page.setViewport({
		width: RESOLUTION.width,
		height: RESOLUTION.height,
		deviceScaleFactor: DEVICE_SCALE_FACTOR,
		isLandscape: true,
		hasTouch: false,
		isMobile: false,
	});

	const targetUrl = process.env.TARGET_URL || "https://crypto-ruddy-eta.vercel.app/";
	console.log(`[Browser] Navigating to ${targetUrl}...`);

	await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});

	let isRunning = true;
	let currentChunkIndex = 0;
	let totalChunksUploaded = 0;
	let activeStream: any = null;
	let activeFileStream: fs.WriteStream | null = null;
	let activeChunkFilePath: string = "";
	let chunkElapsedSeconds = 0;
	let totalSessionSeconds = 0;

	const uploadChunkToFirebase = async (filePath: string, chunkNum: number, durationSec: number) => {
		try {
			if (!fs.existsSync(filePath)) return;
			const stats = fs.statSync(filePath);
			if (stats.size < 1000) return;

			const baseName = path.basename(filePath);
			const storageFileName = `recordings/chunks/${Date.now()}_${baseName}`;
			const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

			console.log(`\n[Firebase] 🚀 Uploading Chunk #${chunkNum} (${sizeMB} MB) to Firebase Storage...`);
			const bucket = storage.bucket();
			const fileUpload = bucket.file(storageFileName);
			const fileBuffer = fs.readFileSync(filePath);

			await fileUpload.save(fileBuffer, {
				metadata: {
					contentType: "video/webm",
					metadata: {
						chunkNumber: String(chunkNum),
						durationSeconds: String(durationSec),
						targetUrl,
						resolution: `${RESOLUTION.width}x${RESOLUTION.height}`,
						quality: "1080p60_Smooth",
						recordedAt: new Date().toISOString(),
					},
				},
			});

			let downloadUrl: string;
			try {
				const [signedUrl] = await fileUpload.getSignedUrl({ action: "read", expires: "03-01-2030" });
				downloadUrl = signedUrl;
			} catch {
				downloadUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(storageFileName)}`;
			}

			const videoDoc = await db.collection("videos").add({
				title: `Full HD 1080p Recording Chunk #${chunkNum}`,
				fileName: baseName,
				storagePath: storageFileName,
				url: downloadUrl,
				size: stats.size,
				sizeFormatted: `${sizeMB} MB`,
				mimetype: "video/webm",
				targetUrl,
				durationSeconds: durationSec,
				chunkNumber: chunkNum,
				isChunk: true,
				resolution: `${RESOLUTION.width}x${RESOLUTION.height}`,
				fps: 60,
				createdAt: new Date().toISOString(),
			});

			totalChunksUploaded += 1;
			console.log(`[Firebase] ✅ Chunk #${chunkNum} saved! Firestore Doc ID: ${videoDoc.id}`);
		} catch (err: any) {
			console.error(`[Firebase] ❌ Failed to upload Chunk #${chunkNum}:`, err.message);
		}
	};

	const recordNextChunk = async () => {
		if (!isRunning) return;

		currentChunkIndex += 1;
		chunkElapsedSeconds = 0;
		const chunkTimestamp = Date.now();
		activeChunkFilePath = path.join(RECORDINGS_DIR, `recording_${chunkTimestamp}_chunk${currentChunkIndex}.webm`);
		activeFileStream = fs.createWriteStream(activeChunkFilePath);

		console.log(`\n====================================================`);
		console.log(`▶ Starting Smooth 1080p Recording Chunk #${currentChunkIndex}`);
		console.log(`Resolution: 1920x1080 @ 60FPS | File: ${path.basename(activeChunkFilePath)}`);
		console.log(`====================================================`);

		activeStream = await getStream(page, {
			audio: true,
			video: true,
			frameSize: 20,
			mimeType: "video/webm;codecs=vp8",
			videoBitsPerSecond: 25_000_000,
			audioBitsPerSecond: 256_000,
			videoConstraints: {
				mandatory: {
					minWidth: RESOLUTION.width,
					minHeight: RESOLUTION.height,
					maxWidth: RESOLUTION.width,
					maxHeight: RESOLUTION.height,
					minFrameRate: 60,
					maxFrameRate: 60,
				},
			},
			streamConfig: {
				highWaterMarkMB: 2048,
				immediateResume: true,
			},
		} as any);

		activeStream.pipe(activeFileStream);

		await new Promise<void>((resolve) => {
			const chunkTimer = setTimeout(async () => {
				clearInterval(tickInterval);
				if (!isRunning) return resolve();

				console.log(`\n[Timer] 5 Minutes completed for Chunk #${currentChunkIndex}. Flushing and starting next chunk...`);

				try { await activeStream.stop().catch(() => {}); } catch {}

				if (activeFileStream) {
					activeFileStream.end();
					await new Promise<void>((fResolve) => {
						activeFileStream?.on("finish", () => fResolve());
						setTimeout(fResolve, 1200);
					});
				}

				uploadChunkToFirebase(activeChunkFilePath, currentChunkIndex, chunkElapsedSeconds);
				resolve();
			}, CHUNK_DURATION_SEC * 1000);

			const tickInterval = setInterval(async () => {
				if (!isRunning) {
					clearInterval(tickInterval);
					clearTimeout(chunkTimer);
					return resolve();
				}

				chunkElapsedSeconds += 1;
				totalSessionSeconds += 1;

				const remainingSec = Math.max(0, CHUNK_DURATION_SEC - chunkElapsedSeconds);
				const mm = Math.floor(chunkElapsedSeconds / 60);
				const ss = chunkElapsedSeconds % 60;
				const rmm = Math.floor(remainingSec / 60);
				const rss = remainingSec % 60;

				process.stdout.write(
					`\r[1080p60 Chunk #${currentChunkIndex}] Elapsed: ${mm}:${ss.toString().padStart(2, '0')} | Next Chunk in: ${rmm}:${rss.toString().padStart(2, '0')}`
				);
			}, 1000);
		});

		if (isRunning) {
			setImmediate(recordNextChunk);
		}
	};

	const gracefulCleanup = async () => {
		if (!isRunning) return;
		isRunning = false;

		console.log("\n\n[Streamer] Stopping recorder gracefully...");

		try { if (activeStream) await activeStream.stop().catch(() => {}); } catch {}

		if (activeFileStream) {
			activeFileStream.end();
			await new Promise<void>((resolve) => {
				activeFileStream?.on("finish", () => resolve());
				setTimeout(resolve, 1000);
			});
		}

		if (activeChunkFilePath && fs.existsSync(activeChunkFilePath)) {
			await uploadChunkToFirebase(activeChunkFilePath, currentChunkIndex, chunkElapsedSeconds);
		}

		try { await browser.close(); } catch {}
		try { (await wss).close(); } catch {}

		console.log(`[Streamer] Session closed.`);
		process.exit(0);
	};

	process.on("SIGINT", gracefulCleanup);
	process.on("SIGTERM", gracefulCleanup);

	await recordNextChunk();
}

// Auto-run if executed directly as entrypoint
const isDirectEntry = process.argv[1] && (process.argv[1].endsWith("init.ts") || process.argv[1].endsWith("init.js"));
if (isDirectEntry) {
	runRotatingBrowserRecorder().catch((err) => console.error("Recording error:", err));
}
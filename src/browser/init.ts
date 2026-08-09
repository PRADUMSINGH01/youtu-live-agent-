import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { recordSegment } from "./recorder.js";
import { streamSegment } from "./streamer.js";

dotenv.config();

const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY || "w263-863b-mq4c-5bce-6cqh";
const RTMP_URL = `rtmps://a.rtmp.youtube.com/live2/${STREAM_KEY}`;
const isDocker = process.env.DOCKER === "true";

const SEGMENT_DIR = isDocker ? "/tmp/segments" : path.join(__dirname, "../../tmp/segments");
const TARGET_URL = "https://youtube-one-rust.vercel.app/dashboard/flag-battler";
const SEGMENT_DURATION = 300; // 5 minutes per video segment

let streamStatus = "Initializing Segment Buffer Pipeline...";
let activeSegmentStreaming = "None";
let activeSegmentRecording = "None";
const liveLogs: string[] = [];

function addLog(msg: string) {
	console.log(msg);
	liveLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
	if (liveLogs.length > 20) liveLogs.shift();
}

async function orchestratePipeline() {
	addLog("🚀 Starting Segment-Buffered YouTube Live Pipeline...");

	if (!fs.existsSync(SEGMENT_DIR)) {
		fs.mkdirSync(SEGMENT_DIR, { recursive: true });
	}

	let segmentIndex = 1;

	// Phase 1: Record initial Segment #1 (Initial Buffer)
	const firstSegmentPath = path.join(SEGMENT_DIR, `segment_${segmentIndex}.mp4`);
	activeSegmentRecording = `segment_${segmentIndex}.mp4`;
	streamStatus = "🟡 Recording Initial 5-Minute Buffer Segment #1...";
	addLog(`Recording initial segment #1: ${firstSegmentPath}`);

	try {
		await recordSegment({
			url: TARGET_URL,
			outputFilePath: firstSegmentPath,
			durationSeconds: SEGMENT_DURATION
		});
	} catch (err: any) {
		addLog(`❌ Initial recording error: ${err.message}`);
	}

	// Main Pipeline Loop: Stream current segment while recording next segment in background
	while (true) {
		const currentSegmentPath = path.join(SEGMENT_DIR, `segment_${segmentIndex}.mp4`);
		const nextSegmentIndex = segmentIndex + 1;
		const nextSegmentPath = path.join(SEGMENT_DIR, `segment_${nextSegmentIndex}.mp4`);

		if (!fs.existsSync(currentSegmentPath)) {
			addLog(`⚠️ Segment ${currentSegmentPath} missing, re-recording...`);
			activeSegmentRecording = `segment_${segmentIndex}.mp4`;
			try {
				await recordSegment({
					url: TARGET_URL,
					outputFilePath: currentSegmentPath,
					durationSeconds: SEGMENT_DURATION
				});
			} catch (err: any) {
				addLog(`❌ Re-recording error: ${err.message}`);
			}
		}

		addLog(`▶️ Starting live stream for segment #${segmentIndex}`);
		activeSegmentStreaming = `segment_${segmentIndex}.mp4`;
		streamStatus = `🟢 Live Streaming Segment #${segmentIndex} to YouTube`;

		// Trigger background recording of next segment simultaneously!
		activeSegmentRecording = `segment_${nextSegmentIndex}.mp4`;
		addLog(`🔴 Background recording started for segment #${nextSegmentIndex}`);
		
		const recordingPromise = recordSegment({
			url: TARGET_URL,
			outputFilePath: nextSegmentPath,
			durationSeconds: SEGMENT_DURATION
		}).catch((err: any) => {
			addLog(`❌ Background recording error for #${nextSegmentIndex}: ${err.message}`);
		});

		// Stream current segment to YouTube
		try {
			await streamSegment({
				filePath: currentSegmentPath,
				rtmpUrl: RTMP_URL,
				onLog: (logStr: string) => {
					if (logStr.includes("frame=") || logStr.includes("fps=")) {
						addLog(logStr);
					}
				}
			});
		} catch (err: any) {
			addLog(`❌ Streamer error: ${err.message}`);
		}

		// Ensure next segment recording finishes before continuing loop
		await recordingPromise;

		// Advance index
		segmentIndex++;
	}
}

// Start Express Dashboard Server
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
				<meta http-equiv="refresh" content="3">
				<style>
					body { font-family: 'Courier New', Courier, monospace; background: #0d1117; color: #58a6ff; padding: 20px; line-height: 1.5; }
					h1 { color: #c9d1d9; border-bottom: 1px solid #30363d; padding-bottom: 10px; }
					.card { background: #161b22; padding: 20px; border-radius: 8px; border: 1px solid #30363d; margin-bottom: 20px; }
					.highlight { color: #7ee787; font-weight: bold; }
					.recording { color: #f2cc60; font-weight: bold; }
					pre { background: #010409; padding: 15px; border-radius: 5px; overflow-x: auto; color: #e6edf3; font-size: 14px; }
				</style>
			</head>
			<body>
				<h1>📺 YouTube Segment-Buffered Live Agent</h1>
				
				<div class="card">
					<h3>⚙️ Pipeline Status</h3>
					<p><strong>Environment:</strong> <span class="highlight">${isDocker ? "🐳 Docker (Google Cloud Run)" : "💻 Local Machine (Windows)"}</span></p>
					<p><strong>Pipeline Status:</strong> <span class="highlight">${streamStatus}</span></p>
					<p><strong>Active Streaming Segment:</strong> <span class="highlight">${activeSegmentStreaming}</span></p>
					<p><strong>Background Recording Segment:</strong> <span class="recording">${activeSegmentRecording}</span></p>
				</div>

				<div class="card">
					<h3>🎥 Real-Time Pipeline Logs</h3>
					<p><em>(Auto-refreshing every 3 seconds...)</em></p>
					<pre>${liveLogs.length > 0 ? liveLogs.join("\n") : "Initializing logs..."}</pre>
				</div>
			</body>
		</html>
	`;
	res.send(html);
});

app.listen(port, () => {
	console.log(`Health check & Dashboard server listening on port ${port}`);
	orchestratePipeline().catch((err) => {
		console.error("Pipeline Orchestration Error:", err);
	});
});

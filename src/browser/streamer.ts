import { spawn } from "child_process";
import fs from "fs";

const isDocker = process.env.DOCKER === "true";

export interface StreamOptions {
	filePath: string;
	rtmpUrl: string;
	onLog?: (log: string) => void;
}

export async function streamSegment(options: StreamOptions): Promise<void> {
	console.log(`[Streamer] Starting live stream of segment: ${options.filePath}`);
	
	if (!fs.existsSync(options.filePath)) {
		throw new Error(`Segment file does not exist: ${options.filePath}`);
	}

	const ffmpegPath = isDocker 
		? "ffmpeg" 
		: "C:/Users/admin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe";

	return new Promise((resolve, reject) => {
		const ffmpegProcess = spawn(ffmpegPath, [
			"-re", // Read input at native frame rate for 100% smooth real-time streaming
			"-i", options.filePath,
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-tune", "zerolatency",
			"-bf", "0", // Zero B-frames for 100% DTS compliance
			"-max_interleave_delta", "0",
			"-pix_fmt", "yuv420p",
			"-b:v", "6000k",
			"-minrate", "4000k",
			"-maxrate", "6000k",
			"-bufsize", "12000k",
			"-r", "30",
			"-g", "30",
			"-c:a", "aac",
			"-b:a", "128k",
			"-ar", "44100",
			"-f", "flv",
			options.rtmpUrl
		]);

		ffmpegProcess.stderr.on("data", (data) => {
			const str = data.toString().trim();
			if (str && options.onLog) {
				options.onLog(str);
			}
		});

		ffmpegProcess.on("close", (code) => {
			console.log(`[Streamer] Finished streaming segment: ${options.filePath}`);
			
			// Clean up MP4 file after streaming to save disk space
			try {
				if (fs.existsSync(options.filePath)) {
					fs.unlinkSync(options.filePath);
					console.log(`[Streamer] Deleted completed segment file: ${options.filePath}`);
				}
			} catch (err) {
				console.error("[Streamer] Failed to delete segment file:", err);
			}

			if (code === 0) {
				resolve();
			} else {
				// Resolve anyway if file finished
				resolve();
			}
		});

		ffmpegProcess.on("error", (err) => {
			reject(err);
		});
	});
}

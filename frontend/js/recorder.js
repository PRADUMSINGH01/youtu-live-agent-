// In-Browser High-Performance 60FPS Video + Audio MediaRecorder
export class CanvasRecorder {
  constructor(canvas, soundEngine) {
    this.canvas = canvas;
    this.soundEngine = soundEngine;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.timerInterval = null;
    this.totalBytes = 0;
    this.autoChunkMinutes = 0; // 0 = manual, > 0 = automatic chunking
    this.chunkTimer = null;

    this.onStatusChange = () => {};
    this.onChunkComplete = () => {};
  }

  isSupported() {
    return typeof MediaRecorder !== 'undefined' && Boolean(this.canvas.captureStream);
  }

  getBestMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'video/webm';
  }

  start(options = {}) {
    if (this.isRecording) return;

    try {
      const fps = options.fps || 60;
      const videoStream = this.canvas.captureStream(fps);
      const audioStream = this.soundEngine ? this.soundEngine.getAudioStream() : null;

      const combinedTracks = [...videoStream.getVideoTracks()];
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        combinedTracks.push(...audioStream.getAudioTracks());
      }

      const combinedStream = new MediaStream(combinedTracks);
      const mimeType = this.getBestMimeType();
      const videoBitsPerSecond = options.bitrate || 14000000; // 14 Mbps default for crystal clear 1080p60

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond,
      });

      this.recordedChunks = [];
      this.totalBytes = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          this.totalBytes += event.data.size;
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finishRecording();
      };

      // Request data in chunks every 1 second
      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.recordingStartTime = performance.now();

      this.timerInterval = setInterval(() => {
        this.updateTelemetry();
      }, 500);

      if (this.autoChunkMinutes > 0) {
        this.chunkTimer = setTimeout(() => {
          this.cycleAutoChunk();
        }, this.autoChunkMinutes * 60 * 1000);
      }

      this.onStatusChange({
        status: 'recording',
        mimeType,
        fps,
        bitrate: videoBitsPerSecond,
      });
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err);
      alert("Error starting recorder: " + err.message);
    }
  }

  stop() {
    if (!this.isRecording || !this.mediaRecorder) return;
    if (this.chunkTimer) clearTimeout(this.chunkTimer);
    if (this.timerInterval) clearInterval(this.timerInterval);

    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
  }

  cycleAutoChunk() {
    if (!this.isRecording) return;
    console.log("[Recorder] Auto-cycling chunk...");
    this.stop();
    // Restart next chunk immediately after download
    setTimeout(() => {
      this.start({ fps: 60 });
    }, 1200);
  }

  finishRecording() {
    if (this.recordedChunks.length === 0) return;

    const mimeType = this.getBestMimeType();
    const blob = new Blob(this.recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const filename = `flag_battle_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;

    // Trigger auto-download
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);

    this.onStatusChange({
      status: 'idle',
      lastFilename: filename,
      lastSize: (blob.size / (1024 * 1024)).toFixed(2) + " MB",
    });

    this.onChunkComplete({
      blob,
      filename,
      size: blob.size,
    });
  }

  updateTelemetry() {
    if (!this.isRecording) return;
    const elapsedSec = Math.floor((performance.now() - this.recordingStartTime) / 1000);
    const sizeMb = (this.totalBytes / (1024 * 1024)).toFixed(1);

    const mins = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
    const secs = String(elapsedSec % 60).padStart(2, "0");

    this.onStatusChange({
      status: 'recording',
      elapsedFormatted: `${mins}:${secs}`,
      elapsedSec,
      sizeFormatted: `${sizeMb} MB`,
    });
  }

  takeSnapshot() {
    try {
      const dataUrl = this.canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `flag_battle_snapshot_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Snapshot error:", e);
    }
  }
}

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { storage, db } from "../../firebase/init.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 500, // 500MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video or audio files are allowed"));
    }
  },
});

const router = Router();

/**
 * POST /upload-video
 * Upload video file to Firebase Storage & save RTMP stream configuration to Firestore
 */
router.post(
  "/upload-video",
  upload.single("video"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: "No video file provided" });
      }

      const {
        title,
        description,
        platform = "youtube",
        rtmpUrl = "rtmp://a.rtmp.youtube.com/live2",
        streamKey = "",
        thumbnailUrl = "",
        scheduleTime,
        fps = 60,
        resolution = "1080p60",
        bitrateKbps = 6500,
        isStreaming = false,
      } = req.body;

      const fileExtension = file.originalname.split(".").pop() || "mp4";
      const uniqueId = uuidv4();
      const fileName = `videos/${Date.now()}_${uniqueId}.${fileExtension}`;

      // Upload file buffer to Firebase Storage
      const bucket = storage.bucket();
      const fileUpload = bucket.file(fileName);

      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            platform,
          },
        },
      });

      // Construct public download URL and attempt signed URL
      let fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
      try {
        const [signedUrl] = await fileUpload.getSignedUrl({
          action: "read",
          expires: "03-01-2030",
        });
        if (signedUrl) {
          fileUrl = signedUrl;
        }
      } catch (signErr) {
        console.warn("Signed URL generation warning (using fallback URL):", signErr);
      }

      const createdAt = new Date().toISOString();

      // Save video record in Firestore
      const videoDocRef = await db.collection("videos").add({
        id: uniqueId,
        title: title || file.originalname,
        description: description || "",
        fileName,
        originalName: file.originalname,
        storagePath: fileUpload.name,
        url: fileUrl,
        size: file.size,
        sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        mimetype: file.mimetype,
        createdAt,
      });

      // Save RTMP stream destination record in Firestore
      const streamDocRef = await db.collection("streams").add({
        id: `stream_${uniqueId}`,
        videoId: videoDocRef.id,
        videoUrl: fileUrl,
        videoFileName: file.originalname,
        platform,
        rtmpUrl,
        streamKey,
        title: title || file.originalname,
        description: description || "",
        thumbnailUrl: thumbnailUrl || "",
        scheduleTime: scheduleTime || null,
        fps: Number(fps) || 60,
        resolution: resolution || "1080p60",
        bitrateKbps: Number(bitrateKbps) || 6500,
        isStreaming: Boolean(isStreaming),
        status: isStreaming ? "streaming" : "ready",
        createdAt,
        updatedAt: createdAt,
      });

      return res.status(201).json({
        success: true,
        message: "Video and RTMP stream configuration saved to Firebase successfully",
        videoId: videoDocRef.id,
        streamId: streamDocRef.id,
        url: fileUrl,
        fileName,
        stream: {
          id: streamDocRef.id,
          platform,
          rtmpUrl,
          streamKey,
          title: title || file.originalname,
          description: description || "",
          videoUrl: fileUrl,
          videoFileName: file.originalname,
          sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          createdAt,
        },
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to upload video and save RTMP to Firebase",
      });
    }
  }
);

/**
 * POST /save-rtmp
 * Save or update RTMP configuration without uploading a new video file
 */
router.post("/save-rtmp", async (req: Request, res: Response) => {
  try {
    const {
      platform = "youtube",
      rtmpUrl,
      streamKey,
      title = "",
      description = "",
      videoUrl = "",
      videoFileName = "",
      thumbnailUrl = "",
      scheduleTime = null,
      fps = 60,
      resolution = "1080p60",
      bitrateKbps = 6500,
      isStreaming = false,
    } = req.body;

    if (!streamKey && !rtmpUrl) {
      return res.status(400).json({ success: false, error: "RTMP URL or Stream Key is required" });
    }

    const createdAt = new Date().toISOString();
    const streamDocRef = await db.collection("streams").add({
      platform,
      rtmpUrl: rtmpUrl || "rtmp://a.rtmp.youtube.com/live2",
      streamKey: streamKey || "",
      title,
      description,
      videoUrl,
      videoFileName,
      thumbnailUrl,
      scheduleTime,
      fps: Number(fps) || 60,
      resolution,
      bitrateKbps: Number(bitrateKbps) || 6500,
      isStreaming: Boolean(isStreaming),
      status: isStreaming ? "streaming" : "ready",
      createdAt,
      updatedAt: createdAt,
    });

    return res.status(201).json({
      success: true,
      message: "RTMP configuration saved to Firebase Firestore",
      streamId: streamDocRef.id,
    });
  } catch (error: any) {
    console.error("Save RTMP error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to save RTMP config" });
  }
});

/**
 * GET /videos
 * List all uploaded videos from Firestore
 */
router.get("/videos", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("videos").orderBy("createdAt", "desc").limit(50).get();
    const videos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ success: true, videos });
  } catch (error: any) {
    console.error("Get videos error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch videos" });
  }
});

/**
 * GET /streams
 * List all active/saved RTMP streams from Firestore
 */
router.get("/streams", async (_req: Request, res: Response) => {
  try {
    const snapshot = await db.collection("streams").orderBy("createdAt", "desc").limit(50).get();
    const streams = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ success: true, streams });
  } catch (error: any) {
    console.error("Get streams error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to fetch streams" });
  }
});

/**
 * DELETE /streams/:id
 * Delete a stream configuration from Firestore
 */
router.delete("/streams/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ success: false, error: "Stream ID is required" });
    }
    await db.collection("streams").doc(id).delete();
    return res.status(200).json({ success: true, message: `Stream ${id} deleted successfully` });
  } catch (error: any) {
    console.error("Delete stream error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to delete stream" });
  }
});

export default router;

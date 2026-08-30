import path from "node:path";
import fs from "node:fs";
import { db, storage } from "../../firebase/init.js";

/**
 * Format current date to DD-MM-YYYY (e.g. "30-08-2026")
 */
function getFormattedDate(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export async function fetchStreamFile(userID: string): Promise<string> {
  const user = await db
    .collection("users")
    .where("email", "==", userID)
    .get();

  if (user.empty) {
    throw new Error(`User not found with email: ${userID}`);
  }

  const refreshtoken = user.docs[0];
  const channelId = refreshtoken?.data().activeChannelId;

  if (!channelId?.trim()) {
    throw new Error(`No activeChannelId found for user: ${userID}`);
  }

  console.log(`[Storage] Active channel ID: ${channelId}`);

  const todayStr = getFormattedDate();
  console.log(`[Storage] Target date: ${todayStr}`);

  const storageBucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    "background-ab0ec.firebasestorage.app";
  const bucket = storage.bucket(storageBucketName);

  // Candidate prefix locations ordered by specificity
  const candidatePrefixes = [
    `final_stream_videoes/${channelId}/${todayStr}/`,
    `final_stream_videos/${channelId}/${todayStr}/`,
    `final_stream_videoes/${channelId}/`,
    `final_stream_videos/${channelId}/`,
  ];

  let selectedFile: any = null;

  for (const prefix of candidatePrefixes) {
    console.log(`[Storage] Searching bucket prefix: ${prefix}`);
    try {
      const [files] = await bucket.getFiles({ prefix });
      const videoFiles = files.filter(
        (f) =>
          f.name.toLowerCase().endsWith(".mp4") &&
          !f.name.endsWith("/"),
      );

      if (videoFiles.length > 0) {
        // Sort newest first
        videoFiles.sort((a, b) => {
          const timeA = new Date(
            a.metadata.timeCreated || a.metadata.updated || 0,
          ).getTime();
          const timeB = new Date(
            b.metadata.timeCreated || b.metadata.updated || 0,
          ).getTime();
          return timeB - timeA;
        });

        selectedFile = videoFiles[0];
        console.log(`[Storage] Selected video file: ${selectedFile.name}`);
        break;
      }
    } catch (err) {
      console.warn(`[Storage] Error listing prefix ${prefix}:`, err);
    }
  }

  // Fallback: search any video for this channel
  if (!selectedFile) {
    console.log(
      `[Storage] Checking all video files matching channel ${channelId}...`,
    );
    try {
      const [allFiles] = await bucket.getFiles({ prefix: "final_stream_" });
      const matchingFiles = allFiles.filter(
        (f) =>
          f.name.includes(channelId) &&
          f.name.toLowerCase().endsWith(".mp4") &&
          !f.name.endsWith("/"),
      );

      if (matchingFiles.length > 0) {
        matchingFiles.sort((a, b) => {
          const timeA = new Date(
            a.metadata.timeCreated || a.metadata.updated || 0,
          ).getTime();
          const timeB = new Date(
            b.metadata.timeCreated || b.metadata.updated || 0,
          ).getTime();
          return timeB - timeA;
        });
        selectedFile = matchingFiles[0];
        console.log(`[Storage] Found fallback video file: ${selectedFile.name}`);
      }
    } catch (err) {
      console.warn("[Storage] Fallback search error:", err);
    }
  }

  if (!selectedFile) {
    throw new Error(
      `No video file (.mp4) found in storage for channel "${channelId}" (date: ${todayStr}). Checked prefixes: ${candidatePrefixes.join(", ")}`,
    );
  }

  const downloadsDir = path.resolve(process.cwd(), "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const remoteBaseName = path
    .basename(selectedFile.name)
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const localFileName = `${channelId}_${remoteBaseName}`;
  const localFilePath = path.join(downloadsDir, localFileName);

  if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
    console.log(`[Storage] Using existing cached stream video at: ${localFilePath}`);
    return localFilePath;
  }

  console.log(
    `[Storage] Downloading stream video "${selectedFile.name}" to ${localFilePath}...`,
  );
  await selectedFile.download({ destination: localFilePath });
  console.log(
    `[Storage] Stream video downloaded successfully to: ${localFilePath}`,
  );

  return localFilePath;
}




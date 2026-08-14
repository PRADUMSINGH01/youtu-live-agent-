/**
 * CLI Utility to upload any local video file to Firebase Storage & Firestore
 *
 * Usage:
 *   npx tsx src/firebase/upload_file.ts test.webm
 *   npx tsx src/firebase/upload_file.ts 4k_battle_perfect.mp4
 */

import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";
import { storage, db } from "./init.js";

dotenv.config();

async function uploadLocalFile(targetFile: string) {
  const resolvedPath = path.isAbsolute(targetFile)
    ? targetFile
    : path.resolve(process.cwd(), targetFile);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`[Upload] File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(resolvedPath);
  const fileBuffer = fs.readFileSync(resolvedPath);
  const fileName = path.basename(resolvedPath);
  const ext = path.extname(fileName).toLowerCase();

  const mimeType =
    ext === ".webm"
      ? "video/webm"
      : ext === ".mp4"
      ? "video/mp4"
      : ext === ".mov"
      ? "video/quicktime"
      : ext === ".mp3"
      ? "audio/mpeg"
      : "application/octet-stream";

  const storagePath = `videos/${Date.now()}_${fileName}`;
  const bucket = storage.bucket();

  console.log("");
  console.log("====================================================");
  console.log("       Firebase Video Asset Ingest Tool");
  console.log("====================================================");
  console.log(`Local File   : ${resolvedPath}`);
  console.log(`File Size    : ${(fileStats.size / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`MIME Type    : ${mimeType}`);
  console.log(`Bucket Name  : ${bucket.name}`);
  console.log(`Storage Path : ${storagePath}`);
  console.log("====================================================\n");

  console.log(`[1/3] Uploading file buffer to Firebase Storage...`);
  const fileUpload = bucket.file(storagePath);

  await fileUpload.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    },
  });
  console.log(`      ✅ Uploaded to Storage bucket successfully.`);

  console.log(`[2/3] Generating download / signed URL...`);
  let downloadUrl: string;
  try {
    const [signedUrl] = await fileUpload.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });
    downloadUrl = signedUrl;
  } catch {
    downloadUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(storagePath)}`;
  }
  console.log(`      ✅ URL: ${downloadUrl}`);

  console.log(`[3/3] Saving document to Firestore 'videos' collection...`);
  const videoDoc = await db.collection("videos").add({
    title: fileName,
    fileName,
    storagePath,
    url: downloadUrl,
    size: fileStats.size,
    sizeFormatted: `${(fileStats.size / (1024 * 1024)).toFixed(1)} MB`,
    mimetype: mimeType,
    createdAt: new Date().toISOString(),
  });

  console.log(`      ✅ Firestore Document ID: ${videoDoc.id}`);
  console.log("\n🎉 Video asset successfully stored in Firebase Storage & Firestore!\n");
  process.exit(0);
}

const fileArg = process.argv[2] || process.env.INPUT_FILE || "test.webm";
uploadLocalFile(fileArg).catch((err) => {
  console.error("Upload error:", err);
  process.exit(1);
});

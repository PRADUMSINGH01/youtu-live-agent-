/**
 * Real connectivity test for FirebaseService (Firestore + Cloud Storage).
 *
 * Run: npx tsx src/firebase/init.test.ts
 */

import { db, storage, app } from "./init.js";

async function testFirebase() {
  console.log("=== Firebase Init & Storage Test ===\n");

  // 1. App object check
  console.log("[1] App name :", app.name);

  // 2. Firestore read
  try {
    console.log("[2] Testing Firestore read...");
    const testRef = db.collection("_health").doc("ping");
    const snapshot = await testRef.get();

    if (snapshot.exists) {
      console.log("    ✅ Document found:", snapshot.data());
    } else {
      console.log("    ✅ Firestore connected — document does not exist yet (normal for first run)");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("    ❌ Firestore read failed:", message);
    process.exit(1);
  }

  // 3. Firestore write
  try {
    console.log("[3] Testing Firestore write...");
    await db.collection("_health").doc("ping").set({ ts: new Date().toISOString() });
    console.log("    ✅ Write succeeded");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("    ❌ Firestore write failed:", message);
    process.exit(1);
  }

  // 4. Firebase Cloud Storage Upload & Signed URL test
  try {
    console.log("[4] Testing Firebase Cloud Storage upload & signed URL...");
    const bucket = storage.bucket();
    console.log("    Storage bucket:", bucket.name);

    const testFile = bucket.file("_health/storage-ping.txt");
    const testContent = `Ping test from youtube-agent at ${new Date().toISOString()}`;

    // Upload test buffer
    await testFile.save(Buffer.from(testContent), {
      contentType: "text/plain",
      metadata: {
        testedBy: "youtube-agent-init-test",
      },
    });
    console.log("    ✅ File buffer uploaded to Storage successfully");

    // Verify existence
    const [exists] = await testFile.exists();
    if (!exists) {
      throw new Error("File was uploaded but exists() returned false");
    }
    console.log("    ✅ File existence verified in Storage bucket");

    // Generate signed URL
    const [signedUrl] = await testFile.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 15,
    });
    console.log("    ✅ Signed URL generated successfully:", signedUrl.substring(0, 65) + "...");

    // Clean up temporary test file
    await testFile.delete();
    console.log("    ✅ Temporary test file deleted successfully");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("    ❌ Firebase Storage test failed:", message);
    process.exit(1);
  }

  console.log("\n=== All checks passed (Firestore + Storage 100% Active) ===");
  process.exit(0);
}

testFirebase();

import fs from "node:fs/promises";
import path from "node:path";
import { storage } from '../../firebase/init.js';

export async function audioUploadFile(music) {
      const fileName = `music/${music.track.id}.mp3`;
        const bucket = storage.bucket();

        const file = bucket.file(fileName);

  await file.save(music.buffer, {
    metadata: {
      contentType: "audio/mpeg",
    },
  });

   console.log(
    `Uploaded successfully: ${fileName}`
  );





    
}
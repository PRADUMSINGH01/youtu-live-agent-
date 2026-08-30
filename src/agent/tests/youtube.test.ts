import "dotenv/config";
import express from "express";
import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";

/* =========================================
   CONFIG
========================================= */

const PORT = 3000;
const ENV_PATH = path.join(process.cwd(), ".env");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:3000/oauth/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error(
    "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env"
  );
}

/* =========================================
   OAUTH CLIENT
========================================= */

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/youtube"
];

/* =========================================
   SAVE REFRESH TOKEN
========================================= */

function saveRefreshToken(refreshToken: string) {
  let envContent = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, "utf8")
    : "";

  if (/^YOUTUBE_REFRESH_TOKEN=.*/m.test(envContent)) {
    envContent = envContent.replace(
      /^YOUTUBE_REFRESH_TOKEN=.*/m,
      `YOUTUBE_REFRESH_TOKEN=${refreshToken}`
    );
  } else {
    envContent += `\nYOUTUBE_REFRESH_TOKEN=${refreshToken}\n`;
  }

  fs.writeFileSync(ENV_PATH, envContent, "utf8");

  console.log("✅ Refresh token saved to .env");
}

/* =========================================
   FIRST-TIME AUTHENTICATION
========================================= */

async function authenticateFirstTime(): Promise<string> {
  return new Promise((resolve, reject) => {
    const app = express();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES
    });

    console.log("\n=================================");
    console.log("GOOGLE AUTHENTICATION REQUIRED");
    console.log("=================================\n");

    console.log("Open this URL in your browser:\n");
    console.log(authUrl);

    const server = app.listen(PORT, () => {
      console.log(`\nWaiting for OAuth callback on port ${PORT}...`);
    });

    app.get("/oauth/callback", async (req, res) => {
      try {
        const code = req.query.code;

        if (!code || typeof code !== "string") {
          throw new Error("Authorization code not received");
        }

        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
          throw new Error(
            "No refresh token received. Remove this app from your Google Account permissions and try again."
          );
        }

        oauth2Client.setCredentials(tokens);

        saveRefreshToken(tokens.refresh_token);

        res.send(`
          <h1>Authentication Successful ✅</h1>
          <p>You can close this page and return to your terminal.</p>
        `);

        console.log("\n✅ Google authentication successful!");

        server.close();

        resolve(tokens.refresh_token);
      } catch (error) {
        console.error("OAuth error:", error);

        res.status(500).send("Authentication failed");

        server.close();

        reject(error);
      }
    });
  });
}

/* =========================================
   GET AUTHENTICATED YOUTUBE CLIENT
========================================= */

async function getYoutubeClient() {
  let refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;


  // Reuse saved refresh token
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  return google.youtube({
    version: "v3",
    auth: oauth2Client
  });
}

/* =========================================
   CREATE LIVE BROADCAST
========================================= */

export async function createLiveBroadcast(youtube: any) {
  console.log("\nCreating Live Broadcast...");

  const response = await youtube.liveBroadcasts.insert({
    part: ["snippet", "status", "contentDetails"],

    requestBody: {
      snippet: {
        title: "My API Live Stream 🔴",

        description:
          "Live stream created automatically using the YouTube Live Streaming API.",

        // Schedule 5 minutes from now
        scheduledStartTime: new Date(
          Date.now() + 5 * 60 * 1000
        ).toISOString()
      },

      status: {
        privacyStatus: "unlisted"
      },

      contentDetails: {
        enableAutoStart: false,
        enableAutoStop: true,
        enableDvr: true,
        recordFromStart: true
      }
    }
  });

  const broadcast = response.data;

  if (!broadcast.id) {
    throw new Error("Broadcast ID was not returned");
  }

  console.log("✅ Broadcast created");
  console.log("Broadcast ID:", broadcast.id);

  return broadcast;
}

/* =========================================
   CREATE LIVE STREAM + RTMP KEY
========================================= */

async function createLiveStream(youtube: any) {
  console.log("\nCreating Live Stream...");

  const response = await youtube.liveStreams.insert({
    part: ["snippet", "cdn", "contentDetails", "status"],

    requestBody: {
      snippet: {
        title: "My API RTMP Stream"
      },

      cdn: {
        ingestionType: "rtmp",
        resolution: "720p",
        frameRate: "30fps"
      },

      contentDetails: {
        isReusable: false
      }
    }
  });

  const stream = response.data;

  if (!stream.id) {
    throw new Error("Stream ID was not returned");
  }

  const ingestionInfo = stream.cdn?.ingestionInfo;

  if (
    !ingestionInfo?.ingestionAddress ||
    !ingestionInfo?.streamName
  ) {
    throw new Error(
      "RTMP ingestion information was not returned"
    );
  }

  console.log("✅ Live Stream created");
  console.log("Stream ID:", stream.id);

  console.log("\n=================================");
  console.log("🔑 RTMP CREDENTIALS");
  console.log("=================================");

  console.log("\nRTMP Server:");
  console.log(ingestionInfo.ingestionAddress);

  console.log("\nStream Key:");
  console.log(ingestionInfo.streamName);

  return {
    id: stream.id,
    rtmpServer: ingestionInfo.ingestionAddress,
    streamKey: ingestionInfo.streamName
  };
}

/* =========================================
   BIND STREAM TO BROADCAST
========================================= */

async function bindStreamToBroadcast(
  youtube: any,
  broadcastId: string,
  streamId: string
) {
  console.log("\nBinding Stream to Broadcast...");

  const response = await youtube.liveBroadcasts.bind({
    part: ["id", "snippet", "contentDetails", "status"],

    id: broadcastId,

    streamId: streamId
  });

  console.log("✅ Stream successfully bound!");

  return response.data;
}

/* =========================================
   MAIN
========================================= */

async function main() {
  try {
    console.log("\n🚀 Starting YouTube Live Setup...\n");

    // Authenticate once / reuse token
    const youtube = await getYoutubeClient();

    // Step 1: Create YouTube Live Broadcast
    const broadcast = await createLiveBroadcast(youtube);

    // Step 2: Create YouTube Live Stream
    const stream = await createLiveStream(youtube);

    // Step 3: Bind Stream to Broadcast
    await bindStreamToBroadcast(
      youtube,
      broadcast.id!,
      stream.id
    );

    console.log("\n=================================");
    console.log("🎉 YOUTUBE LIVE SETUP COMPLETE");
    console.log("=================================");

    console.log("\nBroadcast ID:");
    console.log(broadcast.id);

    console.log("\nStream ID:");
    console.log(stream.id);

    console.log("\nRTMP Server:");
    console.log(stream.rtmpServer);

    console.log("\nRTMP Stream Key:");
    console.log(stream.streamKey);

    console.log("\n=================================");
    console.log("NEXT: Configure OBS");
    console.log("=================================");

    console.log("\nOBS Server:");
    console.log(stream.rtmpServer);

    console.log("\nOBS Stream Key:");
    console.log(stream.streamKey);

    console.log(
      "\nStart streaming from OBS. YouTube will receive the stream."
    );

    process.exit(0);

  } catch (error: any) {
    console.error("\n❌ ERROR:");

    if (error?.response?.data) {
      console.error(JSON.stringify(
        error.response.data,
        null,
        2
      ));
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

main()

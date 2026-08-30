import { google, youtube_v3 } from "googleapis";

export interface YouTubeOAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export function createYouTubeClient(
  credentials: YouTubeOAuthCredentials,
): youtube_v3.Youtube {
  if (!credentials.clientId) {
    throw new Error("Google clientId is required");
  }

  if (!credentials.clientSecret) {
    throw new Error("Google clientSecret is required");
  }

  if (!credentials.refreshToken) {
    throw new Error("Google refreshToken is required");
  }

  const auth = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
  );

  auth.setCredentials({
    refresh_token: credentials.refreshToken,
  });

  return google.youtube({
    version: "v3",
    auth,
  });
}
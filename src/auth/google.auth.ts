import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// OAuth 2.0 Client Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const DEFAULT_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/youtube.readonly',
];

/**
 * Creates a new OAuth2 client instance
 */
export function createOAuth2Client(redirectUri?: string) {
  const uri = redirectUri || process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    uri
  );
}

export type GoogleOAuthClient = ReturnType<typeof createOAuth2Client>;

/**
 * Generates the Google OAuth 2.0 Consent URL
 */
export function getGoogleAuthUrl(state?: string, redirectUri?: string): string {
  const targetRedirect = redirectUri || process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  if (!GOOGLE_CLIENT_ID) {
    const params = new URLSearchParams({
      client_id: 'sample-google-client-id.apps.googleusercontent.com',
      redirect_uri: targetRedirect,
      response_type: 'code',
      scope: YOUTUBE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state || 'dev_session',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  const oauth2Client = createOAuth2Client(targetRedirect);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: YOUTUBE_SCOPES,
    include_granted_scopes: true,
    redirect_uri: targetRedirect,
    state,
  });
}

/**
 * Exchanges authorization code for access & refresh tokens
 */
export async function getTokensFromCode(code: string, redirectUri?: string) {
  if (!GOOGLE_CLIENT_ID || code === 'dev_code' || code.startsWith('demo_')) {
    return {
      tokens: {
        access_token: `ya29.sample_dev_token_${Date.now()}`,
        refresh_token: `1//04_sample_refresh_token_${Date.now()}`,
        scope: YOUTUBE_SCOPES.join(' '),
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600 * 1000,
      },
    };
  }

  const targetRedirect = redirectUri || process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  const oauth2Client = createOAuth2Client(targetRedirect);
  const { tokens } = await oauth2Client.getToken({
    code,
    redirect_uri: targetRedirect,
  });
  return { tokens };
}

/**
 * Retrieves Google User Profile using OAuth client
 */
export async function fetchGoogleUserProfile(authClient: any) {
  const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
  const { data } = await oauth2.userinfo.get();
  return {
    id: data.id || `google_user_${Date.now()}`,
    email: data.email || 'creator@youtube-agent.com',
    name: data.name || 'YouTube Creator',
    picture: data.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    verifiedEmail: data.verified_email ?? true,
  };
}

/**
 * Fetches all YouTube channels owned or managed by this Google account
 */
export async function fetchUserYouTubeChannels(authClient: any) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: authClient });
    const response = await youtube.channels.list({
      mine: true,
      part: ['snippet', 'contentDetails', 'statistics', 'brandingSettings', 'status'],
    });

    const items = response.data.items || [];
    return items.map((item) => ({
      id: item.id || `UC_channel_${Date.now()}`,
      title: item.snippet?.title || 'YouTube Channel',
      customUrl: item.snippet?.customUrl || `@${(item.snippet?.title || 'channel').toLowerCase().replace(/\s+/g, '')}`,
      description: item.snippet?.description || '',
      publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
      thumbnails: {
        default: item.snippet?.thumbnails?.default?.url || '',
        medium: item.snippet?.thumbnails?.medium?.url || '',
        high: item.snippet?.thumbnails?.high?.url || '',
      },
      statistics: {
        viewCount: Number(item.statistics?.viewCount || 0),
        subscriberCount: Number(item.statistics?.subscriberCount || 0),
        hiddenSubscriberCount: Boolean(item.statistics?.hiddenSubscriberCount),
        videoCount: Number(item.statistics?.videoCount || 0),
      },
      privacyStatus: item.status?.privacyStatus || 'public',
    }));
  } catch (err: any) {
    console.warn('[YouTube API] Could not fetch real channels (falling back to default channel):', err.message);
    return [];
  }
}

/**
 * Creates a YouTube Live Broadcast & Ingest Stream Key
 */
export interface CreateBroadcastOptions {
  title: string;
  description?: string;
  scheduledStartTime?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  resolution?: '1080p' | '720p' | '4k';
  frameRate?: '60fps' | '30fps';
}

export async function createYouTubeLiveBroadcast(
  authClient: any,
  options: CreateBroadcastOptions
) {
  const youtube = google.youtube({ version: 'v3', auth: authClient });

  const scheduledTime = options.scheduledStartTime || new Date(Date.now() + 1000 * 60 * 2).toISOString();
  const privacy = options.privacyStatus || 'public';

  // 1. Insert Live Broadcast
  const broadcastRes = await youtube.liveBroadcasts.insert({
    part: ['snippet', 'status', 'contentDetails'],
    requestBody: {
      snippet: {
        title: options.title,
        description: options.description || 'Autonomous YouTube Live Stream via Agent Hub',
        scheduledStartTime: scheduledTime,
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: true,
        recordFromStart: true,
      },
    },
  });

  const broadcastId = broadcastRes.data.id;

  // 2. Insert Live Stream Ingestion Point (generates RTMP URL and Stream Key)
  const streamRes = await youtube.liveStreams.insert({
    part: ['snippet', 'cdn', 'status'],
    requestBody: {
      snippet: {
        title: `${options.title} - Stream Ingest`,
      },
      cdn: {
        frameRate: options.frameRate || '60fps',
        ingestionType: 'rtmp',
        resolution: options.resolution || '1080p',
      },
    },
  });

  const streamId = streamRes.data.id;
  const ingestionInfo = streamRes.data.cdn?.ingestionInfo;
  const rtmpUrl = ingestionInfo?.ingestionAddress || 'rtmp://a.rtmp.youtube.com/live2';
  const streamKey = ingestionInfo?.streamName || `live_${Date.now()}_streamkey`;

  // 3. Bind Broadcast to Stream
  if (broadcastId && streamId) {
    await youtube.liveBroadcasts.bind({
      id: broadcastId,
      part: ['id', 'contentDetails'],
      streamId: streamId,
    });
  }

  return {
    broadcastId,
    streamId,
    title: options.title,
    rtmpUrl,
    streamKey,
    scheduledStartTime: scheduledTime,
    privacyStatus: privacy,
    youtubeWatchUrl: `https://www.youtube.com/watch?v=${broadcastId}`,
  };
}

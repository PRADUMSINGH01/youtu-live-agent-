import type {
  FirestoreStream,
  FirestoreVideo,
  SystemHealth,
  UserProfile,
  YouTubeChannel,
  YouTubeLiveBroadcast,
} from '../types';

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/api`;
  }
  return '/api';
};

const API_BASE = getApiBase();

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}

// ----------------------------------------------------
// Google Auth & User Management APIs
// ----------------------------------------------------

export async function getGoogleAuthUrl(): Promise<{ authUrl: string; permissions: string[] }> {
  const res = await fetch(`${API_BASE}/auth/google/url`);
  if (!res.ok) {
    throw new Error(`Failed to get Google Auth URL: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAuthMe(uid?: string): Promise<{
  authenticated: boolean;
  user: UserProfile | null;
  channels: YouTubeChannel[];
  activeChannel: YouTubeChannel | null;
}> {
  const url = uid ? `${API_BASE}/auth/me?uid=${encodeURIComponent(uid)}` : `${API_BASE}/auth/me`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch auth state: ${res.statusText}`);
  }
  return res.json();
}

export async function devLogin(email?: string, name?: string): Promise<{
  success: boolean;
  user: UserProfile;
  channels: YouTubeChannel[];
  activeChannel: YouTubeChannel;
}> {
  const res = await fetch(`${API_BASE}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) {
    throw new Error(`Dev login failed: ${res.statusText}`);
  }
  return res.json();
}

export async function switchActiveChannel(userId: string, channelId: string): Promise<{ success: boolean; activeChannelId: string }> {
  const res = await fetch(`${API_BASE}/auth/switch-channel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, channelId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to switch channel: ${res.statusText}`);
  }
  return res.json();
}

export async function syncYouTubeChannels(userId: string): Promise<{ success: boolean; message: string; channels: YouTubeChannel[] }> {
  const res = await fetch(`${API_BASE}/auth/sync-channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to sync YouTube channels: ${res.statusText}`);
  }
  return res.json();
}

// ----------------------------------------------------
// YouTube Live Broadcast & Video APIs
// ----------------------------------------------------

export interface CreateBroadcastPayload {
  userId?: string;
  channelId?: string;
  title: string;
  description?: string;
  scheduledStartTime?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  resolution?: '1080p' | '720p' | '4k';
  frameRate?: '60fps' | '30fps';
  videoId?: string;
}

export async function createYouTubeBroadcast(payload: CreateBroadcastPayload): Promise<{
  success: boolean;
  broadcast: YouTubeLiveBroadcast;
  streamId: string;
  rtmpUrl: string;
  streamKey: string;
  youtubeWatchUrl: string;
}> {
  const res = await fetch(`${API_BASE}/youtube/broadcasts/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create YouTube Live Broadcast: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBroadcasts(userId?: string): Promise<YouTubeLiveBroadcast[]> {
  const url = userId ? `${API_BASE}/youtube/broadcasts?userId=${encodeURIComponent(userId)}` : `${API_BASE}/youtube/broadcasts`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch broadcasts: ${res.statusText}`);
  }
  const data = await res.json();
  return data.broadcasts || [];
}

export interface PostVideoToYouTubePayload {
  userId?: string;
  channelId?: string;
  title: string;
  description?: string;
  videoUrl: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  tags?: string[];
}

export async function postVideoToYouTube(payload: PostVideoToYouTubePayload): Promise<{
  success: boolean;
  message: string;
  publishedId: string;
  youtubeVideoId: string;
  watchUrl: string;
}> {
  const res = await fetch(`${API_BASE}/youtube/videos/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to post video to YouTube: ${res.statusText}`);
  }
  return res.json();
}

// ----------------------------------------------------
// Existing Video & RTMP APIs
// ----------------------------------------------------

export async function fetchVideos(): Promise<FirestoreVideo[]> {
  const res = await fetch(`${API_BASE}/videos`);
  if (!res.ok) {
    throw new Error(`Failed to fetch videos: ${res.statusText}`);
  }
  const data = await res.json();
  return data.videos || [];
}

export async function fetchStreams(): Promise<FirestoreStream[]> {
  const res = await fetch(`${API_BASE}/streams`);
  if (!res.ok) {
    throw new Error(`Failed to fetch streams: ${res.statusText}`);
  }
  const data = await res.json();
  return data.streams || [];
}

export async function deleteStream(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/streams/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete stream: ${res.statusText}`);
  }
  const data = await res.json();
  return data.success;
}

export interface SaveRtmpPayload {
  platform?: string;
  rtmpUrl?: string;
  streamKey: string;
  title: string;
  description?: string;
  videoUrl?: string;
  videoFileName?: string;
  thumbnailUrl?: string;
  scheduleTime?: string | null;
  fps?: number;
  resolution?: string;
  bitrateKbps?: number;
  isStreaming?: boolean;
}

export async function saveRtmpStream(payload: SaveRtmpPayload): Promise<{ success: boolean; streamId: string }> {
  const res = await fetch(`${API_BASE}/save-rtmp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to save RTMP configuration: ${res.statusText}`);
  }
  return res.json();
}

export async function queueStream(videoId: string): Promise<{ success: boolean; message: string; job?: any }> {
  const res = await fetch(`${API_BASE}/add-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ videoId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to queue stream: ${res.statusText}`);
  }
  return res.json();
}

export interface UploadVideoPayload {
  file: File;
  title: string;
  description?: string;
  platform?: string;
  rtmpUrl?: string;
  streamKey?: string;
  thumbnailUrl?: string;
  scheduleTime?: string;
  fps?: number;
  resolution?: string;
  bitrateKbps?: number;
  isStreaming?: boolean;
}

export async function uploadVideo(payload: UploadVideoPayload): Promise<{
  success: boolean;
  videoId: string;
  streamId: string;
  url: string;
  fileName: string;
  stream: any;
}> {
  const formData = new FormData();
  formData.append('video', payload.file);
  formData.append('title', payload.title);
  if (payload.description) formData.append('description', payload.description);
  if (payload.platform) formData.append('platform', payload.platform);
  if (payload.rtmpUrl) formData.append('rtmpUrl', payload.rtmpUrl);
  if (payload.streamKey) formData.append('streamKey', payload.streamKey);
  if (payload.thumbnailUrl) formData.append('thumbnailUrl', payload.thumbnailUrl);
  if (payload.scheduleTime) formData.append('scheduleTime', payload.scheduleTime);
  if (payload.fps) formData.append('fps', String(payload.fps));
  if (payload.resolution) formData.append('resolution', payload.resolution);
  if (payload.bitrateKbps) formData.append('bitrateKbps', String(payload.bitrateKbps));
  if (payload.isStreaming !== undefined) formData.append('isStreaming', String(payload.isStreaming));

  const res = await fetch(`${API_BASE}/upload-video`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to upload video: ${res.statusText}`);
  }
  return res.json();
}

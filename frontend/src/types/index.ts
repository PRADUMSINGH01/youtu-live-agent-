export type StreamStatus = 'live' | 'streaming' | 'ready' | 'offline' | 'error' | 'queued' | 'idle';

export interface UserProfile {
  id: string; // Google UID / sub
  email: string;
  name: string;
  picture?: string;
  role: 'owner' | 'admin' | 'creator';
  channelIds?: string[];
  activeChannelId?: string;
  settings?: {
    defaultResolution?: string;
    defaultBitrate?: number;
    autoSyncChannels?: boolean;
    autoUploadToFirestore?: boolean;
  };
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    lastLoginAt?: string;
  };
}

export interface YouTubeChannel {
  id: string;
  name?: string;
  title?: string;
  handle?: string;
  customUrl?: string;
  streamKey?: string;
  rtmpUrl?: string;
  category?: string;
  defaultResolution?: string;
  defaultBitrate?: number;
  status?: StreamStatus;
  subscribers?: string;
  lastActive?: string;
  notes?: string;
  thumbnails?: {
    default?: string;
    medium?: string;
    high?: string;
  };
  statistics?: {
    viewCount?: number;
    subscriberCount?: number;
    videoCount?: number;
    hiddenSubscriberCount?: boolean;
  };
  createdAt?: string;
}

export interface YouTubeLiveBroadcast {
  id: string; // YouTube Broadcast ID
  channelId?: string;
  userId?: string;
  title: string;
  description?: string;
  scheduledStartTime?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  rtmpUrl?: string;
  streamKey?: string;
  status?: 'ready' | 'live' | 'completed';
  youtubeWatchUrl?: string;
  videoId?: string;
  createdAt?: string;
}

export interface FirestoreStream {
  id: string;
  platform?: string;
  rtmpUrl: string;
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
  status?: 'streaming' | 'ready' | 'offline' | 'error';
  videoId?: string;
  broadcastId?: string;
  youtubeWatchUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FirestoreVideo {
  id: string;
  title?: string;
  description?: string;
  fileName?: string;
  originalName?: string;
  storagePath?: string;
  url: string;
  size?: number;
  sizeFormatted?: string;
  mimetype?: string;
  createdAt: string;
}

export interface SystemHealth {
  status: string;
  version: string;
  serverTime: string;
  activeRtmpWorkers: number;
  storage: string;
  firestore: string;
}

export interface AgentPipelineStep {
  id: string;
  name: string;
  agentName: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  details: string;
  timestamp?: string;
  output?: Record<string, any>;
}

export interface AgentLog {
  id: string;
  timestamp: string;
  level: 'info' | 'agent' | 'success' | 'warn' | 'error';
  source: string;
  message: string;
  meta?: Record<string, any>;
}

export type TabType = 'overview' | 'channels' | 'streams' | 'agent' | 'videos';

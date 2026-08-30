import type { YouTubeChannel } from '../types';

const STORAGE_KEY = 'yt_agent_channels_v1';

const DEFAULT_CHANNELS: YouTubeChannel[] = [
  {
    id: 'ch_lofi_beats_01',
    name: '24/7 Lofi Ambient Chill',
    handle: '@LofiAmbientRadio',
    streamKey: 'live_yt_8849204_lofi_amb',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    category: 'Music / Study & Relax',
    defaultResolution: '1080p60',
    defaultBitrate: 6500,
    status: 'streaming',
    subscribers: '142K',
    lastActive: 'Just now',
    notes: 'Agent autonomous continuous ambient generator with Gemini mood prompts.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: 'ch_synthwave_02',
    name: 'Synthwave Neon Horizons',
    handle: '@NeonHorizonVibes',
    streamKey: 'live_yt_3910582_synth_neon',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    category: 'Electronic / Synthwave',
    defaultResolution: '1080p60',
    defaultBitrate: 6500,
    status: 'ready',
    subscribers: '58.4K',
    lastActive: '12m ago',
    notes: 'Scheduled for evening prime time broadcast loops.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: 'ch_nature_deep_03',
    name: 'Deep Focus Nature Soundscapes',
    handle: '@DeepFocusNature',
    streamKey: 'live_yt_9104821_nature_rain',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    category: 'Nature & White Noise',
    defaultResolution: '1080p60',
    defaultBitrate: 6500,
    status: 'idle',
    subscribers: '29.1K',
    lastActive: '1 hour ago',
    notes: 'Rain and forest ambient tracks mixed via automated video pipeline.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
];

export function getStoredChannels(): YouTubeChannel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CHANNELS));
      return DEFAULT_CHANNELS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load stored channels:', err);
    return DEFAULT_CHANNELS;
  }
}

export function saveStoredChannels(channels: YouTubeChannel[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  } catch (err) {
    console.error('Failed to save channels:', err);
  }
}

export function addChannel(channelData: Omit<YouTubeChannel, 'id' | 'createdAt'>): YouTubeChannel {
  const channels = getStoredChannels();
  const newChannel: YouTubeChannel = {
    ...channelData,
    id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newChannel, ...channels];
  saveStoredChannels(updated);
  return newChannel;
}

export function updateChannel(id: string, updates: Partial<YouTubeChannel>): YouTubeChannel | null {
  const channels = getStoredChannels();
  const index = channels.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const updatedChannel = { ...channels[index], ...updates };
  channels[index] = updatedChannel;
  saveStoredChannels(channels);
  return updatedChannel;
}

export function deleteStoredChannel(id: string): boolean {
  const channels = getStoredChannels();
  const filtered = channels.filter((c) => c.id !== id);
  if (filtered.length === channels.length) return false;
  saveStoredChannels(filtered);
  return true;
}

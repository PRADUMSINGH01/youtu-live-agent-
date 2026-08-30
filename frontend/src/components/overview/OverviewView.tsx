import React from 'react';
import {
  Radio,
  Tv,
  Film,
  Bot,
  Activity,
  ArrowRight,
  Database,
  HardDrive,
  Cpu,
  Plus,
  Play,
  Clock,
  Zap,
  Upload,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import type {
  YouTubeChannel,
  FirestoreStream,
  FirestoreVideo,
  SystemHealth,
  TabType,
} from '../../types';

interface OverviewViewProps {
  channels: YouTubeChannel[];
  streams: FirestoreStream[];
  videos: FirestoreVideo[];
  health: SystemHealth | null;
  setActiveTab: (tab: TabType) => void;
  onOpenNewChannelModal: () => void;
  onOpenNewStreamModal: () => void;
  onOpenQuickStreamModal: () => void;
  onOpenUploadModal: () => void;
  onSelectVideo: (video: FirestoreVideo) => void;
  onLaunchStreamForChannel: (channel: YouTubeChannel) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  channels = [],
  streams = [],
  videos = [],
  health,
  setActiveTab,
  onOpenNewChannelModal,
  onOpenQuickStreamModal,
  onOpenUploadModal,
  onSelectVideo,
  onLaunchStreamForChannel,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const activeStreams = (streams || []).filter(
    (s) => s?.isStreaming || s?.status === 'streaming'
  );
  const liveChannels = (channels || []).filter(
    (c) => c?.status === 'live' || c?.status === 'streaming'
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const primaryLiveStream = activeStreams[0] || (streams.length > 0 ? streams[0] : null);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Quick Action Command Bar */}
      <div className="p-4 rounded-2xl glass-panel flex flex-col md:flex-row items-center justify-between gap-4 border border-zinc-800">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              YouTube Autonomous Control Hub
            </h2>
            <p className="text-[11px] text-zinc-400">
              {channels.length} Channels • {activeStreams.length} Active RTMP Streams • {videos.length} Firestore Videos
            </p>
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={onOpenQuickStreamModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all shadow-md active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            1-Click Stream
          </button>

          <button
            onClick={onOpenNewChannelModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl border border-zinc-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Channel
          </button>

          <button
            onClick={onOpenUploadModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl border border-zinc-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Video
          </button>

          <button
            onClick={() => setActiveTab('agent')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl border border-zinc-800 transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            Agent Engine
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* YouTube Channels */}
        <div
          onClick={() => setActiveTab('channels')}
          className="p-5 rounded-2xl glass-card cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              YouTube Channels
            </span>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white">
              <Tv className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {channels.length}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              ({liveChannels.length} broadcasting)
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1 group-hover:text-white transition-colors">
            Manage channels &amp; stream keys <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* RTMP Streams */}
        <div
          onClick={() => setActiveTab('streams')}
          className="p-5 rounded-2xl glass-card cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              RTMP Broadcasts
            </span>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {streams.length}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              ({activeStreams.length} live now)
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1 group-hover:text-white transition-colors">
            View active RTMP feeds <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Firestore Videos */}
        <div
          onClick={() => setActiveTab('videos')}
          className="p-5 rounded-2xl glass-card cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Firestore Videos
            </span>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">
              {videos.length}
            </span>
            <span className="text-xs text-zinc-400 font-mono">indexed assets</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1 group-hover:text-white transition-colors">
            Browse &amp; stream video library <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Autonomous Agent Status */}
        <div
          onClick={() => setActiveTab('agent')}
          className="p-5 rounded-2xl glass-card cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Agent State
            </span>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold font-mono text-white">
              READY
            </span>
            <span className="text-xs text-zinc-400 font-mono">Gemini 3.1</span>
          </div>
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1 group-hover:text-white transition-colors">
            Inspect autonomous pipeline <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Main Broadcast Center: Live Stream Visualizer & Video Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Live Monitor & Managed Channels */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Broadcast Visualizer Player */}
          {primaryLiveStream ? (
            <div className="p-6 rounded-2xl glass-panel border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white live-pulse" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Live Broadcast Ingestion Stream
                  </h3>
                </div>
                <Badge status={primaryLiveStream.isStreaming ? 'streaming' : 'ready'} />
              </div>

              {/* Simulated Live Video Player Viewport */}
              <div className="relative rounded-xl overflow-hidden bg-black border border-zinc-800 aspect-video flex flex-col items-center justify-center p-6 text-center group">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

                {/* Animated Audio Equalizer Waveform */}
                <div className="flex items-end gap-1.5 h-10 mb-4 z-10">
                  <span className="w-1.5 bg-white rounded-full animate-wave-1" />
                  <span className="w-1.5 bg-zinc-400 rounded-full animate-wave-2" />
                  <span className="w-1.5 bg-white rounded-full animate-wave-3" />
                  <span className="w-1.5 bg-zinc-300 rounded-full animate-wave-4" />
                  <span className="w-1.5 bg-white rounded-full animate-wave-2" />
                  <span className="w-1.5 bg-zinc-400 rounded-full animate-wave-1" />
                </div>

                <h4 className="text-lg font-bold text-white z-10 line-clamp-1 max-w-md">
                  {primaryLiveStream.title || 'Autonomous YouTube Live Stream'}
                </h4>
                <p className="text-xs text-zinc-400 font-mono mt-1 z-10">
                  Target: {primaryLiveStream.rtmpUrl} • {primaryLiveStream.resolution || '1080p60'}
                </p>

                {/* Live Stream Telemetry Pills */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10 text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-zinc-700 text-white font-bold">
                      {primaryLiveStream.bitrateKbps || 6500} KBPS
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-zinc-700 text-zinc-300">
                      {primaryLiveStream.fps || 60} FPS
                    </span>
                  </div>

                  <button
                    onClick={onOpenQuickStreamModal}
                    className="px-3 py-1 rounded-lg bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors shadow-md"
                  >
                    Switch Stream Target
                  </button>
                </div>
              </div>

              {/* Stream Ingest Details */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>Stream Key:</span>
                  <span className="text-zinc-200 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                    {primaryLiveStream.streamKey ? `${primaryLiveStream.streamKey.substring(0, 8)}••••••••` : 'None'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy('rtmp_copy', primaryLiveStream.rtmpUrl)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
                  >
                    {copiedId === 'rtmp_copy' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === 'rtmp_copy' ? 'Copied URL' : 'Copy RTMP URL'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl glass-panel border border-zinc-800 text-center space-y-4">
              <Radio className="w-10 h-10 text-zinc-600 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white">No RTMP Streams Active</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  Click 1-Click Stream to bind a YouTube channel and video asset to an active broadcast.
                </p>
              </div>
              <button
                onClick={onOpenQuickStreamModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all shadow-md"
              >
                <Zap className="w-3.5 h-3.5 fill-current" /> Launch First Stream
              </button>
            </div>
          )}

          {/* Connected YouTube Channels Quick Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Tv className="w-4 h-4 text-white" />
                Managed YouTube Channels ({channels.length})
              </h3>
              <button
                onClick={() => setActiveTab('channels')}
                className="text-xs text-zinc-400 hover:text-white font-medium flex items-center gap-1"
              >
                View all channels <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {channels.map((channel) => {
                const chName = channel.name || channel.title || 'YouTube Channel';
                const chHandle = channel.handle || channel.customUrl || `@${channel.id.substring(0, 6)}`;
                const initials = (chName || 'YT').substring(0, 2).toUpperCase();

                return (
                  <div
                    key={channel.id}
                    className="p-4 rounded-xl glass-card flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{chName}</h4>
                          <p className="text-[11px] font-mono text-zinc-400">{chHandle}</p>
                        </div>
                      </div>
                      <Badge status={channel.status || 'ready'} size="sm" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-[11px] font-mono">
                      <span className="text-zinc-500">{channel.category || 'YouTube Live'}</span>
                      <button
                        onClick={() => onLaunchStreamForChannel(channel)}
                        className="px-2.5 py-1 rounded-lg bg-white text-black font-bold hover:bg-zinc-200 transition-colors flex items-center gap-1 text-[10px]"
                      >
                        <Radio className="w-3 h-3" /> Stream
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Firestore Video Assets & Engine Telemetry */}
        <div className="space-y-6">
          {/* Firestore Video Queue */}
          <div className="p-5 rounded-2xl glass-panel border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4" />
                Firestore Video Assets
              </h3>
              <button
                onClick={onOpenUploadModal}
                className="text-xs text-zinc-400 hover:text-white font-medium"
              >
                + Upload
              </button>
            </div>

            {videos.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">
                No videos found in Firestore collection.
              </p>
            ) : (
              <div className="space-y-2.5">
                {videos.slice(0, 5).map((video) => (
                  <div
                    key={video.id}
                    className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/90 hover:border-zinc-700 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div
                      onClick={() => onSelectVideo(video)}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-white truncate group-hover:underline">
                        {video.title || video.originalName || 'Video Asset'}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                        {video.sizeFormatted || 'MP4'} • {new Date(video.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSelectVideo(video)}
                        title="Preview Video"
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setActiveTab('videos')}
              className="w-full py-2.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-colors text-center block"
            >
              Browse All Videos ({videos.length}) &rarr;
            </button>
          </div>

          {/* Engine Health & DB Status */}
          <div className="p-5 rounded-2xl glass-panel border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Engine Architecture &amp; Health
            </h3>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-white" /> Firestore DB:
                </span>
                <span className="text-white font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white live-pulse" />
                  CONNECTED
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-white" /> Firebase Storage:
                </span>
                <span className="text-white font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  READY
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-white" /> RTMP Workers:
                </span>
                <span className="text-white font-bold">
                  {health?.activeRtmpWorkers ?? 3} Active
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-white" /> Engine Sync:
                </span>
                <span className="text-zinc-400 text-[11px]">
                  {health?.serverTime ? new Date(health.serverTime).toLocaleTimeString() : 'Online'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

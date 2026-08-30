import React, { useState } from 'react';
import {
  Radio,
  Plus,
  Trash2,
  Play,
  Copy,
  Check,
  Search,
  Video,
  Zap,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import type { FirestoreStream, YouTubeChannel, FirestoreVideo } from '../../types';
import type { SaveRtmpPayload } from '../../services/api';

interface StreamMonitorProps {
  streams: FirestoreStream[];
  channels: YouTubeChannel[];
  videos: FirestoreVideo[];
  onSaveRtmp: (payload: SaveRtmpPayload) => Promise<void>;
  onDeleteStream: (id: string) => Promise<void>;
  onQueueStream: (videoId: string) => Promise<void>;
  onOpenUploadModal: () => void;
  onOpenQuickStreamModal: () => void;
  preselectedChannel?: YouTubeChannel | null;
  onClearPreselectedChannel?: () => void;
}

export const StreamMonitorView: React.FC<StreamMonitorProps> = ({
  streams = [],
  channels = [],
  videos = [],
  onSaveRtmp,
  onDeleteStream,
  onQueueStream,
  onOpenUploadModal,
  onOpenQuickStreamModal,
  preselectedChannel,
  onClearPreselectedChannel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New RTMP Stream Modal State
  const [isModalOpen, setIsModalOpen] = useState(Boolean(preselectedChannel));
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    preselectedChannel?.id || ''
  );
  const [title, setTitle] = useState(
    preselectedChannel ? `Live Stream - ${preselectedChannel.name || preselectedChannel.title || 'Channel'}` : ''
  );
  const [description, setDescription] = useState(
    preselectedChannel?.notes || 'Autonomous YouTube Live Stream'
  );
  const [rtmpUrl, setRtmpUrl] = useState(
    preselectedChannel?.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2'
  );
  const [streamKey, setStreamKey] = useState(preselectedChannel?.streamKey || '');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState('');
  const [selectedVideoFileName, setSelectedVideoFileName] = useState('');
  const [resolution, setResolution] = useState('1080p60');
  const [fps, setFps] = useState(60);
  const [bitrateKbps, setBitrateKbps] = useState(6500);
  const [isStreamingNow, setIsStreamingNow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When preselectedChannel changes
  React.useEffect(() => {
    if (preselectedChannel) {
      const chName = preselectedChannel.name || preselectedChannel.title || 'Channel';
      setSelectedChannelId(preselectedChannel.id);
      setTitle(`Live Broadcast - ${chName}`);
      setDescription(preselectedChannel.notes || 'Autonomous YouTube Stream');
      setRtmpUrl(preselectedChannel.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2');
      setStreamKey(preselectedChannel.streamKey || '');
      setIsModalOpen(true);
    }
  }, [preselectedChannel]);

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
    const ch = channels.find((c) => c.id === channelId);
    if (ch) {
      const chName = ch.name || ch.title || 'Channel';
      setRtmpUrl(ch.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2');
      setStreamKey(ch.streamKey || '');
      setTitle(`Live Broadcast - ${chName}`);
      setDescription(ch.notes || '');
      setResolution(ch.defaultResolution || '1080p60');
      setBitrateKbps(ch.defaultBitrate || 6500);
    }
  };

  const handleVideoSelect = (videoUrl: string) => {
    setSelectedVideoUrl(videoUrl);
    const matched = videos.find((v) => v.url === videoUrl);
    if (matched) {
      setSelectedVideoFileName(matched.originalName || matched.fileName || '');
      if (!title || title.startsWith('Live Broadcast')) {
        setTitle(matched.title || matched.originalName || '');
      }
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setIsSubmitting(true);
      await onSaveRtmp({
        platform: 'youtube',
        rtmpUrl,
        streamKey,
        title,
        description,
        videoUrl: selectedVideoUrl,
        videoFileName: selectedVideoFileName,
        fps,
        resolution,
        bitrateKbps,
        isStreaming: isStreamingNow,
      });
      setIsModalOpen(false);
      if (onClearPreselectedChannel) onClearPreselectedChannel();
    } catch (err: any) {
      alert(`Error saving stream: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStreams = (streams || []).filter((stream) => {
    const sTitle = stream?.title || '';
    const sDesc = stream?.description || '';
    const sId = stream?.id || '';

    const matchesSearch =
      sTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'streaming' && (stream?.isStreaming || stream?.status === 'streaming')) ||
      (filterStatus === 'ready' && stream?.status === 'ready' && !stream?.isStreaming);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Radio className="w-5 h-5" />
            RTMP Broadcast Feeds &amp; Live Monitor
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time RTMP stream configurations and active feeds saved in Firebase Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenQuickStreamModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all shadow-md active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 fill-current" /> 1-Click Stream
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl border border-zinc-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Custom RTMP
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search streams by title, description, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          {['all', 'streaming', 'ready'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-xs rounded-xl font-mono uppercase transition-colors ${
                filterStatus === status
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Stream List / Grid */}
      {filteredStreams.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-zinc-800 space-y-3">
          <Radio className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-sm font-semibold text-white">No RTMP Streams Ingested</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Click "1-Click Stream" to bind a channel and begin broadcasting, or save a manual RTMP endpoint.
          </p>
          <button
            onClick={onOpenQuickStreamModal}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white text-black rounded-xl hover:bg-zinc-200 shadow-md"
          >
            <Zap className="w-3.5 h-3.5 fill-current" /> 1-Click Stream
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStreams.map((stream) => {
            const isLive = stream.isStreaming || stream.status === 'streaming';
            const isKeyCopied = copiedId === `key_${stream.id}`;
            const isUrlCopied = copiedId === `url_${stream.id}`;

            return (
              <div
                key={stream.id}
                className="p-5 rounded-2xl glass-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                {/* Left: Stream Info */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <Badge status={isLive ? 'streaming' : (stream.status || 'ready')} />
                    <h3 className="text-sm font-bold text-white truncate">
                      {stream.title || 'Untitled RTMP Stream'}
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-500">
                      ID: {stream.id.substring(0, 12)}
                    </span>
                  </div>

                  {stream.description && (
                    <p className="text-xs text-zinc-400 line-clamp-1">
                      {stream.description}
                    </p>
                  )}

                  {/* Technical Meta Badges */}
                  <div className="flex items-center gap-2.5 flex-wrap text-[11px] font-mono text-zinc-400">
                    <span className="px-2.5 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                      {stream.resolution || '1080p60'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                      {stream.bitrateKbps || 6500} kbps
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                      {stream.fps || 60} fps
                    </span>
                    {stream.videoFileName && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white flex items-center gap-1">
                        <Video className="w-3 h-3 text-zinc-400" />
                        {stream.videoFileName}
                      </span>
                    )}
                    <span className="text-zinc-500">
                      Added {new Date(stream.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Right: RTMP Endpoints & Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto justify-end">
                  {/* Copy endpoints */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(`url_${stream.id}`, stream.rtmpUrl)}
                      className="px-3 py-1.5 text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-800 transition-colors flex items-center gap-1"
                      title="Copy RTMP Ingest URL"
                    >
                      {isUrlCopied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                      RTMP URL
                    </button>

                    {stream.streamKey && (
                      <button
                        onClick={() => handleCopy(`key_${stream.id}`, stream.streamKey)}
                        className="px-3 py-1.5 text-[11px] font-mono bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-800 transition-colors flex items-center gap-1"
                        title="Copy Stream Key"
                      >
                        {isKeyCopied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                        Key
                      </button>
                    )}
                  </div>

                  {/* Queue Stream Button if videoId exists */}
                  {stream.videoId && (
                    <button
                      onClick={() => onQueueStream(stream.videoId!)}
                      className="px-3.5 py-1.5 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm"
                      title="Push to BullMQ Stream Queue"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Queue Stream
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm(`Delete stream config "${stream.title}" from Firestore?`)) {
                        onDeleteStream(stream.id);
                      }
                    }}
                    title="Delete Stream Config"
                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Custom RTMP Stream Configuration Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          if (onClearPreselectedChannel) onClearPreselectedChannel();
        }}
        title="Custom RTMP Stream Configuration"
        subtitle="Registers an RTMP broadcast target with stream key in Firebase Firestore."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Channel selector auto-fill */}
          {channels.length > 0 && (
            <div>
              <label className="block text-zinc-400 font-medium mb-1">
                Auto-fill from Saved Channel (Optional)
              </label>
              <select
                value={selectedChannelId}
                onChange={(e) => handleChannelSelect(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
              >
                <option value="">-- Choose a YouTube Channel --</option>
                {channels.map((ch) => {
                  const chName = ch.name || ch.title || 'Channel';
                  const chHandle = ch.handle || ch.customUrl || '';
                  return (
                    <option key={ch.id} value={ch.id}>
                      {chName} {chHandle ? `(${chHandle})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Stream Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. 24/7 Deep Lo-Fi Chill Beats Stream"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Stream description or Gemini prompt notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">YouTube RTMP Ingest URL</label>
              <input
                type="text"
                value={rtmpUrl}
                onChange={(e) => setRtmpUrl(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">YouTube Stream Key *</label>
              <input
                type="text"
                required
                placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Attach Firestore Video */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-zinc-400 font-medium">Attach Firestore Video (Optional)</label>
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="text-[11px] text-zinc-400 hover:text-white underline"
              >
                + Upload New Video
              </button>
            </div>
            <select
              value={selectedVideoUrl}
              onChange={(e) => handleVideoSelect(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono text-xs"
            >
              <option value="">-- Select from Firestore Videos --</option>
              {videos.map((v) => (
                <option key={v.id} value={v.url}>
                  {v.title || v.originalName} ({v.sizeFormatted})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="1080p60">1080p60</option>
                <option value="720p60">720p60</option>
                <option value="1080p30">1080p30</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">FPS</label>
              <input
                type="number"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Bitrate (kbps)</label>
              <input
                type="number"
                value={bitrateKbps}
                onChange={(e) => setBitrateKbps(Number(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isStreamingNow}
                onChange={(e) => setIsStreamingNow(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-950 text-white focus:ring-0 cursor-pointer"
              />
              <span className="text-zinc-300 font-medium">Mark status as Active Streaming immediately</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-white text-black font-bold hover:bg-zinc-200 rounded-xl transition-colors disabled:opacity-50 shadow-md"
            >
              {isSubmitting ? 'Saving to Firestore...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Radio, ExternalLink, Check } from 'lucide-react';
import type { YouTubeChannel, FirestoreVideo } from '../../types';
import type { CreateBroadcastPayload } from '../../services/api';

interface CreateBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: YouTubeChannel[];
  videos: FirestoreVideo[];
  activeChannel: YouTubeChannel | null;
  userId?: string;
  onCreateBroadcast: (payload: CreateBroadcastPayload) => Promise<any>;
}

export const CreateBroadcastModal: React.FC<CreateBroadcastModalProps> = ({
  isOpen,
  onClose,
  channels = [],
  videos = [],
  activeChannel,
  userId,
  onCreateBroadcast,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    activeChannel?.id || channels[0]?.id || ''
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState(
    new Date(Date.now() + 1000 * 60 * 5).toISOString().slice(0, 16)
  );
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('public');
  const [resolution, setResolution] = useState<'1080p' | '720p' | '4k'>('1080p');
  const [frameRate, setFrameRate] = useState<'60fps' | '30fps'>('60fps');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Sync selectedChannel when activeChannel changes
  React.useEffect(() => {
    if (activeChannel) {
      setSelectedChannelId(activeChannel.id);
    }
  }, [activeChannel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Please enter a broadcast title.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onCreateBroadcast({
        userId,
        channelId: selectedChannelId,
        title,
        description,
        scheduledStartTime: new Date(scheduledStartTime).toISOString(),
        privacyStatus,
        resolution,
        frameRate,
        videoId: selectedVideoId || undefined,
      });

      setCreatedResult(res);
    } catch (err: any) {
      alert(`Error creating YouTube Live Broadcast: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyStreamKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleResetAndClose = () => {
    setCreatedResult(null);
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title="Create YouTube Live Broadcast"
      subtitle="Creates a live broadcast via YouTube Data API v3, binds a fresh RTMP stream key, and syncs to Firestore."
      maxWidth="lg"
    >
      {createdResult ? (
        <div className="space-y-5 text-xs">
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-700 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Check className="w-5 h-5 stroke-[3]" />
              YouTube Live Broadcast Created Successfully!
            </div>

            <p className="text-zinc-300">
              Your broadcast has been created and bound to the RTMP live stream ingestion target.
            </p>

            <div className="space-y-2 pt-2 border-t border-zinc-800 font-mono text-[11px]">
              <div>
                <span className="text-zinc-500 block text-[10px]">Broadcast ID:</span>
                <span className="text-white font-semibold">{createdResult.broadcast?.id || 'Created'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">RTMP Ingest URL:</span>
                <span className="text-zinc-300 break-all">{createdResult.rtmpUrl}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">Ingest Stream Key:</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800 flex-1 truncate">
                    {createdResult.streamKey}
                  </span>
                  <button
                    onClick={() => handleCopyStreamKey(createdResult.streamKey)}
                    className="px-3 py-1 bg-white text-black font-bold rounded hover:bg-zinc-200 transition-colors"
                  >
                    {copiedKey ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {createdResult.youtubeWatchUrl && (
              <a
                href={createdResult.youtubeWatchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white font-mono text-[11px] underline pt-1"
              >
                Watch on YouTube Studio <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleResetAndClose}
              className="px-5 py-2 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-all shadow-md"
            >
              Done &amp; View Broadcasts
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Target Channel */}
          <div>
            <label className="block text-zinc-400 font-medium mb-1">Target YouTube Channel *</label>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono"
            >
              {channels.map((ch) => {
                const chName = ch.name || ch.title || 'YouTube Channel';
                const chHandle = ch.handle || ch.customUrl || '';
                return (
                  <option key={ch.id} value={ch.id}>
                    {chName} {chHandle ? `(${chHandle})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Broadcast Title */}
          <div>
            <label className="block text-zinc-400 font-medium mb-1">Broadcast Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. 24/7 Autonomous Lo-Fi Coding Beats [Live Stream]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-zinc-400 font-medium mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Live stream notes, music credits, tags..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Schedule Time & Privacy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Scheduled Start Time</label>
              <input
                type="datetime-local"
                value={scheduledStartTime}
                onChange={(e) => setScheduledStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Privacy Status</label>
              <select
                value={privacyStatus}
                onChange={(e) => setPrivacyStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="public">Public (Everyone)</option>
                <option value="unlisted">Unlisted (Anyone with link)</option>
                <option value="private">Private (Only you)</option>
              </select>
            </div>
          </div>

          {/* Technical Ingestion: Resolution & Frame Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="1080p">1080p (Full HD)</option>
                <option value="720p">720p (HD)</option>
                <option value="4k">4K Ultra HD</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Frame Rate</label>
              <select
                value={frameRate}
                onChange={(e) => setFrameRate(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="60fps">60 FPS (Smooth)</option>
                <option value="30fps">30 FPS (Standard)</option>
              </select>
            </div>
          </div>

          {/* Attach Firestore Video */}
          {videos.length > 0 && (
            <div>
              <label className="block text-zinc-400 font-medium mb-1">
                Attach Initial Video Loop from Firestore (Optional)
              </label>
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono text-xs"
              >
                <option value="">-- No initial video --</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title || v.originalName} ({v.sizeFormatted})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-white text-black font-bold hover:bg-zinc-200 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              <Radio className="w-3.5 h-3.5 fill-current" />
              {isSubmitting ? 'Creating via YouTube API...' : 'Create Live Broadcast'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

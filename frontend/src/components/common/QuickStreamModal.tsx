import React, { useState } from 'react';
import { Modal } from './Modal';
import { Radio, Tv, Film, Check } from 'lucide-react';
import type { YouTubeChannel, FirestoreVideo } from '../../types';
import type { SaveRtmpPayload } from '../../services/api';

interface QuickStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: YouTubeChannel[];
  videos: FirestoreVideo[];
  onSaveRtmp: (payload: SaveRtmpPayload) => Promise<void>;
  onQueueStream: (videoId: string) => Promise<void>;
}

export const QuickStreamModal: React.FC<QuickStreamModalProps> = ({
  isOpen,
  onClose,
  channels = [],
  videos = [],
  onSaveRtmp,
  onQueueStream,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    channels[0]?.id || ''
  );
  const [selectedVideoId, setSelectedVideoId] = useState<string>(
    videos[0]?.id || ''
  );
  const [streamTitle, setStreamTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  // Auto-set title when channel or video changes
  React.useEffect(() => {
    const chName = selectedChannel?.name || selectedChannel?.title || 'YouTube Channel';
    if (selectedVideo && selectedChannel) {
      setStreamTitle(`[LIVE] ${selectedVideo.title || selectedVideo.originalName} - ${chName}`);
    } else if (selectedChannel) {
      setStreamTitle(`[LIVE] 24/7 Broadcast - ${chName}`);
    }
  }, [selectedChannelId, selectedVideoId]);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) {
      alert('Please select a YouTube Channel.');
      return;
    }
    const sKey = selectedChannel.streamKey || (selectedChannel as any).liveStreamingDetails?.streamKey;
    if (!sKey) {
      alert('The selected channel does not have a Stream Key configured. Please edit the channel and add a Stream Key.');
      return;
    }

    const chName = selectedChannel.name || selectedChannel.title || 'Channel';

    try {
      setIsSubmitting(true);
      await onSaveRtmp({
        platform: 'youtube',
        rtmpUrl: selectedChannel.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: sKey,
        title: streamTitle || `Live Stream - ${chName}`,
        description: selectedChannel.notes || 'Autonomous YouTube Live Stream via Agent Hub',
        videoUrl: selectedVideo?.url || '',
        videoFileName: selectedVideo?.originalName || selectedVideo?.fileName || '',
        fps: 60,
        resolution: selectedChannel.defaultResolution || '1080p60',
        bitrateKbps: selectedChannel.defaultBitrate || 6500,
        isStreaming: true,
      });

      if (selectedVideo?.id) {
        await onQueueStream(selectedVideo.id);
      }

      onClose();
    } catch (err: any) {
      alert(`Failed to launch stream: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentChName = selectedChannel?.name || selectedChannel?.title || 'YouTube Channel';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚡ 1-Click Stream Launcher"
      subtitle="Select a YouTube Channel and a Firestore Video to start broadcasting immediately."
      maxWidth="xl"
    >
      <form onSubmit={handleLaunch} className="space-y-6 text-xs">
        {/* Step 1: Select Channel */}
        <div className="space-y-2">
          <label className="block text-zinc-300 font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-white" /> Step 1: Select Destination YouTube Channel
          </label>

          {channels.length === 0 ? (
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
              No channels registered yet. Please add a channel first.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {channels.map((ch) => {
                const isSelected = ch.id === selectedChannelId;
                const chName = ch.name || ch.title || 'YouTube Channel';
                const chHandle = ch.handle || ch.customUrl || `@${ch.id.substring(0, 6)}`;

                return (
                  <div
                    key={ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-zinc-800/90 border-white text-white shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold truncate text-xs text-white">{chName}</p>
                      <p className="text-[10px] font-mono text-zinc-400">{chHandle} • {ch.category || 'YouTube Live'}</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 2: Select Video from Firestore */}
        <div className="space-y-2">
          <label className="block text-zinc-300 font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-white" /> Step 2: Select Video Asset from Firestore
          </label>

          {videos.length === 0 ? (
            <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
              No videos uploaded in Firestore yet. You can still stream a placeholder RTMP config.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {videos.map((vid) => {
                const isSelected = vid.id === selectedVideoId;
                return (
                  <div
                    key={vid.id}
                    onClick={() => setSelectedVideoId(vid.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-zinc-800/90 border-white text-white shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold truncate text-xs text-white">{vid.title || vid.originalName}</p>
                      <p className="text-[10px] font-mono text-zinc-400">
                        {vid.sizeFormatted || 'MP4'} • {new Date(vid.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stream Title Input */}
        <div className="space-y-1">
          <label className="block text-zinc-300 font-medium">Broadcast Title</label>
          <input
            type="text"
            required
            value={streamTitle}
            onChange={(e) => setStreamTitle(e.target.value)}
            placeholder="Live Stream Title..."
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Launch Button */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
          <div className="text-[11px] font-mono text-zinc-400">
            {selectedChannel ? (
              <span>Target: <strong className="text-white">{currentChName}</strong></span>
            ) : (
              <span className="text-zinc-500">No channel selected</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedChannel}
              className="px-5 py-2 bg-white text-black font-semibold hover:bg-zinc-200 rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Launching...</span>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 fill-current" />
                  Launch Live Broadcast
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

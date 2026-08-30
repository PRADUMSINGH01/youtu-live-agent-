import React, { useState } from 'react';
import {
  Film,
  Upload,
  Play,
  Copy,
  Check,
  Search,
  Radio,
  Share2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import type { FirestoreVideo, YouTubeChannel } from '../../types';
import type { SaveRtmpPayload } from '../../services/api';
import { postVideoToYouTube } from '../../services/api';

export interface VideoExplorerProps {
  videos: FirestoreVideo[];
  channels: YouTubeChannel[];
  activeChannel: YouTubeChannel | null;
  userId?: string;
  onSelectVideo: (video: FirestoreVideo) => void;
  onUploadVideo?: (payload: any) => Promise<any>;
  onPostVideoToYouTube?: (payload: any) => Promise<any>;
  onOpenQuickStreamModal?: () => void;
  onOpenUploadModal?: () => void;
  isUploadModalOpen?: boolean;
  setIsUploadModalOpen?: (isOpen: boolean) => void;
  onSaveRtmp?: (payload: SaveRtmpPayload) => Promise<void>;
}

export const VideoExplorerView: React.FC<VideoExplorerProps> = ({
  videos = [],
  channels = [],
  activeChannel,
  userId,
  onSelectVideo,
  onPostVideoToYouTube,
  onOpenQuickStreamModal,
  onOpenUploadModal,
  setIsUploadModalOpen,
  onSaveRtmp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick Stream Modal for this Video
  const [streamingVideo, setStreamingVideo] = useState<FirestoreVideo | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [streamKey, setStreamKey] = useState('');
  const [rtmpUrl, setRtmpUrl] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [isSubmittingStream, setIsSubmittingStream] = useState(false);

  // Post to YouTube Direct Upload Modal
  const [postingVideo, setPostingVideo] = useState<FirestoreVideo | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('public');
  const [isPosting, setIsPosting] = useState(false);

  const handleOpenUpload = () => {
    if (setIsUploadModalOpen) {
      setIsUploadModalOpen(true);
    } else if (onOpenUploadModal) {
      onOpenUploadModal();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenStreamModal = (video: FirestoreVideo) => {
    if (onOpenQuickStreamModal) {
      onOpenQuickStreamModal();
      return;
    }
    setStreamingVideo(video);
    if (activeChannel) {
      setSelectedChannelId(activeChannel.id);
      setStreamKey(activeChannel.streamKey || '');
      setRtmpUrl(activeChannel.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2');
    } else if (channels.length > 0) {
      setSelectedChannelId(channels[0].id);
      setStreamKey(channels[0].streamKey || '');
      setRtmpUrl(channels[0].rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2');
    }
  };

  const handleChannelChange = (chId: string) => {
    setSelectedChannelId(chId);
    const ch = channels.find((c) => c.id === chId);
    if (ch) {
      setStreamKey(ch.streamKey || '');
      setRtmpUrl(ch.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2');
    }
  };

  const handleLaunchStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamingVideo || !streamKey.trim() || !onSaveRtmp) return;

    try {
      setIsSubmittingStream(true);
      await onSaveRtmp({
        platform: 'youtube',
        rtmpUrl,
        streamKey,
        title: streamingVideo.title || streamingVideo.originalName || 'Video Stream',
        description: streamingVideo.description || 'Autonomous stream from Firestore asset',
        videoUrl: streamingVideo.url,
        videoFileName: streamingVideo.originalName || streamingVideo.fileName,
        fps: 60,
        resolution: '1080p60',
        bitrateKbps: 6500,
        isStreaming: true,
      });
      setStreamingVideo(null);
      alert('Live broadcast registered and bound to RTMP engine!');
    } catch (err: any) {
      alert(`Failed to launch stream: ${err.message}`);
    } finally {
      setIsSubmittingStream(false);
    }
  };

  const handleOpenPostModal = (video: FirestoreVideo) => {
    setPostingVideo(video);
    setPostTitle(video.title || video.originalName || 'Video Asset');
    setPostDescription(video.description || 'Uploaded via Autonomous YouTube Agent');
    setPrivacyStatus('public');
  };

  const handlePostToYouTube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postingVideo) return;

    try {
      setIsPosting(true);
      if (onPostVideoToYouTube) {
        await onPostVideoToYouTube({
          channelId: activeChannel?.id,
          title: postTitle,
          description: postDescription,
          videoUrl: postingVideo.url,
          privacyStatus,
        });
      } else {
        const res = await postVideoToYouTube({
          userId,
          channelId: activeChannel?.id,
          title: postTitle,
          description: postDescription,
          videoUrl: postingVideo.url,
          privacyStatus,
        });
        alert(`Success! Video posted to YouTube:\n${res.watchUrl || res.message}`);
      }

      setPostingVideo(null);
    } catch (err: any) {
      alert(`YouTube upload error: ${err.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  const filteredVideos = (videos || []).filter((video) => {
    const vTitle = video?.title || '';
    const vName = video?.originalName || video?.fileName || '';
    return (
      vTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Film className="w-5 h-5" />
            Firestore Video Repository
          </h2>
          <p className="text-xs text-zinc-400">
            Rendered and generated MP4 video assets stored in Firebase Storage and indexed in Firestore.
          </p>
        </div>

        <button
          onClick={handleOpenUpload}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all shadow-md active:scale-95"
        >
          <Upload className="w-4 h-4" /> Upload MP4 Video
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative w-full md:w-96">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search videos by title or file name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
        />
      </div>

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-zinc-800 space-y-3">
          <Film className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-sm font-semibold text-white">No Videos in Firestore</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Upload your first video asset to Firebase Storage or wait for the Autonomous Agent to complete rendering.
          </p>
          <button
            onClick={handleOpenUpload}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white text-black rounded-xl hover:bg-zinc-200 shadow-md"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((video) => {
            const isCopied = copiedId === video.id;

            return (
              <div
                key={video.id}
                className="p-5 rounded-2xl glass-card flex flex-col justify-between space-y-4 group"
              >
                {/* Video Preview Thumbnail / Player Box */}
                <div
                  onClick={() => onSelectVideo(video)}
                  className="relative rounded-xl overflow-hidden bg-black aspect-video cursor-pointer border border-zinc-800 flex items-center justify-center group-hover:border-zinc-600 transition-colors"
                >
                  <video
                    src={video.url}
                    preload="metadata"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white border border-zinc-800">
                    {video.sizeFormatted || 'MP4'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1.5">
                  <h3
                    onClick={() => onSelectVideo(video)}
                    className="text-sm font-bold text-white truncate cursor-pointer hover:underline"
                    title={video.title || video.originalName}
                  >
                    {video.title || video.originalName || 'Untitled Video Asset'}
                  </h3>
                  <p className="text-[11px] font-mono text-zinc-400 truncate">
                    {video.originalName || video.fileName}
                  </p>

                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(video.createdAt).toLocaleDateString()}
                    </span>
                    <span>• {video.mimetype || 'video/mp4'}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(video.id, video.url)}
                      title="Copy Public Video URL"
                      className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open Video URL"
                      className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenPostModal(video)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white rounded-xl border border-zinc-700 transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Post
                    </button>

                    <button
                      onClick={() => handleOpenStreamModal(video)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <Radio className="w-3.5 h-3.5" /> Stream
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stream Video Modal */}
      {streamingVideo && (
        <Modal
          isOpen={Boolean(streamingVideo)}
          onClose={() => setStreamingVideo(null)}
          title="Stream Video to YouTube"
          subtitle={`Bind "${streamingVideo.title || streamingVideo.originalName}" to an RTMP live stream.`}
        >
          <form onSubmit={handleLaunchStream} className="space-y-4 text-xs">
            {channels.length > 0 && (
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Target YouTube Channel</label>
                <select
                  value={selectedChannelId}
                  onChange={(e) => handleChannelChange(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono"
                >
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
              <label className="block text-zinc-400 font-medium mb-1">RTMP Ingest URL</label>
              <input
                type="text"
                value={rtmpUrl}
                onChange={(e) => setRtmpUrl(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Stream Key *</label>
              <input
                type="text"
                required
                placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setStreamingVideo(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingStream}
                className="px-5 py-2 bg-white text-black font-bold hover:bg-zinc-200 rounded-xl transition-colors shadow-md disabled:opacity-50"
              >
                {isSubmittingStream ? 'Binding RTMP Stream...' : 'Start Live Broadcast'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Post to YouTube Modal */}
      {postingVideo && (
        <Modal
          isOpen={Boolean(postingVideo)}
          onClose={() => setPostingVideo(null)}
          title="Publish Video to YouTube Channel"
          subtitle={`Directly upload "${postingVideo.title || postingVideo.originalName}" to YouTube.`}
        >
          <form onSubmit={handlePostToYouTube} className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Video Title *</label>
              <input
                type="text"
                required
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Description</label>
              <textarea
                rows={3}
                value={postDescription}
                onChange={(e) => setPostDescription(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Privacy Status</label>
              <select
                value={privacyStatus}
                onChange={(e) => setPrivacyStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="public">Public (Visible to everyone)</option>
                <option value="unlisted">Unlisted (Anyone with link)</option>
                <option value="private">Private (Only you)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setPostingVideo(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPosting}
                className="px-5 py-2 bg-white text-black font-bold hover:bg-zinc-200 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                {isPosting ? 'Uploading to YouTube...' : 'Publish to YouTube'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

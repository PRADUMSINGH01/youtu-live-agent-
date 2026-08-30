import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/layout/Navbar';
import { OverviewView } from './components/overview/OverviewView';
import { ChannelManager } from './components/channels/ChannelManager';
import { StreamMonitorView } from './components/streams/StreamMonitorView';
import { AgentPipelineView } from './components/agent/AgentPipelineView';
import { VideoExplorerView } from './components/videos/VideoExplorerView';
import { VideoPlayerModal } from './components/common/VideoPlayerModal';
import { QuickStreamModal } from './components/common/QuickStreamModal';
import { UploadVideoModal } from './components/common/UploadVideoModal';
import { AuthModal } from './components/auth/AuthModal';
import { CreateBroadcastModal } from './components/broadcasts/CreateBroadcastModal';
import {
  fetchHealth,
  fetchVideos,
  fetchStreams,
  deleteStream,
  saveRtmpStream,
  queueStream,
  uploadVideo,
  fetchAuthMe,
  devLogin,
  switchActiveChannel,
  syncYouTubeChannels,
  createYouTubeBroadcast,
  postVideoToYouTube,
  type SaveRtmpPayload,
  type UploadVideoPayload,
  type CreateBroadcastPayload,
  type PostVideoToYouTubePayload,
} from './services/api';
import {
  getStoredChannels,
  addChannel,
  updateChannel,
  deleteStoredChannel,
} from './services/channelStorage';
import type {
  YouTubeChannel,
  FirestoreStream,
  FirestoreVideo,
  SystemHealth,
  TabType,
  UserProfile,
} from './types';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // User & Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeChannel, setActiveChannel] = useState<YouTubeChannel | null>(null);

  // Core Data
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [streams, setStreams] = useState<FirestoreStream[]>([]);
  const [videos, setVideos] = useState<FirestoreVideo[]>([]);

  // Polling & Loading state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [bannerNotice, setBannerNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals & Selected items
  const [selectedVideo, setSelectedVideo] = useState<FirestoreVideo | null>(null);
  const [preselectedChannel, setPreselectedChannel] = useState<YouTubeChannel | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isQuickStreamModalOpen, setIsQuickStreamModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCreateBroadcastModalOpen, setIsCreateBroadcastModalOpen] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setBannerNotice({ message, type });
    setTimeout(() => setBannerNotice(null), 4500);
  };

  // Initial Auth Check & URL Query Params Handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authSuccess = params.get('auth_success');
    const authError = params.get('auth_error');
    const uid = params.get('uid');

    if (authError) {
      showNotification(`Authentication error: ${authError}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authSuccess && uid) {
      localStorage.setItem('yt_agent_uid', uid);
      window.history.replaceState({}, document.title, window.location.pathname);
      showNotification('✓ Google Account & YouTube permissions verified with Firestore!');
    }

    const savedUid = uid || localStorage.getItem('yt_agent_uid') || '';
    fetchAuthMe(savedUid)
      .then((res) => {
        if (res.authenticated && res.user) {
          setUser(res.user);
          if (res.channels.length > 0) {
            setChannels(res.channels);
            setActiveChannel(res.activeChannel || res.channels[0]);
          }
        } else {
          // Fallback to locally stored channels
          setChannels(getStoredChannels());
        }
      })
      .catch((err) => {
        console.warn('Auth check error:', err);
        setChannels(getStoredChannels());
      });
  }, []);

  const loadBackendData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthRes, streamsRes, videosRes] = await Promise.allSettled([
        fetchHealth(),
        fetchStreams(),
        fetchVideos(),
      ]);

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      }
      if (streamsRes.status === 'fulfilled') {
        setStreams(streamsRes.value);
      }
      if (videosRes.status === 'fulfilled') {
        setVideos(videosRes.value);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Polling Timer
  useEffect(() => {
    loadBackendData();

    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        loadBackendData();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadBackendData, refreshInterval]);

  // Auth Handlers
  const handleDevLogin = async () => {
    const res = await devLogin();
    setUser(res.user);
    setChannels(res.channels);
    setActiveChannel(res.activeChannel);
    localStorage.setItem('yt_agent_uid', res.user.id);
    showNotification(`Logged in as ${res.user.name} with ${res.channels.length} YouTube channels!`);
  };

  const handleSwitchChannel = async (channelId: string) => {
    if (!user) return;
    await switchActiveChannel(user.id, channelId);
    const target = channels.find((c) => c.id === channelId) || null;
    setActiveChannel(target);
    showNotification(`Active channel switched to: ${target?.name}`);
  };

  const handleSyncChannels = async () => {
    if (!user) return;
    const res = await syncYouTubeChannels(user.id);
    setChannels(res.channels);
    showNotification(res.message);
  };

  const handleLogout = () => {
    localStorage.removeItem('yt_agent_uid');
    setUser(null);
    setActiveChannel(null);
    setChannels(getStoredChannels());
    showNotification('Logged out from YouTube Agent.');
  };

  // Broadcast & Video Publishing Handlers
  const handleCreateBroadcast = async (payload: CreateBroadcastPayload) => {
    const res = await createYouTubeBroadcast(payload);
    showNotification(`✓ Live Broadcast "${res.broadcast.title}" registered in Firestore!`);
    await loadBackendData();
    return res;
  };

  const handlePostVideoToYouTube = async (payload: PostVideoToYouTubePayload) => {
    const res = await postVideoToYouTube(payload);
    showNotification(res.message);
    await loadBackendData();
    return res;
  };

  // Channel CRUD
  const handleAddChannel = (channelData: Omit<YouTubeChannel, 'id' | 'createdAt'>) => {
    const created = addChannel(channelData);
    setChannels(getStoredChannels());
    showNotification(`Channel "${created.name}" registered successfully.`);
  };

  const handleUpdateChannel = (id: string, updates: Partial<YouTubeChannel>) => {
    updateChannel(id, updates);
    setChannels(getStoredChannels());
    showNotification('Channel updated.');
  };

  const handleDeleteChannel = (id: string) => {
    if (confirm('Are you sure you want to delete this channel?')) {
      deleteStoredChannel(id);
      setChannels(getStoredChannels());
      showNotification('Channel removed.');
    }
  };

  const handleLaunchStreamForChannel = (channel: YouTubeChannel) => {
    setPreselectedChannel(channel);
    setActiveTab('streams');
  };

  // Stream Handlers
  const handleSaveRtmp = async (payload: SaveRtmpPayload) => {
    const res = await saveRtmpStream(payload);
    showNotification(`RTMP Stream saved to Firestore (ID: ${res.streamId.substring(0, 10)}...)`);
    await loadBackendData();
  };

  const handleDeleteStream = async (id: string) => {
    await deleteStream(id);
    showNotification(`Stream deleted from Firestore.`);
    await loadBackendData();
  };

  const handleQueueStream = async (videoId: string) => {
    const res = await queueStream(videoId);
    showNotification(`Stream queued to BullMQ: ${res.message}`);
    await loadBackendData();
  };

  // Video Upload
  const handleUploadVideo = async (payload: UploadVideoPayload) => {
    const res = await uploadVideo(payload);
    showNotification(`✓ Video uploaded & registered in Firestore (Doc ID: ${res.videoId.substring(0, 10)}...)`);
    await loadBackendData();
    setActiveTab('videos');
  };

  const activeStreamsCount = streams.filter((s) => s.isStreaming || s.status === 'streaming').length;

  return (
    <div className="min-h-screen bg-[#050507] text-[#f4f4f6] flex flex-col selection:bg-white selection:text-black">
      {/* Background Matrix Pattern */}
      <div className="fixed inset-0 bg-grid-subtle opacity-15 pointer-events-none" />

      {/* Main Navigation Bar */}
      <Navbar
        health={health}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeStreamsCount={activeStreamsCount}
        channelsCount={channels.length}
        isRefreshing={isRefreshing}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        onManualRefresh={loadBackendData}
        user={user}
        channels={channels}
        activeChannel={activeChannel}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenCreateBroadcastModal={() => setIsCreateBroadcastModalOpen(true)}
        onSwitchChannel={handleSwitchChannel}
        onSyncChannels={handleSyncChannels}
        onLogout={handleLogout}
      />

      {/* Notification Toast */}
      {bannerNotice && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2.5 border ${
              bannerNotice.type === 'error'
                ? 'bg-zinc-950 text-white border-zinc-700'
                : 'bg-white text-black border-zinc-200'
            }`}
          >
            {bannerNotice.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-white stroke-[3]" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-black stroke-[3]" />
            )}
            <span>{bannerNotice.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {activeTab === 'overview' && (
          <OverviewView
            channels={channels}
            streams={streams}
            videos={videos}
            health={health}
            setActiveTab={setActiveTab}
            onOpenNewChannelModal={() => {
              setActiveTab('channels');
            }}
            onOpenNewStreamModal={() => {
              setActiveTab('streams');
            }}
            onOpenQuickStreamModal={() => setIsQuickStreamModalOpen(true)}
            onOpenUploadModal={() => {
              setIsUploadModalOpen(true);
              setActiveTab('videos');
            }}
            onSelectVideo={(v) => setSelectedVideo(v)}
            onLaunchStreamForChannel={handleLaunchStreamForChannel}
          />
        )}

        {activeTab === 'channels' && (
          <ChannelManager
            channels={channels}
            onAddChannel={handleAddChannel}
            onUpdateChannel={handleUpdateChannel}
            onDeleteChannel={handleDeleteChannel}
            onLaunchStreamForChannel={handleLaunchStreamForChannel}
          />
        )}

        {activeTab === 'streams' && (
          <StreamMonitorView
            streams={streams}
            channels={channels}
            videos={videos}
            onSaveRtmp={handleSaveRtmp}
            onDeleteStream={handleDeleteStream}
            onQueueStream={handleQueueStream}
            onOpenUploadModal={() => {
              setIsUploadModalOpen(true);
              setActiveTab('videos');
            }}
            onOpenQuickStreamModal={() => setIsQuickStreamModalOpen(true)}
            preselectedChannel={preselectedChannel}
            onClearPreselectedChannel={() => setPreselectedChannel(null)}
          />
        )}

        {activeTab === 'agent' && (
          <AgentPipelineView
            videos={videos}
            onUploadModalOpen={() => {
              setIsUploadModalOpen(true);
              setActiveTab('videos');
            }}
            onRefreshAll={loadBackendData}
            onSelectVideo={(v) => setSelectedVideo(v)}
            onOpenQuickStreamModal={() => setIsQuickStreamModalOpen(true)}
          />
        )}

        {activeTab === 'videos' && (
          <VideoExplorerView
            videos={videos}
            channels={channels}
            activeChannel={activeChannel}
            userId={user?.id}
            onSelectVideo={(v) => setSelectedVideo(v)}
            onUploadVideo={handleUploadVideo}
            onPostVideoToYouTube={handlePostVideoToYouTube}
            onOpenQuickStreamModal={() => setIsQuickStreamModalOpen(true)}
            isUploadModalOpen={isUploadModalOpen}
            setIsUploadModalOpen={setIsUploadModalOpen}
          />
        )}
      </main>

      {/* Google OAuth & Permissions Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onDevLogin={handleDevLogin}
      />

      {/* Create YouTube Live Broadcast Modal */}
      <CreateBroadcastModal
        isOpen={isCreateBroadcastModalOpen}
        onClose={() => setIsCreateBroadcastModalOpen(false)}
        channels={channels}
        videos={videos}
        activeChannel={activeChannel}
        userId={user?.id}
        onCreateBroadcast={handleCreateBroadcast}
      />

      {/* 1-Click Quick Stream Launcher Modal */}
      <QuickStreamModal
        isOpen={isQuickStreamModalOpen}
        onClose={() => setIsQuickStreamModalOpen(false)}
        channels={channels}
        videos={videos}
        onSaveRtmp={handleSaveRtmp}
        onQueueStream={handleQueueStream}
      />

      {/* Video Playback & Metadata Modal */}
      <VideoPlayerModal
        video={selectedVideo}
        isOpen={Boolean(selectedVideo)}
        onClose={() => setSelectedVideo(null)}
      />

      {/* Upload Video to Firebase Storage Modal */}
      <UploadVideoModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUploadVideo}
      />

      {/* Minimalist Monochromatic Footer */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-[#050507] py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white" />
            <span className="text-zinc-300 font-semibold">
              YOUTUBE AGENT // GOOGLE OAUTH &amp; MULTI-CHANNEL FIRESTORE
            </span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <span>USER: {user ? user.email : 'GUEST'}</span>
            <span>•</span>
            <span>ACTIVE CHANNEL: {activeChannel ? activeChannel.name : 'ALL'}</span>
            <span>•</span>
            <span>YOUTUBE API: READY</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default App;

import React from 'react';
import { RefreshCw, Radio, LogIn } from 'lucide-react';
import { MultiChannelSwitcher } from '../channels/MultiChannelSwitcher';
import type { SystemHealth, TabType, UserProfile, YouTubeChannel } from '../../types';

interface NavbarProps {
  health: SystemHealth | null;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activeStreamsCount: number;
  channelsCount: number;
  isRefreshing: boolean;
  refreshInterval: number;
  setRefreshInterval: (val: number) => void;
  onManualRefresh: () => void;
  user: UserProfile | null;
  channels: YouTubeChannel[];
  activeChannel: YouTubeChannel | null;
  onOpenAuthModal: () => void;
  onOpenCreateBroadcastModal: () => void;
  onSwitchChannel: (channelId: string) => Promise<void>;
  onSyncChannels: () => Promise<void>;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  activeTab,
  setActiveTab,
  activeStreamsCount,
  channelsCount,
  isRefreshing,
  refreshInterval,
  setRefreshInterval,
  onManualRefresh,
  user,
  channels,
  activeChannel,
  onOpenAuthModal,
  onOpenCreateBroadcastModal,
  onSwitchChannel,
  onSyncChannels,
  onLogout,
}) => {
  const tabs: { id: TabType; label: string; count?: number; badge?: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'channels', label: 'Channels', count: channelsCount },
    { id: 'streams', label: 'Live RTMP', count: activeStreamsCount, badge: activeStreamsCount > 0 ? 'LIVE' : undefined },
    { id: 'agent', label: 'Agent Pipeline' },
    { id: 'videos', label: 'Firestore Videos' },
  ];

  const isServerOnline = health?.status === 'online';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#070709]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold text-sm shadow-md">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-sm">
                  YOUTUBE AGENT
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  v2.5
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono hidden sm:block">
                Autonomous Stream &amp; Video Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/70 p-1 rounded-xl border border-zinc-800">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-black shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-black text-white'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {tab.badge && (
                    <span className="w-2 h-2 rounded-full bg-white live-pulse ml-0.5" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Auto-Refresh, YouTube Live Creator & Google Auth Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Create Live Broadcast Button */}
            <button
              onClick={onOpenCreateBroadcastModal}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all shadow-md active:scale-95"
            >
              <Radio className="w-3.5 h-3.5 fill-current" />
              <span>Go Live</span>
            </button>

            {/* Polling Interval Selector */}
            <div className="hidden xl:flex items-center gap-1.5 bg-zinc-900/80 px-2 py-1 rounded-xl border border-zinc-800 text-xs font-mono">
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-zinc-300 text-[11px] focus:outline-none cursor-pointer"
              >
                <option value={2000} className="bg-zinc-950 text-white">2s sync</option>
                <option value={5000} className="bg-zinc-950 text-white">5s sync</option>
                <option value={15000} className="bg-zinc-950 text-white">15s sync</option>
                <option value={0} className="bg-zinc-950 text-white">Manual</option>
              </select>
            </div>

            {/* Manual Refresh Trigger */}
            <button
              onClick={onManualRefresh}
              disabled={isRefreshing}
              title="Refresh Firestore & API metrics"
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Server Online Badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-mono ${
                isServerOnline
                  ? 'bg-zinc-900/90 border-zinc-700 text-zinc-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isServerOnline ? 'bg-white live-pulse' : 'bg-zinc-600'
                }`}
              />
              <span className="uppercase text-[10px]">
                {isServerOnline ? 'API 5000' : 'Offline'}
              </span>
            </div>

            {/* Google User Profile & Multi-Channel Switcher */}
            {user ? (
              <MultiChannelSwitcher
                user={user}
                channels={channels}
                activeChannel={activeChannel}
                onSwitchChannel={onSwitchChannel}
                onSyncChannels={onSyncChannels}
                onLogout={onLogout}
              />
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all shadow-md active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Connect Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center justify-between gap-1 py-2 border-t border-zinc-800/60 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg shrink-0 transition-all ${
                  isActive
                    ? 'bg-white text-black font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

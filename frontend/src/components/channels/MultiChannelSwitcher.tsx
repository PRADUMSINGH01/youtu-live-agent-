import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  ChevronDown,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import type { UserProfile, YouTubeChannel } from '../../types';

interface MultiChannelSwitcherProps {
  user: UserProfile;
  channels: YouTubeChannel[];
  activeChannel: YouTubeChannel | null;
  onSwitchChannel: (channelId: string) => Promise<void>;
  onSyncChannels: () => Promise<void>;
  onLogout: () => void;
}

export const MultiChannelSwitcher: React.FC<MultiChannelSwitcherProps> = ({
  user,
  channels = [],
  activeChannel,
  onSwitchChannel,
  onSyncChannels,
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await onSyncChannels();
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const currentChannel = activeChannel || (channels.length > 0 ? channels[0] : null);
  const currentChannelName = currentChannel?.name || currentChannel?.title || user.name || 'Channel';
  const currentAvatarText = (user.name || 'U').substring(0, 1).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all text-xs"
      >
        {/* User / Channel Avatar */}
        <div className="w-6 h-6 rounded-full overflow-hidden border border-zinc-700 shrink-0 bg-zinc-800 flex items-center justify-center">
          {user.picture ? (
            <img src={user.picture} alt={user.name || 'User'} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-bold text-white">
              {currentAvatarText}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="text-left hidden sm:block max-w-[130px] min-w-0">
          <p className="font-bold text-white text-[11px] truncate leading-tight">
            {currentChannelName}
          </p>
          <p className="text-[9px] font-mono text-zinc-400 truncate leading-tight">
            {channels.length} {channels.length === 1 ? 'Channel' : 'Channels'}
          </p>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl glass-panel border border-zinc-700 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-4">
          {/* User Profile Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-700 shrink-0 bg-zinc-800 flex items-center justify-center">
              {user.picture ? (
                <img src={user.picture} alt={user.name || 'User'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">{currentAvatarText}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-xs truncate">{user.name || 'Creator'}</p>
              <p className="text-[10px] font-mono text-zinc-400 truncate">{user.email}</p>
              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                Role: {(user.role || 'creator').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Channels List Under This Account */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                YouTube Channels ({channels.length})
              </span>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 font-mono transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync YouTube'}
              </button>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {channels.map((channel) => {
                const isActive = channel.id === currentChannel?.id;
                const chName = channel.name || channel.title || 'YouTube Channel';
                const chHandle = channel.handle || channel.customUrl || `@${channel.id.substring(0, 6)}`;
                const initials = (chName || 'YT').substring(0, 2).toUpperCase();

                return (
                  <div
                    key={channel.id}
                    onClick={async () => {
                      if (!isActive) {
                        await onSwitchChannel(channel.id);
                      }
                      setIsOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                      isActive
                        ? 'bg-zinc-800/90 border-white text-white shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs shrink-0 text-white">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-white leading-tight">
                          {chName}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 mt-0.5">
                          <span>{chHandle}</span>
                          {channel.statistics?.subscriberCount ? (
                            <span>• {Number(channel.statistics.subscriberCount).toLocaleString()} subs</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <div className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
            <span className="text-[10px] text-zinc-500">ID: {(user.id || '').substring(0, 10)}...</span>

            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="text-zinc-400 hover:text-white flex items-center gap-1.5 text-[11px] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

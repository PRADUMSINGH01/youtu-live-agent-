import React, { useState } from 'react';
import {
  Tv,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Radio,
  Search,
  Users,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import type { YouTubeChannel } from '../../types';

interface ChannelManagerProps {
  channels: YouTubeChannel[];
  onAddChannel: (channel: Omit<YouTubeChannel, 'id' | 'createdAt'>) => void;
  onUpdateChannel: (id: string, updates: Partial<YouTubeChannel>) => void;
  onDeleteChannel: (id: string) => void;
  onLaunchStreamForChannel: (channel: YouTubeChannel) => void;
}

export const ChannelManager: React.FC<ChannelManagerProps> = ({
  channels = [],
  onAddChannel,
  onUpdateChannel,
  onDeleteChannel,
  onLaunchStreamForChannel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // New / Edit Channel Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<YouTubeChannel | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [rtmpUrl, setRtmpUrl] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [category, setCategory] = useState('Lo-Fi & Study');
  const [defaultResolution, setDefaultResolution] = useState('1080p60');
  const [defaultBitrate, setDefaultBitrate] = useState(6500);
  const [subscribers, setSubscribers] = useState('');
  const [notes, setNotes] = useState('');

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyKey = (id: string, key?: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleOpenAddModal = () => {
    setEditingChannel(null);
    setName('');
    setHandle('');
    setStreamKey('');
    setRtmpUrl('rtmp://a.rtmp.youtube.com/live2');
    setCategory('Lo-Fi & Study');
    setDefaultResolution('1080p60');
    setDefaultBitrate(6500);
    setSubscribers('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (channel: YouTubeChannel) => {
    setEditingChannel(channel);
    setName(channel.name || channel.title || '');
    setHandle(channel.handle || channel.customUrl || '');
    setStreamKey(channel.streamKey || '');
    setRtmpUrl(channel.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2');
    setCategory(channel.category || 'YouTube Live');
    setDefaultResolution(channel.defaultResolution || '1080p60');
    setDefaultBitrate(channel.defaultBitrate || 6500);
    setSubscribers(channel.subscribers || '');
    setNotes(channel.notes || '');
    setIsModalOpen(true);
  };

  const handleQuickAddTemplate = (templateType: 'lofi' | 'gaming' | 'ambient') => {
    const templates = {
      lofi: {
        name: '24/7 Deep Lo-Fi Radio',
        handle: '@DeepLoFiBeats',
        category: 'Lo-Fi Chillhop',
        notes: 'Continuous generative lo-fi relaxing beats broadcast.',
      },
      gaming: {
        name: 'Cyberpunk Synth Beats',
        handle: '@CyberpunkSynthRadio',
        category: 'Synthwave & Electronic',
        notes: 'High energy synthwave loops for coding & gaming.',
      },
      ambient: {
        name: 'Deep Sleep Nature Sounds',
        handle: '@DeepNatureSounds',
        category: 'Nature & White Noise',
        notes: 'Forest rainfall and calming ocean audio streams.',
      },
    };

    const chosen = templates[templateType];
    setName(chosen.name);
    setHandle(chosen.handle);
    setCategory(chosen.category);
    setNotes(chosen.notes);
    setStreamKey(`live_yt_${Math.random().toString(36).substring(2, 9)}_key`);
    setRtmpUrl('rtmp://a.rtmp.youtube.com/live2');
    setDefaultResolution('1080p60');
    setDefaultBitrate(6500);
    setSubscribers('10.5K');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingChannel) {
      onUpdateChannel(editingChannel.id, {
        name,
        handle: handle.startsWith('@') ? handle : `@${handle}`,
        streamKey,
        rtmpUrl,
        category,
        defaultResolution,
        defaultBitrate: Number(defaultBitrate),
        subscribers,
        notes,
      });
    } else {
      onAddChannel({
        name,
        handle: handle.startsWith('@') ? handle : `@${handle}`,
        streamKey,
        rtmpUrl,
        category,
        defaultResolution,
        defaultBitrate: Number(defaultBitrate),
        status: 'ready',
        subscribers: subscribers || '0',
        lastActive: 'Just registered',
        notes,
      });
    }
    setIsModalOpen(false);
  };

  const filteredChannels = (channels || []).filter((channel) => {
    const chName = channel?.name || channel?.title || '';
    const chHandle = channel?.handle || channel?.customUrl || '';
    const chCat = channel?.category || '';

    const matchesSearch =
      chName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chHandle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chCat.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || (channel?.status || 'ready') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Fast Templates */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Tv className="w-5 h-5" />
            Managed YouTube Channels
          </h2>
          <p className="text-xs text-zinc-400">
            Register and organize multiple YouTube broadcast endpoints, stream keys, and broadcast targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Channel
          </button>
        </div>
      </div>

      {/* Quick Add Presets Bar if user wants rapid testing */}
      <div className="p-3.5 rounded-2xl glass-panel flex flex-wrap items-center justify-between gap-3 border border-zinc-800 text-xs">
        <span className="text-zinc-400 font-semibold flex items-center gap-1.5 font-mono text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-white" /> Quick Channel Templates:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleQuickAddTemplate('lofi')}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors text-[11px] font-mono"
          >
            + Lo-Fi Radio
          </button>
          <button
            onClick={() => handleQuickAddTemplate('gaming')}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors text-[11px] font-mono"
          >
            + Synthwave
          </button>
          <button
            onClick={() => handleQuickAddTemplate('ambient')}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors text-[11px] font-mono"
          >
            + Nature Sleep
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search channels by name, handle, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {['all', 'streaming', 'ready', 'idle'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs rounded-xl font-mono uppercase transition-colors ${
                statusFilter === status
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Cards Grid */}
      {filteredChannels.length === 0 ? (
        <div className="p-12 text-center rounded-2xl glass-panel border border-zinc-800 space-y-3">
          <Tv className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-sm font-semibold text-white">No YouTube Channels Found</p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Click "Add Channel" or choose a quick template above to configure a YouTube broadcast endpoint.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white text-black rounded-xl hover:bg-zinc-200 shadow-md"
          >
            <Plus className="w-3.5 h-3.5" /> Add First Channel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredChannels.map((channel) => {
            const chName = channel.name || channel.title || 'YouTube Channel';
            const chHandle = channel.handle || channel.customUrl || `@${channel.id.substring(0, 6)}`;
            const initials = (chName || 'YT').substring(0, 2).toUpperCase();
            const isKeyVisible = visibleKeys[channel.id];
            const isCopied = copiedKeyId === channel.id;

            return (
              <div
                key={channel.id}
                className="p-5 rounded-2xl glass-card flex flex-col justify-between space-y-4"
              >
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-inner">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">
                          {chName}
                        </h3>
                        <span className="text-xs font-mono text-zinc-400 block truncate">
                          {chHandle}
                        </span>
                      </div>
                    </div>
                    <Badge status={channel.status || 'ready'} size="sm" />
                  </div>

                  {/* Channel Meta */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                      {channel.category || 'YouTube Live'}
                    </span>
                    {channel.statistics?.subscriberCount !== undefined && (
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-center gap-1">
                        <Users className="w-3 h-3 text-zinc-500" /> {Number(channel.statistics.subscriberCount).toLocaleString()} subs
                      </span>
                    )}
                  </div>

                  {channel.notes && (
                    <p className="text-xs text-zinc-400 bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800/80 text-[11px] line-clamp-2 leading-relaxed">
                      {channel.notes}
                    </p>
                  )}
                </div>

                {/* Stream Key Security Box */}
                <div className="space-y-3 pt-3 border-t border-zinc-800/80">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500 font-mono">Stream Key:</span>
                      <button
                        onClick={() => toggleKeyVisibility(channel.id)}
                        className="text-zinc-400 hover:text-white flex items-center gap-1 text-[10px] font-mono"
                      >
                        {isKeyVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {isKeyVisible ? 'Hide' : 'Reveal'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-300 truncate">
                        {isKeyVisible
                          ? channel.streamKey || 'None provided'
                          : channel.streamKey
                          ? `${channel.streamKey.substring(0, 6)}••••••••••••`
                          : 'None provided'}
                      </div>
                      {channel.streamKey && (
                        <button
                          onClick={() => handleCopyKey(channel.id, channel.streamKey)}
                          title="Copy Stream Key"
                          className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(channel)}
                        title="Edit Channel"
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteChannel(channel.id)}
                        title="Delete Channel"
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => onLaunchStreamForChannel(channel)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      Stream Now
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Channel Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingChannel ? 'Edit YouTube Channel' : 'Add New YouTube Channel'}
        subtitle="Manage endpoint configuration and YouTube RTMP live stream key."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Channel Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. 24/7 Deep Lo-Fi Radio"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">YouTube Handle *</label>
              <input
                type="text"
                required
                placeholder="@ChannelHandle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">YouTube Stream Key *</label>
            <input
              type="text"
              required
              placeholder="e.g. xxxx-xxxx-xxxx-xxxx-xxxx"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <p className="text-[10px] text-zinc-500 mt-1 font-mono">
              Found in YouTube Studio &gt; Go Live &gt; Stream Settings &gt; Stream Key
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">RTMP Ingest URL</label>
              <input
                type="text"
                value={rtmpUrl}
                onChange={(e) => setRtmpUrl(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Niche / Category</label>
              <input
                type="text"
                placeholder="e.g. Lo-Fi, Ambient, Synthwave"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Resolution</label>
              <select
                value={defaultResolution}
                onChange={(e) => setDefaultResolution(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="1080p60">1080p60 (Full HD)</option>
                <option value="720p60">720p60 (HD)</option>
                <option value="1080p30">1080p30</option>
                <option value="4k60">4K 60fps</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Bitrate (kbps)</label>
              <input
                type="number"
                value={defaultBitrate}
                onChange={(e) => setDefaultBitrate(Number(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Subscribers (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 120K"
                value={subscribers}
                onChange={(e) => setSubscribers(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-medium mb-1">Notes / Target Objective</label>
            <textarea
              rows={2}
              placeholder="e.g. Continuous ambient loop generation with relaxing backgrounds"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
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
              className="px-5 py-2 bg-white text-black font-bold hover:bg-zinc-200 rounded-xl transition-colors shadow-md"
            >
              {editingChannel ? 'Save Changes' : 'Register Channel'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

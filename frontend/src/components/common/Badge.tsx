import React from 'react';
import type { StreamStatus } from '../../types';

interface BadgeProps {
  status: StreamStatus | 'active' | 'inactive' | 'online' | 'connected';
  label?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, label, size = 'md' }) => {
  const isLive = status === 'live' || status === 'streaming' || status === 'active';
  const isReady = status === 'ready' || status === 'online' || status === 'connected';
  const isQueued = status === 'queued';
  const isError = status === 'error';

  let colorClasses = 'bg-zinc-900/80 text-zinc-400 border-zinc-800';
  let dotClasses = 'bg-zinc-500';

  if (isLive) {
    colorClasses = 'bg-white text-black border-white font-semibold';
    dotClasses = 'bg-black live-pulse';
  } else if (isReady) {
    colorClasses = 'bg-zinc-900 text-zinc-100 border-zinc-700';
    dotClasses = 'bg-white';
  } else if (isQueued) {
    colorClasses = 'bg-zinc-900 text-zinc-300 border-dashed border-zinc-700';
    dotClasses = 'bg-zinc-400 animate-spin';
  } else if (isError) {
    colorClasses = 'bg-zinc-950 text-zinc-300 border-zinc-700 line-through';
    dotClasses = 'bg-zinc-400';
  }

  const displayText = label || status.toUpperCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs tracking-wider uppercase mono-box transition-all ${colorClasses} ${
        size === 'sm' ? 'text-[10px] px-2 py-0.2' : ''
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClasses}`} />
      {displayText}
    </span>
  );
};

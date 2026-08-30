import React from 'react';
import { Modal } from './Modal';
import { Download, ExternalLink, Copy, Check } from 'lucide-react';
import type { FirestoreVideo } from '../../types';

interface VideoPlayerModalProps {
  video: FirestoreVideo | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!video) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(video.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={video.title || video.originalName || 'Video Preview'}
      subtitle={`Firestore ID: ${video.id} • ${video.sizeFormatted || 'Unknown size'}`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Video Player */}
        <div className="relative rounded-lg overflow-hidden bg-black border border-zinc-800 aspect-video flex items-center justify-center">
          <video
            src={video.url}
            controls
            autoPlay
            className="w-full h-full object-contain"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Video Metadata Breakdown */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs border-b border-zinc-800/60 pb-2">
            <span className="text-zinc-400 font-medium">Uploaded to Firestore:</span>
            <span className="text-white font-mono">{new Date(video.createdAt).toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-zinc-800/60 pb-2">
            <span className="text-zinc-400 font-medium">Storage Path:</span>
            <span className="text-zinc-300 font-mono text-[11px] truncate max-w-[300px]">
              {video.storagePath || video.fileName}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-zinc-800/60 pb-2">
            <span className="text-zinc-400 font-medium">Mime Type:</span>
            <span className="text-white font-mono">{video.mimetype || 'video/mp4'}</span>
          </div>

          {video.description && (
            <div className="text-xs pt-1">
              <span className="text-zinc-400 block mb-1 font-medium">Description / Agent Prompt:</span>
              <p className="text-zinc-300 bg-zinc-950 p-2.5 rounded border border-zinc-800 text-xs">
                {video.description}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg border border-zinc-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied URL' : 'Copy Firebase URL'}
          </button>

          <div className="flex items-center gap-2">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Direct
            </a>
            <a
              href={video.url}
              download={video.originalName || 'video.mp4'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white text-black hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
};

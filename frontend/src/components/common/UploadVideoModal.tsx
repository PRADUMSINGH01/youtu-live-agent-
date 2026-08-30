import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { UploadCloud, FileVideo, X, AlertCircle } from 'lucide-react';
import type { UploadVideoPayload } from '../../services/api';

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (payload: UploadVideoPayload) => Promise<void>;
}

export const UploadVideoModal: React.FC<UploadVideoModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!selectedFile.type.includes('video') && !selectedFile.name.endsWith('.mp4')) {
      setError('Please select a valid video file (.mp4 format recommended)');
      return;
    }
    setError(null);
    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file to upload.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      await onUpload({
        file,
        title: title || file.name,
        description,
      });
      handleResetAndClose();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetAndClose = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title="Upload Video to Firebase Storage"
      subtitle="Upload an MP4 video asset to Firebase Storage bucket and register document in Firestore."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Drag and drop zone */}
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
              isDragging
                ? 'border-white bg-zinc-900/80 scale-[1.01]'
                : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
            />
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shadow-inner">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Click or drag &amp; drop MP4 video</p>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">MP4, MOV, or WebM up to 500MB</p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
                <FileVideo className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-xs truncate">{file.name}</p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'video/mp4'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Title Input */}
        <div>
          <label className="block text-zinc-400 font-medium mb-1">Video Title *</label>
          <input
            type="text"
            required
            placeholder="e.g. 24/7 Deep Lo-Fi Chill Beats Visualizer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs"
          />
        </div>

        {/* Description Input */}
        <div>
          <label className="block text-zinc-400 font-medium mb-1">Description / Notes</label>
          <textarea
            rows={2}
            placeholder="Metadata description, tags, Gemini generation prompt..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 text-xs"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-700 text-white flex items-center gap-2 text-xs font-mono">
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleResetAndClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading || !file}
            className="px-5 py-2 bg-white text-black font-bold hover:bg-zinc-200 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5 text-xs"
          >
            {isUploading ? (
              <span>Uploading to Firebase...</span>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                Upload to Firestore
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

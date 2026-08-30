import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { getGoogleAuthUrl } from '../../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDevLogin: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onDevLogin,
}) => {
  const [isLoadingAuthUrl, setIsLoadingAuthUrl] = useState(false);
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);

  const handleGoogleConnect = async () => {
    try {
      setIsLoadingAuthUrl(true);
      const { authUrl } = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (err: any) {
      alert(`Could not generate Google Auth URL: ${err.message}`);
    } finally {
      setIsLoadingAuthUrl(false);
    }
  };

  const handleDevLoginSubmit = async () => {
    try {
      setIsDevLoggingIn(true);
      await onDevLogin();
      onClose();
    } catch (err: any) {
      alert(`Developer login error: ${err.message}`);
    } finally {
      setIsDevLoggingIn(false);
    }
  };

  const PERMISSIONS = [
    {
      title: 'YouTube Live Stream Management',
      desc: 'Create, schedule, and ingest RTMP streams directly via YouTube Data API v3.',
    },
    {
      title: 'Direct Video Publishing',
      desc: 'Upload synthesized or uploaded video assets from Firestore directly to your channels.',
    },
    {
      title: 'Multi-Channel Under One Account',
      desc: 'Manage all brand channels and sub-accounts with live subscriber and view stats.',
    },
    {
      title: 'Secure Firestore Sync',
      desc: 'Channel stream keys and metadata are encrypted and linked to your user schema in Firestore.',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Connect Google Account &amp; YouTube Studio"
      subtitle="Authenticate with Google OAuth 2.0 to grant YouTube stream creation and video publishing permissions."
      maxWidth="md"
    >
      <div className="space-y-6 text-xs">
        {/* Permission List Box */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-white" />
            Granted YouTube API Permissions
          </div>

          <div className="space-y-2.5">
            {PERMISSIONS.map((perm, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                <div>
                  <p className="text-zinc-200 font-semibold text-xs">{perm.title}</p>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{perm.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Main Google OAuth Button */}
          <button
            onClick={handleGoogleConnect}
            disabled={isLoadingAuthUrl}
            className="w-full py-3 px-4 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-lg active:scale-98 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            {isLoadingAuthUrl ? 'Redirecting to Google...' : 'Sign In with Google Account'}
          </button>

          {/* Instant Developer Login */}
          <button
            onClick={handleDevLoginSubmit}
            disabled={isDevLoggingIn}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-700 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            {isDevLoggingIn ? 'Setting up Creator Account...' : 'Instant 1-Click Creator Sign-In (Demo Multi-Channel)'}
          </button>
        </div>

        <div className="pt-2 text-center text-[10px] font-mono text-zinc-500">
          OAuth 2.0 • Offline Refresh Tokens • Auto-synced with Firestore Database
        </div>
      </div>
    </Modal>
  );
};

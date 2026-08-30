import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  Play,
  CheckCircle2,
  Terminal,
  RefreshCw,
  Check,
  UploadCloud,
  Zap,
  Radio,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import type { AgentPipelineStep, AgentLog, FirestoreVideo } from '../../types';

interface AgentPipelineProps {
  videos: FirestoreVideo[];
  onUploadModalOpen: () => void;
  onRefreshAll: () => void;
  onSelectVideo: (video: FirestoreVideo) => void;
  onOpenQuickStreamModal: () => void;
}

const PRESET_PROMPTS = [
  {
    label: '24/7 Lo-Fi Study Beats',
    prompt: 'Generate a 60-minute relaxing Lo-Fi study session with vinyl rain texture and calm melodic beats.',
    genre: 'Lo-Fi Chillhop',
  },
  {
    label: 'Neon Cyberpunk Synthwave',
    prompt: 'Synthesize an energetic 45-minute retro synthwave driving loop with 80s analog basslines.',
    genre: 'Synthwave / Retro',
  },
  {
    label: 'Deep Focus Nature Soundscapes',
    prompt: 'Compose a 90-minute soothing forest rain ambient background with gentle stream water sounds.',
    genre: 'Nature & White Noise',
  },
  {
    label: 'Midnight Coffeehouse Jazz',
    prompt: 'Create a 60-minute warm acoustic coffeehouse jazz stream with smooth piano and upright bass.',
    genre: 'Smooth Jazz',
  },
];

const DEFAULT_STEPS: AgentPipelineStep[] = [
  {
    id: 'step_content_designer',
    name: '1. Content Designer Agent',
    agentName: 'Gemini 3.1 Flash AI',
    status: 'completed',
    details: 'Generated structured content schema, mood tags, video duration, and audio loop requirements.',
    timestamp: '2 mins ago',
    output: {
      title: 'Midnight Rain & Ambient Lo-Fi Chill Beats',
      mood: 'Calm & Meditative',
      musicCategory: 'Lo-Fi Chillhop',
      video_duration: 60,
      loops: 4,
    },
  },
  {
    id: 'step_audio_fetch',
    name: '2. Asset & Music Downloader',
    agentName: 'FreeToUse Music Tool',
    status: 'completed',
    details: 'Fetched 4 royalty-free background audio tracks from FreeToUse API into buffer memory.',
    timestamp: '1 min ago',
    output: {
      tracks: ['Glass Shop - Calima', 'Moving Mountains - Aeris', 'Uke Waves - Aylex'],
      totalSize: '48.2 MB',
    },
  },
  {
    id: 'step_ffmpeg_render',
    name: '3. Video Synthesis & Rendering',
    agentName: 'FFmpeg Processing Engine',
    status: 'completed',
    details: 'Assembled 1080p60 visual motion loops, stitched audio timeline, and encoded H.264 video.',
    timestamp: '45s ago',
    output: {
      resolution: '1920x1080',
      fps: 60,
      codec: 'h264_nvenc',
      outputFile: 'render_1772184920.mp4',
    },
  },
  {
    id: 'step_firestore_upload',
    name: '4. Firebase Storage & Firestore Sync',
    agentName: 'Firestore Storage Agent',
    status: 'completed',
    details: 'Uploaded MP4 binary to Firebase Storage and committed metadata to Firestore videos collection.',
    timestamp: '20s ago',
    output: {
      collection: 'videos',
      status: 'Document written & Public Storage URL verified',
    },
  },
  {
    id: 'step_rtmp_stream',
    name: '5. RTMP Broadcast Ingestion',
    agentName: 'BullMQ & Puppeteer Streamer',
    status: 'running',
    details: 'Pushed job to BullMQ queue and broadcasting live stream feed to YouTube RTMP endpoint.',
    timestamp: 'Active now',
    output: {
      queue: 'streamQueue',
      rtmpTarget: 'rtmp://a.rtmp.youtube.com/live2',
      bitrate: '6500 kbps',
    },
  },
];

const INITIAL_LOGS: AgentLog[] = [
  {
    id: 'log_1',
    timestamp: new Date(Date.now() - 1000 * 90).toLocaleTimeString(),
    level: 'agent',
    source: 'GeminiContentDesigner',
    message: 'Analyzing previous 7 stored sessions in Firebase Realtime Store memory...',
  },
  {
    id: 'log_2',
    timestamp: new Date(Date.now() - 1000 * 75).toLocaleTimeString(),
    level: 'info',
    source: 'GeminiContentDesigner',
    message: 'Content Schema validated: "Midnight Rain & Ambient Lo-Fi Chill Beats" (duration: 60m, mood: calm).',
  },
  {
    id: 'log_3',
    timestamp: new Date(Date.now() - 1000 * 60).toLocaleTimeString(),
    level: 'agent',
    source: 'AudioDownloader',
    message: 'Downloaded 4 audio loops from api.freetouse.com/v3/music/categories/lofi.',
  },
  {
    id: 'log_4',
    timestamp: new Date(Date.now() - 1000 * 45).toLocaleTimeString(),
    level: 'info',
    source: 'FFmpegEngine',
    message: 'Processing audio loops with frame background overlay: 1080p @ 60fps (bitrate: 6500k).',
  },
  {
    id: 'log_5',
    timestamp: new Date(Date.now() - 1000 * 20).toLocaleTimeString(),
    level: 'success',
    source: 'FirebaseUpload',
    message: '✓ Video file uploaded to Storage bucket. Document registered in Firestore (collection: "videos").',
  },
  {
    id: 'log_6',
    timestamp: new Date(Date.now() - 1000 * 5).toLocaleTimeString(),
    level: 'agent',
    source: 'RTMPStreamWorker',
    message: 'Job dispatched to BullMQ streamQueue. RTMP stream live to YouTube Ingest.',
  },
];

export const AgentPipelineView: React.FC<AgentPipelineProps> = ({
  videos,
  onUploadModalOpen,
  onRefreshAll,
  onSelectVideo,
  onOpenQuickStreamModal,
}) => {
  const [steps, setSteps] = useState<AgentPipelineStep[]>(DEFAULT_STEPS);
  const [logs, setLogs] = useState<AgentLog[]>(INITIAL_LOGS);
  const [customPrompt, setCustomPrompt] = useState(
    'Generate a 60-minute relaxing Lo-Fi study session with vinyl rain texture and calm melodic beats.'
  );
  const [isSimulating, setIsSimulating] = useState(false);

  // Trigger Agent Workflow Simulation
  const handleTriggerAgent = (promptText?: string) => {
    const activePrompt = promptText || customPrompt;
    setIsSimulating(true);

    // Reset steps
    const updated = steps.map((s, idx) => ({
      ...s,
      status: idx === 0 ? ('running' as const) : ('idle' as const),
      timestamp: 'Pending...',
    }));
    setSteps(updated);

    const newLog: AgentLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      level: 'agent',
      source: 'GeminiContentDesigner',
      message: `Triggering autonomous pipeline with prompt: "${activePrompt}"`,
    };
    setLogs((prev) => [newLog, ...prev]);

    // Step 1 -> Step 2
    setTimeout(() => {
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 0
            ? { ...s, status: 'completed', timestamp: 'Just now' }
            : idx === 1
            ? { ...s, status: 'running', timestamp: 'Running...' }
            : s
        )
      );
      setLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          source: 'GeminiContentDesigner',
          message: 'Gemini structured JSON output parsed successfully. Requesting audio download tools.',
        },
        ...prev,
      ]);
    }, 1500);

    // Step 2 -> Step 3
    setTimeout(() => {
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 1
            ? { ...s, status: 'completed', timestamp: 'Just now' }
            : idx === 2
            ? { ...s, status: 'running', timestamp: 'Running...' }
            : s
        )
      );
      setLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'agent',
          source: 'AudioDownloader',
          message: 'Downloaded 4 audio loops from FreeToUse. Starting FFmpeg visual composite.',
        },
        ...prev,
      ]);
    }, 3000);

    // Step 3 -> Step 4 (Video Render -> Firestore Upload)
    setTimeout(() => {
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 2
            ? { ...s, status: 'completed', timestamp: 'Just now' }
            : idx === 3
            ? { ...s, status: 'running', timestamp: 'Uploading...' }
            : s
        )
      );
      setLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          source: 'FFmpegEngine',
          message: 'Video rendering finished. Handing buffer to Firebase Storage uploader.',
        },
        ...prev,
      ]);
    }, 4500);

    // Step 4 -> Step 5 (Firestore Upload Complete -> RTMP Broadcast)
    setTimeout(() => {
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === 3
            ? { ...s, status: 'completed', timestamp: 'Just now' }
            : idx === 4
            ? { ...s, status: 'running', timestamp: 'Broadcasting...' }
            : s
        )
      );
      setLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'success',
          source: 'FirebaseUpload',
          message: '✓ Video ready and uploaded on Firestore! Document ID created. Storage URL signed.',
        },
        {
          id: `log_${Date.now() + 1}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'agent',
          source: 'RTMPStreamWorker',
          message: 'Stream queued and active on RTMP destination.',
        },
        ...prev,
      ]);
      setIsSimulating(false);
      onRefreshAll();
    }, 6000);
  };

  const latestVideo = videos.length > 0 ? videos[0] : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Autonomous Agent Pipeline Visualizer
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time stage tracking: Gemini Prompt &rarr; Asset Fetch &rarr; FFmpeg Render &rarr; Firestore Video Upload &rarr; RTMP Stream.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onUploadModalOpen}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl border border-zinc-700 transition-colors"
          >
            <UploadCloud className="w-4 h-4" /> Upload Video
          </button>
        </div>
      </div>

      {/* Prominent Live Firestore Video Ready Alert */}
      {latestVideo && (
        <div className="p-5 rounded-2xl glass-panel border border-zinc-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-bold shadow-md shrink-0">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Video Ready &amp; Synced in Firestore
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {latestVideo.sizeFormatted || 'Ready'}
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-200 truncate mt-0.5">
                {latestVideo.title || latestVideo.originalName}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Doc ID: {latestVideo.id} • Created {new Date(latestVideo.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => onSelectVideo(latestVideo)}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Play Preview
            </button>
            <button
              onClick={onOpenQuickStreamModal}
              className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Radio className="w-3.5 h-3.5" /> Stream to Channel
            </button>
          </div>
        </div>
      )}

      {/* 5-Step Visual Stepper Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Live Autonomous Execution Pipeline
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3.5">
          {steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isRunning = step.status === 'running';

            let borderClass = 'border-zinc-800/80 bg-zinc-950/60';
            let iconClass = 'text-zinc-500 bg-zinc-900';

            if (isRunning) {
              borderClass = 'border-white bg-zinc-900/90 shadow-lg';
              iconClass = 'text-black bg-white';
            } else if (isCompleted) {
              borderClass = 'border-zinc-700 bg-zinc-900/60';
              iconClass = 'text-white bg-zinc-800';
            }

            return (
              <div
                key={step.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${borderClass}`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono ${iconClass}`}
                    >
                      {isRunning ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : isCompleted ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <Badge
                      status={isRunning ? 'streaming' : isCompleted ? 'ready' : 'idle'}
                      label={isRunning ? 'ACTIVE' : isCompleted ? 'DONE' : 'QUEUED'}
                      size="sm"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">
                      {step.name}
                    </h4>
                    <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                      {step.agentName}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                    {step.details}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>{step.timestamp || 'Idle'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preset 1-Click Theme Prompts */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-white" /> 1-Click Quick Generation Presets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_PROMPTS.map((preset) => (
            <div
              key={preset.label}
              onClick={() => {
                setCustomPrompt(preset.prompt);
                handleTriggerAgent(preset.prompt);
              }}
              className="p-4 rounded-xl glass-card cursor-pointer group flex flex-col justify-between space-y-2 border border-zinc-800 hover:border-zinc-600"
            >
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {preset.genre}
                </span>
                <h4 className="text-xs font-bold text-white mt-2 group-hover:underline">
                  {preset.label}
                </h4>
                <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                  {preset.prompt}
                </p>
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-400 group-hover:text-white transition-colors">
                <span>Run Preset</span>
                <Play className="w-3 h-3 fill-current" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Prompt Trigger & Live Agent Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Custom Trigger */}
        <div className="p-6 rounded-2xl glass-panel border border-zinc-800 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Custom Agent Prompt
            </h3>
            <p className="text-xs text-zinc-400">
              Customize the topic, duration, and musical mood for the autonomous loop.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <textarea
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe video theme..."
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
            />

            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase">Engine</span>
                <span className="text-white font-semibold">Gemini 3.1 Flash</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px] uppercase">Destination</span>
                <span className="text-white font-semibold">Firestore &amp; RTMP</span>
              </div>
            </div>

            <button
              onClick={() => handleTriggerAgent()}
              disabled={isSimulating}
              className="w-full py-2.5 text-xs font-bold bg-white text-black hover:bg-zinc-200 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 shadow-md"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating &amp; Uploading to Firestore...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Execute Agent Loop
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right 2 Cols: Live Agent Terminal Console */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#070709] border border-zinc-800 flex flex-col justify-between space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Terminal className="w-4 h-4 text-zinc-400" />
              LIVE AGENT TELEMETRY &amp; EXECUTION STREAM
            </div>
            <span className="text-[10px] text-zinc-500">Realtime Stream</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
            {logs.map((log) => {
              let levelBadge = 'text-zinc-400 bg-zinc-900';
              if (log.level === 'agent') levelBadge = 'text-black bg-white font-bold';
              if (log.level === 'success') levelBadge = 'text-white bg-zinc-800 font-bold border border-zinc-700';
              if (log.level === 'warn') levelBadge = 'text-zinc-300 bg-zinc-800';

              return (
                <div key={log.id} className="flex items-start gap-2.5 py-1 text-[11px] leading-relaxed">
                  <span className="text-zinc-600 shrink-0">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider shrink-0 ${levelBadge}`}>
                    {log.source}
                  </span>
                  <span className="text-zinc-300 break-words">{log.message}</span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
            <span>Live Telemetry Channel Active</span>
            <button
              onClick={() => setLogs([])}
              className="text-zinc-400 hover:text-white underline"
            >
              Clear Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

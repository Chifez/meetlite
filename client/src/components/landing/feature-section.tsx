import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MousePointer2,
  Sparkles,
  Bot,
  Sliders,
  Tv,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import IntegrationsBeam from './integrations-beam';

interface FeatureTab {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  tagline: string;
  description: string;
  color: string;
}

const FEATURE_TABS: FeatureTab[] = [
  {
    id: 'whiteboard',
    icon: MousePointer2,
    title: 'Collaborative Whiteboard',
    badge: 'Real-time Draw',
    tagline: 'Sketch plans together on an infinite glass canvas',
    description: 'Explain ideas visually. Co-draw, drop shapes, and sync cursor pointers with sub-10ms latency. No registration required for guest joiners.',
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 'ai-summarizer',
    icon: Bot,
    title: 'AI Summary & Transcripts',
    badge: 'GPT-4 Power',
    tagline: 'Meeting summaries, key points, and action items generated automatically',
    description: 'Never miss details. OpenAI integrations listen to conversation audios, output precise speaker-labeled transcripts, and draft structured bullets.',
    color: 'from-violet-500 to-indigo-500',
  },
  {
    id: 'roles-invites',
    icon: Sliders,
    title: 'Granular Workspace Roles',
    badge: 'Enterprise Security',
    tagline: 'Complete governance over participants and sharing options',
    description: 'Ensure meetings stay secure. Toggle presenter roles, manage screen-share access, or toggle audio muting dynamically on the fly.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'stream-quality',
    icon: Tv,
    title: 'Adaptive HD Streaming',
    badge: 'WebRTC Core',
    tagline: 'Crystal clear connections built for global collaboration',
    description: 'Experience consistent audio/video streams routing via decentralized MediaSoup workers, keeping latency below 50ms.',
    color: 'from-amber-500 to-orange-500',
  },
];

export default function FeaturesSection() {
  const [activeTabId, setActiveTabId] = useState('whiteboard');
  const sectionRef = useRef<HTMLDivElement>(null);

  // Active tab object
  const activeTab = FEATURE_TABS.find((t) => t.id === activeTabId) || FEATURE_TABS[0];

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-24 bg-background relative overflow-hidden transition-colors duration-300 border-b border-border/50"
    >
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Explore the product interface
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Interact with our simulated controls below to preview how our core collaborative workspace tools operate.
          </p>
        </div>

        {/* Dynamic Showcase Dashboard Grid */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch mb-20">
          
          {/* Left Column: Tab Selectors */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
            {FEATURE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTabId;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    'text-left p-5 rounded-2xl border transition-all duration-300 relative group flex items-start space-x-4',
                    isActive
                      ? 'bg-gradient-to-r from-primary/5 to-violet-500/5 dark:from-primary/10 dark:to-violet-500/5 border-primary/40 shadow-sm'
                      : 'border-border/60 hover:border-primary/30 hover:bg-muted/30 bg-card/40'
                  )}
                >
                  {/* Sliding Left Border Highlight */}
                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute left-0 top-4 bottom-4 w-1 bg-primary rounded-r-md"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}

                  {/* Icon Wrapper */}
                  <div
                    className={cn(
                      'p-2.5 rounded-xl border transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary/20'
                        : 'bg-muted border-border group-hover:bg-primary/10 group-hover:text-primary'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-foreground text-base">
                        {tab.title}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-[10px] font-medium rounded-full border',
                          isActive
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-muted text-muted-foreground border-border'
                        )}
                      >
                        {tab.badge}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {tab.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Live Mockup Simulator Canvas */}
          <div className="lg:col-span-7 flex flex-col min-h-[400px]">
            <div className="flex-1 rounded-3xl border border-border bg-card/60 dark:bg-zinc-950/80 shadow-2xl p-6 relative overflow-hidden flex flex-col justify-between backdrop-blur-xl">
              
              {/* Top Window Actions bar */}
              <div className="flex items-center justify-between pb-4 border-b border-border/80">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-destructive/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="text-xs text-muted-foreground font-mono ml-2">
                    sim_sandbox_env:/{activeTab.id}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 bg-muted/60 border rounded-lg px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">
                    Interactive
                  </span>
                </div>
              </div>

              {/* Central Canvas Simulator */}
              <div className="flex-1 py-6 flex items-center justify-center relative overflow-hidden min-h-[280px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTabId}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -15, scale: 0.98 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="w-full h-full flex flex-col items-center justify-center"
                  >
                    {activeTabId === 'whiteboard' && <WhiteboardSimulator />}
                    {activeTabId === 'ai-summarizer' && <AiSummarizerSimulator />}
                    {activeTabId === 'roles-invites' && <RolesSimulator />}
                    {activeTabId === 'stream-quality' && <StreamingSimulator />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Dynamic Bottom Description */}
              <div className="pt-4 border-t border-border/80 text-xs text-muted-foreground flex justify-between items-center">
                <span>{activeTab.description}</span>
                <span className="font-semibold text-primary shrink-0 ml-4">
                  Powered by MeetLite Core
                </span>
              </div>

            </div>
          </div>

        </div>

        {/* Global Integrations Banner */}
        <div className="pt-8 border-t border-border/40">
          <IntegrationsBeam />
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   1. WHITEBOARD SIMULATOR WORKSPACE
   ========================================================================== */
function WhiteboardSimulator() {
  const [nodes, setNodes] = useState([
    { id: 1, x: 50, y: 50, label: 'Room Service', color: 'bg-pink-500' },
    { id: 2, x: 220, y: 40, label: 'Signaling', color: 'bg-rose-500' },
    { id: 3, x: 130, y: 140, label: 'MediaSoup SFU', color: 'bg-primary' },
  ]);
  const [activeCursor, setActiveCursor] = useState({ x: 140, y: 110 });

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 20;
    const y = e.clientY - rect.top - 20;
    setActiveCursor({ x: x + 10, y: y + 10 });
  };

  const addRandomNode = () => {
    const names = ['Auth Service', 'Client App', 'Webhook Pool', 'Redis Hub', 'Billing DB'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const id = Date.now();
    const x = 40 + Math.random() * 240;
    const y = 30 + Math.random() * 120;
    setNodes((prev) => [...prev, { id, x, y, label: randomName, color: 'bg-violet-500' }]);
  };

  const resetCanvas = () => {
    setNodes([
      { id: 1, x: 50, y: 50, label: 'Room Service', color: 'bg-pink-500' },
      { id: 2, x: 220, y: 40, label: 'Signaling', color: 'bg-rose-500' },
      { id: 3, x: 130, y: 140, label: 'MediaSoup SFU', color: 'bg-primary' },
    ]);
  };

  return (
    <div
      onClick={handleCanvasClick}
      className="w-full h-full relative rounded-xl border border-dashed border-border/80 bg-zinc-950/20 dark:bg-zinc-950/40 cursor-crosshair overflow-hidden p-4 select-none flex flex-col justify-between"
    >
      {/* SVG Connections Beam */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {nodes.map((node, i) =>
          nodes.slice(i + 1).map((target) => (
            <line
              key={`${node.id}-${target.id}`}
              x1={node.x + 40}
              y1={node.y + 16}
              x2={target.x + 40}
              y2={target.y + 16}
              stroke="currentColor"
              className="text-primary/10 dark:text-primary/20"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          ))
        )}
      </svg>

      {/* Nodes Container */}
      <div className="relative flex-1">
        {nodes.map((node) => (
          <motion.div
            key={node.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              'absolute px-3 py-1.5 rounded-lg text-[10px] font-semibold text-white shadow-md flex items-center space-x-1.5',
              node.color
            )}
            style={{ left: node.x, top: node.y }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>{node.label}</span>
          </motion.div>
        ))}

        {/* Animated Active Cursor indicator */}
        <motion.div
          animate={{ x: activeCursor.x, y: activeCursor.y }}
          transition={{ type: 'spring', damping: 20 }}
          className="absolute pointer-events-none flex flex-col items-start"
        >
          <MousePointer2 className="w-4 h-4 text-primary fill-primary" />
          <span className="text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-mono shadow mt-1">
            Sarah
          </span>
        </motion.div>
      </div>

      {/* Top Floating bar controls */}
      <div className="flex justify-between items-center relative z-10 pt-2">
        <span className="text-[10px] text-muted-foreground font-mono">
          Click sandbox canvas to move pointer
        </span>
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addRandomNode();
            }}
            className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-[10px] font-medium shadow hover:bg-primary/95 flex items-center space-x-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>Draw Node</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetCanvas();
            }}
            className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground border border-border"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. AI SUMMARIZER SIMULATOR
   ========================================================================== */
function AiSummarizerSimulator() {
  const [step, setStep] = useState(0); // 0: transcript, 1: generating, 2: summaries
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const lines = [
    'Emma: Let\'s lock down the visual theme by tonight.',
    'Alex: Fully support. Light mode should feel clean; dark mode needs pure obsidian tones.',
    'Liam: Agreed. We should avoid generic grays.',
  ];

  useEffect(() => {
    if (step === 0) {
      setTranscriptLines([]);
      let i = 0;
      const interval = setInterval(() => {
        if (i < lines.length) {
          setTranscriptLines((prev) => [...prev, lines[i]]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 900);
      return () => clearInterval(interval);
    }
  }, [step]);

  return (
    <div className="w-full h-full rounded-xl border border-border/80 bg-zinc-950/10 dark:bg-zinc-950/30 p-4 flex flex-col justify-between space-y-4">
      <div className="flex-1 flex flex-col md:grid md:grid-cols-2 gap-4">
        
        {/* Left Panel: Transcript Stream */}
        <div className="border border-border/60 rounded-lg p-3 bg-card flex flex-col justify-between space-y-2 h-[170px] overflow-hidden">
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
              Audio Transcript
            </span>
            <div className="space-y-1.5">
              <AnimatePresence>
                {transcriptLines.map((line, idx) => (
                  <motion.p
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[10px] text-foreground font-mono leading-relaxed"
                  >
                    {line}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          </div>
          {step === 0 && transcriptLines.length === lines.length && (
            <button
              onClick={() => {
                setStep(1);
                setTimeout(() => setStep(2), 1500);
              }}
              className="w-full py-1.5 rounded bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center space-x-1.5"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Generate AI Summary</span>
            </button>
          )}
        </div>

        {/* Right Panel: AI Summarization Output */}
        <div className="border border-border/60 rounded-lg p-3 bg-muted/30 flex flex-col justify-center items-center text-center h-[170px]">
          {step === 0 && (
            <div className="space-y-1">
              <Sparkles className="w-6 h-6 text-primary animate-pulse mx-auto" />
              <p className="text-[10px] text-muted-foreground">
                Listening to transcript stream...
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" />
              <p className="text-[10px] text-foreground font-semibold">
                Summarizing with GPT-4...
              </p>
            </div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-left space-y-2.5"
            >
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-[10px] font-bold text-foreground">
                  Meeting Summary Drafted
                </span>
              </div>
              <div className="space-y-1.5 text-[9px] text-muted-foreground font-medium">
                <p className="flex items-start gap-1">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Decision:</strong> Commit to pure obsidian dark mode.</span>
                </p>
                <p className="flex items-start gap-1">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Deadline:</strong> Style adjustments finalized tonight.</span>
                </p>
                <p className="flex items-start gap-1">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>Action:</strong> Emma to compile code changes.</span>
                </p>
              </div>
              <button
                onClick={() => setStep(0)}
                className="text-[9px] text-primary underline hover:text-primary/80 block mt-2"
              >
                Replay Simulator
              </button>
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ==========================================================================
   3. GRANULAR ROLES SIMULATOR (STATIC MATRIX)
   ========================================================================== */
function RolesSimulator() {
  const roles = [
    { name: 'Workspace Owner', invite: true, moderate: true, settings: true },
    { name: 'Workspace Admin', invite: true, moderate: true, settings: false },
    { name: 'Team Member', invite: false, moderate: false, settings: false },
  ];

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 bg-zinc-950/10 dark:bg-zinc-950/30 rounded-xl border border-border/80">
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
          Role Permission Matrix
        </span>
        <div className="border border-border/60 rounded-xl overflow-hidden bg-card/50">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60 text-[9px] font-bold text-muted-foreground uppercase">
                <th className="p-2.5">Role</th>
                <th className="p-2.5 text-center">Invites</th>
                <th className="p-2.5 text-center">Moderation</th>
                <th className="p-2.5 text-center">Billing Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {roles.map((r) => (
                <tr key={r.name} className="hover:bg-muted/20">
                  <td className="p-2.5 font-semibold text-foreground">{r.name}</td>
                  <td className="p-2.5 text-center">
                    {r.invite ? (
                      <span className="text-green-500 font-bold">✓</span>
                    ) : (
                      <span className="text-muted-foreground/45">—</span>
                    )}
                  </td>
                  <td className="p-2.5 text-center">
                    {r.moderate ? (
                      <span className="text-green-500 font-bold">✓</span>
                    ) : (
                      <span className="text-muted-foreground/45">—</span>
                    )}
                  </td>
                  <td className="p-2.5 text-center">
                    {r.settings ? (
                      <span className="text-green-500 font-bold">✓</span>
                    ) : (
                      <span className="text-muted-foreground/45">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-normal">
        Configure precise join settings, stream limitations, and screen-sharing permissions per user type.
      </p>
    </div>
  );
}

/* ==========================================================================
   4. ADAPTIVE STREAMING SIMULATOR (STATIC DIAGNOSTICS)
   ========================================================================== */
function StreamingSimulator() {
  return (
    <div className="w-full h-full flex flex-col justify-between p-4 bg-zinc-950/10 dark:bg-zinc-950/30 rounded-xl border border-border/80">
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
          WebRTC Stream Diagnostic
        </span>
        <div className="border border-border/60 rounded-xl p-3 bg-card/50 space-y-3">
          {/* Diagnostic Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-foreground">MediaSoup Node Status: ACTIVE</span>
            </div>
            <span className="text-[9px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              RTT: 14ms
            </span>
          </div>
          {/* Diagnostic Stats Grid */}
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div className="space-y-1">
              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Video Quality</span>
              <span className="text-foreground font-semibold">1080p HD @ 60fps</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Audio Codec</span>
              <span className="text-foreground font-semibold">Opus Fullband (48kHz)</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">BWE Estimated</span>
              <span className="text-foreground font-semibold">4.8 Mbps (Optimal)</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block text-[9px] uppercase font-semibold">Packet Loss</span>
              <span className="text-foreground font-semibold">0.00% (Lossless)</span>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-normal">
        MeetLite dynamically scales resolution and bitrate per participant to maintain sub-50ms latency across networks.
      </p>
    </div>
  );
}

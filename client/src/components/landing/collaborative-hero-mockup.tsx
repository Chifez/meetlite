import { useState } from 'react';
import { motion } from 'motion/react';
import { MousePointer2, Type, Square, Circle } from 'lucide-react';
import { VideoParticipant } from '@/components/room/video-participant';

// Mock Data for participants
const MOCK_PARTICIPANTS = [
  {
    id: '1',
    userName: 'Emma Woods',
    mediaState: { audioEnabled: true, videoEnabled: false },
    forceSpeaking: true,
  },
  {
    id: '2',
    userName: 'Alex Chen',
    mediaState: { audioEnabled: false, videoEnabled: false },
    forceSpeaking: false,
  },
  {
    id: '3',
    userName: 'Liam Miller',
    mediaState: { audioEnabled: false, videoEnabled: false },
    forceSpeaking: false,
  },
  {
    id: '4',
    userName: 'You',
    isLocal: true,
    mediaState: { audioEnabled: true, videoEnabled: false },
    forceSpeaking: false,
  },
];

export const CollaborativeHeroMockup = () => {
  const [activeCursor, setActiveCursor] = useState({ x: 45, y: 35 });

  const handleCanvasMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setActiveCursor({ x, y });
  };

  return (
    <div className="relative w-full aspect-[16/10] sm:aspect-[21/9] lg:aspect-[16/9] max-w-6xl mx-auto rounded-2xl overflow-hidden border border-border shadow-2xl bg-card">
      {/* Top Toolbar (Simulated) */}
      <div className="absolute top-0 inset-x-0 h-12 bg-card border-b border-border flex items-center justify-between px-4 z-20">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-border" />
          </div>
          <span className="ml-4 text-sm font-semibold text-foreground">
            Project Alpha Q3 / Architecture
          </span>
        </div>
        <div className="hidden sm:flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-background border border-border rounded-lg p-1">
            <button className="p-1.5 rounded-md bg-white shadow-sm border border-border text-foreground">
              <MousePointer2 className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md text-muted-foreground hover:bg-white hover:text-foreground transition-colors">
              <Square className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md text-muted-foreground hover:bg-white hover:text-foreground transition-colors">
              <Circle className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md text-muted-foreground hover:bg-white hover:text-foreground transition-colors">
              <Type className="w-4 h-4" />
            </button>
          </div>
          <button className="ml-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90">
            Share
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div 
        className="absolute top-12 bottom-0 inset-x-0 bg-[#F7F6F2] overflow-hidden"
        onMouseMove={handleCanvasMove}
      >
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#E4E1D8_1px,transparent_1px)] [background-size:20px_20px] opacity-70" />

        {/* Drawn Elements (Mock) */}
        <div className="absolute top-[20%] left-[15%] w-48 h-32 bg-white border-2 border-primary rounded-xl shadow-sm flex items-center justify-center">
          <span className="font-semibold text-zinc-900">Client App</span>
        </div>
        
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <path 
            d="M 25% 20% C 35% 20%, 45% 45%, 55% 45%" 
            fill="none" 
            stroke="var(--primary)" 
            strokeWidth="3" 
            strokeDasharray="6 6"
            className="opacity-50"
          />
        </svg>

        <div className="absolute top-[45%] left-[55%] w-48 h-32 bg-white border-2 border-[#E8A54B] rounded-xl shadow-sm flex items-center justify-center">
          <span className="font-semibold text-zinc-900">Room Service</span>
        </div>

        <div className="absolute top-[10%] left-[60%] w-40 h-40 bg-[#FFF9C4] rotate-3 shadow-md p-4">
          <p className="text-sm font-handwriting text-zinc-800 leading-relaxed">
            Need to ensure sub-50ms latency for this node.
          </p>
        </div>

        {/* Cursors */}
        <motion.div
          animate={{ left: `${activeCursor.x}%`, top: `${activeCursor.y}%` }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute pointer-events-none z-30"
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          <MousePointer2 className="w-5 h-5 text-warm fill-warm rotate-[-15deg]" />
          <div className="mt-1 ml-3 px-2 py-0.5 bg-warm text-white text-[10px] font-bold rounded shadow-sm whitespace-nowrap">
            Alex Chen
          </div>
        </motion.div>

        <motion.div
          animate={{ left: '30%', top: '60%' }}
          initial={{ left: '25%', top: '55%' }}
          transition={{
            repeat: Infinity,
            repeatType: 'reverse',
            duration: 4,
            ease: 'easeInOut'
          }}
          className="absolute pointer-events-none z-30"
        >
          <MousePointer2 className="w-5 h-5 text-[#2E7D5B] fill-[#2E7D5B] rotate-[-15deg]" />
          <div className="mt-1 ml-3 px-2 py-0.5 bg-[#2E7D5B] text-white text-[10px] font-bold rounded shadow-sm whitespace-nowrap">
            Emma Woods
          </div>
        </motion.div>

        {/* Video Participants Sidebar overlayed on right */}
        <div className="absolute top-4 right-4 bottom-4 w-32 md:w-40 z-40 flex flex-col gap-3">
          {MOCK_PARTICIPANTS.map((p) => (
            <div key={p.id} className="w-full aspect-video rounded-xl overflow-hidden shadow-lg border border-border bg-black/5">
              <VideoParticipant
                stream={null}
                isLocal={p.isLocal || false}
                mediaState={p.mediaState}
                userName={p.userName}
                forceSpeaking={p.forceSpeaking}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CollaborativeHeroMockup;

import { MousePointer2, Bot, Calendar, Sparkles } from 'lucide-react';

export const FeatureSection = () => {
  return (
    <section className="py-24 bg-background border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-32">
        
        {/* Block 1: Canvas */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
          <div className="flex-1 space-y-6">
            <div className="inline-flex p-3 rounded-2xl bg-warm/10 border border-warm/20 text-warm">
              <MousePointer2 className="w-6 h-6" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              An infinite canvas for finite time.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Stop talking over each other and start sketching. The built-in multiplayer canvas synchronizes cursors instantly, letting everyone draw, drop shapes, and paste assets with sub-10ms latency.
            </p>
          </div>
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-warm/5 blur-3xl rounded-full" />
            <div className="relative aspect-[4/3] bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-6 flex flex-col justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] opacity-50" />
              <div className="relative w-48 h-32 bg-white shadow-sm border border-border mx-auto flex items-center justify-center transform -rotate-3">
                 <span className="font-semibold text-zinc-900">Q4 Roadmap</span>
              </div>
              <div className="relative w-40 h-24 bg-white shadow-sm border-2 border-warm mx-auto -mt-4 ml-12 flex items-center justify-center transform rotate-6">
                 <span className="font-semibold text-zinc-900 text-sm">Launch Plan</span>
                 <div className="absolute -top-3 -right-3 w-4 h-4 bg-warm rounded-full" />
                 <span className="absolute -top-7 -right-10 bg-warm text-white text-[10px] px-2 py-1 rounded">Alex</span>
              </div>
            </div>
          </div>
        </div>

        {/* Block 2: AI Layer */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-24">
          <div className="flex-1 space-y-6">
            <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Bot className="w-6 h-6" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Focus on the meeting, not the notes.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Our AI engine listens to the conversation, identifies speakers, and automatically generates precise transcripts and structured action items in real-time.
            </p>
          </div>
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
            <div className="relative aspect-[4/3] bg-card border border-border rounded-2xl shadow-xl p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                   <Sparkles className="w-4 h-4 text-primary" />
                   <span className="text-sm font-semibold text-foreground">AI Meeting Summary</span>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-full animate-pulse" />
                  <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-border">
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Action:</strong> Emma to finalize the Figma mockups by Friday.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Block 3: Calendar Sync */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
          <div className="flex-1 space-y-6">
            <div className="inline-flex p-3 rounded-2xl bg-[#2E7D5B]/10 border border-[#2E7D5B]/20 text-[#2E7D5B]">
              <Calendar className="w-6 h-6" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Scheduling without the headache.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              MeetLite automatically resolves timezones and finds the perfect overlap across Google Calendar and Outlook, sending smart invites with context built-in.
            </p>
          </div>
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-[#2E7D5B]/5 blur-3xl rounded-full" />
            <div className="relative aspect-[4/3] bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-6 flex items-center justify-center">
              <div className="w-full max-w-sm bg-white border border-border shadow-md rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-zinc-900 text-lg">Weekly Sync</h4>
                    <p className="text-sm text-zinc-500">Tomorrow, 10:00 AM - 11:00 AM</p>
                  </div>
                  <div className="bg-[#2E7D5B]/10 text-[#2E7D5B] text-xs font-bold px-2 py-1 rounded">
                    Timezone Matched
                  </div>
                </div>
                <div className="flex -space-x-2 pt-2">
                   <div className="w-8 h-8 rounded-full bg-primary/20 border-2 border-white flex items-center justify-center text-xs font-bold text-primary">A</div>
                   <div className="w-8 h-8 rounded-full bg-warm/20 border-2 border-white flex items-center justify-center text-xs font-bold text-warm">B</div>
                   <div className="w-8 h-8 rounded-full bg-[#2E7D5B]/20 border-2 border-white flex items-center justify-center text-xs font-bold text-[#2E7D5B]">C</div>
                </div>
                <button className="w-full mt-2 bg-primary text-primary-foreground py-2 rounded-lg font-semibold text-sm">
                  Join MeetLite Workspace
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default FeatureSection;

import { ShieldCheck, Lock, Server } from 'lucide-react';

export const SecuritySection = () => {
  return (
    <section className="py-24 bg-[#09090b] text-white border-b border-white/10 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold tracking-wide uppercase text-white/80">Enterprise Security</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Your ideas are safe. <br/> Period.
            </h2>
            
            <p className="text-lg text-white/60 leading-relaxed max-w-xl">
              We built MeetLite from the ground up with a zero-trust architecture. Your collaborative sessions, canvases, and AI transcripts are end-to-end encrypted and never used for model training.
            </p>

            <ul className="space-y-4 pt-4">
              {[
                { icon: Lock, text: 'End-to-End Encryption (E2EE) on all calls' },
                { icon: Server, text: 'SOC2 Type II & GDPR Compliant Infrastructure' },
                { icon: ShieldCheck, text: 'Granular Role-Based Access Controls (RBAC)' },
              ].map((item, i) => (
                <li key={i} className="flex items-center space-x-3">
                  <div className="p-1.5 rounded bg-primary/20 text-white border border-primary/30">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-white/90">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Visual Trust Badge/Block */}
          <div className="relative lg:h-[400px] flex items-center justify-center">
            <div className="absolute w-full aspect-square bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative bg-[#1A1A1A] border border-white/10 rounded-3xl p-8 shadow-2xl w-full max-w-md">
               <div className="flex justify-between items-center pb-6 border-b border-white/10 mb-6">
                 <div className="flex items-center space-x-3">
                   <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                     <Lock className="w-5 h-5 text-green-400" />
                   </div>
                   <div>
                     <p className="text-white font-bold">Secure Session</p>
                     <p className="text-xs text-white/50">ID: mtl-8472-xc9</p>
                   </div>
                 </div>
                 <div className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                   Encrypted
                 </div>
               </div>

               <div className="space-y-4">
                 {[
                   { label: 'Key Exchange', status: 'Verified (DTLS-SRTP)' },
                   { label: 'Media Transport', status: 'AES-256-GCM' },
                   { label: 'Data Channel', status: 'SCTP over DTLS' },
                 ].map((stat, i) => (
                   <div key={i} className="flex justify-between text-sm">
                     <span className="text-white/50 font-mono">{stat.label}</span>
                     <span className="text-white/90 font-mono">{stat.status}</span>
                   </div>
                 ))}
               </div>

               <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
                 <span>Status: Active Monitoring</span>
                 <span className="flex items-center gap-1.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                   System Nominal
                 </span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;

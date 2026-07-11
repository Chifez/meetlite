import { motion } from 'motion/react';
import { Layers, Triangle, Hexagon, CircleDashed, SquareAsterisk } from 'lucide-react';

const LOGOS = [
  { name: 'Acme Corp', icon: Layers },
  { name: 'GlobalTech', icon: Triangle },
  { name: 'Nexus', icon: Hexagon },
  { name: 'Quantum', icon: CircleDashed },
  { name: 'Vertex', icon: SquareAsterisk },
];

export const LogoCloudSection = () => {
  return (
    <section className="relative py-16 bg-background dark:bg-[#09090b] border-b border-border overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <p className="text-center text-sm font-medium text-muted-foreground mb-10 uppercase tracking-widest">
          Trusted by teams who value clear communication
        </p>
        
        <div className="relative flex overflow-hidden">
          {/* Gradient Masks for smooth fade out at edges */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background dark:from-[#09090b] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background dark:from-[#09090b] to-transparent z-10 pointer-events-none" />
          
          <motion.div 
            className="flex space-x-20 items-center whitespace-nowrap"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ 
              repeat: Infinity, 
              ease: 'linear', 
              duration: 25 
            }}
          >
            {/* Double the logos to create seamless loop */}
            {[...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS].map((logo, idx) => {
              const Icon = logo.icon;
              return (
                <div key={idx} className="flex items-center space-x-3 text-muted-foreground/40 hover:text-foreground transition-colors duration-300">
                  <Icon className="w-8 h-8" />
                  <span className="text-2xl font-display font-semibold tracking-tight">{logo.name}</span>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default LogoCloudSection;

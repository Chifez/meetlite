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
    <section className="py-12 bg-background border-b border-border overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <p className="text-center text-sm font-semibold text-muted-foreground mb-8 uppercase tracking-wider">
          Trusted by innovative teams worldwide
        </p>
        
        <div className="relative flex overflow-hidden">
          {/* Gradient Masks for smooth fade out at edges */}
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
          
          <motion.div 
            className="flex space-x-16 items-center whitespace-nowrap"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ 
              repeat: Infinity, 
              ease: 'linear', 
              duration: 20 
            }}
          >
            {/* Double the logos to create seamless loop */}
            {[...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS].map((logo, idx) => {
              const Icon = logo.icon;
              return (
                <div key={idx} className="flex items-center space-x-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                  <Icon className="w-8 h-8" />
                  <span className="text-xl font-display font-bold tracking-tight">{logo.name}</span>
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

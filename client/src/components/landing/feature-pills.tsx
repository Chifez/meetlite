import { Users, Shield } from 'lucide-react';

const FeaturePills = () => {
  return (
    <div className="flex justify-center items-center flex-wrap gap-3 pt-4">
      <div className="flex items-center space-x-2 bg-card backdrop-blur-sm rounded-full px-4 py-2 border border-border hover:border-primary/50 transition-colors">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          Up to 1000 participants
        </span>
      </div>
      <div className="flex items-center space-x-2 bg-card backdrop-blur-sm rounded-full px-4 py-2 border border-border hover:border-primary/50 transition-colors">
        <Shield className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          End-to-end encrypted
        </span>
      </div>
    </div>
  );
};

export default FeaturePills;

import { Star } from 'lucide-react';

const StatsDisplay = () => {
  return (
    <div className="flex flex-wrap flex-row items-center justify-center lg:items-start gap-4 sm:gap-8 pt-4 text-sm text-gray-600 dark:text-gray-400">
      <div className="flex items-center space-x-2">
        <div className="flex text-yellow-400">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-current" />
          ))}
        </div>
        <span>4.9/5 rating</span>
      </div>
      <div className="hidden sm:block w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
      <span>100,000+ happy users</span>
      <div className="hidden sm:block w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
      <span>99.9% uptime</span>
    </div>
  );
};

export default StatsDisplay;

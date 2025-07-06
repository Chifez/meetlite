import { Users, Shield } from 'lucide-react';

const FeaturePills = () => {
  return (
    <div className="flex justify-center items-center flex-wrap gap-3 pt-4">
      <div className="flex items-center space-x-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-200/50 dark:border-gray-700/50">
        <Users className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Up to 1000 participants
        </span>
      </div>
      <div className="flex items-center space-x-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-200/50 dark:border-gray-700/50">
        <Shield className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          End-to-end encrypted
        </span>
      </div>
    </div>
  );
};

export default FeaturePills;

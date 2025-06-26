import { Video } from 'lucide-react';

export default function Logo({ size = 'base' }: { size?: 'base' | 'sm' }) {
  return (
    <div className="flex items-center space-x-2 mb-4">
      <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
        <Video className="w-5 h-5 text-white" size={size == 'base' ? 10 : 5} />
      </div>
      <span className="text-lg font-semibold text-foreground">meetlite</span>
    </div>
  );
}

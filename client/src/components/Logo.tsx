import { cn } from '@/lib/utils';

export default function Logo({ size = 'base' }: { size?: 'base' | 'sm' }) {
  const sizeClasses = {
    base: 'w-10 h-8',
    sm: 'w-8 h-6',
  };
  return (
    <div className="flex items-center gap-2">
      <img
        src="/logo.png"
        alt="MeetLite Logo"
        className={cn(sizeClasses[size])}
      />
      <h1 className="text-xl lg:text-2xl font-bold">MeetLite</h1>
    </div>
  );
}

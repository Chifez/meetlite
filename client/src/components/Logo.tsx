import { Video } from 'lucide-react';

interface LogoProps {
  variant?: 'default' | 'gradient' | 'white';
  size?: 'sm' | 'base';
}

export default function Logo({
  variant = 'default',
  size = 'base',
}: LogoProps) {
  const sizeClasses = {
    sm: {
      container: 'w-6 h-6',
      icon: 'w-3 h-3',
      text: 'text-sm',
    },
    base: {
      container: 'w-8 h-8',
      icon: 'w-4 h-4',
      text: 'text-xl',
    },
  };

  const variantClasses = {
    default: {
      text: 'text-black',
    },
    gradient: {
      text: 'bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent',
    },
    white: {
      text: 'text-white',
    },
  };

  const currentSize = sizeClasses[size];
  const currentVariant = variantClasses[variant];

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`${currentSize.container} bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center`}
      >
        <Video className={`${currentSize.icon} text-white`} />
      </div>
      <span className={`${currentSize.text} font-bold ${currentVariant.text}`}>
        meetlite
      </span>
    </div>

    // <div className="flex items-center space-x-2 mb-4">
    //   <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
    //     <Video className="w-5 h-5 text-white" size={size == 'base' ? 10 : 5} />
    //   </div>
    //   <span className="text-lg font-semibold text-foreground">meetlite</span>
    // </div>
  );
}

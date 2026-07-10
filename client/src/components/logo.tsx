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
      container: 'w-4 h-4',
      icon: 'w-3 h-3',
      text: 'text-xs',
    },
    base: {
      container: 'w-6 h-6',
      icon: 'w-4 h-4',
      text: 'text-lg tracking-tight',
    },
  };

  const variantClasses = {
    default: {
      text: 'text-gray-800 dark:text-white',
    },
    gradient: {
      text: 'text-primary',
    },
    white: {
      text: 'text-white dark:text-black',
    },
  };

  const currentSize = sizeClasses[size];
  const currentVariant = variantClasses[variant];

  return (
    <div className="flex items-center gap-1.5 justify-start">
      <img src="/logo.png" alt="Logo" className={currentSize.container} />
      <span className={`${currentSize.text} font-bold ${currentVariant.text}`}>
        MeetLite
      </span>
    </div>
  );
}

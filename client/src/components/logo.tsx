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
      container: 'w-8 h-8',
      icon: 'w-3 h-3',
      text: 'text-sm',
    },
    base: {
      container: 'w-10 h-10',
      icon: 'w-4 h-4',
      text: 'text-xl',
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
    <div className="flex items-center justify-center">
      <img src="/logo.svg" alt="Logo" className={currentSize.container} />
      <span className={`${currentSize.text} font-bold ${currentVariant.text}`}>
        MeetLite
      </span>
    </div>
  );
}

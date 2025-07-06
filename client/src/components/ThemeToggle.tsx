import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'default' | 'landing';
  className?: string;
}

const ThemeToggle = ({ variant = 'default', className }: ThemeToggleProps) => {
  const { setTheme, theme } = useTheme();

  // Toggle between light and dark
  const handleToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (variant === 'landing') {
    // Landing page theme toggle with gradient icons
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'rounded-full hover:bg-gray-100 dark:hover:bg-gray-800',
          className
        )}
        onClick={handleToggle}
      >
        {theme === 'dark' ? (
          <div className="w-4 h-4 rounded-full bg-gradient-to-r from-gray-400 to-gray-500"></div>
        ) : (
          <div className="w-4 h-4 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400"></div>
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  // Default theme toggle (for app pages)
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleToggle}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};

export default ThemeToggle;

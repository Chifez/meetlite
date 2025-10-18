import { Grid3X3, Users, Presentation, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';

export type LayoutMode = 'grid' | 'speaker' | 'presentation';

interface LayoutToggleProps {
  currentMode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
  participantCount: number;
  isPresenting?: boolean;
  className?: string;
}

export const LayoutToggle = ({
  currentMode,
  onModeChange,
  participantCount,
  isPresenting = false,
  className = '',
}: LayoutToggleProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-switch to presentation mode when someone starts presenting
  useEffect(() => {
    if (isPresenting && currentMode !== 'presentation') {
      onModeChange('presentation');
    }
  }, [isPresenting, currentMode, onModeChange]);

  const layoutOptions = [
    {
      mode: 'grid' as LayoutMode,
      icon: Grid3X3,
      label: 'Grid View',
      description: 'See everyone in a grid',
      disabled: false,
    },
    {
      mode: 'speaker' as LayoutMode,
      icon: Users,
      label: 'Speaker View',
      description: 'Focus on active speakers',
      disabled: participantCount < 2,
    },
    {
      mode: 'presentation' as LayoutMode,
      icon: Presentation,
      label: 'Presentation View',
      description: 'Optimized for content sharing',
      disabled: !isPresenting,
    },
  ];

  const currentOption = layoutOptions.find(
    (option) => option.mode === currentMode
  );

  return (
    <div className={`relative ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
        title={`Current: ${currentOption?.label}`}
      >
        {currentOption && <currentOption.icon className="h-4 w-4" />}
        <span className="text-sm font-medium">{currentOption?.label}</span>
        <Settings className="h-3 w-3 opacity-60" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-20">
            <div className="p-2">
              <div className="text-xs text-gray-400 px-2 py-1 mb-1">
                Choose Layout
              </div>

              {layoutOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = option.mode === currentMode;

                return (
                  <button
                    key={option.mode}
                    onClick={() => {
                      if (!option.disabled) {
                        onModeChange(option.mode);
                        setIsOpen(false);
                      }
                    }}
                    disabled={option.disabled}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : option.disabled
                        ? 'text-gray-500 cursor-not-allowed'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs opacity-75">
                        {option.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 bg-white rounded-full flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Participant Count Info */}
            <div className="px-2 py-1 border-t border-gray-700">
              <div className="text-xs text-gray-400">
                {participantCount} participant
                {participantCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

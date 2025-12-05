import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import {
  Smile,
  Heart,
  Star,
  Rocket,
  Target,
  Database,
  Cloud,
  Lock,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  AlertCircle,
  Info,
  Trash,
  Edit,
  Save,
  Zap,
  Settings as SettingsIcon,
  Send,
  Image,
  FileText,
  Tag,
  Plus,
  Check,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// All available Lucide icons
export const iconLibrary = {
  zap: Zap,
  settings: SettingsIcon,
  send: Send,
  smile: Smile,
  heart: Heart,
  star: Star,
  rocket: Rocket,
  target: Target,
  database: Database,
  cloud: Cloud,
  lock: Lock,
  mail: Mail,
  phone: Phone,
  calendar: Calendar,
  checkCircle: CheckCircle,
  alertCircle: AlertCircle,
  info: Info,
  trash: Trash,
  edit: Edit,
  save: Save,
  image: Image,
  fileText: FileText,
  tag: Tag,
  plus: Plus,
  check: Check,
  moreHorizontal: MoreHorizontal,
};

// All available emojis
export const emojiLibrary: Record<string, string> = {
  fire: '🔥',
  thumbsUp: '👍',
  party: '🎉',
  lightbulb: '💡',
  warning: '⚠️',
  checkmark: '✅',
  cross: '❌',
  bell: '🔔',
  flag: '🚩',
  gear: '⚙️',
  chart: '📊',
  clock: '⏰',
  folder: '📁',
  globe: '🌐',
  link: '🔗',
  key: '🔑',
  search: '🔍',
  bookmark: '🔖',
  trophy: '🏆',
  gift: '🎁',
  camera: '📷',
  video: '📹',
  music: '🎵',
  paint: '🎨',
};

interface IconEmojiPickerProps {
  onSelect: (iconName: string) => void;
  onClose: () => void;
  className?: string;
  iconsOnly?: boolean;
}

export const IconEmojiPicker = ({
  onSelect,
  onClose,
  className,
  iconsOnly = false,
}: IconEmojiPickerProps) => {
  return (
    <div
      className={cn(
        'bg-white border rounded-lg shadow-lg min-w-[280px] max-h-96 overflow-y-auto',
        className
      )}
    >
      <div className="p-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium">
            {iconsOnly ? 'Select Icon:' : 'Select Icon or Emoji:'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Lucide Icons */}
        <div className={iconsOnly ? '' : 'mb-3'}>
          <div className="text-xs text-gray-500 mb-1 font-medium">Icons</div>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(iconLibrary).map(([name, IconComponent]) => (
              <Button
                key={name}
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelect(name);
                  onClose();
                }}
                className="h-8 w-8 p-0 hover:bg-muted transition-colors"
                title={name}
              >
                <IconComponent className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>

        {/* Emojis - Only show if not iconsOnly */}
        {!iconsOnly && (
          <div>
            <div className="text-xs text-muted-foreground mb-1 font-medium">
              Emojis
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(emojiLibrary).map(([name, emoji]) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelect(name);
                    onClose();
                  }}
                  className="h-8 w-8 p-0 text-base hover:bg-muted transition-colors"
                  title={name}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to render icon/emoji
export const renderIconOrEmoji = (
  iconName: string | undefined,
  fallbackIcon?: keyof typeof iconLibrary,
  className?: string
) => {
  if (!iconName) {
    if (fallbackIcon && iconLibrary[fallbackIcon]) {
      const FallbackIcon = iconLibrary[fallbackIcon];
      return <FallbackIcon className={className || 'w-4 h-4'} />;
    }
    return null;
  }

  // Check if it's an emoji first
  const emoji = emojiLibrary[iconName];
  if (emoji) {
    return <span className="text-base">{emoji}</span>;
  }

  // Otherwise use lucide icon
  const IconComponent = iconLibrary[iconName as keyof typeof iconLibrary];
  if (IconComponent) {
    return <IconComponent className={className || 'w-4 h-4'} />;
  }

  return null;
};

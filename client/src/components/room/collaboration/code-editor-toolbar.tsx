import React from 'react';
import { Users, Crown } from 'lucide-react';
import { LanguageSelector } from './language-selector';
import { Badge } from '@/components/ui/badge';

interface CodeEditorToolbarProps {
  language: string;
  onLanguageChange: (language: string) => void;
  canEdit: boolean;
  activeEditors: string[];
  isPresenter: boolean;
  compact?: boolean;
}

export const CodeEditorToolbar: React.FC<CodeEditorToolbarProps> = ({
  language,
  onLanguageChange,
  canEdit,
  activeEditors,
  isPresenter,
  compact = false,
}) => {
  return (
    <div
      className={`
      flex items-center justify-between border-b bg-gray-50 dark:bg-gray-800
      ${compact ? 'p-2' : 'p-3'}
    `}
    >
      {/* Left side: Safari dots + Active users */}
      <div className="flex items-center gap-3">
        {/* Safari dots */}
        <div className="flex items-center gap-1">
          <div
            className={`rounded-full bg-red-500 ${
              compact ? 'w-2 h-2' : 'w-3 h-3'
            }`}
          ></div>
          <div
            className={`rounded-full bg-yellow-500 ${
              compact ? 'w-2 h-2' : 'w-3 h-3'
            }`}
          ></div>
          <div
            className={`rounded-full bg-green-500 ${
              compact ? 'w-2 h-2' : 'w-3 h-3'
            }`}
          ></div>
        </div>

        {/* Active Editors Indicator */}
        <div className="flex items-center gap-1">
          <Users
            className={`text-gray-500 dark:text-gray-400 ${
              compact ? 'h-3 w-3' : 'h-4 w-4'
            }`}
          />
          <Badge
            variant="outline"
            className={`${compact ? 'text-xs px-1 py-0' : 'text-sm px-2 py-1'}`}
          >
            {activeEditors.length}
          </Badge>
        </div>
      </div>

      {/* Right side: Language selector + Presenter/Viewer badge */}
      <div className="flex items-center gap-3">
        <LanguageSelector
          value={language}
          onChange={onLanguageChange}
          disabled={!canEdit}
          compact={compact}
        />

        {/* Presenter/Viewer Badge */}
        <div className="flex items-center gap-2">
          {isPresenter && (
            <Crown
              className={`text-yellow-600 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`}
            />
          )}
          <Badge
            variant={canEdit ? 'default' : 'secondary'}
            className={compact ? 'text-xs px-2 py-0.5' : 'text-sm px-2 py-1'}
          >
            {isPresenter ? 'Presenter' : canEdit ? 'Can Edit' : 'Viewer'}
          </Badge>
        </div>
      </div>
    </div>
  );
};

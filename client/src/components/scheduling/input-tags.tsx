import React, { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputTagsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  className?: string;
  id?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function InputTags({
  tags,
  onChange,
  placeholder = 'Add email',
  disabled = false,
  className,
  id,
}: InputTagsProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (rawTag: string) => {
    const clean = rawTag.trim().toLowerCase();
    if (!clean) return;
    if (!tags.includes(clean)) {
      onChange([...tags, clean]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (inputValue.trim()) {
        e.preventDefault();
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      e.preventDefault();
      onChange(tags.slice(0, -1));
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.includes(',') || text.includes(';') || text.includes(' ') || text.includes('\n')) {
      e.preventDefault();
      const parts = text
        .split(/[,;\s\n]+/)
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);

      const next = [...tags];
      for (const p of parts) {
        if (!next.includes(p)) {
          next.push(p);
        }
      }
      onChange(next);
      setInputValue('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const invalidTag = tags.find((tag) => !isValidEmail(tag));

  return (
    <div className="w-full">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'min-h-[38px] bg-background border rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-1.5 cursor-text transition-all',
          'border-[#CFCCC3] dark:border-border/80',
          isFocused && 'border-primary ring-3 ring-primary/20',
          className
        )}
      >
        {tags.map((tag, idx) => {
          const isValid = isValidEmail(tag);
          return (
            <span
              key={`${tag}-${idx}`}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md font-medium transition-colors select-none',
                isValid
                  ? 'bg-[#EEEDE8] dark:bg-muted text-foreground'
                  : 'bg-[#FCEBEB] dark:bg-destructive/20 text-[#791F1F] dark:text-destructive border border-[#E24B4A]/50'
              )}
            >
              <span className="truncate max-w-[200px]">{tag}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(idx);
                }}
                disabled={disabled}
                className="hover:opacity-75 focus:outline-none p-0.5 rounded"
                aria-label={`Remove ${tag}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}

        <input
          id={id}
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[100px] h-6 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0"
        />
      </div>

      {invalidTag && (
        <div className="text-[11px] text-[#A32D2D] dark:text-destructive mt-1.5 pl-0.5 font-medium">
          "{invalidTag}" isn't a valid email. Edit or remove it.
        </div>
      )}
    </div>
  );
}

export default InputTags;


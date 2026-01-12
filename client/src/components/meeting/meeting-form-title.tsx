import { Input } from '@/components/ui/input';
import { Wand2, Loader2 } from 'lucide-react';
import React from 'react';

interface MeetingFormTitleProps {
  formData: any;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateDescription?: () => void;
  isGenerating?: boolean;
}

const MeetingFormTitle: React.FC<MeetingFormTitleProps> = ({
  formData,
  onInputChange,
  onGenerateDescription,
  isGenerating = false,
}) => {

  return (
    <>
      <div>
        <label className="block mb-1 font-medium">Title *</label>
        <Input
          name="title"
          value={formData.title}
          onChange={onInputChange}
          required
        />
      </div>
      <div className="relative">
        <label className="block mb-1 font-medium">Description</label>
        <Input
          name="description"
          value={formData.description}
          onChange={onInputChange}
          autoComplete="off"
          disabled={isGenerating}
          className="pr-10"
        />
        {onGenerateDescription && (
          <button
            type="button"
            className="absolute right-2 top-8 p-1 rounded hover:bg-muted transition-colors"
            onClick={onGenerateDescription}
            tabIndex={-1}
            disabled={isGenerating}
            aria-label="Generate description"
          >
            {isGenerating ? (
              <Loader2 className="animate-spin w-5 h-5 text-primary" />
            ) : (
              <Wand2 className="w-5 h-5 text-primary" />
            )}
          </button>
        )}
      </div>
    </>
  );
};

export default MeetingFormTitle;

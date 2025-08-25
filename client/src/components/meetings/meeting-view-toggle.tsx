import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

interface MeetingViewToggleProps {
  view: 'list' | 'calendar';
  setView: (view: 'list' | 'calendar') => void;
  setShowImportModal: (e: any) => void;
}

export default function MeetingViewToggle({
  view,
  setView,
  setShowImportModal,
}: MeetingViewToggleProps) {
  return (
    <div className="flex justify-end mb-4 gap-2">
      <Button
        variant={view === 'list' ? 'default' : 'outline'}
        onClick={() => setView('list')}
      >
        List View
      </Button>
      <Button
        variant={view === 'calendar' ? 'default' : 'outline'}
        onClick={() => setView('calendar')}
      >
        Calendar View
      </Button>
      <Button
        variant="outline"
        onClick={() => setShowImportModal(true)}
        className="flex items-center gap-2"
      >
        <PlusCircle className="w-4 h-4" />
        Import
      </Button>
    </div>
  );
}

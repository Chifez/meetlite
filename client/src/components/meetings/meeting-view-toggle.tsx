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
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={view === 'list' ? 'default' : 'outline'}
        onClick={() => setView('list')}
        className="rounded-xl font-semibold"
      >
        List
      </Button>
      <Button
        size="sm"
        variant={view === 'calendar' ? 'default' : 'outline'}
        onClick={() => setView('calendar')}
        className="rounded-xl font-semibold"
      >
        Calendar
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowImportModal(true)}
        className="flex items-center gap-1.5 rounded-xl font-semibold"
      >
        <PlusCircle className="w-4 h-4" />
        Import
      </Button>
    </div>
  );
}

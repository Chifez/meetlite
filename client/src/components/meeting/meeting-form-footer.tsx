import { Button } from '@/components/ui/button';

export default function MeetingFormFooter({ isSubmitting, onCancel }: any) {
  return (
    <div className="flex justify-end gap-2 mt-6">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Meeting'}
      </Button>
    </div>
  );
}

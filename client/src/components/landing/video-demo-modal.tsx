import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VideoDemoModalProps {
  open: boolean;
  onClose: () => void;
}

const VideoDemoModal = ({ open, onClose }: VideoDemoModalProps) => {
  // Placeholder YouTube video ID - replace with actual demo video ID
  const videoId = 'dQw4w9WgXcQ'; // Replace with your actual demo video ID

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl p-1 bg-background/80 dark:bg-white rounded-lg overflow-hidden gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Watch Demo</DialogTitle>
          <DialogDescription>
            Watch a demonstration of MeetLite's features
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>

          {/* Video embed */}
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="MeetLite Demo Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoDemoModal;


import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { env } from '@/config/env';

interface ScheduleDemoModalProps {
  open: boolean;
  onClose: () => void;
}

const ScheduleDemoModal = ({ open, onClose }: ScheduleDemoModalProps) => {
  const calendlyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      // Load Calendly inline widget script
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      
      // Only append if not already loaded
      if (!document.querySelector('script[src*="calendly.com"]')) {
        document.head.appendChild(script);
      }

      // Initialize Calendly widget when script loads
      script.onload = () => {
        if (window.Calendly && calendlyRef.current) {
          const calendlyUrl = env.CALENDLY_URL;
          if (!calendlyUrl) {
            console.error('Calendly URL is not configured. Please set VITE_CALENDLY_URL in your .env file.');
            return;
          }
          window.Calendly.initInlineWidget({
            url: calendlyUrl,
            parentElement: calendlyRef.current,
          });
        }
      };

      return () => {
        // Cleanup: Remove Calendly widget when modal closes
        if (calendlyRef.current) {
          calendlyRef.current.innerHTML = '';
        }
      };
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 gap-0 max-h-[90vh] overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Schedule a Demo</DialogTitle>
          <DialogDescription>
            Book a time to see MeetLite in action
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

          {/* Calendly Inline Widget */}
          <div
            ref={calendlyRef}
            className="calendly-inline-widget"
            style={{ minWidth: '320px', height: '630px' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Extend Window interface for Calendly
declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: {
        url: string;
        parentElement: HTMLElement;
      }) => void;
    };
  }
}

export default ScheduleDemoModal;

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
// import { Separator } from '../../components/ui/separator';
import { useHotkeyHelp } from '../../hooks/use-hotkeys';
import { Keyboard } from 'lucide-react';

interface HotkeyHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HotkeyHelp: React.FC<HotkeyHelpProps> = ({
  open,
  onOpenChange,
}) => {
  const { categories, getHotkeysByCategory, formatHotkey } = useHotkeyHelp();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map((category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getHotkeysByCategory(category).map((hotkey, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <span className="text-sm font-medium">
                        {hotkey.description}
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatHotkey(hotkey)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* <Separator /> */}

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Press <kbd className="px-2 py-1 bg-muted rounded text-xs">?</kbd>{' '}
            anytime to show this help
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Global hotkey help component
export const GlobalHotkeyHelp: React.FC = () => {
  const [open, setOpen] = useState(false);

  React.useEffect(() => {
    const handleShowHelp = () => setOpen(true);
    const handleCloseModal = () => setOpen(false);

    window.addEventListener('hotkey:show-help', handleShowHelp);
    window.addEventListener('hotkey:close-modal', handleCloseModal);

    return () => {
      window.removeEventListener('hotkey:show-help', handleShowHelp);
      window.removeEventListener('hotkey:close-modal', handleCloseModal);
    };
  }, []);

  return <HotkeyHelp open={open} onOpenChange={setOpen} />;
};

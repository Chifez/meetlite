import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle, Trash2, Archive, ArchiveRestore } from 'lucide-react';

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon,
  isLoading = false,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const getConfirmButtonVariant = () => {
    return variant === 'destructive' ? 'destructive' : 'default';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-left text-base">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-left">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 ">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={getConfirmButtonVariant()}
            onClick={handleConfirm}
            disabled={isLoading}
            className="text-white"
          >
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Specialized confirmation modals for common use cases
export const DeleteConfirmationModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemName: string;
  isLoading?: boolean;
}> = ({ open, onOpenChange, onConfirm, itemName, isLoading }) => (
  <ConfirmationModal
    open={open}
    onOpenChange={onOpenChange}
    onConfirm={onConfirm}
    title="Delete Recording"
    description={`Are you sure you want to delete "${itemName}"? This action cannot be undone and will permanently remove the recording and all associated files.`}
    confirmText="Delete"
    variant="destructive"
    icon={<Trash2 className="h-6 w-6 text-red-600" />}
    isLoading={isLoading}
  />
);

export const ArchiveConfirmationModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemName: string;
  isArchiving: boolean;
  isLoading?: boolean;
}> = ({ open, onOpenChange, onConfirm, itemName, isArchiving, isLoading }) => (
  <ConfirmationModal
    open={open}
    onOpenChange={onOpenChange}
    onConfirm={onConfirm}
    title={isArchiving ? 'Archive Recording' : 'Unarchive Recording'}
    description={
      isArchiving
        ? `Are you sure you want to archive "${itemName}"? It will be hidden from the main recordings list but can be restored later.`
        : `Are you sure you want to unarchive "${itemName}"? It will be restored to the main recordings list.`
    }
    confirmText={isArchiving ? 'Archive' : 'Unarchive'}
    variant="default"
    icon={
      isArchiving ? (
        <Archive className="h-6 w-6 text-blue-600" />
      ) : (
        <ArchiveRestore className="h-6 w-6 text-green-600" />
      )
    }
    isLoading={isLoading}
  />
);

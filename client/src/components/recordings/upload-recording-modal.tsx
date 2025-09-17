import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CircularProgress } from '@/components/ui/circular-progress';

import { Upload, Video, FileText, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { meetingAssetsService } from '@/services/meetingAssetsService';
import { toast } from 'sonner';

interface UploadRecordingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess?: (recording: any) => void;
}

interface UploadFormData {
  title: string;
  description?: string;
  visibility: 'organization' | 'participants' | 'private';
  tags: string;
}

export const UploadRecordingModal: React.FC<UploadRecordingModalProps> = ({
  open,
  onOpenChange,
  onUploadSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UploadFormData>({
    defaultValues: {
      title: '',
      description: '',
      visibility: 'organization',
      tags: '',
    },
  });

  const visibility = watch('visibility');

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      alert('Please select a video or audio file');
      return;
    }

    // Validate file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
      alert('File size must be less than 500MB');
      return;
    }

    setSelectedFile(file);

    // Auto-generate title from filename if empty
    const currentTitle = watch('title');
    if (!currentTitle) {
      const name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      setValue('title', name);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload the file using the real service with progress tracking
      const recording = await meetingAssetsService.uploadRecording(
        selectedFile,
        {
          title: data.title,
          description: data.description,
          visibility: data.visibility,
          tags: data.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
        (progress) => {
          setUploadProgress(progress.percentage);
        }
      );

      setUploadProgress(100);

      toast.success('Recording uploaded successfully!');

      // Call the success callback
      if (onUploadSuccess) {
        onUploadSuccess(recording);
      }

      // Reset form and close modal
      reset();
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error(error.message || 'Failed to upload recording');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      reset();
      setSelectedFile(null);
      setUploadProgress(0);
      onOpenChange(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('video/')) {
      return <Video className="w-8 h-8 text-blue-500" />;
    }
    return <FileText className="w-8 h-8 text-green-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Upload Recording
            {uploading && (
              <div>
                <CircularProgress
                  value={uploadProgress}
                  size={30}
                  strokeWidth={3}
                  className="text-blue-600 text-xs"
                />
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-1">
            {/* File Upload Area */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : selectedFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    {getFileIcon(selectedFile)}
                    <div className="text-left">
                      <p className="font-medium text-gray-900">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      className="ml-auto"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      Drop your recording here
                    </p>
                    <p className="text-sm text-gray-500">
                      or click to browse files
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label htmlFor="file-upload">
                    <Button type="button" variant="outline" asChild>
                      <span>Choose File</span>
                    </Button>
                  </Label>
                  <p className="text-xs text-gray-400">
                    Supports video and audio files up to 500MB
                  </p>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  Title *
                </Label>
                <Input
                  id="title"
                  placeholder="Enter recording title"
                  {...register('title', { required: 'Title is required' })}
                />
                {errors.title && (
                  <p className="text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the recording..."
                  rows={3}
                  {...register('description')}
                />
              </div>

              {/* Visibility */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Visibility</Label>
                <RadioGroup
                  value={visibility}
                  onValueChange={(
                    value: 'organization' | 'participants' | 'private'
                  ) => setValue('visibility', value)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-gray-50">
                    <RadioGroupItem value="organization" id="organization" />
                    <div className="flex-1">
                      <Label
                        htmlFor="organization"
                        className="font-medium cursor-pointer"
                      >
                        Organization
                      </Label>
                      <p className="text-sm text-gray-600">
                        Visible to all organization members
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-gray-50">
                    <RadioGroupItem value="participants" id="participants" />
                    <div className="flex-1">
                      <Label
                        htmlFor="participants"
                        className="font-medium cursor-pointer"
                      >
                        Participants Only
                      </Label>
                      <p className="text-sm text-gray-600">
                        Only meeting participants can access
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-gray-50">
                    <RadioGroupItem value="private" id="private" />
                    <div className="flex-1">
                      <Label
                        htmlFor="private"
                        className="font-medium cursor-pointer"
                      >
                        Private
                      </Label>
                      <p className="text-sm text-gray-600">
                        Only you can access this recording
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags" className="text-sm font-medium">
                  Tags
                </Label>
                <Input
                  id="tags"
                  placeholder="Enter tags separated by commas"
                  {...register('tags')}
                />
                <p className="text-xs text-gray-500">
                  Use tags to organize and search your recordings
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit(onSubmit)}
            disabled={!selectedFile || uploading}
            className="flex-1"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Recording
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, FileText } from 'lucide-react';

interface RequestChangesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  onSubmit: (notes: string) => Promise<void>;
}

export function RequestChangesModal({
  open,
  onOpenChange,
  filename,
  onSubmit,
}: RequestChangesModalProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(notes);
      setNotes('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to submit changes request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Request Changes</DialogTitle>
          <DialogDescription>
            Provide detailed feedback for the buyer to revise this document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Info */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium truncate">{filename}</span>
          </div>

          {/* Feedback Textarea */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback *</Label>
            <Textarea
              id="feedback"
              placeholder="Please describe what needs to be changed. Be specific about the issues and provide clear guidance for revision."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px]"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              The buyer will receive this feedback and can reupload a revised version.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !notes.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

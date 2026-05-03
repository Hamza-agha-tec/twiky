'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoryUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File, caption: string) => Promise<void>;
}

export function StoryUploadDialog({ open, onOpenChange, onSubmit }: StoryUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File) {
    setFile(f);
    setIsVideo(f.type.startsWith('video/'));
    setPreview(URL.createObjectURL(f));
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setIsVideo(false);
    setCaption('');
  }

  function handleClose(v: boolean) {
    if (!v) clear();
    onOpenChange(v);
  }

  async function handleSubmit() {
    if (!file || loading) return;
    setLoading(true);
    try {
      await onSubmit(file, caption.trim());
      clear();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[340px] gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-[13px] font-semibold">New story</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 p-4">
          {!preview ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) pick(f);
              }}
              className={cn(
                'flex h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-all',
                dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40 hover:bg-muted/20',
              )}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-0.5 text-center">
                <p className="text-[12.5px] font-medium text-foreground">Upload photo or video</p>
                <p className="text-[11px] text-muted-foreground">Drag & drop or click to browse</p>
              </div>
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '9/14' }}>
              {isVideo ? (
                <video
                  src={preview}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                  loop
                />
              ) : (
                <img src={preview} alt="preview" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={clear}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <input
            type="text"
            placeholder="Add a caption…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            maxLength={200}
            className="h-9 w-full rounded-xl border border-border bg-background px-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />

          <Button
            className="w-full rounded-xl text-[12.5px] font-semibold"
            disabled={!file || loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Posting…</>
            ) : (
              'Share story'
            )}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/mov"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }}
        />
      </DialogContent>
    </Dialog>
  );
}

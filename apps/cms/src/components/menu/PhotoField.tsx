import { useId, useRef, useState, type DragEvent } from 'react';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { cn } from '../../lib/cn';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

const MAX_BYTES = 8 * 1024 * 1024;

interface PhotoFieldProps {
  currentUrl: string | null;
  file: File | null;
  onFile: (file: File | null) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  layout: 'drawer' | 'sheet';
}

/** Item photo with upload drop zone and client-side crop zoom (the file is sent after the item is saved). */
export function PhotoField({ currentUrl, file, onFile, zoom, onZoom, layout }: PhotoFieldProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const previewUrl = useObjectUrl(file);
  const src = previewUrl ?? currentUrl;
  const sliderId = useId();

  const accept = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      toast.error('Images must be smaller than 8 MB');
      return;
    }
    onZoom(1);
    onFile(candidate);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    accept(event.dataTransfer.files[0]);
  };

  const preview = (size: number, radius: number) => (
    <div
      className="relative shrink-0 overflow-hidden bg-line-2"
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover"
          style={{ transform: `scale(${file ? zoom : 1})`, transformOrigin: 'center' }}
        />
      ) : (
        <span className="grid size-full place-items-center text-faint">
          <Icon name="image" size={Math.round(size * 0.24)} />
        </span>
      )}
      {file ? (
        <>
          <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,.7)]" />
          <span className="pointer-events-none absolute inset-x-0 inset-y-[33%] border-y border-white/40" />
          <span className="pointer-events-none absolute inset-y-0 inset-x-[33%] border-x border-white/40" />
        </>
      ) : null}
    </div>
  );

  const zoomSlider = file ? (
    <label htmlFor={sliderId} className="flex flex-col gap-1">
      <span className="text-xs text-muted">Crop · zoom</span>
      <input
        id={sliderId}
        type="range"
        min={1}
        max={2}
        step={0.05}
        value={zoom}
        onChange={(event) => onZoom(Number(event.target.value))}
        className="w-full accent-accent"
      />
    </label>
  ) : null;

  const hiddenInputs = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </>
  );

  if (layout === 'sheet') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {preview(88, 12)}
          <div className="flex flex-1 flex-col gap-2">
            <Button size="xl" icon={<Icon name="camera" size={16} strokeWidth={1.8} />} onClick={() => cameraRef.current?.click()}>
              Take photo
            </Button>
            <Button size="xl" onClick={() => inputRef.current?.click()}>
              Choose from library
            </Button>
          </div>
        </div>
        {zoomSlider}
        {hiddenInputs}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">Photo</span>
      <div className="flex gap-4">
        {preview(140, 10)}
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'grid h-16 cursor-pointer place-items-center rounded-[10px] border border-dashed px-2 text-center text-[13px] text-muted transition-colors',
              dragOver ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:bg-line-2',
            )}
          >
            <span>
              {file ? file.name : 'Drop image or '}
              {file ? null : <span className="font-medium text-accent">browse</span>}
            </span>
          </button>
          {zoomSlider}
          <span className="text-xs text-faint">{file ? 'Square crop, shown at 76px in the menu.' : 'JPEG, PNG or WebP up to 8 MB. Shown at 76px in the menu.'}</span>
        </div>
      </div>
      {hiddenInputs}
    </div>
  );
}

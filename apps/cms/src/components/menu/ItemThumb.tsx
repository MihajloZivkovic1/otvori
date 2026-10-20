import { cn } from '../../lib/cn';
import { Icon } from '../icons';

/** Square item photo (44px in rows) or a neutral placeholder. */
export function ItemThumb({ src, size = 44, className }: { src: string | null; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-lg border border-black/5 bg-line-2 text-faint', className)}
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : <Icon name="image" size={Math.round(size * 0.4)} />}
    </span>
  );
}

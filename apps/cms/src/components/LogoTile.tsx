import { textOn } from '../lib/color';
import { cn } from '../lib/cn';
import { initialOf } from '../lib/format';

interface LogoTileProps {
  name: string;
  color: string;
  logoUrl?: string | null;
  size: number;
  radius?: number;
  className?: string;
}

/** Venue tile: the restaurant logo, or its initial in Libre Baskerville on the tenant's primary color. */
export function LogoTile({ name, color, logoUrl, size, radius, className }: LogoTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center overflow-hidden font-serif font-bold leading-none', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size / 4),
        background: color,
        color: textOn(color),
        fontSize: Math.round(size * 0.5),
      }}
    >
      {logoUrl ? <img src={logoUrl} alt="" className="size-full object-contain" /> : initialOf(name)}
    </span>
  );
}

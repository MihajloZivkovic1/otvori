import { cn } from '../../lib/cn';

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} style={style} />;
}

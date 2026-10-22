import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** The payment QR as an inline SVG (error level M, like banking apps expect); one path, crisp at any size. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { size: n, path: d };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={label} className={className}>
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#1F1A17" />
    </svg>
  );
}

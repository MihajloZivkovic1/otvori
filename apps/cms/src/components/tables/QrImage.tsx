import { useObjectUrl } from '../../hooks/useObjectUrl';
import { cn } from '../../lib/cn';
import { useQrBlob } from '../../lib/queries';

interface QrImageProps {
  restaurantId: string;
  tableId: string;
  label: string;
  size: number;
  className?: string;
}

/** Table QR code fetched with the bearer token (the API endpoints are tenant-scoped) and shown as an object URL. */
export function QrImage({ restaurantId, tableId, label, size, className }: QrImageProps) {
  const query = useQrBlob(restaurantId, tableId, 'svg');
  const url = useObjectUrl(query.data);
  return (
    <span
      className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-white', !url && 'qr-ghost', className)}
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt={`QR code for ${label}`} width={size} height={size} className="size-full" /> : <span className="sr-only">Loading QR code</span>}
    </span>
  );
}

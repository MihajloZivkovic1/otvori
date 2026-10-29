import { useState } from 'react';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { errorMessage } from '../../lib/api';
import { downloadBlob, openBlob } from '../../lib/download';
import { displayUrl } from '../../lib/format';
import { downloads, useMenuQrBlob } from '../../lib/queries';
import { Icon } from '../icons';
import { LogoTile } from '../LogoTile';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

type Format = 'png' | 'svg' | 'pdf';

/**
 * The venue's universal QR: the plain menu URL without a table, for venues that hang one code at the entrance or
 * on the counter instead of printing one per table. PNG / SVG for the printer, a one-card PDF in the sheet layout.
 */
export function MenuQrModal({ onClose }: { onClose: () => void }) {
  const { restaurant } = useRestaurantContext();
  const toast = useToast();
  const preview = useMenuQrBlob(restaurant.id, 'svg');
  const previewUrl = useObjectUrl(preview.data);
  const [busy, setBusy] = useState<Format | null>(null);

  const download = async (format: Format) => {
    setBusy(format);
    try {
      if (format === 'pdf') openBlob(await downloads.menuQrCard(restaurant.id), `qr-${restaurant.slug}-meni.pdf`);
      else downloadBlob(await downloads.menuQr(restaurant.id, format), `qr-${restaurant.slug}-meni.${format}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download the QR code'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Menu QR code"
      subtitle="One code for the whole venue — opens the menu without a table."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button icon={<Icon name="download" size={14} strokeWidth={1.8} />} loading={busy === 'png'} onClick={() => void download('png')}>
            PNG
          </Button>
          <Button icon={<Icon name="download" size={14} strokeWidth={1.8} />} loading={busy === 'svg'} onClick={() => void download('svg')}>
            SVG
          </Button>
          <Button variant="primary" icon={<Icon name="print" size={14} strokeWidth={1.8} />} loading={busy === 'pdf'} onClick={() => void download('pdf')}>
            Print card
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <LogoTile name={restaurant.name} color={restaurant.primaryColor} logoUrl={restaurant.logoUrl} size={22} radius={6} />
          <span className="font-serif text-sm font-bold">{restaurant.name}</span>
        </div>
        <span
          className="relative grid size-[200px] place-items-center overflow-hidden rounded-xl border border-line bg-white"
          aria-busy={preview.isPending || undefined}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={`Menu QR code for ${restaurant.name}`} width={200} height={200} className="size-full" />
          ) : (
            <span className="sr-only">Loading QR code</span>
          )}
        </span>
        <a href={restaurant.publicUrl} target="_blank" rel="noreferrer" className="font-mono text-[13px] text-ink-2 underline-offset-2 hover:underline">
          {displayUrl(restaurant.publicUrl)}
        </a>
        <p className="text-[13px] text-muted">
          Guests who scan it browse the menu and, with ordering on, type their table number before sending an order. Table codes
          below stay the better choice when you want orders tied to a table automatically.
        </p>
      </div>
    </Modal>
  );
}

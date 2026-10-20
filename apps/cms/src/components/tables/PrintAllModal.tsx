import { useState } from 'react';
import type { TableDto } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { openBlob } from '../../lib/download';
import { downloads } from '../../lib/queries';
import { LogoTile } from '../LogoTile';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { QrImage } from './QrImage';

const PER_SHEET = 6;

/** Preview of the A4 QR sheet (6 cards per page) with the PDF download from the API. */
export function PrintAllModal({ tables, onClose }: { tables: TableDto[]; onClose: () => void }) {
  const { restaurant } = useRestaurantContext();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const pages = Math.max(1, Math.ceil(tables.length / PER_SHEET));

  const download = async () => {
    setDownloading(true);
    try {
      const pdf = await downloads.qrSheet(restaurant.id);
      openBlob(pdf, `qr-${restaurant.slug}.pdf`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not build the PDF'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      flush
      title="Print all QR cards"
      subtitle={`A4 · ${PER_SHEET} per sheet · ${tables.length} ${tables.length === 1 ? 'table' : 'tables'}${pages > 1 ? ` · ${pages} pages` : ''}`}
      headerActions={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={downloading} onClick={() => void download()} disabled={tables.length === 0}>
            Download PDF
          </Button>
        </>
      }
    >
      <div className="bg-line-2 p-6">
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-6 bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,.1)] max-tab:grid-cols-1 max-tab:p-5">
          {tables.slice(0, PER_SHEET).map((table) => (
            <div key={table.id} className="flex flex-col items-center gap-3 rounded-xl border border-line p-5 text-center text-[#18181B]">
              <div className="flex items-center gap-2">
                <LogoTile name={restaurant.name} color={restaurant.primaryColor} logoUrl={restaurant.logoUrl} size={22} radius={6} />
                <span className="font-serif text-sm font-bold">{restaurant.name}</span>
              </div>
              <QrImage restaurantId={restaurant.id} tableId={table.id} label={table.label} size={120} />
              <div className="text-xl font-semibold">{table.label}</div>
              <div className="text-xs text-[#71717A]">Scan to view the menu</div>
            </div>
          ))}
          {tables.length === 0 ? <div className="col-span-full p-6 text-center text-sm text-muted">Add a table to print its QR card.</div> : null}
        </div>
        {tables.length > PER_SHEET ? (
          <p className="mt-3 text-center text-xs text-muted">
            Showing the first sheet · {tables.length - PER_SHEET} more {tables.length - PER_SHEET === 1 ? 'card' : 'cards'} on the next {pages - 1 === 1 ? 'page' : 'pages'} of the PDF.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

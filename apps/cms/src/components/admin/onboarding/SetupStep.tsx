import { useRef, useState } from 'react';
import { hexColorSchema, type SuperadminRestaurantDetailDto } from '@qr-menu/shared';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useAdminUpdateRestaurant } from '../../../lib/admin';
import { errorMessage } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { useUploadLogo } from '../../../lib/queries';
import { Icon } from '../../icons';
import { LogoTile } from '../../LogoTile';
import { ImportMenuModal } from '../../menu/ImportMenuModal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Field';
import { useToast } from '../../ui/Toast';
import { BulkTablesModal, CopyMenuModal } from './modals';

const SWATCHES = ['#7A3E48', '#B5421F', '#2F5D50', '#8A5A2B', '#3B5BA5', '#18181B'];

/** Step 4: tables, logo + colour, menu import or copy. Every part is optional and repeatable. */
export function SetupStep({ venue, finishing, onFinish }: { venue: SuperadminRestaurantDetailDto; finishing?: boolean; onFinish: () => void }) {
  const isMobile = useIsMobile();
  const toast = useToast();
  const update = useAdminUpdateRestaurant(venue.id);
  const uploadLogo = useUploadLogo(venue.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tables, setTables] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [hex, setHex] = useState(venue.primaryColor.toUpperCase());

  const saveColor = (value: string) => {
    const parsed = hexColorSchema.safeParse(value);
    if (!parsed.success) return;
    setHex(parsed.data.toUpperCase());
    if (parsed.data.toUpperCase() === venue.primaryColor.toUpperCase()) return;
    update.mutate({ primaryColor: parsed.data.toUpperCase() }, { onError: (error) => toast.error(errorMessage(error)) });
  };

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    uploadLogo.mutate(file, { onSuccess: () => toast.success('Logo uploaded'), onError: (error) => toast.error(errorMessage(error, 'Could not upload the logo')) });
  };

  const block = 'flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4';

  return (
    <div className="flex flex-col gap-4">
      <section className={block} aria-labelledby="setup-tables">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="setup-tables" className="text-sm font-semibold">
              Tables
            </h3>
            <p className="text-[13px] text-muted">{venue.tableCount > 0 ? `${venue.tableCount} ${venue.tableCount === 1 ? 'table' : 'tables'} so far. Each one gets its own QR code.` : 'How many tables, and what to call them. Each one gets its own QR code.'}</p>
          </div>
          <Button variant={venue.tableCount > 0 ? 'secondary' : 'primary'} onClick={() => setTables(true)}>
            {venue.tableCount > 0 ? 'Add more' : 'Add tables'}
          </Button>
        </div>
      </section>

      <section className={block} aria-labelledby="setup-brand">
        <h3 id="setup-brand" className="text-sm font-semibold">
          Logo and colour (optional)
        </h3>
        <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-center')}>
          <div className="flex items-center gap-3">
            <LogoTile name={venue.name} color={hex} logoUrl={venue.logoUrl} size={56} radius={14} />
            <div className="flex flex-col gap-1">
              <Button size="sm" loading={uploadLogo.isPending} onClick={() => fileRef.current?.click()}>
                {venue.logoUrl ? 'Replace logo' : 'Upload logo'}
              </Button>
              <span className="text-xs text-muted">PNG or JPG, square works best.</span>
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Logo file" onChange={(event) => onLogoFile(event.target.files?.[0])} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Primary colour">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={hex === swatch}
                aria-label={swatch}
                onClick={() => saveColor(swatch)}
                className="size-8 cursor-pointer rounded-full"
                style={{ background: swatch, boxShadow: hex === swatch ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)' : 'inset 0 0 0 1px var(--swatch-ring)' }}
              />
            ))}
            <Input aria-label="Hex colour" value={hex} onChange={(event) => setHex(event.target.value.toUpperCase())} onBlur={(event) => saveColor(event.target.value)} maxLength={7} className="h-8 w-24 font-mono text-[13px] uppercase" />
          </div>
        </div>
      </section>

      <section className={block} aria-labelledby="setup-menu">
        <h3 id="setup-menu" className="text-sm font-semibold">
          Menu
        </h3>
        <p className="text-[13px] text-muted">
          {venue.itemCount > 0 ? `${venue.itemCount} items in ${venue.categoryCount} ${venue.categoryCount === 1 ? 'category' : 'categories'} so far.` : 'Bring the menu in now, or let the owner type it later.'}
        </p>
        <div className={cn('flex gap-2', isMobile && 'flex-col')}>
          <Button icon={<Icon name="upload" size={14} />} onClick={() => setImporting(true)}>
            Import from spreadsheet
          </Button>
          <Button icon={<Icon name="copy" size={14} />} onClick={() => setCopying(true)}>
            Copy from another venue
          </Button>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-muted">Everything here can be done later from the venue page.</span>
        <Button variant="primary" size={isMobile ? 'lg' : 'md'} loading={finishing} onClick={onFinish}>
          Finish setup
        </Button>
      </div>

      {tables ? <BulkTablesModal restaurantId={venue.id} existing={venue.tableCount} onClose={() => setTables(false)} /> : null}
      {importing ? <ImportMenuModal restaurantId={venue.id} currency={venue.currency} onClose={() => setImporting(false)} /> : null}
      {copying ? <CopyMenuModal restaurantId={venue.id} onClose={() => setCopying(false)} /> : null}
    </div>
  );
}

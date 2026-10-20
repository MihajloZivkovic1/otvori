import type { Dictionary } from '../lib/i18n';
import type { CachedTenant } from '../lib/tenant';
import { LogoTile } from './LogoTile';

const CHIP_WIDTHS = [88, 104, 80, 112];
const SECTIONS = [0, 1];
const ROWS = [0, 1, 2];

function Row() {
  return (
    <div className="flex items-start gap-3.5 border-b border-line py-4">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex justify-between gap-2.5">
          <div className="skeleton h-5 w-[55%]" />
          <div className="skeleton h-4 w-14" />
        </div>
        <div className="skeleton h-3.5 w-[80%]" />
        <div className="skeleton h-5 w-12 rounded-full" />
      </div>
      <div className="skeleton size-[76px] rounded-xl" />
    </div>
  );
}

/** Loading state shaped like the menu: header, chip bar and two sections of three rows. */
export function MenuSkeleton({ t, tenant }: { t: Dictionary; tenant: CachedTenant | null }) {
  return (
    <div role="status" aria-busy="true" aria-label={t.loading} className="mx-auto min-h-dvh max-w-[640px]">
      <div className="safe-top flex flex-col gap-[18px] px-5 pb-4">
        <div className="flex items-center gap-3">
          {tenant ? <LogoTile name={tenant.name} logoUrl={tenant.logoUrl} /> : <div className="skeleton size-11 rounded-xl" />}
          <div className="flex flex-col gap-2">
            {tenant ? (
              <div className="font-serif text-[21px] leading-[1.15] font-bold">{tenant.name}</div>
            ) : (
              <div className="skeleton h-5 w-44" />
            )}
            <div className="skeleton h-3 w-28" />
          </div>
        </div>
        <div className="skeleton h-7 w-20 rounded-full" />
      </div>
      <div className="flex gap-1.5 border-b border-line px-5 py-2">
        {CHIP_WIDTHS.map((width) => (
          <div key={width} className="skeleton h-10 rounded-full" style={{ width }} />
        ))}
      </div>
      {SECTIONS.map((section) => (
        <div key={section} className="px-5 pt-7 pb-2">
          <div className="skeleton mb-3 h-6 w-32" />
          {ROWS.map((row) => (
            <Row key={row} />
          ))}
        </div>
      ))}
    </div>
  );
}

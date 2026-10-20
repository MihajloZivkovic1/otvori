import type { MenuErrorKind } from '../lib/api';
import type { Dictionary } from '../lib/i18n';
import type { CachedTenant } from '../lib/tenant';
import { Footer } from './Footer';
import { WifiOffIcon } from './icons';
import { LogoTile } from './LogoTile';

interface Props {
  kind: MenuErrorKind;
  t: Dictionary;
  tenant: CachedTenant | null;
  onRetry: () => void;
  retrying?: boolean;
}

/** Empty / offline state. Branded with the last known header when we have seen this restaurant before. */
export function OfflineScreen({ kind, t, tenant, onRetry, retrying = false }: Props) {
  const body = kind === 'not-published' ? t.notPublishedBody : kind === 'not-found' ? t.notFoundBody : t.offlineBody;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col">
      {tenant && (
        <div className="safe-top flex items-center gap-3 px-5 pb-4">
          <LogoTile name={tenant.name} logoUrl={tenant.logoUrl} />
          <div className="font-serif text-[22px] leading-[1.1] font-bold">{tenant.name}</div>
        </div>
      )}
      <main className="flex flex-1 flex-col items-center justify-center gap-3.5 px-10 py-10 text-center">
        <div className="grid size-14 place-items-center rounded-full border border-line-strong text-muted" aria-hidden="true">
          <WifiOffIcon />
        </div>
        <h1 className="font-serif text-[22px] leading-[1.25] font-bold text-pretty">{t.offlineTitle}</h1>
        <p className="max-w-[280px] text-[15px] leading-[1.5] text-muted text-pretty">{body}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-2 h-12 rounded-[14px] bg-accent px-6 text-[15px] font-semibold text-on-accent disabled:opacity-60"
        >
          {t.retry}
        </button>
        <p className="text-[13px] text-muted">{t.askStaff}</p>
      </main>
      <Footer />
    </div>
  );
}

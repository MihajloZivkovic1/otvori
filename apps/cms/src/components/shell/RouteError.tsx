import { isRouteErrorResponse, useRouteError } from 'react-router';
import { useT } from '../../lib/i18n';
import { isStaleChunkError, reloadOnceForStaleChunk } from '../../lib/stale-chunk';
import { Icon } from '../icons';
import { Button } from '../ui/Button';

/** Root `errorElement`: a readable screen with a Reload button instead of React Router's default stack dump. */
export function RouteError() {
  const error = useRouteError();
  const { t } = useT();
  if (isStaleChunkError(error) && reloadOnceForStaleChunk()) return null;

  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = notFound ? t('Page not found') : t('Something went wrong');
  const detail = isStaleChunkError(error)
    ? 'A new version of otvori was deployed. Reload to get it.'
    : notFound
      ? t('The link may be old, or the page moved.')
      : 'Reload the page; if it keeps happening, contact zdravo@otvori.menu.';

  return (
    <div role="alert" className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <div className="grid size-14 place-items-center rounded-2xl border border-dashed border-line-strong text-faint">
          <Icon name="warning" size={22} strokeWidth={1.6} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">{notFound ? '404' : '500'}</span>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-muted">{detail}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          {t('Reload')}
        </Button>
      </div>
    </div>
  );
}

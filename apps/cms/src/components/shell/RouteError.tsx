import { isRouteErrorResponse, useRouteError } from 'react-router';
import { isStaleChunkError, reloadOnceForStaleChunk } from '../../lib/stale-chunk';
import { Button } from '../ui/Button';

/** Root `errorElement`: a readable screen with a Reload button instead of React Router's default stack dump. */
export function RouteError() {
  const error = useRouteError();
  if (isStaleChunkError(error) && reloadOnceForStaleChunk()) return null;

  const title = isRouteErrorResponse(error) && error.status === 404 ? 'Page not found' : 'Something went wrong';
  const detail = isStaleChunkError(error)
    ? 'A new version of otvori was deployed. Reload to get it.'
    : 'Reload the page; if it keeps happening, contact zdravo@otvori.menu.';

  return (
    <div role="alert" className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        <p className="text-sm text-muted">{detail}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    </div>
  );
}

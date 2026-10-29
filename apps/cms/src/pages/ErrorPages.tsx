import { Link } from 'react-router';
import { useT } from '../lib/i18n';
import { Icon } from '../components/icons';
import { Button } from '../components/ui/Button';

function Screen({ code, title, detail, actions }: { code: string; title: string; detail: string; actions: React.ReactNode }) {
  return (
    <div role="alert" className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <div className="grid size-14 place-items-center rounded-2xl border border-dashed border-line-strong text-faint">
          <Icon name="warning" size={22} strokeWidth={1.6} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[.08em] text-muted">{code}</span>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-muted">{detail}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

/** Unknown route. */
export function NotFoundPage() {
  const { t } = useT();
  return (
    <Screen
      code="404"
      title={t('Page not found')}
      detail={t('The link may be old, or the page moved.')}
      actions={
        <Link to="/" className="no-underline">
          <Button variant="primary">{t('Go home')}</Button>
        </Link>
      }
    />
  );
}

/** Signed in, but the route belongs to another account or role. */
export function ForbiddenPage() {
  const { t } = useT();
  return (
    <Screen
      code="403"
      title={t('No access')}
      detail={t('You are signed in, but this page is not yours to see.')}
      actions={
        <Link to="/" className="no-underline">
          <Button variant="primary">{t('Go home')}</Button>
        </Link>
      }
    />
  );
}

import { useEffect, useState } from 'react';
import { installHint } from '../../lib/storage';
import { Button } from '../ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

/** "Install otvori" banner above the tab bar: native prompt on Chromium, Share → Add to Home Screen hint on iOS. */
export function InstallHint() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (installHint.dismissed() || isStandalone()) return;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const iosTimer = isIos() ? setTimeout(() => setVisible(true), 1500) : null;
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    installHint.dismiss();
    setVisible(false);
  };

  return (
    <div role="region" aria-label="Install otvori" className="pop-enter mx-3 mb-2 flex items-center gap-3 rounded-xl bg-ink px-3.5 py-3 text-surface">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold">Install otvori</div>
        <div className="text-xs opacity-80">
          {promptEvent ? 'Add it to your home screen for one-tap access.' : 'Tap Share, then “Add to Home Screen”.'}
        </div>
      </div>
      {promptEvent ? (
        <Button
          size="sm"
          className="border-none bg-surface text-ink"
          onClick={async () => {
            await promptEvent.prompt();
            dismiss();
          }}
        >
          Install
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" className="text-surface hover:bg-white/10" onClick={dismiss}>
        Not now
      </Button>
    </div>
  );
}

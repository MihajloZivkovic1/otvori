import { promotionStatus, type PromotionDto, type PromotionStatus } from '@qr-menu/shared';
import { useT } from '../../lib/i18n';
import { StatusPill, type StatusTone } from '../ui/Chip';

const TONES: Record<PromotionStatus, StatusTone> = { active: 'success', scheduled: 'warning', expired: 'neutral', off: 'neutral' };
const LABELS: Record<PromotionStatus, string> = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired', off: 'Off' };

/** Active / Scheduled / Expired / Off (Aktivna / Zakazana / Istekla / Isključena). */
export function PromotionStatusChip({ promotion }: { promotion: Pick<PromotionDto, 'isActive' | 'isActiveNow' | 'endsAt'> }) {
  const { t } = useT();
  const status = promotionStatus(promotion);
  return <StatusPill tone={TONES[status]}>{t(LABELS[status])}</StatusPill>;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 Nov – 30 Nov · Mon, Tue 16:00–18:00" for the list (fixed English short names, no ICU surprises). */
export function scheduleSummary(promotion: Pick<PromotionDto, 'startsAt' | 'endsAt' | 'recurrence'>): string {
  const parts: string[] = [];
  const fmt = (iso: string) => {
    const date = new Date(iso);
    return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
  };
  if (promotion.startsAt && promotion.endsAt) parts.push(`${fmt(promotion.startsAt)} – ${fmt(promotion.endsAt)}`);
  else if (promotion.startsAt) parts.push(`from ${fmt(promotion.startsAt)}`);
  else if (promotion.endsAt) parts.push(`until ${fmt(promotion.endsAt)}`);
  if (promotion.recurrence) {
    const days = [...promotion.recurrence.weekdays].sort((a, b) => a - b);
    const label = days.length === 7 ? 'Every day' : days.map((d) => WEEKDAY_SHORT[d - 1]).join(', ');
    parts.push(`${label} ${promotion.recurrence.from}–${promotion.recurrence.to}`);
  }
  return parts.length ? parts.join(' · ') : 'Always';
}

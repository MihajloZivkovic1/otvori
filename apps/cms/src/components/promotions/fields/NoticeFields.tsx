import { PROMOTION_LIMITS, type NoticeContent } from '@qr-menu/shared';
import { Field, Input, Textarea } from '../../ui/Field';

interface Props {
  value: NoticeContent;
  onChange: (next: NoticeContent) => void;
  error?: string;
}

/** Step 2 for a notice: headline and body. */
export function NoticeFields({ value, onChange, error }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Headline" htmlFor="promo-headline" error={error?.startsWith('headline') ? error : undefined}>
        <Input id="promo-headline" value={value.headline} maxLength={PROMOTION_LIMITS.headlineMax} onChange={(event) => onChange({ ...value, headline: event.target.value })} />
      </Field>
      <Field label="Text" htmlFor="promo-body" error={error?.startsWith('body') ? error : undefined} hint={`${value.body.length}/${PROMOTION_LIMITS.bodyMax}`}>
        <Textarea id="promo-body" rows={6} value={value.body} maxLength={PROMOTION_LIMITS.bodyMax} onChange={(event) => onChange({ ...value, body: event.target.value })} />
      </Field>
    </div>
  );
}

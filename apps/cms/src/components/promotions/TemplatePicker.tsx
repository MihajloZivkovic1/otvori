import { PROMOTION_TEMPLATES, type PromotionTemplate } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { PromotionPreview } from './PromotionPreview';
import { TEMPLATE_META } from './draft';
import { SAMPLES } from './samples';

interface TemplatePickerProps {
  value: PromotionTemplate | null;
  accent: string;
  currency: string;
  locale: string;
  onPick: (template: PromotionTemplate) => void;
}

/** Step 1: four cards, each with a small static render of its template. */
export function TemplatePicker({ value, accent, currency, locale, onPick }: TemplatePickerProps) {
  return (
    <div role="radiogroup" aria-label="Template" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PROMOTION_TEMPLATES.map((template) => {
        const selected = value === template;
        return (
          <button
            key={template}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(template)}
            className={cn(
              'flex cursor-pointer flex-col overflow-hidden rounded-[14px] border bg-surface text-left transition-colors',
              selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-line-strong',
            )}
          >
            <div className="relative h-[190px] overflow-hidden bg-[#f7f2eb]" aria-hidden="true">
              <div className="pointer-events-none absolute top-3 left-1/2 w-[390px] origin-top -translate-x-1/2 scale-[0.38]">
                <PromotionPreview promotion={SAMPLES[template]} accent={accent} currency={currency} locale={locale} variant="plain" className="rounded-2xl p-4" />
              </div>
            </div>
            <div className="flex flex-col gap-1 border-t border-line p-3.5">
              <span className="text-sm font-semibold">{TEMPLATE_META[template].name}</span>
              <span className="text-xs leading-[1.45] text-muted">{TEMPLATE_META[template].description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

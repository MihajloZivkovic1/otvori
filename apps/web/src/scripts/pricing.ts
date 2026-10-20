export type Billing = 'monthly' | 'yearly';

/**
 * Monthly / yearly toggle. Markup contract:
 *  - buttons `[data-billing="monthly"|"yearly"]` with `aria-pressed`
 *  - prices `[data-price]` with `data-monthly` / `data-yearly` (preformatted strings)
 *  - unit labels `[data-per]` with `data-per-month` / `data-per-year`
 */
export function applyBilling(root: ParentNode, billing: Billing): void {
  root.querySelectorAll<HTMLButtonElement>('[data-billing]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.billing === billing ? 'true' : 'false');
  });
  root.querySelectorAll<HTMLElement>('[data-price]').forEach((el) => {
    el.textContent = (billing === 'yearly' ? el.dataset.yearly : el.dataset.monthly) ?? el.textContent;
  });
  root.querySelectorAll<HTMLElement>('[data-per]').forEach((el) => {
    el.textContent = (billing === 'yearly' ? el.dataset.perYear : el.dataset.perMonth) ?? el.textContent;
  });
}

export function initPricing(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('[data-billing]').forEach((button) => {
    button.addEventListener('click', () => applyBilling(root, button.dataset.billing as Billing));
  });
}

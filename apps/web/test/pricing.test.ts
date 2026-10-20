import { beforeEach, describe, expect, it } from 'vitest';
import { applyBilling, initPricing } from '../src/scripts/pricing';

function mount() {
  document.body.innerHTML = `
    <div data-billing-toggle>
      <button data-billing="monthly" aria-pressed="true">Mesečno</button>
      <button data-billing="yearly" aria-pressed="false">Godišnje</button>
    </div>
    <span data-price="starter" data-monthly="1.490" data-yearly="14.900">1.490</span>
    <span data-per data-per-month="RSD / mesec" data-per-year="RSD / godina">RSD / mesec</span>
    <span data-price="pro" data-monthly="2.990" data-yearly="29.900">2.990</span>
    <span data-per data-per-month="RSD / mesec" data-per-year="RSD / godina">RSD / mesec</span>`;
  initPricing(document);
}

const text = (selector: string) => Array.from(document.querySelectorAll(selector)).map((el) => el.textContent);

describe('pricing toggle', () => {
  beforeEach(mount);

  it('switches both plans to yearly prices and labels, and marks the pressed button', () => {
    document.querySelector<HTMLButtonElement>('[data-billing="yearly"]')!.click();
    expect(text('[data-price]')).toEqual(['14.900', '29.900']);
    expect(text('[data-per]')).toEqual(['RSD / godina', 'RSD / godina']);
    expect(document.querySelector('[data-billing="yearly"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-billing="monthly"]')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('goes back to monthly', () => {
    applyBilling(document, 'yearly');
    document.querySelector<HTMLButtonElement>('[data-billing="monthly"]')!.click();
    expect(text('[data-price]')).toEqual(['1.490', '2.990']);
    expect(text('[data-per]')).toEqual(['RSD / mesec', 'RSD / mesec']);
    expect(document.querySelector('[data-billing="monthly"]')!.getAttribute('aria-pressed')).toBe('true');
  });
});

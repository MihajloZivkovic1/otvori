import { beforeEach, describe, expect, it } from 'vitest';
import { initQrCard, safeImageUrl } from '../src/scripts/qr-card';

const shell = `
  <p id="card-note"></p><button id="print" type="button">Print</button>
  <span id="logo-slot" class="border-dashed border-[1.5px]"><span id="logo-placeholder"></span><img id="logo" class="hidden" alt="" /></span>
  <div id="qr"></div><span id="table"></span><span id="tagline"></span><span id="url"></span>`;

describe('print card', () => {
  beforeEach(() => {
    document.body.innerHTML = shell;
  });

  it('renders the QR as an SVG and never interprets the parameters as HTML', () => {
    const payload = 'x"><img src=x onerror="window.pwned=1"><svg';
    initQrCard(document, new URLSearchParams({ venue: '<b>Kafe</b>', table: '7', qr: payload, lang: 'sr' }));
    const svg = document.querySelector('#qr > svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-label')).toBe('QR');
    expect(document.querySelector('#qr img')).toBeNull();
    expect(document.querySelector('[onerror]')).toBeNull();
    expect(document.querySelectorAll('img, script')).toHaveLength(1); // only the hidden logo slot
    expect(document.getElementById('url')!.textContent).toBe(payload);
    expect(document.getElementById('table')!.textContent).toBe('Sto 7');
    expect(document.title).toBe('<b>Kafe</b> — Sto 7');
    expect(document.documentElement.lang).toBe('sr-Latn');
  });

  it('only loads http(s) images from the query string', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(safeImageUrl('https://cdn.example/logo.png')).toBe('https://cdn.example/logo.png');
    initQrCard(
      document,
      new URLSearchParams({ table: '1', qrImage: 'data:text/html,<script>1</script>', logo: 'ftp://x/y' }),
    );
    expect(document.querySelector('#qr img')).toBeNull();
    expect((document.getElementById('logo') as HTMLImageElement).classList.contains('hidden')).toBe(true);
  });

  it('shows a ready QR image and the short link in English', () => {
    initQrCard(
      document,
      new URLSearchParams({
        table: '3',
        qrImage: 'https://api.otvori.menu/qr.png',
        url: 'kafe.otvori.menu/t/3',
        lang: 'en',
      }),
    );
    expect((document.querySelector('#qr img') as HTMLImageElement).src).toBe('https://api.otvori.menu/qr.png');
    expect(document.getElementById('url')!.textContent).toBe('kafe.otvori.menu/t/3');
    expect(document.getElementById('table')!.textContent).toBe('Table 3');
  });
});

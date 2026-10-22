import qrcode from 'qrcode-generator';
import { t, type Locale } from '../i18n';

/** Only http(s) images may be loaded onto the brand origin from a query parameter. */
export function safeImageUrl(value: string | null): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

/**
 * The QR as an SVG built with DOM APIs, never from an HTML string: every parameter of the print page is attacker
 * controlled (the page is public), so nothing from the URL may reach `innerHTML`.
 */
export function qrSvg(doc: Document, data: string): SVGSVGElement {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  const n = qr.getModuleCount();
  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR');
  const modules = doc.createElementNS(SVG, 'path');
  modules.setAttribute('d', path);
  modules.setAttribute('fill', '#1F1A17');
  svg.appendChild(modules);
  return svg;
}

/** Fills the card from the query string (see the page comment for the parameters). */
export function initQrCard(doc: Document, params: URLSearchParams): void {
  const lang: Locale = params.get('lang') === 'en' ? 'en' : 'sr';
  const dict = t(lang);
  const venue = params.get('venue') ?? '';
  const table = params.get('table') ?? '';
  const qrUrl = params.get('qr') ?? '';
  const qrImage = safeImageUrl(params.get('qrImage'));
  const logo = safeImageUrl(params.get('logo'));
  const shortUrl = params.get('url') ?? qrUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  doc.title = `${venue ? venue + ' — ' : ''}${dict.guest.table} ${table}`.trim();
  doc.documentElement.lang = dict.htmlLang;
  doc.getElementById('table')!.textContent = table ? `${dict.guest.table} ${table}` : venue;
  doc.getElementById('tagline')!.textContent = dict.tagline;
  doc.getElementById('url')!.textContent = shortUrl;
  doc.getElementById('card-note')!.textContent = dict.card.note;
  doc.getElementById('logo-placeholder')!.textContent = dict.card.logo;
  doc.getElementById('print')?.addEventListener('click', () => doc.defaultView?.print());

  if (logo) {
    const img = doc.getElementById('logo') as HTMLImageElement;
    img.src = logo;
    img.classList.remove('hidden');
    doc.getElementById('logo-placeholder')!.classList.add('hidden');
    doc.getElementById('logo-slot')!.classList.remove('border-dashed', 'border-[1.5px]');
  }

  const holder = doc.getElementById('qr')!;
  if (qrImage) {
    const img = doc.createElement('img');
    img.src = qrImage;
    img.alt = 'QR';
    img.className = 'size-full';
    holder.replaceChildren(img);
  } else if (qrUrl) {
    holder.replaceChildren(qrSvg(doc, qrUrl));
  }
}

import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import { FONT_BOLD, FONT_REGULAR, FONT_SERIF, qrPng } from '../tables/qr.js';

const require = createRequire(import.meta.url);
// The fiscal text is a fixed-width block (40 columns, Cyrillic): DejaVu Sans Mono covers it, pdfkit's Courier does not.
export const FONT_MONO = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf');
export const FONT_MONO_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSansMono-Bold.ttf');

const PLUM = '#7A3E48';
const INK = '#1F1A17';
const MUTED = '#6B6B6B';
const MARK_FRAME = 'M23 6H9a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14';
const MARK_DOOR = 'M24.5 6.4 30 2.2v27.6l-5.5-4.2z';

/** 80 mm receipt paper, like the till would print. */
const PAGE_W = 226.77;
const MARGIN = 14;
const MONO_SIZE = 7.6;
const MONO_LEADING = 9.4;
const QR_SIZE = 96;

export interface ReceiptPdfInput {
  venue: { name: string; taxNumber: string | null; address: string | null; city: string | null };
  order: { number: number; tableNumber: number | null };
  receipt: {
    invoiceNumber: string;
    verificationUrl: string;
    /** TextTop + TextBottom as the PFR returned them (CRLF separated, 40 columns). */
    text: string;
    issuedAt: Date | null;
    doubleFontLines?: number[];
  };
  /** Small print at the bottom, e.g. the public menu host. */
  footer: string;
}

function drawWordmark(doc: PDFKit.PDFDocument, centerX: number, y: number, size: number): void {
  const mark = size * 1.125;
  const gap = size * 0.4;
  doc.font('Serif').fontSize(size);
  const textWidth = doc.widthOfString('otvori', { characterSpacing: -size * 0.02 });
  const total = mark + gap + textWidth;
  const x = centerX - total / 2;
  const scale = mark / 32;
  doc
    .save()
    .translate(x, y - mark * 0.1)
    .scale(scale)
    .path(MARK_FRAME)
    .lineWidth(3.2)
    .lineJoin('round')
    .strokeColor(PLUM)
    .stroke()
    .roundedRect(11.3, 12, 8, 8, 1.5)
    .fill(PLUM)
    .path(MARK_DOOR)
    .fill(PLUM)
    .restore();
  doc.fillColor(PLUM).text('otvori', x + mark + gap, y, { lineBreak: false, characterSpacing: -size * 0.02 });
}

function formatIssuedAt(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Belgrade' }).format(date);
}

/**
 * A proper Serbian fiscal receipt as a PDF: the venue header, the PFR's textual representation verbatim (monospace,
 * Cyrillic as returned, double-font lines enlarged), the verification QR of the tax authority URL, the invoice
 * number and a small otvori footer. One page, 80 mm wide, as tall as the content.
 */
export async function renderFiscalReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  const lines = input.receipt.text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const doubled = new Set(input.receipt.doubleFontLines ?? []);
  const issued = formatIssuedAt(input.receipt.issuedAt);
  const headerLines = [input.venue.name, input.venue.taxNumber ? `PIB ${input.venue.taxNumber}` : null, [input.venue.address, input.venue.city].filter(Boolean).join(', ') || null].filter(
    (line): line is string => Boolean(line),
  );
  const metaLines = [`Narudžbina #${input.order.number}${input.order.tableNumber ? ` · Sto ${input.order.tableNumber}` : ''}`, issued ? `Izdat ${issued}` : null].filter(
    (line): line is string => Boolean(line),
  );

  const textHeight = lines.reduce((sum, _line, index) => sum + (doubled.has(index) ? MONO_LEADING * 2 : MONO_LEADING), 0);
  const pageHeight =
    MARGIN +
    16 + // title
    headerLines.length * 11 +
    metaLines.length * 10 +
    10 +
    textHeight +
    14 +
    QR_SIZE +
    12 + // invoice number
    22 + // verify line
    30 + // wordmark + footer
    MARGIN;

  const doc = new PDFDocument({
    size: [PAGE_W, pageHeight],
    margin: 0,
    info: { Title: `Fiskalni račun ${input.receipt.invoiceNumber}`, Author: input.venue.name, Creator: 'otvori' },
  });
  doc.registerFont('Sans', FONT_REGULAR);
  doc.registerFont('SansBold', FONT_BOLD);
  doc.registerFont('Serif', FONT_SERIF);
  doc.registerFont('Mono', FONT_MONO);
  doc.registerFont('MonoBold', FONT_MONO_BOLD);

  const done = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const innerW = PAGE_W - 2 * MARGIN;
  let y = MARGIN;
  doc.font('SansBold').fontSize(11).fillColor(INK).text('Fiskalni račun', MARGIN, y, { width: innerW, align: 'center', lineBreak: false });
  y += 16;
  doc.font('Sans').fontSize(8).fillColor(INK);
  for (const line of headerLines) {
    doc.text(line, MARGIN, y, { width: innerW, align: 'center', lineBreak: false, ellipsis: true });
    y += 11;
  }
  doc.fontSize(7.5).fillColor(MUTED);
  for (const line of metaLines) {
    doc.text(line, MARGIN, y, { width: innerW, align: 'center', lineBreak: false });
    y += 10;
  }
  y += 10;

  // The PFR text, verbatim. 40 columns of DejaVu Sans Mono at 7.6 pt fit the 80 mm paper with the margins.
  lines.forEach((line, index) => {
    const double = doubled.has(index);
    doc.font(double ? 'MonoBold' : 'Mono').fontSize(double ? MONO_SIZE * 1.6 : MONO_SIZE).fillColor(INK);
    doc.text(line.replace(/\s+$/, ''), MARGIN, y, { width: innerW, lineBreak: false });
    y += double ? MONO_LEADING * 2 : MONO_LEADING;
  });
  y += 14;

  const qr = await qrPng(input.receipt.verificationUrl, 512);
  doc.image(qr, (PAGE_W - QR_SIZE) / 2, y, { width: QR_SIZE, height: QR_SIZE });
  y += QR_SIZE + 4;
  doc.font('SansBold').fontSize(8).fillColor(INK).text(input.receipt.invoiceNumber, MARGIN, y, { width: innerW, align: 'center', lineBreak: false });
  y += 12;
  doc.font('Sans').fontSize(6.5).fillColor(MUTED).text('Proverite račun skeniranjem koda ili na suf.purs.gov.rs', MARGIN, y, { width: innerW, align: 'center', lineBreak: false });
  y += 22;

  drawWordmark(doc, PAGE_W / 2, y, 9);
  y += 16;
  doc.font('Sans').fontSize(6.5).fillColor('#9A9A9A').text(input.footer, MARGIN, y, { width: innerW, align: 'center', lineBreak: false, ellipsis: true });

  doc.end();
  return done;
}

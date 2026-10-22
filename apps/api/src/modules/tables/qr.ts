import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
// DejaVu Sans covers Serbian Latin (č, ć, đ, š, ž) and Cyrillic, which pdfkit's built-in fonts do not.
export const FONT_REGULAR = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
export const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
// Libre Baskerville Regular (OFL) renders the "otvori" wordmark; apps/api/assets is outside src so the path works from dist too.
export const FONT_SERIF = fileURLToPath(new URL('../../../assets/fonts/LibreBaskerville-Regular.ttf', import.meta.url));

const PLUM = '#7A3E48';
/**
 * The otvori mark from design/otvori-brand.html (32×32 grid): a QR finder square whose right side has swung open
 * toward the viewer. Frame stroke 3.2 (round joins), inner 8×8 square (radius 1.5), door hinged at x=24.5.
 */
const MARK_FRAME = 'M23 6H9a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14';
const MARK_DOOR = 'M24.5 6.4 30 2.2v27.6l-5.5-4.2z';

/** Draws the mark + "otvori" wordmark centred on `centerX`, with the text `size` points tall (the mark is 1.125× that). */
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

export function qrPng(url: string, width = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 2, width: 512, errorCorrectionLevel: 'M' });
}

export interface QrCard {
  label: string;
  url: string;
}

export interface QrSheetOptions {
  restaurantName: string;
  primaryColor: string;
  logo: Buffer | null;
  /** Shown in small print at the bottom of each card, e.g. the public menu host. */
  footer: string;
  cards: QrCard[];
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const GAP = 14;
const COLS = 2;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;

/** A4 sheet with 6 cut-out cards per page: logo, restaurant name, QR, table label, "Scan to view the menu", otvori wordmark. */
export async function renderQrSheet(options: QrSheetOptions): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: false,
    info: { Title: `${options.restaurantName} – table QR codes`, Author: 'otvori' },
  });
  doc.registerFont('Sans', FONT_REGULAR);
  doc.registerFont('SansBold', FONT_BOLD);
  doc.registerFont('Serif', FONT_SERIF);

  const done = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const cardW = (PAGE_W - 2 * MARGIN - GAP * (COLS - 1)) / COLS;
  const cardH = (PAGE_H - 2 * MARGIN - GAP * (ROWS - 1)) / ROWS;
  const qrImages = await Promise.all(options.cards.map((card) => qrPng(card.url, 512)));

  options.cards.forEach((card, index) => {
    if (index % PER_PAGE === 0) doc.addPage();
    const slot = index % PER_PAGE;
    const x = MARGIN + (slot % COLS) * (cardW + GAP);
    const y = MARGIN + Math.floor(slot / COLS) * (cardH + GAP);
    const innerX = x + 12;
    const innerW = cardW - 24;

    doc
      .save()
      .roundedRect(x, y, cardW, cardH, 12)
      .lineWidth(0.75)
      .dash(4, { space: 3 })
      .strokeColor('#C8C8C8')
      .stroke()
      .undash()
      .restore();

    let cursor = y + 16;
    if (options.logo) {
      doc.image(options.logo, x + cardW / 2 - 20, cursor, { fit: [40, 40], align: 'center', valign: 'center' });
      cursor += 46;
    }
    doc
      .font('SansBold')
      .fontSize(12)
      .fillColor(options.primaryColor)
      .text(options.restaurantName, innerX, cursor, { width: innerW, align: 'center', lineBreak: false, ellipsis: true });
    cursor += 22;

    const qrSize = Math.min(innerW - 40, cardH - (cursor - y) - 86);
    doc.image(qrImages[index]!, x + (cardW - qrSize) / 2, cursor, { width: qrSize, height: qrSize });
    cursor += qrSize + 8;

    doc
      .font('SansBold')
      .fontSize(14)
      .fillColor('#1F1F1F')
      .text(card.label, innerX, cursor, { width: innerW, align: 'center', lineBreak: false, ellipsis: true });
    cursor += 20;
    doc
      .font('Sans')
      .fontSize(9.5)
      .fillColor('#6B6B6B')
      .text('Scan to view the menu', innerX, cursor, { width: innerW, align: 'center', lineBreak: false });
    drawWordmark(doc, x + cardW / 2, y + cardH - 40, 11);
    doc
      .font('Sans')
      .fontSize(7.5)
      .fillColor('#9A9A9A')
      .text(options.footer, innerX, y + cardH - 20, { width: innerW, align: 'center', lineBreak: false, ellipsis: true });
  });

  if (options.cards.length === 0) {
    doc.addPage();
    doc.font('Sans').fontSize(12).fillColor('#444').text('No tables yet.', MARGIN, MARGIN);
  }

  doc.end();
  return done;
}

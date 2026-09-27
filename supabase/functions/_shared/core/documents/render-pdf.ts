// PDF renderer: DocumentSpec -> bytes. Works in Node, browsers, React Native and the Edge Function (pdf-lib is pure JS).
// Restricted to the standard Helvetica fonts (WinAnsi): text is sanitized so an unusual character can never crash a render.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { DocBlock, DocumentSpec } from './spec.ts';

const PAGE_W = 612;
const PAGE_H = 792;
const M = 54;
const CONTENT_W = PAGE_W - M * 2;
const INK = rgb(0.06, 0.06, 0.06);
const MUTED = rgb(0.38, 0.4, 0.38);
const RULE = rgb(0.8, 0.82, 0.78);
const LIME = rgb(0.66, 0.95, 0.17);

const KEEP = new Set(['–', '—', '‘', '’', '“', '”', '•', '…', '€', '™', '·']);
/** Maps text to what the standard PDF fonts can draw. */
export function toWinAnsi(input: string): string {
  let out = '';
  for (const ch of String(input ?? '')) {
    const code = ch.codePointAt(0)!;
    if (ch === '\n' || ch === '\t') out += ' ';
    else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || KEEP.has(ch)) out += ch;
    else if (ch === '☐') out += '[ ]';
    else if (ch === '☑' || ch === '✓' || ch === '✔') out += 'x';
    else if (ch === '→') out += '->';
    else if (ch === '✕' || ch === '✗') out += 'x';
    else out += '?';
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = toWinAnsi(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    let word = w;
    // Break a single word that is wider than the line (long URLs).
    while (font.widthOfTextAtSize(word, size) > maxWidth) {
      let cut = word.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function renderPdf(spec: DocumentSpec): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(spec.title));
  pdf.setAuthor('FairPath');
  pdf.setCreator('FairPath');
  pdf.setProducer('FairPath document engine');
  pdf.setSubject(toWinAnsi(spec.documentType));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const newPage = () => { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; };
  const ensure = (h: number) => { if (y - h < M + 24) newPage(); };
  const text = (s: string, x: number, size: number, f: PDFFont, color = INK) => {
    page.drawText(s, { x, y, size, font: f, color });
  };

  // Masthead
  page.drawRectangle({ x: M, y: y - 3, width: 28, height: 3, color: LIME });
  y -= 16;
  text('FAIRPATH', M, 8, bold, MUTED);
  y -= 22;

  for (const b of spec.blocks) drawBlock(b);

  function drawBlock(b: DocBlock) {
    switch (b.type) {
      case 'heading': {
        const size = b.level === 1 || !b.level ? 20 : b.level === 2 ? 13 : 11;
        const lines = wrap(b.text, bold, size, CONTENT_W);
        ensure(lines.length * (size + 4) + (b.level === 1 || !b.level ? 8 : 16));
        if (b.level && b.level > 1) y -= 12;
        for (const l of lines) { text(l, M, size, bold); y -= size + 4; }
        y -= 4;
        break;
      }
      case 'paragraph': {
        const lines = wrap(b.text, font, 10.5, CONTENT_W);
        for (const l of lines) { ensure(15); text(l, M, 10.5, font); y -= 15; }
        y -= 4;
        break;
      }
      case 'notice': {
        const lines = wrap(b.text, font, 9.5, CONTENT_W - 20);
        const h = lines.length * 13 + 14;
        ensure(h + 6);
        page.drawRectangle({ x: M, y: y - h + 10, width: CONTENT_W, height: h, color: rgb(0.96, 0.97, 0.94), borderColor: RULE, borderWidth: 0.5 });
        page.drawRectangle({ x: M, y: y - h + 10, width: 3, height: h, color: b.tone === 'warning' ? rgb(0.75, 0.5, 0.05) : LIME });
        let ly = y - 4;
        for (const l of lines) { page.drawText(l, { x: M + 12, y: ly, size: 9.5, font, color: INK }); ly -= 13; }
        y -= h + 8;
        break;
      }
      case 'keyvalue': {
        for (const item of b.items) {
          const lines = wrap(item.value, font, 10.5, CONTENT_W - 118);
          ensure(lines.length * 14 + 4);
          text(toWinAnsi(item.label).toUpperCase().slice(0, 22), M, 7.5, bold, MUTED);
          for (const l of lines) { text(l, M + 118, 10.5, font); y -= 14; }
          y -= 3;
        }
        y -= 2;
        break;
      }
      case 'bullets': {
        for (const item of b.items) {
          const lines = wrap(item, font, 10.5, CONTENT_W - 16);
          ensure(lines.length * 14 + 2);
          text('•', M + 2, 10.5, font);
          for (const l of lines) { text(l, M + 16, 10.5, font); y -= 14; }
          y -= 2;
        }
        y -= 2;
        break;
      }
      case 'checklist': {
        for (const item of b.items) {
          const lines = wrap(item.text, font, 10.5, CONTENT_W - 26);
          const note = item.note ? wrap(item.note, font, 8.5, CONTENT_W - 26) : [];
          ensure(lines.length * 14 + note.length * 11 + 6);
          page.drawRectangle({ x: M, y: y - 8, width: 10, height: 10, borderColor: INK, borderWidth: 0.8, color: item.checked ? LIME : undefined });
          for (const l of lines) { text(l, M + 20, 10.5, font); y -= 14; }
          for (const l of note) { text(l, M + 20, 8.5, font, MUTED); y -= 11; }
          y -= 4;
        }
        y -= 2;
        break;
      }
      case 'editable': {
        const lines = wrap(b.value || ' ', font, 10.5, CONTENT_W - 16);
        const h = lines.length * 14 + 12;
        ensure(h + 30);
        text(toWinAnsi(b.label).toUpperCase(), M, 7.5, bold, MUTED);
        y -= 10;
        page.drawRectangle({ x: M, y: y - h + 10, width: CONTENT_W, height: h, borderColor: RULE, borderWidth: 0.8 });
        let ly = y - 4;
        for (const l of lines) { page.drawText(l, { x: M + 8, y: ly, size: 10.5, font, color: INK }); ly -= 14; }
        y -= h + 4;
        if (b.hint) { for (const l of wrap(b.hint, font, 8.5, CONTENT_W)) { text(l, M, 8.5, font, MUTED); y -= 11; } }
        y -= 6;
        break;
      }
      case 'table': {
        const n = b.columns.length;
        const weights = b.columns.map((c, i) => Math.min(28, Math.max(8, ...[c, ...b.rows.map((r) => r[i] ?? '')].map((s) => s.length))));
        const total = weights.reduce((a, c) => a + c, 0);
        const widths = weights.map((w) => (w / total) * CONTENT_W);
        const size = n > 5 ? 8 : 9;
        const drawRow = (cells: string[], f: PDFFont, header: boolean) => {
          const wrapped = cells.map((c, i) => wrap(c, f, size, widths[i] - 8));
          const rows = Math.max(...wrapped.map((w) => w.length));
          const h = rows * (size + 3) + 8;
          ensure(h);
          let x = M;
          wrapped.forEach((lines, i) => {
            let ly = y - size - 2;
            for (const l of lines) { page.drawText(l, { x: x + 4, y: ly, size, font: f, color: header ? MUTED : INK }); ly -= size + 3; }
            x += widths[i];
          });
          y -= h;
          page.drawLine({ start: { x: M, y }, end: { x: M + CONTENT_W, y }, thickness: header ? 0.9 : 0.4, color: header ? INK : RULE });
        };
        drawRow(b.columns.map((c) => c.toUpperCase()), bold, true);
        for (const r of b.rows) drawRow(r, font, false);
        y -= 8;
        break;
      }
      case 'spacer':
        y -= 10;
        break;
    }
  }

  // Footer + page numbers on every page
  const pages = pdf.getPages();
  const footerLines = wrap(spec.footer, font, 7.5, CONTENT_W - 60);
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M - 6 }, end: { x: PAGE_W - M, y: M - 6 }, thickness: 0.4, color: RULE });
    footerLines.slice(0, 2).forEach((l, k) => p.drawText(l, { x: M, y: M - 18 - k * 9, size: 7.5, font, color: MUTED }));
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: PAGE_W - M - 50, y: M - 18, size: 7.5, font, color: MUTED });
  });

  return pdf.save();
}

// DOCX renderer: DocumentSpec -> bytes (editable in Word, Pages and Google Docs). Same spec as the PDF.
import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import type { DocBlock, DocumentSpec } from './spec.ts';

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const THIN = { style: BorderStyle.SINGLE, size: 4, color: 'C8CCC4' };

export function base64ToBytes(b64: string): Uint8Array {
  const g = globalThis as unknown as { atob?: (s: string) => string; Buffer?: { from(s: string, enc: string): Uint8Array } };
  if (g.Buffer) return new Uint8Array(g.Buffer.from(b64, 'base64'));
  const bin = g.atob!(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text, bold: o.bold, size: o.size ? o.size * 2 : undefined, color: o.color, italics: o.italics, font: 'Arial' });

function blockToChildren(b: DocBlock): (Paragraph | Table)[] {
  switch (b.type) {
    case 'heading':
      return [new Paragraph({
        heading: b.level === 2 ? HeadingLevel.HEADING_2 : b.level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_1,
        spacing: { before: b.level && b.level > 1 ? 280 : 0, after: 100 },
        children: [run(b.text, { bold: true, size: b.level === 2 ? 13 : b.level === 3 ? 11 : 20 })],
      })];
    case 'paragraph':
      return [new Paragraph({ spacing: { after: 100 }, children: [run(b.text, { size: 10.5 })] })];
    case 'notice':
      return [new Paragraph({
        spacing: { before: 60, after: 140 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F4F6EF' },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: b.tone === 'warning' ? 'BF800D' : 'A8F32C', space: 6 } },
        children: [run(b.text, { size: 9.5 })],
      })];
    case 'keyvalue':
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
        rows: b.items.map((i) => new TableRow({
          children: [
            new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [run(i.label.toUpperCase(), { bold: true, size: 7.5, color: '60665F' })] })] }),
            new TableCell({ width: { size: 78, type: WidthType.PERCENTAGE }, children: [new Paragraph({ spacing: { after: 40 }, children: [run(i.value, { size: 10.5 })] })] }),
          ],
        })),
      }), new Paragraph({ children: [] })];
    case 'bullets':
      return b.items.map((t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [run(t, { size: 10.5 })] }));
    case 'checklist':
      return b.items.flatMap((i) => [
        new Paragraph({ spacing: { after: i.note ? 0 : 60 }, children: [run((i.checked ? '☑ ' : '☐ ') + i.text, { size: 10.5 })] }),
        ...(i.note ? [new Paragraph({ indent: { left: 360 }, spacing: { after: 80 }, children: [run(i.note, { size: 8.5, color: '60665F' })] })] : []),
      ]);
    case 'editable':
      return [
        new Paragraph({ spacing: { before: 120 }, children: [run(b.label.toUpperCase(), { bold: true, size: 7.5, color: '60665F' })] }),
        new Paragraph({ border: { top: THIN, bottom: THIN, left: THIN, right: THIN }, spacing: { after: 60 }, children: [run(b.value || ' ', { size: 10.5 })] }),
        ...(b.hint ? [new Paragraph({ spacing: { after: 100 }, children: [run(b.hint, { size: 8.5, color: '60665F', italics: true })] })] : []),
      ];
    case 'table':
      return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: b.columns.map((c) => new TableCell({ borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [run(c.toUpperCase(), { bold: true, size: 8, color: '60665F' })] })] })) }),
          ...b.rows.map((r) => new TableRow({ children: r.map((cell) => new TableCell({ borders: { top: THIN, bottom: THIN, left: THIN, right: THIN }, children: [new Paragraph({ children: [run(cell, { size: 9 })] })] })) })),
        ],
      }), new Paragraph({ children: [] })];
    case 'spacer':
      return [new Paragraph({ children: [] })];
  }
}

export async function renderDocx(spec: DocumentSpec): Promise<Uint8Array> {
  const doc = new Document({
    creator: 'FairPath',
    title: spec.title,
    description: spec.documentType,
    sections: [{
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
      children: [
        new Paragraph({ children: [run('FAIRPATH', { bold: true, size: 8, color: '60665F' })], spacing: { after: 240 } }),
        ...spec.blocks.flatMap(blockToChildren),
      ],
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [run(spec.footer, { size: 7.5, color: '60665F' })] })] }),
      },
    }],
  });
  return base64ToBytes(await Packer.toBase64String(doc));
}

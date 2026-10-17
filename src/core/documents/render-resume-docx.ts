// Resume-only DOCX renderer. Separate from render-docx.ts (the shared letter/checklist engine) so resumes can have
// real color/layout templates without changing the plain look of Record Relief letters or credit dispute letters.
import {
  AlignmentType, BorderStyle, Document, Footer, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from 'docx';
import { base64ToBytes } from './bytes.ts';
import type { ResumeContent, ResumeTemplate } from '../resume/resume-types.ts';

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const DARK = '1A1F18';
const LIME = 'A8F32C';
const MUTED = '60665F';

const run = (text: string, o: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, bold: o.bold, size: o.size ? o.size * 2 : 21, color: o.color, font: 'Arial' });

function experienceParas(content: ResumeContent, accentColor: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const e of content.experience) {
    out.push(new Paragraph({ spacing: { before: 140, after: 20 }, children: [run(`${e.title || 'Role'} — ${e.employer || 'Employer'}`, { bold: true, size: 11 })] }));
    const dateLine = [e.location, `${e.start || ''}${e.start || e.end || e.current ? ' – ' : ''}${e.current ? 'Present' : e.end || ''}`].filter(Boolean).join('   ·   ');
    if (dateLine) out.push(new Paragraph({ spacing: { after: 60 }, children: [run(dateLine, { size: 8.5, color: MUTED })] }));
    for (const b of e.bullets.filter(Boolean)) out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [run(b, { size: 9.5 })] }));
  }
  return out;
}
function educationParas(content: ResumeContent): Paragraph[] {
  const out: Paragraph[] = [];
  for (const e of content.education) {
    out.push(new Paragraph({ spacing: { before: 60 }, children: [run(e.school || 'School', { bold: true, size: 10 })] }));
    const v = [e.credential, e.field, e.endYear].filter(Boolean).join(', ');
    if (v) out.push(new Paragraph({ spacing: { after: 40 }, children: [run(v, { size: 8.5, color: MUTED })] }));
  }
  return out;
}
function sectionHeading(label: string, accentColor: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C8CCC4', space: 2 } },
    children: [run(label.toUpperCase(), { bold: true, size: 10.5, color: accentColor })],
  });
}

function plainDoc(content: ResumeContent, compact: boolean): Paragraph[] {
  const gapAfter = compact ? 60 : 160;
  const out: Paragraph[] = [
    new Paragraph({ children: [run(content.contact.name || 'Your name', { bold: true, size: 20 })] }),
  ];
  const line1 = [content.contact.location, content.contact.phone, content.contact.email].filter(Boolean).join('   ·   ');
  if (line1) out.push(new Paragraph({ spacing: { after: gapAfter }, children: [run(line1, { size: 9.5, color: MUTED })] }));
  if (content.summary.trim()) out.push(new Paragraph({ spacing: { after: gapAfter }, children: [run(content.summary, { size: 10 })] }));
  if (content.experience.length) { out.push(sectionHeading('Experience', MUTED)); out.push(...experienceParas(content, MUTED)); }
  if (content.education.length) { out.push(sectionHeading('Education', MUTED)); out.push(...educationParas(content)); }
  if (content.skills.length) { out.push(sectionHeading('Skills', MUTED)); out.push(new Paragraph({ children: [run(content.skills.join('   ·   '), { size: 9.5 })] })); }
  if (content.credentials.length) {
    out.push(sectionHeading('Credentials & Certifications', MUTED));
    for (const c of content.credentials) out.push(new Paragraph({ spacing: { after: 30 }, children: [run([c.name, c.issuer, c.year].filter(Boolean).join('  ·  '), { size: 9.5 })] }));
  }
  return out;
}

function modernDoc(content: ResumeContent): Paragraph[] {
  const accent = '2E5C1F';
  const out: Paragraph[] = [
    new Paragraph({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: DARK },
      spacing: { after: 0 },
      children: [run(content.contact.name || 'Your name', { bold: true, size: 24, color: 'FFFFFF' })],
    }),
  ];
  const contactLine = [content.contact.location, content.contact.phone, content.contact.email].filter(Boolean).join('   ·   ');
  out.push(new Paragraph({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: DARK }, spacing: { after: 160 }, children: [run(contactLine, { size: 9, color: 'CBE8B8' })] }));
  if (content.summary.trim()) out.push(new Paragraph({ spacing: { after: 160 }, children: [run(content.summary, { size: 10 })] }));
  if (content.experience.length) { out.push(sectionHeading('Experience', accent)); out.push(...experienceParas(content, accent)); }
  if (content.education.length) { out.push(sectionHeading('Education', accent)); out.push(...educationParas(content)); }
  if (content.skills.length) { out.push(sectionHeading('Skills', accent)); out.push(new Paragraph({ children: [run(content.skills.join('   ·   '), { size: 9.5 })] })); }
  if (content.credentials.length) {
    out.push(sectionHeading('Credentials & Certifications', accent));
    for (const c of content.credentials) out.push(new Paragraph({ spacing: { after: 30 }, children: [run([c.name, c.issuer, c.year].filter(Boolean).join('  ·  '), { size: 9.5 })] }));
  }
  return out;
}

/** Bold: a single two-cell table (dark sidebar | main column) so the sidebar look survives in real Word/Pages. */
function boldTable(content: ResumeContent): Table {
  const sidebar: Paragraph[] = [
    new Paragraph({ children: [run(content.contact.name || 'Your name', { bold: true, size: 15, color: 'FFFFFF' })] }),
  ];
  for (const v of [content.contact.location, content.contact.phone, content.contact.email].filter(Boolean)) {
    sidebar.push(new Paragraph({ spacing: { after: 20 }, children: [run(v, { size: 8.5, color: 'CBE8B8' })] }));
  }
  if (content.skills.length) {
    sidebar.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [run('SKILLS', { bold: true, size: 8.5, color: LIME })] }));
    for (const sk of content.skills) sidebar.push(new Paragraph({ spacing: { after: 20 }, children: [run('• ' + sk, { size: 8.5, color: 'E6EFE0' })] }));
  }
  if (content.education.length) {
    sidebar.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [run('EDUCATION', { bold: true, size: 8.5, color: LIME })] }));
    for (const e of content.education) {
      sidebar.push(new Paragraph({ children: [run(e.school || 'School', { bold: true, size: 8.5, color: 'FFFFFF' })] }));
      const v = [e.credential, e.field, e.endYear].filter(Boolean).join(', ');
      if (v) sidebar.push(new Paragraph({ spacing: { after: 20 }, children: [run(v, { size: 7.5, color: 'CBE8B8' })] }));
    }
  }
  if (content.credentials.length) {
    sidebar.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [run('CREDENTIALS', { bold: true, size: 8.5, color: LIME })] }));
    for (const c of content.credentials) sidebar.push(new Paragraph({ spacing: { after: 20 }, children: [run([c.name, c.issuer, c.year].filter(Boolean).join(', '), { size: 7.5, color: 'E6EFE0' })] }));
  }

  const main: Paragraph[] = [];
  if (content.summary.trim()) main.push(new Paragraph({ spacing: { after: 160 }, children: [run(content.summary, { size: 10 })] }));
  if (content.experience.length) { main.push(sectionHeading('Experience', '2E5C1F')); main.push(...experienceParas(content, '2E5C1F')); }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: DARK }, verticalAlign: VerticalAlign.TOP, margins: { top: 200, bottom: 200, left: 150, right: 150 }, children: sidebar }),
      new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, margins: { top: 200, bottom: 200, left: 200, right: 100 }, children: main }),
    ] })],
  });
}

export async function renderResumeDocx(content: ResumeContent, template: ResumeTemplate): Promise<Uint8Array> {
  const footer = 'Prepared with FairPath Resume Studio. Content is written and confirmed by the member.';
  const children: (Paragraph | Table)[] = template === 'bold' ? [boldTable(content)] : template === 'modern' ? modernDoc(content) : plainDoc(content, template === 'compact');
  const doc = new Document({
    creator: 'FairPath',
    title: content.contact.name ? `${content.contact.name} — Resume` : 'Resume',
    description: 'resume',
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 900, left: 720, right: 720 } } },
      children,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [run(footer, { size: 7.5, color: MUTED })] })] }) },
    }],
  });
  return base64ToBytes(await Packer.toBase64String(doc));
}

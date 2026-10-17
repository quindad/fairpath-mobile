// Resume-only PDF renderer. Separate from render-pdf.ts (the shared letter/checklist engine used by every other
// document type) on purpose: resumes get real visual templates (color, columns) without risking the plain,
// printer-safe black-and-white look that Record Relief letters, credit disputes and the Opportunity Profile rely on.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { ResumeContent, ResumeTemplate } from '../resume/resume-types.ts';
import { toWinAnsi } from './render-pdf.ts';

const PAGE_W = 612;
const PAGE_H = 792;
const INK = rgb(0.06, 0.06, 0.06);
const MUTED = rgb(0.38, 0.4, 0.38);
const RULE = rgb(0.82, 0.84, 0.8);
const LIME = rgb(0.66, 0.95, 0.17);
const DARK = rgb(0.1, 0.12, 0.1);
const WHITE = rgb(1, 1, 1);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = toWinAnsi(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    let word = w;
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

type Ctx = {
  pdf: PDFDocument; font: PDFFont; bold: PDFFont;
  page: PDFPage; y: number; x: number; width: number; marginLeft: number; marginBottom: number;
  accent: ReturnType<typeof rgb>;
};

function newPage(ctx: Ctx, headerDraw?: (c: Ctx) => void) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - 54;
  ctx.x = ctx.marginLeft;
  if (headerDraw) headerDraw(ctx);
}
function ensure(ctx: Ctx, h: number, headerDraw?: (c: Ctx) => void) {
  if (ctx.y - h < ctx.marginBottom) newPage(ctx, headerDraw);
}
function text(ctx: Ctx, s: string, x: number, size: number, f: PDFFont, color = INK) {
  ctx.page.drawText(toWinAnsi(s), { x, y: ctx.y, size, font: f, color });
}

function heading(ctx: Ctx, label: string, size = 11.5, color?: ReturnType<typeof rgb>, headerDraw?: (c: Ctx) => void) {
  ensure(ctx, size + 14, headerDraw);
  text(ctx, label.toUpperCase(), ctx.x, size, ctx.bold, color ?? ctx.accent);
  ctx.y -= size + 6;
  ctx.page.drawLine({ start: { x: ctx.x, y: ctx.y + 4 }, end: { x: ctx.x + ctx.width, y: ctx.y + 4 }, thickness: 0.8, color: RULE });
  ctx.y -= 6;
}

function experienceBlock(ctx: Ctx, e: ResumeContent['experience'][number], headerDraw?: (c: Ctx) => void) {
  const titleLine = `${e.title || 'Role'} — ${e.employer || 'Employer'}`;
  const dateLine = [e.location, `${e.start || ''}${e.start || e.end || e.current ? ' – ' : ''}${e.current ? 'Present' : e.end || ''}`].filter(Boolean).join('   ·   ');
  ensure(ctx, 32, headerDraw);
  text(ctx, titleLine, ctx.x, 10.5, ctx.bold);
  ctx.y -= 13;
  if (dateLine) { text(ctx, dateLine, ctx.x, 8.5, ctx.font, MUTED); ctx.y -= 12; }
  for (const b of e.bullets.filter(Boolean)) {
    const lines = wrap(b, ctx.font, 9.5, ctx.width - 14);
    ensure(ctx, lines.length * 12 + 2, headerDraw);
    text(ctx, '•', ctx.x + 2, 9.5, ctx.font);
    for (const l of lines) { text(ctx, l, ctx.x + 13, 9.5, ctx.font); ctx.y -= 12; }
  }
  ctx.y -= 7;
}

/** Classic / Compact: single column, plain, no color — kept byte-for-byte in spirit with the original design. */
function renderPlain(pdf: PDFDocument, font: PDFFont, bold: PDFFont, content: ResumeContent, title: string, compact: boolean): void {
  const M = 54;
  const ctx: Ctx = { pdf, font, bold, page: pdf.addPage([PAGE_W, PAGE_H]), y: PAGE_H - M, x: M, width: PAGE_W - M * 2, marginLeft: M, marginBottom: M + 24, accent: MUTED };
  const gap = compact ? 10 : 18;
  text(ctx, content.contact.name || 'Your name', ctx.x, 20, bold);
  ctx.y -= 24;
  const line1 = [content.contact.location, content.contact.phone, content.contact.email].filter(Boolean).join('   ·   ');
  if (line1) { text(ctx, line1, ctx.x, 9.5, font, MUTED); ctx.y -= gap; }
  if (content.summary.trim()) {
    for (const l of wrap(content.summary, font, 10, ctx.width)) { ensure(ctx, 14); text(ctx, l, ctx.x, 10, font); ctx.y -= 14; }
    ctx.y -= gap;
  }
  if (content.experience.length) {
    heading(ctx, 'Experience');
    for (const e of content.experience) experienceBlock(ctx, e);
  }
  if (content.education.length) {
    heading(ctx, 'Education');
    for (const e of content.education) {
      ensure(ctx, 16);
      text(ctx, e.school || 'School', ctx.x, 10, bold);
      ctx.y -= 12;
      const v = [e.credential, e.field, e.endYear].filter(Boolean).join(', ');
      if (v) { text(ctx, v, ctx.x, 9, font, MUTED); ctx.y -= 13; }
      ctx.y -= 3;
    }
    ctx.y -= gap - 10;
  }
  if (content.skills.length) { heading(ctx, 'Skills'); for (const l of wrap(content.skills.join('   ·   '), font, 9.5, ctx.width)) { ensure(ctx, 13); text(ctx, l, ctx.x, 9.5, font); ctx.y -= 13; } ctx.y -= gap - 10; }
  if (content.credentials.length) {
    heading(ctx, 'Credentials & Certifications');
    for (const c of content.credentials) { ensure(ctx, 14); text(ctx, [c.name, c.issuer, c.year].filter(Boolean).join('  ·  '), ctx.x, 9.5, font); ctx.y -= 14; }
  }
}

/** Modern: a colored name band at the top, then a clean single column with accent-colored section rules. */
function renderModern(pdf: PDFDocument, font: PDFFont, bold: PDFFont, content: ResumeContent, title: string): void {
  const M = 54;
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: PAGE_H - 108, width: PAGE_W, height: 108, color: DARK });
  page.drawText(toWinAnsi(content.contact.name || 'Your name'), { x: M, y: PAGE_H - 58, size: 24, font: bold, color: WHITE });
  const contactLine = [content.contact.location, content.contact.phone, content.contact.email].filter(Boolean).join('   ·   ');
  if (contactLine) page.drawText(toWinAnsi(contactLine), { x: M, y: PAGE_H - 80, size: 9.5, font, color: rgb(0.8, 0.85, 0.75) });
  page.drawRectangle({ x: M, y: PAGE_H - 96, width: 28, height: 3, color: LIME });

  const ctx: Ctx = { pdf, font, bold, page, y: PAGE_H - 134, x: M, width: PAGE_W - M * 2, marginLeft: M, marginBottom: M + 24, accent: rgb(0.2, 0.45, 0.14) };
  const headerDraw = (c: Ctx) => { /* subsequent pages are plain, no repeated band */ };
  if (content.summary.trim()) { for (const l of wrap(content.summary, font, 10, ctx.width)) { ensure(ctx, 14, headerDraw); text(ctx, l, ctx.x, 10, font); ctx.y -= 14; } ctx.y -= 10; }
  if (content.experience.length) { heading(ctx, 'Experience', 11.5, undefined, headerDraw); for (const e of content.experience) experienceBlock(ctx, e, headerDraw); }
  if (content.education.length) {
    heading(ctx, 'Education', 11.5, undefined, headerDraw);
    for (const e of content.education) {
      ensure(ctx, 16, headerDraw);
      text(ctx, e.school || 'School', ctx.x, 10, bold); ctx.y -= 12;
      const v = [e.credential, e.field, e.endYear].filter(Boolean).join(', ');
      if (v) { text(ctx, v, ctx.x, 9, font, MUTED); ctx.y -= 13; }
      ctx.y -= 3;
    }
    ctx.y -= 8;
  }
  if (content.skills.length) { heading(ctx, 'Skills', 11.5, undefined, headerDraw); for (const l of wrap(content.skills.join('   ·   '), font, 9.5, ctx.width)) { ensure(ctx, 13, headerDraw); text(ctx, l, ctx.x, 9.5, font); ctx.y -= 13; } ctx.y -= 8; }
  if (content.credentials.length) {
    heading(ctx, 'Credentials & Certifications', 11.5, undefined, headerDraw);
    for (const c of content.credentials) { ensure(ctx, 14, headerDraw); text(ctx, [c.name, c.issuer, c.year].filter(Boolean).join('  ·  '), ctx.x, 9.5, font); ctx.y -= 14; }
  }
}

/** Bold: a full-height dark-green sidebar (contact, skills, education, credentials) + a wide right column for
 * summary and experience. The most visually distinct of the four. */
function renderBold(pdf: PDFDocument, font: PDFFont, bold: PDFFont, content: ResumeContent, title: string): void {
  const SIDEBAR_W = 184;
  const M = 24;
  const RIGHT_M = 54;
  function drawPage(): PDFPage {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: SIDEBAR_W, height: PAGE_H, color: DARK });
    return page;
  }
  let page = drawPage();
  let sy = PAGE_H - 50;
  const sideText = (s: string, size: number, f: PDFFont, color = WHITE) => { page.drawText(toWinAnsi(s), { x: M, y: sy, size, font: f, color }); };
  const sideWrap = (s: string, size: number, f: PDFFont, color = WHITE) => {
    for (const l of wrap(s, f, size, SIDEBAR_W - M * 2)) { sideText(l, size, f, color); sy -= size + 3; }
  };
  sideWrap(content.contact.name || 'Your name', 15, bold); sy -= 6;
  page.drawRectangle({ x: M, y: sy + 2, width: 24, height: 2.5, color: LIME }); sy -= 14;
  if (content.contact.location) { sideWrap(content.contact.location, 8.5, font, rgb(0.75, 0.8, 0.72)); }
  if (content.contact.phone) { sideWrap(content.contact.phone, 8.5, font, rgb(0.75, 0.8, 0.72)); }
  if (content.contact.email) { sideWrap(content.contact.email, 8.5, font, rgb(0.75, 0.8, 0.72)); }
  sy -= 10;
  if (content.skills.length) {
    sideText('SKILLS', 8.5, bold, LIME); sy -= 14;
    for (const sk of content.skills) sideWrap('• ' + sk, 8.5, font, rgb(0.9, 0.93, 0.87));
    sy -= 8;
  }
  if (content.education.length) {
    sideText('EDUCATION', 8.5, bold, LIME); sy -= 14;
    for (const e of content.education) {
      sideWrap(e.school || 'School', 8.5, bold, WHITE);
      const v = [e.credential, e.field, e.endYear].filter(Boolean).join(', ');
      if (v) sideWrap(v, 7.5, font, rgb(0.75, 0.8, 0.72));
      sy -= 5;
    }
    sy -= 4;
  }
  if (content.credentials.length) {
    sideText('CREDENTIALS', 8.5, bold, LIME); sy -= 14;
    for (const c of content.credentials) sideWrap([c.name, c.issuer, c.year].filter(Boolean).join(', '), 7.5, font, rgb(0.9, 0.93, 0.87));
  }

  const ctx: Ctx = { pdf, font, bold, page, y: PAGE_H - 50, x: SIDEBAR_W + RIGHT_M, width: PAGE_W - SIDEBAR_W - RIGHT_M - 36, marginLeft: SIDEBAR_W + RIGHT_M, marginBottom: 40, accent: rgb(0.2, 0.45, 0.14) };
  const headerDraw = (c: Ctx) => { c.page = page = drawPage(); c.y = PAGE_H - 50; };
  if (content.summary.trim()) { for (const l of wrap(content.summary, font, 10, ctx.width)) { ensure(ctx, 14, headerDraw); text(ctx, l, ctx.x, 10, font); ctx.y -= 14; } ctx.y -= 10; }
  if (content.experience.length) {
    heading(ctx, 'Experience', 11.5, undefined, headerDraw);
    for (const e of content.experience) experienceBlock(ctx, e, headerDraw);
  }
}

export async function renderResumePdf(content: ResumeContent, title: string, template: ResumeTemplate): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(content.contact.name ? `${content.contact.name} — Resume` : 'Resume'));
  pdf.setAuthor('FairPath'); pdf.setCreator('FairPath'); pdf.setProducer('FairPath document engine'); pdf.setSubject('resume');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  if (template === 'modern') renderModern(pdf, font, bold, content, title);
  else if (template === 'bold') renderBold(pdf, font, bold, content, title);
  else renderPlain(pdf, font, bold, content, title, template === 'compact');

  const footer = 'Prepared with FairPath Resume Studio. Content is written and confirmed by the member.';
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const sidebar = template === 'bold';
    const fx = sidebar ? 184 + 54 : 54;
    p.drawText(toWinAnsi(footer), { x: fx, y: 28, size: 7, font, color: MUTED });
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: PAGE_W - 54 - 50, y: 28, size: 7, font, color: MUTED });
  });

  return pdf.save();
}

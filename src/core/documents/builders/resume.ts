// Resume document builder. Pure: ResumeContent -> DocumentSpec. Prints exactly what the member wrote; invents nothing.
import type { DocBlock, DocumentSpec } from '../spec.ts';
import { documentTypeInfo } from '../document-types.ts';
import type { ResumeContent } from '../../resume/resume-types.ts';

const FOOTER = 'Prepared with FairPath Resume Studio. Content is written and confirmed by the member.';

export function buildResume(title: string, content: ResumeContent, now = new Date()): DocumentSpec {
  const info = documentTypeInfo('resume')!;
  const blocks: DocBlock[] = [
    { type: 'heading', text: content.contact.name || 'Your name', level: 1 },
    { type: 'paragraph', text: [content.contact.location, content.contact.phone, content.contact.email].filter(Boolean).join('  ·  ') },
  ];
  if (content.summary.trim()) blocks.push({ type: 'spacer' }, { type: 'heading', text: 'Summary', level: 2 }, { type: 'paragraph', text: content.summary });
  if (content.experience.length) {
    blocks.push({ type: 'spacer' }, { type: 'heading', text: 'Experience', level: 2 });
    for (const e of content.experience) {
      blocks.push({ type: 'heading', text: `${e.title || 'Role'} — ${e.employer || 'Employer'}`, level: 3 });
      blocks.push({ type: 'paragraph', text: [e.location, `${e.start || ''} – ${e.current ? 'Present' : e.end || ''}`].filter(Boolean).join('  ·  ') });
      if (e.bullets.filter(Boolean).length) blocks.push({ type: 'bullets', items: e.bullets.filter(Boolean) });
    }
  }
  if (content.education.length) {
    blocks.push({ type: 'spacer' }, { type: 'heading', text: 'Education', level: 2 });
    blocks.push({ type: 'keyvalue', items: content.education.map((e) => ({ label: e.school || 'School', value: [e.credential, e.field, e.endYear].filter(Boolean).join(', ') })) });
  }
  if (content.skills.length) blocks.push({ type: 'spacer' }, { type: 'heading', text: 'Skills', level: 2 }, { type: 'bullets', items: content.skills });
  if (content.credentials.length) {
    blocks.push({ type: 'spacer' }, { type: 'heading', text: 'Credentials & Certifications', level: 2 });
    blocks.push({ type: 'keyvalue', items: content.credentials.map((c) => ({ label: c.name || 'Credential', value: [c.issuer, c.year].filter(Boolean).join(', ') })) });
  }
  return {
    documentType: 'resume', sourceModule: info.module, sourceRecordId: null, templateId: info.templateId, templateVersion: info.templateVersion,
    title: content.contact.name ? `${content.contact.name} — Resume` : 'Resume', subject: title || 'Resume', audience: 'employer', sensitivity: info.sensitivity,
    kind: info.kind, formats: info.formats, blocks, confirmedDataAt: now.toISOString(), inputs: content, footer: FOOTER,
  };
}

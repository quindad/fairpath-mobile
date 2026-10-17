// Regression test for a real member-facing defect: ResumeContent has always stored and exported `education` and
// `credentials` (buildResume renders both into the PDF/DOCX, and importFromProfile silently populates both from
// the member's real member_education/member_credentials rows) -- but the resume editor screen
// (src/app/resume-studio/[id].tsx) never rendered either section, so a member could export a resume whose
// education/certification content they had never seen or could never correct. Fixed by adding Education and
// Certifications sections to the editor, mirroring the existing Experience section's UI. This test guards the
// data layer that fix now surfaces: both fields must round-trip through parseResumeContent and appear in the
// built document exactly as entered, never invented or dropped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResumeContent, EMPTY_RESUME_CONTENT, type ResumeContent } from '../src/core/resume/resume-types.ts';
import { buildResume } from '../src/core/documents/builders/resume.ts';

test('parseResumeContent round-trips education and credentials, not just experience', () => {
  const raw = {
    contact: { name: 'Jordan Test', email: 'jordan@example.com', phone: '', location: '' },
    summary: '', experience: [], skills: [],
    education: [{ school: '[TEST] Synthetic Community College', credential: 'A.A.', field: 'Business', endYear: '2019' }],
    credentials: [{ name: '[TEST] Synthetic Forklift Certification', issuer: 'Synthetic Training Co', year: '2021' }],
  };
  const parsed = parseResumeContent(raw);
  assert.deepEqual(parsed.education, [{ school: '[TEST] Synthetic Community College', credential: 'A.A.', field: 'Business', endYear: '2019' }]);
  assert.deepEqual(parsed.credentials, [{ name: '[TEST] Synthetic Forklift Certification', issuer: 'Synthetic Training Co', year: '2021' }]);
});

test('parseResumeContent never invents education/credentials when absent', () => {
  const parsed = parseResumeContent({ contact: { name: 'Jordan Test' } });
  assert.deepEqual(parsed.education, []);
  assert.deepEqual(parsed.credentials, []);
});

test('buildResume includes Education and Credentials sections in the exported document when present', () => {
  const content: ResumeContent = {
    ...EMPTY_RESUME_CONTENT,
    contact: { ...EMPTY_RESUME_CONTENT.contact, name: 'Jordan Test' },
    education: [{ school: '[TEST] Synthetic Community College', credential: 'A.A.', field: 'Business', endYear: '2019' }],
    credentials: [{ name: '[TEST] Synthetic Forklift Certification', issuer: 'Synthetic Training Co', year: '2021' }],
  };
  const spec = buildResume('Test resume', content);
  const headings = spec.blocks.filter((b) => b.type === 'heading').map((b) => (b as { text: string }).text);
  assert.ok(headings.includes('Education'), 'Education heading must appear when education entries exist');
  assert.ok(headings.includes('Credentials & Certifications'), 'Credentials heading must appear when credential entries exist');
  const eduBlock = spec.blocks.find((b) => b.type === 'keyvalue' && (b as { items: { label: string }[] }).items.some((i) => i.label === '[TEST] Synthetic Community College'));
  assert.ok(eduBlock, 'the exact school the member entered must appear in the built document, not a placeholder');
});

test('buildResume omits Education/Credentials headings entirely when both are empty, never a fake empty section', () => {
  const content: ResumeContent = { ...EMPTY_RESUME_CONTENT, contact: { ...EMPTY_RESUME_CONTENT.contact, name: 'Jordan Test' } };
  const spec = buildResume('Test resume', content);
  const headings = spec.blocks.filter((b) => b.type === 'heading').map((b) => (b as { text: string }).text);
  assert.ok(!headings.includes('Education'));
  assert.ok(!headings.includes('Credentials & Certifications'));
});

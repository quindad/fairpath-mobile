// Resume Studio content shape (pure, no imports). Stored as member_resumes.content, bounded to 20KB by the database.
// Nothing here is ever invented by FairPath: every field is either typed by the member or copied, once, from their
// own Opportunity Profile at the moment they choose to import it.
export type ResumeContact = { name: string; email: string; phone: string; location: string };
export type ResumeExperience = { title: string; employer: string; location: string; start: string; end: string; current: boolean; bullets: string[] };
export type ResumeEducation = { school: string; credential: string; field: string; endYear: string };
export type ResumeCredential = { name: string; issuer: string; year: string };
export type ResumeContent = {
  contact: ResumeContact;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
  credentials: ResumeCredential[];
};

export const EMPTY_RESUME_CONTENT: ResumeContent = {
  contact: { name: '', email: '', phone: '', location: '' },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  credentials: [],
};

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const arr = <T,>(v: unknown, max: number, map: (x: unknown) => T): T[] => (Array.isArray(v) ? v.slice(0, max).map(map) : []);

/** Reads whatever is stored back into a well-shaped object, never trusting the JSON blindly. */
export function parseResumeContent(raw: unknown): ResumeContent {
  const o = (raw && typeof raw === 'object' ? raw as Record<string, unknown> : {});
  const c = (o.contact && typeof o.contact === 'object' ? o.contact as Record<string, unknown> : {});
  return {
    contact: { name: str(c.name, 120), email: str(c.email, 254), phone: str(c.phone, 40), location: str(c.location, 120) },
    summary: str(o.summary, 800),
    experience: arr(o.experience, 12, (x) => {
      const e = (x && typeof x === 'object' ? x as Record<string, unknown> : {});
      return { title: str(e.title, 120), employer: str(e.employer, 120), location: str(e.location, 120), start: str(e.start, 40), end: str(e.end, 40), current: e.current === true, bullets: arr(e.bullets, 8, (b) => str(b, 300)) };
    }),
    education: arr(o.education, 8, (x) => {
      const e = (x && typeof x === 'object' ? x as Record<string, unknown> : {});
      return { school: str(e.school, 120), credential: str(e.credential, 120), field: str(e.field, 120), endYear: str(e.endYear, 8) };
    }),
    skills: arr(o.skills, 40, (s) => str(s, 60)).filter(Boolean),
    credentials: arr(o.credentials, 12, (x) => {
      const e = (x && typeof x === 'object' ? x as Record<string, unknown> : {});
      return { name: str(e.name, 120), issuer: str(e.issuer, 120), year: str(e.year, 8) };
    }),
  };
}

export const RESUME_TEMPLATES: { value: 'classic' | 'compact'; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'compact', label: 'Compact' },
];

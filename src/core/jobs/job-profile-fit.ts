import type { Job } from '@/core/jobs/jobs-service.ts';

export type ProfileFitInputs = {
  skills: string[];
  desiredTitles: string[];
  employmentTypes: string[];
  workplaceTypes: string[];
  zipCode: string | null;
  credentialNames: string[];
};

export type ProfileFitResult = {
  score: number;
  band: 'strong' | 'moderate' | 'explore';
  reasons: string[];
  gaps: string[];
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+/#\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenOverlap(a: string, b: string): boolean {
  const ta = new Set(norm(a).split(' ').filter((x) => x.length > 2));
  const tb = norm(b).split(' ').filter((x) => x.length > 2);
  return tb.some((t) => ta.has(t) || [...ta].some((x) => x.includes(t) || t.includes(x)));
}

/** Deterministic, explainable fit — not a background check and not an auto-reject. */
export function evaluateJobProfileFit(job: Job, member: ProfileFitInputs): ProfileFitResult {
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const jobSkillNeed = [...(job.skills ?? []), ...(job.requirements ?? [])].join(' ');
  const memberSkills = member.skills.map((s) => norm(s));
  let skillHits = 0;
  for (const need of job.skills ?? []) {
    if (memberSkills.some((s) => tokenOverlap(s, need))) {
      skillHits += 1;
      reasons.push(`Your skills include something related to “${need}”.`);
    }
  }
  if ((job.skills?.length ?? 0) > 0 && skillHits === 0) {
    gaps.push('Add skills that match this job posting, or highlight related experience.');
  }
  score += Math.min(40, skillHits * 12);

  const title = norm(job.title);
  for (const want of member.desiredTitles) {
    if (tokenOverlap(want, job.title)) {
      score += 25;
      reasons.push(`This role aligns with your career interest: ${want}.`);
      break;
    }
  }
  if (member.desiredTitles.length && !reasons.some((r) => r.includes('career interest'))) {
    gaps.push('Your career interests may not mention this kind of role yet.');
  }

  if (member.employmentTypes.includes(job.employment_type)) {
    score += 10;
    reasons.push('The schedule type matches what you said you want.');
  } else if (member.employmentTypes.length) {
    gaps.push('Double-check employment type (full-time vs part-time) fits your preferences.');
  }

  if (job.workplace_type === 'remote' && member.workplaceTypes.includes('remote')) {
    score += 10;
    reasons.push('You prefer remote work and this job allows it.');
  } else if (job.workplace_type !== 'remote' && member.workplaceTypes.includes('on_site')) {
    score += 5;
  }

  if (member.zipCode && job.postal_code && member.zipCode.slice(0, 3) === job.postal_code.slice(0, 3)) {
    score += 10;
    reasons.push('You are searching near this job’s area.');
  }

  for (const cred of member.credentialNames) {
    if (tokenOverlap(cred, jobSkillNeed)) {
      score += 8;
      reasons.push(`Your credential “${cred}” relates to something in this posting.`);
      break;
    }
  }

  if (job.background_policy_summary?.toLowerCase().includes('fair chance')) {
    reasons.push('This employer mentions a fair-chance or individualized review approach.');
    score += 5;
  }

  const band: ProfileFitResult['band'] = score >= 55 ? 'strong' : score >= 30 ? 'moderate' : 'explore';
  if (!reasons.length) {
    reasons.push('Complete your Opportunity Profile to see clearer reasons this job may fit.');
  }

  return { score: Math.min(100, score), band, reasons: [...new Set(reasons)].slice(0, 6), gaps: [...new Set(gaps)].slice(0, 4) };
}

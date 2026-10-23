import { buildStudyPlan, COMPANION_ACTIONS, type StudyPlan } from './learning-companion.ts';
import type { Enrollment, NativeCourse } from './enrollment.ts';

/** Consent-aware Signal entry for Academy lessons — no automatic AI charge. */
export function academySignalWorksheetPrompt(lessonTitle: string, reflectPrompt: string): string {
  return `Startup Academy worksheet — ${lessonTitle}. Help me think through this reflect prompt in plain language (no legal or financial advice): ${reflectPrompt}`;
}

export function signalWorksheetConsentLine(): string {
  const pending = COMPANION_ACTIONS.filter((a) => a.status === 'pending_approval').map((a) => a.label);
  return `Signal opens with built-in guidance first. AI-heavy companion actions${pending.length ? ` (${pending.join(', ')})` : ''} stay off until founder approval and may use credits when enabled.`;
}

export function studyPlanForLesson(course: NativeCourse, enrollment: Enrollment, passed: boolean): StudyPlan {
  return buildStudyPlan(course, enrollment, passed);
}

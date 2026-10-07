// Academy learning companion, foundation. Builds a study plan from real enrollment progress, deterministically.
// No AI call is made here, so no credits are debited. Any AI-generated companion action must declare its cost, and any
// cost not in the frozen specification is marked 'pending_approval' and cannot be charged until the founder approves it.

import { progressPercent, type Enrollment, type NativeCourse } from './enrollment.ts';

export type StudyStep = { id: string; text: string; kind: 'lesson' | 'assessment' | 'review' };

export type StudyPlan = {
  courseId: string;
  percentComplete: number;
  steps: StudyStep[];
};

/** Next steps in order: unfinished required lessons, then the assessment if all lessons are done and not yet passed. */
export function buildStudyPlan(course: NativeCourse, enrollment: Enrollment, passed: boolean): StudyPlan {
  const steps: StudyStep[] = [];
  for (const lesson of course.lessons) {
    if (!lesson.required) continue;
    if (!enrollment.completedLessonIds.includes(lesson.id)) {
      steps.push({ id: `lesson-${lesson.id}`, text: `Finish: ${lesson.title}`, kind: 'lesson' });
    }
  }
  const lessonsDone = steps.length === 0;
  if (lessonsDone && !passed) {
    steps.push({ id: 'assessment', text: 'Take the assessment', kind: 'assessment' });
  }
  if (lessonsDone && passed) {
    steps.push({ id: 'review', text: 'Review what you learned, then record completion', kind: 'review' });
  }
  return { courseId: course.id, percentComplete: progressPercent(course, enrollment), steps };
}

export type CompanionAction = {
  id: string;
  label: string;
  creditCost: number | null; // null means not yet approved
  status: 'included' | 'pending_approval';
};

/**
 * Companion actions and their billing status. Only actions already in the frozen schedule may be charged. Anything else
 * is shown as pending approval and carries no cost.
 */
export const COMPANION_ACTIONS: readonly CompanionAction[] = [
  { id: 'study_plan', label: 'Build a study plan', creditCost: null, status: 'included' },
  { id: 'explain_concept', label: 'Explain a difficult concept', creditCost: null, status: 'pending_approval' },
  { id: 'practice_quiz', label: 'Generate practice questions', creditCost: null, status: 'pending_approval' },
];

export function chargeableNow(action: CompanionAction): boolean {
  return action.status === 'included' && action.creditCost !== null;
}

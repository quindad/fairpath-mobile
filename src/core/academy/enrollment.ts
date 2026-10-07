// Native course enrollment and progress. Pure logic; persistence is a separate server-backed step.
// Certificates of completion are issued only for FairPath-authored courses when every required lesson is complete and the
// final assessment is passed. External-provider courses never receive a FairPath certificate. Nothing is backdated.

export type Lesson = { id: string; title: string; required: boolean };

export type NativeCourse = {
  id: string;
  title: string;
  authoredBy: 'fairpath' | 'external';
  lessons: readonly Lesson[];
  assessmentPassPercent: number; // e.g. 80
};

export type AssessmentAttempt = { courseId: string; score: number; maxScore: number; attemptedAt: string };

export type Enrollment = {
  courseId: string;
  enrolledAt: string;
  completedLessonIds: string[];
  bookmarked: boolean;
  attempts: AssessmentAttempt[];
  completedAt: string | null;
};

export function enroll(course: NativeCourse, nowIso: string, existing: Enrollment | null): Enrollment {
  if (existing) return existing;
  return { courseId: course.id, enrolledAt: nowIso, completedLessonIds: [], bookmarked: false, attempts: [], completedAt: null };
}

export function completeLesson(course: NativeCourse, enrollment: Enrollment, lessonId: string): Enrollment {
  if (!course.lessons.some((l) => l.id === lessonId)) return enrollment;
  if (enrollment.completedLessonIds.includes(lessonId)) return enrollment;
  return { ...enrollment, completedLessonIds: [...enrollment.completedLessonIds, lessonId] };
}

export function progressPercent(course: NativeCourse, enrollment: Enrollment): number {
  const required = course.lessons.filter((l) => l.required);
  if (required.length === 0) return 0;
  const done = required.filter((l) => enrollment.completedLessonIds.includes(l.id)).length;
  return Math.round((done / required.length) * 100);
}

export function scoreAttempt(course: NativeCourse, score: number, maxScore: number, attemptedAt: string): AssessmentAttempt | null {
  if (!(maxScore > 0) || score < 0 || score > maxScore) return null;
  return { courseId: course.id, score, maxScore, attemptedAt };
}

export function passed(course: NativeCourse, attempt: AssessmentAttempt): boolean {
  return (attempt.score / attempt.maxScore) * 100 >= course.assessmentPassPercent;
}

/** Certificate eligibility. Explicit, auditable, and never granted for external courses. */
export function certificateEligible(course: NativeCourse, enrollment: Enrollment): { eligible: true } | { eligible: false; reason: string } {
  if (course.authoredBy !== 'fairpath') return { eligible: false, reason: 'external_course' };
  if (progressPercent(course, enrollment) < 100) return { eligible: false, reason: 'lessons_incomplete' };
  const best = enrollment.attempts.filter((a) => a.courseId === course.id);
  if (!best.some((a) => passed(course, a))) return { eligible: false, reason: 'assessment_not_passed' };
  return { eligible: true };
}

export function complete(course: NativeCourse, enrollment: Enrollment, nowIso: string): Enrollment {
  if (enrollment.completedAt) return enrollment;
  return certificateEligible(course, enrollment).eligible ? { ...enrollment, completedAt: nowIso } : enrollment;
}

import { STARTUP_ACADEMY_TRACK, type TrackProgress } from '../entrepreneurship/tracks.ts';
import type { Enrollment, NativeCourse } from './enrollment.ts';

/** FairPath-authored Startup Academy as a native course for learning-companion study plans. */
export const STARTUP_ACADEMY_COURSE: NativeCourse = {
  id: 'fairpath-startup-academy',
  title: 'Startup Academy',
  authoredBy: 'fairpath',
  assessmentPassPercent: 80,
  lessons: STARTUP_ACADEMY_TRACK.map((step) => ({ id: step.id, title: step.title, required: true })),
};

const TRACK_STEP_IDS = new Set(STARTUP_ACADEMY_COURSE.lessons.map((l) => l.id));

export function enrollmentFromStartupTrack(track: TrackProgress, enrolledAt: string): Enrollment {
  const completedLessonIds = track.completedSteps.filter((id) => TRACK_STEP_IDS.has(id));
  return {
    courseId: STARTUP_ACADEMY_COURSE.id,
    enrolledAt,
    completedLessonIds,
    bookmarked: false,
    attempts: [],
    completedAt: completedLessonIds.length === STARTUP_ACADEMY_COURSE.lessons.length ? enrolledAt : null,
  };
}

export function startupTrackFullyComplete(track: TrackProgress): boolean {
  return STARTUP_ACADEMY_COURSE.lessons.every((l) => track.completedSteps.includes(l.id as (typeof track.completedSteps)[number]));
}

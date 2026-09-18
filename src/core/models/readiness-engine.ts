import type { FairPathReadiness, ReadinessArea, ReadinessAreaProgress } from './readiness';
import {
  getRequiredVisibleQuestions,
  type ProfileQuestion,
} from './profile-questions';

const AREAS: ReadinessArea[] = [
  'identity',
  'employment',
  'housing',
  'reentry',
  'documents',
  'eligibility',
];

function hasAnswer(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function areaProgress(
  area: ReadinessArea,
  questions: ProfileQuestion[],
  answers: Record<string, unknown>,
): ReadinessAreaProgress {
  const areaQuestions = questions.filter((question) => question.area === area);
  const completedRequired = areaQuestions.filter((question) =>
    hasAnswer(answers[question.id]),
  ).length;
  const totalRequired = areaQuestions.length;
  const percentage =
    totalRequired === 0
      ? 100
      : Math.round((completedRequired / totalRequired) * 100);

  return {
    area,
    completedRequired,
    totalRequired,
    percentage,
    status:
      percentage === 100
        ? 'complete'
        : percentage === 0
          ? 'not_started'
          : 'in_progress',
  };
}

export function calculateFairPathReadiness(
  answers: Record<string, unknown>,
  updatedAt = new Date().toISOString(),
): FairPathReadiness {
  const requiredQuestions = getRequiredVisibleQuestions(answers);
  const areas = AREAS.map((area) =>
    areaProgress(area, requiredQuestions, answers),
  );

  const completed = requiredQuestions.filter((question) =>
    hasAnswer(answers[question.id]),
  ).length;
  const overallPercentage =
    requiredQuestions.length === 0
      ? 100
      : Math.round((completed / requiredQuestions.length) * 100);

  const nextRequiredQuestionId =
    requiredQuestions.find((question) => !hasAnswer(answers[question.id]))?.id ??
    null;

  return {
    overallPercentage,
    areas,
    nextRequiredQuestionId,
    updatedAt,
  };
}

export type ReadinessUnlock = {
  area: ReadinessArea;
  title: string;
  description: string;
};

export const READINESS_UNLOCKS: ReadinessUnlock[] = [
  {
    area: 'identity',
    title: 'Faster autofill',
    description: 'Reuse confirmed profile information instead of typing it again.',
  },
  {
    area: 'employment',
    title: 'Better job matches',
    description: 'Improve job recommendations and application readiness.',
  },
  {
    area: 'housing',
    title: 'Better housing matches',
    description: 'Improve housing compatibility screening and application readiness.',
  },
  {
    area: 'reentry',
    title: 'A stronger FairPath Forward plan',
    description: 'Personalize pre-release and community reentry planning.',
  },
  {
    area: 'documents',
    title: 'Document readiness',
    description: 'See what documents you have and what may still be needed.',
  },
  {
    area: 'eligibility',
    title: 'More accurate opportunity screening',
    description: 'Help FairPath screen opportunities and available programs using the information you provide.',
  },
];

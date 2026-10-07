// DEVELOPMENT FIXTURE: a FairPath-authored native course for exercising enrollment, lessons, quiz and certificate flows.
// It is not a real course, has no real credential, and must be replaced by authored content before launch.
// The answer key lives here only because this is a fixture; real assessments must be scored server-side.

import type { NativeCourse } from './enrollment.ts';

export type QuizQuestion = { id: string; prompt: string; choices: readonly string[]; correctIndex: number };

export const NATIVE_FIXTURE_COURSE: NativeCourse & { quiz: readonly QuizQuestion[] } = {
  id: 'fx-native-budget-101',
  title: 'Budget basics (DEV fixture, not a real course)',
  authoredBy: 'fairpath',
  assessmentPassPercent: 67,
  lessons: [
    { id: 'l1', title: 'Track what comes in and goes out', required: true },
    { id: 'l2', title: 'Build a simple monthly plan', required: true },
    { id: 'l3', title: 'Optional: save for surprise costs', required: false },
  ],
  quiz: [
    { id: 'q1', prompt: 'Why track income and spending?', choices: ['To see where money goes', 'To avoid paying bills', 'To raise a credit score directly'], correctIndex: 0 },
    { id: 'q2', prompt: 'A simple monthly plan starts with:', choices: ['Guessing expenses', 'Listing income first', 'Opening new cards'], correctIndex: 1 },
    { id: 'q3', prompt: 'An emergency buffer is for:', choices: ['Unexpected costs', 'Luxury purchases only', 'Investing in stocks'], correctIndex: 0 },
  ],
};

/** Scores quiz answers. Unanswered questions count as incorrect. Returns integer counts only. */
export function scoreQuiz(questions: readonly QuizQuestion[], answers: readonly (number | null)[]): { correct: number; total: number } {
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) correct += 1;
  });
  return { correct, total: questions.length };
}

// Generic quiz scoring, extracted out of what used to be a single fake fixture course file. This logic
// itself is real and reusable for any future real FairPath-run assessment; it just isn't tied to any
// specific course content.

export type QuizQuestion = { id: string; prompt: string; choices: readonly string[]; correctIndex: number };

/** Scores quiz answers. Unanswered questions count as incorrect. Returns integer counts only. */
export function scoreQuiz(questions: readonly QuizQuestion[], answers: readonly (number | null)[]): { correct: number; total: number } {
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) correct += 1;
  });
  return { correct, total: questions.length };
}

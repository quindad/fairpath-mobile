export type ReadinessArea =
  | 'identity'
  | 'employment'
  | 'housing'
  | 'reentry'
  | 'documents'
  | 'eligibility';

export type ReadinessStatus = 'not_started' | 'in_progress' | 'complete';

export type ReadinessAreaProgress = {
  area: ReadinessArea;
  completedRequired: number;
  totalRequired: number;
  percentage: number;
  status: ReadinessStatus;
};

export type FairPathReadiness = {
  overallPercentage: number;
  areas: ReadinessAreaProgress[];
  nextRequiredQuestionId: string | null;
  updatedAt: string;
};

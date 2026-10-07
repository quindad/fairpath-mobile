// Experian integration boundary — placeholder only. No use case is mapped yet. This module exists so a future,
// explicitly-approved Experian product can be wired in through an adapter, the same pattern as FoxHire and Checkr.
// It intentionally exposes NOTHING related to employment screening or hiring decisions. Do not add such a function
// here without a separate, explicit founder decision identifying the exact approved Experian product and use case.

export type ExperianUseCase = 'not_yet_mapped';

export const EXPERIAN_STATUS: { useCase: ExperianUseCase; note: string } = {
  useCase: 'not_yet_mapped',
  note: 'Experian is not connected to any FairPath workflow yet. Its product and use case must be identified and approved before an adapter is implemented.',
};

/** This module must never export an employment-screening or hiring-decision function. Checked by a test. */
export const BANNED_EXPORT_PATTERNS = [/screen/i, /hire/i, /reject/i, /employment/i, /background/i];

import type { EngineFacts } from './engine-executor.ts';
import { todayIso } from './relief-format.ts';

/** Case-row fields that feed jurisdiction engines (shared manual entry + saved rows). */
export type ReliefCaseFactRow = {
  fines_paid: boolean | null;
  restitution_paid: boolean | null;
  other_convictions_count: number | null;
  pending_charges: boolean | null;
  is_juvenile: boolean;
};

/** Maps persisted case inputs into the shared engine fact bag (today + cross-jurisdiction aliases). */
export function caseRowToEngineFacts(c: ReliefCaseFactRow, asOf = new Date()): EngineFacts {
  const facts: EngineFacts = { today: todayIso(asOf) };
  if (c.is_juvenile) facts.isJuvenile = true;
  if (c.pending_charges !== null) {
    facts.pendingProceeding = c.pending_charges;
    facts.pendingCharges = c.pending_charges;
  }
  if (c.other_convictions_count !== null) {
    facts.otherFelonyConvictions = c.other_convictions_count;
    facts.applicationFelonyCount = c.other_convictions_count;
  }
  if (c.fines_paid !== null && c.restitution_paid !== null) {
    facts.allFinesFeesRestitutionPaid = c.fines_paid && c.restitution_paid;
  }
  return facts;
}

// Pure helpers (no imports) so audit scripts can execute them directly under Node.

export type InquiryTimes = {
  created_at: string;
  received_at?: string | null;
  seen_at?: string | null;
  responded_at?: string | null;
  reply_read_at?: string | null;
};
export type InquiryStage = 'sent' | 'received' | 'seen' | 'replied';

/**
 * A stage is reached ONLY when the server has recorded its timestamp. "received" and "seen" are written by the
 * partner-side functions; the app never infers them, so an unanswered inquiry honestly reads SENT.
 */
export function inquiryStages(q: InquiryTimes): { stage: InquiryStage; at: string | null; reached: boolean }[] {
  return [
    { stage: 'sent', at: q.created_at, reached: true },
    { stage: 'received', at: q.received_at ?? null, reached: Boolean(q.received_at) },
    { stage: 'seen', at: q.seen_at ?? null, reached: Boolean(q.seen_at) },
    { stage: 'replied', at: q.responded_at ?? null, reached: Boolean(q.responded_at) },
  ];
}

export function currentInquiryStage(q: InquiryTimes): InquiryStage {
  const reached = inquiryStages(q).filter((s) => s.reached);
  return reached[reached.length - 1].stage;
}

/** A reply the applicant has not opened yet. */
export function hasUnreadReply(q: InquiryTimes): boolean {
  return Boolean(q.responded_at) && !q.reply_read_at;
}

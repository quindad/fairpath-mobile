import { PROMISE_PATTERN } from '@/core/credit/credit-format';
import { supabase } from '@/lib/supabase';

/**
 * Client side of FairPath Signal (the member-facing AI). This file never calls a model provider directly.
 * It asks the server, which spends a real AI credit via spend_ai_credits() before doing anything else and
 * runs every response through the gateway's decision-language guard. Before any text is shown, this client
 * also refuses wording that promises a score change, a successful dispute, or expungement.
 */
export type SignalResult =
  | { status: 'ok'; text: string; modelAssisted: boolean }
  | { status: 'signed_out' }
  | { status: 'out_of_credits' }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string };

async function invokeSignal(fn: string, body: Record<string, unknown>, fallbackMessage: string): Promise<SignalResult> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401) return { status: 'signed_out' };
    if (status === 402) return { status: 'out_of_credits' };
    if (status === 503) return { status: 'rate_limited' };
    return { status: 'error', message: fallbackMessage };
  }
  if (typeof data?.text !== 'string') return { status: 'error', message: fallbackMessage };
  // The server guard is the backstop once deployed. This check is what the app enforces on the text it
  // actually shows, including a reply from a server that has not yet picked up the tighter pattern.
  if (PROMISE_PATTERN.test(data.text)) return { status: 'error', message: fallbackMessage };
  return { status: 'ok', text: data.text, modelAssisted: Boolean(data.modelAssisted) };
}

export function explainJobFit(jobId: string): Promise<SignalResult> {
  return invokeSignal('job-fit-explanation', { job_id: jobId }, 'Signal could not explain this job right now. Please try again.');
}

export function prepareForInterview(jobId: string): Promise<SignalResult> {
  return invokeSignal('interview-prep', { job_id: jobId }, 'Signal could not prepare interview tips right now. Please try again.');
}

export function prepareHousingApplication(listingId: string): Promise<SignalResult> {
  return invokeSignal('housing-application-prep', { listing_id: listingId }, 'Signal could not prepare application tips right now. Please try again.');
}

export function prepareForMeeting(meetingId: string): Promise<SignalResult> {
  return invokeSignal('meeting-prep', { meeting_id: meetingId }, 'Signal could not prepare meeting tips right now. Please try again.');
}

export function getFocusGuidance(): Promise<SignalResult> {
  return invokeSignal('member-focus-guidance', {}, 'Signal could not look at your activity right now. Please try again.');
}

export function getBusinessIdeaFeedback(idea: string, currentStep?: string): Promise<SignalResult> {
  return invokeSignal('business-idea-feedback', { idea, current_step: currentStep ?? '' }, 'Signal could not look at this right now. Please try again.');
}

export function translateVeteranExperience(duties: string, branch?: string): Promise<SignalResult> {
  return invokeSignal('veteran-experience-translation', { duties, branch: branch ?? '' }, 'Signal could not help with this right now. Please try again.');
}

export function draftMarketplaceListing(title: string, notes: string, category?: string, condition?: string): Promise<SignalResult> {
  return invokeSignal('marketplace-listing-draft', { title, notes, category: category ?? '', condition: condition ?? '' }, 'Signal could not draft this description right now. Please try again.');
}

export function askAboutLesson(lessonTitle: string, lessonBody: string, question: string): Promise<SignalResult> {
  return invokeSignal('academy-lesson-question', { lesson_title: lessonTitle, lesson_body: lessonBody, question }, 'Signal could not answer that right now. Please try again.');
}

export function explainHousingFit(listingId: string): Promise<SignalResult> {
  return invokeSignal('housing-fit-explanation', { listing_id: listingId }, 'Signal could not explain this home right now. Please try again.');
}

export function getResourceGuidance(situation: string): Promise<SignalResult> {
  return invokeSignal('resource-guidance', { situation }, 'Signal could not look at this right now. Please try again.');
}

export function explainReliefCase(caseId: string): Promise<SignalResult> {
  return invokeSignal('record-relief-explanation', { case_id: caseId }, 'Signal could not explain this case right now. Please try again.');
}

export function explainCreditItem(itemId: string): Promise<SignalResult> {
  return invokeSignal('credit-report-explanation', { item_id: itemId }, 'Signal could not explain this item right now. Please try again.');
}

export function explainCreditReport(): Promise<SignalResult> {
  return invokeSignal('credit-report-explanation', {}, 'Signal could not explain your report right now. Please try again.');
}

export function draftResumeBullets(jobTitle: string, employer: string, bullets: string[], targetRole?: string): Promise<SignalResult> {
  return invokeSignal('resume-bullet-draft', { job_title: jobTitle, employer, bullets, target_role: targetRole ?? '' }, 'Signal could not improve these bullets right now. Please try again.');
}

export function draftDisputeLetter(itemIds: string[], targetKind: 'bureau' | 'furnisher', targetName: string): Promise<SignalResult> {
  return invokeSignal('dispute-letter-draft', { item_ids: itemIds, target_kind: targetKind, target_name: targetName }, 'Signal could not draft this letter right now. Please try again.');
}

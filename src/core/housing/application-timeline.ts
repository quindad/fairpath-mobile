/** Member-visible housing application timeline.
 * Partner updates may skip review or tour, and a denial or withdrawal is not the approval path.
 * A step is complete only when the current status or an event proves the application reached it.
 */

export type HousingTimelineState = 'done' | 'current' | 'upcoming';

export type HousingTimelineStep = {
  key: 'submitted' | 'reviewing' | 'tour' | 'decision';
  label: string;
  body: string;
  state: HousingTimelineState;
};

export type HousingTimelineEvent = {
  event_type: string;
  metadata?: Record<string, unknown> | null;
};

const PROGRESS = ['submitted', 'reviewing', 'tour'] as const;
type ProgressStage = (typeof PROGRESS)[number];

const PROGRESS_COPY: Record<ProgressStage, { label: string; body: string }> = {
  submitted: { label: 'Submitted', body: 'FairPath received your completed application.' },
  reviewing: { label: 'Property review', body: 'Property review and any required screening happen here.' },
  tour: { label: 'Tour / next step', body: 'A tour, clarification, or other property-specific next step may be requested.' },
};

const EVENT_LABEL: Record<string, string> = {
  started: 'DRAFT STARTED',
  submitted: 'APPLICATION SUBMITTED',
  reviewing: 'PROPERTY REVIEW STARTED',
  tour: 'TOUR / NEXT STEP',
  approved: 'APPLICATION APPROVED',
  denied: 'APPLICATION NOT APPROVED',
  withdrawn: 'APPLICATION WITHDRAWN',
};

function addStage(reached: Set<string>, value: unknown) {
  if (typeof value === 'string' && value.length > 0) reached.add(value);
}

function reachedStages(status: string, events: readonly HousingTimelineEvent[]): Set<string> {
  const reached = new Set<string>();
  addStage(reached, status);
  if ((PROGRESS as readonly string[]).includes(status) || status === 'approved' || status === 'denied' || status === 'withdrawn') {
    reached.add('submitted');
  }
  for (const event of events) {
    addStage(reached, event.event_type);
    addStage(reached, event.metadata?.from);
    addStage(reached, event.metadata?.to);
  }
  return reached;
}

function decisionStep(status: string): HousingTimelineStep {
  if (status === 'approved') {
    return { key: 'decision', label: 'Approved', body: 'The property team approved this application.', state: 'current' };
  }
  if (status === 'denied') {
    return { key: 'decision', label: 'Not approved', body: 'The property team did not approve this application.', state: 'current' };
  }
  if (status === 'withdrawn') {
    return { key: 'decision', label: 'Withdrawn', body: 'You withdrew this application.', state: 'current' };
  }
  return { key: 'decision', label: 'Decision', body: 'The property owner or manager records the final application decision.', state: 'upcoming' };
}

export function housingApplicationTimeline(status: string, events: readonly HousingTimelineEvent[] = []): HousingTimelineStep[] {
  const reached = reachedStages(status, events);
  const terminal = status === 'approved' || status === 'denied' || status === 'withdrawn';
  const progressIndex = (PROGRESS as readonly string[]).indexOf(status);

  const steps: HousingTimelineStep[] = PROGRESS.map((key, index) => {
    let state: HousingTimelineState = 'upcoming';
    if (!terminal && progressIndex >= 0) {
      state = index < progressIndex ? 'done' : index === progressIndex ? 'current' : 'upcoming';
    } else if (reached.has(key)) {
      state = 'done';
    }
    return { key, ...PROGRESS_COPY[key], state };
  });

  return [...steps, decisionStep(status)];
}

export function housingApplicationEventLabel(event: HousingTimelineEvent): string {
  if (event.event_type === 'provider_status_change') {
    const to = typeof event.metadata?.to === 'string' ? event.metadata.to : '';
    return EVENT_LABEL[to] ?? 'PROPERTY STATUS UPDATED';
  }
  return EVENT_LABEL[event.event_type] ?? event.event_type.replaceAll('_', ' ').toUpperCase();
}

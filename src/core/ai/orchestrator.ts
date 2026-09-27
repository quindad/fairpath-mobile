// FairPath AI orchestrator (pure logic over an injected, allow-listed, READ-ONLY gateway).
//
// Design rules (audited):
//   * The orchestrator never touches the database, never imports a service that writes, and never edits a record.
//     It sees only what the gateway exposes (summaries, the member's own review items/cases/completion) for the task.
//   * Its actions are navigation only: deep links into real FairPath workflows. Consequential changes always happen in
//     those workflows, with the member's confirmation.
//   * Every answer part says WHERE it comes from: a source-backed rule, information the member provided, a value read
//     from a file, the app's own state, or an AI interpretation. Today there is no model, so nothing is "ai".
//   * A model adapter may only rephrase the wording of a deterministic answer. If it is missing, slow or fails, the
//     deterministic answer is used unchanged: no workflow depends on AI being available.
//   * It never tells a member to dispute something because it is negative, never promises an outcome, and never states
//     an eligibility determination.
import { matchIntent, type IntentId } from './intents.ts';
import { nextSteps, type MemberSummary } from '../profile/next-step.ts';
import { OUTCOME_INFO, countdownText } from '../record-relief/relief-format.ts';
import { STAGE_INFO, ISSUE_LABEL } from '../credit/credit-format.ts';

export type Basis = 'rule' | 'member' | 'extracted' | 'app_state' | 'ai';
export type AnswerPart = { text: string; basis: Basis };
export type AiAction = { label: string; route: string; primary?: boolean };
export type SourceRef = { kind: 'resource' | 'credit_item' | 'credit_account' | 'credit_dispute' | 'relief_case' | 'relief_evaluation' | 'profile_section' | 'document' | 'summary' | 'notification'; id: string };
export type Provenance = {
  task: string; intent: string; engine: 'deterministic_router' | 'model'; route: string | null; sourceRefs: SourceRef[];
  ruleVersions: { rule_key: string; rule_version: number }[]; officialSources: { label: string; url: string }[];
  confidence: 'deterministic' | 'high' | 'medium' | 'low' | 'unavailable';
};
export type AiResponse = { intent: IntentId; title: string; parts: AnswerPart[]; actions: AiAction[]; provenance: Provenance; modelAssisted: boolean };

/** The ONLY data the assistant may read. Implemented by src/core/ai/gateway.ts with read-only loaders. */
export type AiGateway = {
  signedIn(): Promise<boolean>;
  summary(): Promise<MemberSummary>;
  profileCompletion(): Promise<{ section_key: string; label: string; is_complete: boolean; sort_order: number }[]>;
  needs(text: string): Promise<{ need_slug: string; label: string; urgent: boolean }[]>;
  creditItems(): Promise<{ id: string; account_id: string | null; stage: keyof typeof STAGE_INFO; issue_type: string; title: string; explanation: string; origin: string }[]>;
  creditAccountsToConfirm(): Promise<number>;
  reliefCases(): Promise<{ id: string; label: string }[]>;
  reliefEvaluations(): Promise<{ case_id: string; id: string; outcome: keyof typeof OUTCOME_INFO; eligibility_date: string | null; days_remaining: number | null; rule_key: string | null; rule_version: number | null }[]>;
};

export type ModelAdapter = {
  available(): Promise<boolean>;
  /** May only rephrase; it receives the deterministic parts and must return text of the same facts. */
  rephrase(intent: IntentId, parts: AnswerPart[]): Promise<string | null>;
};
/** No model is connected in this build. */
export const NO_MODEL: ModelAdapter = { available: async () => false, rephrase: async () => null };

export type AssistantContext = { routeHint?: { kind: 'credit_item'; id: string } | null; adapter?: ModelAdapter };

const SEARCH_OFFICIAL: { label: string; url: string }[] = [];
const CREDIT_SOURCES = [{ label: 'CFPB: credit reports and scores', url: 'https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/' }];

function base(task: string, intent: IntentId, route: string | null, extra: Partial<Provenance> = {}): Provenance {
  return { task, intent, engine: 'deterministic_router', route, sourceRefs: [], ruleVersions: [], officialSources: SEARCH_OFFICIAL, confidence: 'deterministic', ...extra };
}
const enc = encodeURIComponent;

export const CAPABILITIES: AiAction[] = [
  { label: 'Find help near me', route: '/resources' }, { label: 'Finish my profile', route: '/opportunity-profile' }, { label: 'Review my credit', route: '/credit' },
  { label: 'Record relief cases', route: '/record-relief' }, { label: 'My documents', route: '/documents' }, { label: 'My next steps', route: '/me' },
];

export async function answer(text: string, gw: AiGateway, ctx: AssistantContext = {}): Promise<AiResponse> {
  const { intent } = matchIntent(text);
  const id: IntentId = intent?.id ?? 'help';
  const task = intent?.task ?? 'navigation';
  let res: AiResponse;

  try {
    res = await build(id, task, text, gw, ctx);
  } catch {
    // A gateway/network failure never breaks the assistant: it says so and offers the plain workflows.
    res = {
      intent: 'help', title: 'I could not load that right now', modelAssisted: false, actions: CAPABILITIES,
      parts: [{ text: 'Something went wrong while looking at your information. Nothing was changed. You can open any of these directly.', basis: 'app_state' }],
      provenance: base('navigation', 'help', null, { confidence: 'unavailable' }),
    };
  }

  // Optional wording help from a model. It can only rephrase; facts, actions and provenance stay exactly as computed.
  const adapter = ctx.adapter;
  if (adapter) {
    try {
      if (await adapter.available()) {
        const reworded = await adapter.rephrase(res.intent, res.parts);
        if (reworded && reworded.trim().length > 0 && reworded.length < 1200) {
          res = { ...res, parts: [...res.parts.map((p) => p), { text: reworded.trim(), basis: 'ai' }], modelAssisted: true, provenance: { ...res.provenance, engine: 'model', confidence: 'medium' } };
        }
      }
    } catch { /* deterministic answer stands */ }
  }
  return res;
}

async function build(id: IntentId, task: string, text: string, gw: AiGateway, ctx: AssistantContext): Promise<AiResponse> {
  switch (id) {
    case 'safety':
      return {
        intent: id, title: 'If you are in danger, get help now', modelAssisted: false,
        parts: [
          { text: 'If you are in immediate danger, call 911. If you are thinking about harming yourself, you can call or text 988 (the Suicide and Crisis Lifeline in the U.S.) at any time.', basis: 'rule' },
          { text: 'FairPath can also show safe places, food, and shelter that were verified recently.', basis: 'app_state' },
        ],
        actions: [{ label: 'I need help today', route: '/resources?urgent=1', primary: true }],
        provenance: base('navigation', id, '/resources?urgent=1'),
      };

    case 'need_shelter':
      return {
        intent: id, title: 'Let\'s find somewhere for tonight', modelAssisted: false,
        parts: [{ text: 'I will open help-today results: shelter, meals and emergency help that FairPath verified recently. Call ahead if you can, and check the hours shown.', basis: 'app_state' }],
        actions: [{ label: 'Show help for tonight', route: '/resources?urgent=1&q=' + enc('somewhere to stay'), primary: true }, { label: 'Search all resources', route: '/resources' }],
        provenance: base('resource_search', id, '/resources?urgent=1&q=somewhere%20to%20stay'),
      };

    case 'find_resources': {
      const needs = await gw.needs(text);
      if (!needs.length) return help(text);
      const urgent = needs.some((n) => n.urgent);
      const route = '/resources?q=' + enc(text.slice(0, 80)) + (urgent ? '&urgent=1' : '');
      return {
        intent: id, title: 'Here is where to look', modelAssisted: false,
        parts: [{ text: `That sounds like: ${needs.map((n) => n.label).join(', ')}. I will search FairPath's verified resources for it.`, basis: 'app_state' }],
        actions: [{ label: 'Search resources', route, primary: true }],
        provenance: base('resource_search', id, route),
      };
    }

    case 'finish_profile': {
      if (!(await gw.signedIn())) return signInNeeded(id, 'profile_help');
      const sections = await gw.profileCompletion();
      const done = sections.filter((s) => s.is_complete).length;
      const next = [...sections].sort((a, b) => a.sort_order - b.sort_order).find((s) => !s.is_complete);
      if (!next) return { intent: id, title: 'Your profile is complete', modelAssisted: false, parts: [{ text: `All ${sections.length} sections are complete. You can export it or attach it to an application.`, basis: 'member' }], actions: [{ label: 'Open my profile', route: '/opportunity-profile', primary: true }], provenance: base('profile_help', id, '/opportunity-profile', { sourceRefs: [{ kind: 'summary', id: 'profile' }] }) };
      return {
        intent: id, title: 'Let\'s finish your profile', modelAssisted: false,
        parts: [{ text: `${done} of ${sections.length} sections are complete. The next one is: ${next.label}.`, basis: 'app_state' }, { text: 'Only you can add this information. I will open the right screen.', basis: 'app_state' }],
        actions: [{ label: 'Continue: ' + next.label, route: '/opportunity-profile', primary: true }],
        provenance: base('profile_help', id, '/opportunity-profile', { sourceRefs: [{ kind: 'profile_section', id: next.section_key }] }),
      };
    }

    case 'credit_review': {
      if (!(await gw.signedIn())) return signInNeeded(id, 'credit_explain');
      const s = await gw.summary();
      const toConfirm = await gw.creditAccountsToConfirm();
      const items = await gw.creditItems();
      const open = items.filter((i) => i.stage === 'possible_inaccuracy').length;
      const parts: AnswerPart[] = [];
      if (!(s.credit?.reports ?? 0)) parts.push({ text: 'You have not added a credit report yet. You can upload one or enter accounts yourself. FairPath does not pull your credit for you.', basis: 'app_state' });
      else {
        parts.push({ text: `You have ${s.credit?.reports ?? 0} report(s). ${toConfirm} account(s) need your review, and ${open} possible issue(s) are waiting for you.`, basis: 'app_state' });
        parts.push({ text: 'Negative information that is accurate is not a reason to dispute. FairPath only helps with things that may be wrong, and you decide what is.', basis: 'rule' });
      }
      return { intent: id, title: 'Your credit workspace', modelAssisted: false, parts, actions: [{ label: 'Open Credit Builder', route: '/credit', primary: true }],
        provenance: base('credit_explain', id, '/credit', { sourceRefs: [{ kind: 'summary', id: 'credit' }], officialSources: CREDIT_SOURCES }) };
    }

    case 'credit_why_flagged': {
      if (!(await gw.signedIn())) return signInNeeded(id, 'credit_explain');
      const items = await gw.creditItems();
      const pick = (ctx.routeHint?.kind === 'credit_item' ? items.find((i) => i.id === ctx.routeHint!.id) : null) ?? items.find((i) => i.stage === 'possible_inaccuracy') ?? items[0];
      if (!pick) return { intent: id, title: 'Nothing is flagged', modelAssisted: false, parts: [{ text: 'FairPath has not flagged anything for you to review.', basis: 'app_state' }], actions: [{ label: 'Open Credit Builder', route: '/credit' }], provenance: base('credit_explain', id, '/credit') };
      return {
        intent: id, title: pick.title, modelAssisted: false,
        parts: [
          { text: `${ISSUE_LABEL[pick.issue_type] ?? 'Flagged item'}: ${pick.explanation}`, basis: pick.origin === 'member' ? 'member' : 'rule' },
          { text: STAGE_INFO[pick.stage].explain, basis: 'rule' },
          { text: 'This is a question for you, not a finding. Check it against your own records.', basis: 'app_state' },
        ],
        actions: [{ label: 'Review this item', route: '/credit/item/' + pick.id, primary: true }],
        provenance: base('credit_explain', id, '/credit/item/' + pick.id, { sourceRefs: [{ kind: 'credit_item', id: pick.id }, ...(pick.account_id ? [{ kind: 'credit_account' as const, id: pick.account_id }] : [])], officialSources: CREDIT_SOURCES }),
      };
    }

    case 'credit_build_dispute': {
      if (!(await gw.signedIn())) return signInNeeded(id, 'dispute_help');
      const items = await gw.creditItems();
      const confirmed = items.filter((i) => i.stage === 'confirmed_dispute_issue');
      if (!confirmed.length) {
        return { intent: id, title: 'A letter starts from an issue you confirm', modelAssisted: false,
          parts: [{ text: 'You have no confirmed issues yet. A dispute letter is built only from something YOU have confirmed is inaccurate, in your own words. FairPath will not write one for accurate information.', basis: 'rule' }],
          actions: [{ label: 'Review my items', route: '/credit', primary: true }], provenance: base('dispute_help', id, '/credit') };
      }
      return { intent: id, title: 'Ready to build a dispute', modelAssisted: false,
        parts: [{ text: `You have ${confirmed.length} confirmed issue(s). I will open the dispute builder. You review and edit everything before any letter exists, and FairPath does not send it.`, basis: 'member' }],
        actions: [{ label: 'Start a dispute', route: '/credit/new-dispute', primary: true }],
        provenance: base('dispute_help', id, '/credit/new-dispute', { sourceRefs: confirmed.slice(0, 20).map((i) => ({ kind: 'credit_item' as const, id: i.id })), officialSources: CREDIT_SOURCES }) };
    }

    case 'relief_can_i_clear':
    case 'relief_paperwork': {
      if (!(await gw.signedIn())) return signInNeeded(id, 'relief_explain');
      const cases = await gw.reliefCases();
      const legal = { text: 'This is legal information, not legal advice. Record-relief rules are specific to each jurisdiction, and a court decides.', basis: 'rule' as Basis };
      if (!cases.length) {
        return { intent: id, title: 'Let\'s look at your record', modelAssisted: false,
          parts: [{ text: id === 'relief_paperwork' ? 'Paperwork depends on the case and the jurisdiction. Add your case and FairPath will show the verified forms and steps that exist for it, or say plainly when it has none.' : 'Whether relief may be possible depends on your jurisdiction, the offense and the dates. Add a case and FairPath will check it only against rules that were verified from an official source.', basis: 'app_state' }, legal],
          actions: [{ label: 'Add a case', route: '/record-relief/add', primary: true }], provenance: base('relief_explain', id, '/record-relief/add') };
      }
      const c = cases[0];
      return { intent: id, title: id === 'relief_paperwork' ? 'Your paperwork' : 'Your case', modelAssisted: false,
        parts: [{ text: id === 'relief_paperwork' ? 'Each case shows its verified steps, documents to gather, official forms (only with a verified source), and a filing packet you can build.' : 'Each case shows what FairPath can and cannot check, the rule and version used, and any countdown.', basis: 'app_state' }, legal],
        actions: [{ label: 'Open ' + c.label, route: '/record-relief/case/' + c.id, primary: true }, ...(cases.length > 1 ? [{ label: 'All my cases', route: '/record-relief' }] : [])],
        provenance: base('relief_explain', id, '/record-relief/case/' + c.id, { sourceRefs: [{ kind: 'relief_case', id: c.id }] }) };
    }

    case 'relief_when_eligible': {
      if (!(await gw.signedIn())) return signInNeeded(id, 'relief_countdown');
      const evals = (await gw.reliefEvaluations()).filter((e) => e.outcome === 'waiting_period' || e.outcome === 'potentially_eligible_now');
      if (!evals.length) {
        return { intent: id, title: 'No countdown yet', modelAssisted: false,
          parts: [{ text: 'FairPath has no waiting-period result for you yet. A countdown appears when a case matches a verified rule and has the dates it needs.', basis: 'app_state' }],
          actions: [{ label: 'My cases', route: '/record-relief', primary: true }], provenance: base('relief_countdown', id, '/record-relief') };
      }
      const soonest = [...evals].sort((a, b) => String(a.eligibility_date ?? '0').localeCompare(String(b.eligibility_date ?? '0')))[0];
      const line = soonest.outcome === 'potentially_eligible_now' ? 'A waiting period appears to have ended under a verified rule. That is not a determination: review the case.' : countdownText('waiting_period', soonest.eligibility_date, soonest.days_remaining);
      return { intent: id, title: 'Your countdown', modelAssisted: false,
        parts: [{ text: line, basis: 'rule' }, { text: 'The date comes from the verified rule and the dates you entered. Open the case to see which rule and version created it.', basis: 'app_state' }],
        actions: [{ label: 'Open the case', route: '/record-relief/case/' + soonest.case_id, primary: true }],
        provenance: base('relief_countdown', id, '/record-relief/case/' + soonest.case_id, { sourceRefs: [{ kind: 'relief_case', id: soonest.case_id }, { kind: 'relief_evaluation', id: soonest.id }],
          ruleVersions: soonest.rule_key && soonest.rule_version ? [{ rule_key: soonest.rule_key, rule_version: soonest.rule_version }] : [] }) };
    }

    case 'next_steps': {
      if (!(await gw.signedIn())) return signInNeeded(id, 'next_steps');
      const steps = nextSteps(await gw.summary());
      if (!steps.length) return { intent: id, title: 'You are up to date', modelAssisted: false, parts: [{ text: 'Nothing needs your attention right now.', basis: 'app_state' }], actions: [{ label: 'Find help near me', route: '/resources' }], provenance: base('next_steps', id, null, { sourceRefs: [{ kind: 'summary', id: 'home' }] }) };
      return { intent: id, title: 'Your next steps', modelAssisted: false,
        parts: steps.slice(0, 3).map((s, k) => ({ text: `${k + 1}. ${s.title}. ${s.body}`, basis: 'app_state' as Basis })),
        actions: steps.slice(0, 3).map((s, k) => ({ label: s.title, route: s.route, primary: k === 0 })),
        provenance: base('next_steps', id, steps[0].route, { sourceRefs: [{ kind: 'summary', id: 'home' }] }) };
    }

    case 'housing_requirements':
      return { intent: id, title: 'What to bring', modelAssisted: false,
        parts: [{ text: 'Every resource and housing program lists what to bring on its page. Save the ones you like and FairPath combines the required documents into one checklist you can print.', basis: 'app_state' }],
        actions: [{ label: 'Search housing help', route: '/resources?q=' + enc('housing'), primary: true }, { label: 'My saved resources', route: '/saved-resources' }, { label: 'What-to-bring checklist', route: '/documents/create?type=resource_required_documents' }],
        provenance: base('resource_search', id, '/resources?q=housing') };

    case 'documents':
      return { intent: id, title: 'Your documents', modelAssisted: false,
        parts: [{ text: 'My Documents shows what FairPath can prepare, the versions you made, and export options. Files stay private until you download or share them.', basis: 'app_state' }],
        actions: [{ label: 'Open My Documents', route: '/documents', primary: true }], provenance: base('document_help', id, '/documents') };

    default:
      return help(text);
  }
}

function help(_text: string): AiResponse {
  return {
    intent: 'help', title: 'Here is what I can help with', modelAssisted: false, actions: CAPABILITIES,
    parts: [{ text: 'I can point you to real FairPath tools using your own information: finding help, finishing your profile, reviewing credit, checking a record-relief case, and preparing documents. Try one of the suggestions, or open a tool below.', basis: 'app_state' }],
    provenance: base('navigation', 'help', null),
  };
}

function signInNeeded(id: IntentId, task: string): AiResponse {
  return {
    intent: id, title: 'Sign in to continue', modelAssisted: false,
    parts: [{ text: 'This uses your own saved information, so you need to be signed in. Nothing is shared until you do.', basis: 'app_state' }],
    actions: [{ label: 'Sign in', route: '/sign-in', primary: true }], provenance: base(task, id, '/sign-in', { confidence: 'unavailable' }),
  };
}

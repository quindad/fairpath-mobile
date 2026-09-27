// Educational content for the Credit workspace. Pure data.
//
// RULES: these are plain-language orientation notes, not legal advice, and they never state a specific statute,
// deadline or fee as fact. Every card points to the official source, which controls. Nothing here promises a result.
export type EducationCard = {
  id: string;
  title: string;
  body: string;
  source: { label: string; url: string };
};

export const CREDIT_EDUCATION: EducationCard[] = [
  {
    id: 'get_reports',
    title: 'Get your own reports first',
    body: 'Start from your real credit reports so you are working with what the bureaus actually show. Free reports are available through the official site listed below.',
    source: { label: 'AnnualCreditReport.com (official free reports)', url: 'https://www.annualcreditreport.com' },
  },
  {
    id: 'accurate_negative',
    title: 'Negative does not mean wrong',
    body: 'A late payment or collection that is accurate generally stays on your report for the period the rules allow. Disputes are for information that is wrong, incomplete or not yours. FairPath will not tell you to dispute something only because it is negative.',
    source: { label: 'CFPB: credit reports and scores', url: 'https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/' },
  },
  {
    id: 'how_disputes_work',
    title: 'How a dispute generally works',
    body: 'You tell the bureau (and often the company that reported the information) what you believe is wrong and why. They look into it and respond. The result can be that the item is corrected, removed, or verified as accurate. No one can promise which.',
    source: { label: 'CFPB: how to dispute an error on a credit report', url: 'https://www.consumerfinance.gov/ask-cfpb/how-do-i-dispute-an-error-on-my-credit-report-en-314/' },
  },
  {
    id: 'keep_records',
    title: 'Keep copies and a paper trail',
    body: 'Keep a copy of everything you send, note the date and how you sent it, and save any reference or tracking number. FairPath\'s tracker stores the dates and reminders you enter; it does not send anything for you.',
    source: { label: 'FTC: disputing errors on credit reports', url: 'https://consumer.ftc.gov/articles/disputing-errors-credit-reports' },
  },
  {
    id: 'not_yours',
    title: 'If an account is not yours',
    body: 'If an account does not belong to you, it may be a mistake or a sign of identity theft. The official identity-theft resources explain your options and how to report it.',
    source: { label: 'IdentityTheft.gov (FTC)', url: 'https://www.identitytheft.gov' },
  },
  {
    id: 'no_quick_fix',
    title: 'Be careful with promises',
    body: 'No company can legitimately guarantee that accurate negative items will be deleted or that your score will rise by a set amount. Be cautious of anyone who says otherwise or asks for large upfront fees.',
    source: { label: 'FTC: credit repair scams', url: 'https://consumer.ftc.gov/articles/credit-repair-how-help-yourself' },
  },
];

export function safeSourceUrls(): string[] {
  return CREDIT_EDUCATION.map((c) => c.source.url);
}

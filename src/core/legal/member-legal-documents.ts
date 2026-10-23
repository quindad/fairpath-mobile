import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/core/profile/consent-service';

export type LegalDocumentReviewStatus = 'draft_principles';

export type LegalDocumentSection = { heading: string; body: string };

export type MemberLegalDocument = {
  slug: 'terms' | 'privacy';
  title: string;
  version: string;
  /** Published reference URL (website); not a substitute for counsel-approved member-app legal text. */
  canonicalUrl: string;
  reviewStatus: LegalDocumentReviewStatus;
  reviewNotice: string;
  sections: LegalDocumentSection[];
};

/**
 * Member-app legal copy for consent version v1. Wording is aligned with the public FairPath website pages
 * (fairpathfwd.com/terms and /privacy) as of sync — not independently verified as final binding legal text.
 * Founder / counsel must review before treating acceptance as production-ready compliance.
 */
const REVIEW_NOTICE =
  'This is the same draft product language shown on fairpathfwd.com (not final counsel-approved Terms or Privacy Policy). FairPath has not represented here that this text is legally sufficient for your jurisdiction or use case.';

const TERMS_V1: MemberLegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  version: CURRENT_TERMS_VERSION,
  canonicalUrl: 'https://www.fairpathfwd.com/terms',
  reviewStatus: 'draft_principles',
  reviewNotice: REVIEW_NOTICE,
  sections: [
    {
      heading: 'Public information and tools',
      body: 'FairPath public pages and tools provide product information and general informational guidance. They are not a substitute for legal, financial, housing, employment, or other professional advice.',
    },
    {
      heading: 'Record Relief results',
      body: 'A public Record Relief result is an informational screening result based on the rules and sources available to the tool. Optional AI document analysis only extracts visible case details; it does not judge legal eligibility. You must verify and correct extracted details, and even a possible application window is not a court order, legal representation, or guarantee that relief will be granted.',
    },
    {
      heading: 'Employment and housing',
      body: 'FairPath does not promise that a person will be hired, housed, screened successfully, or approved by an organization. Employers and housing providers retain their own decision authority subject to the rules that apply to them.',
    },
    {
      heading: 'Product availability',
      body: 'A page can describe a planned feature or pathway only when its status is stated clearly. Planned products are not purchases, enrollments, or guarantees of a future launch date.',
    },
    {
      heading: 'Acceptable use',
      body: 'You should not misuse public tools, attempt unauthorized access, submit information you are not entitled to submit, or use FairPath to impersonate another person or organization.',
    },
    {
      heading: 'Changes and contact',
      body: 'The website and apps can change as products, providers, and launch terms are confirmed. Material launch terms should be updated before a purchase or enrollment action is enabled. Questions can be sent through the Contact page on fairpathfwd.com.',
    },
    {
      heading: 'FairPath Mobile member workspace',
      body: 'When you use the FairPath mobile member workspace, you choose which workflows to run (jobs, housing, documents, Signal, and related tools). Features may depend on third-party providers and on information you provide. FairPath does not guarantee outcomes from applications, listings, AI-assisted drafts, or record-relief information.',
    },
  ],
};

const PRIVACY_V1: MemberLegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  version: CURRENT_PRIVACY_VERSION,
  canonicalUrl: 'https://www.fairpathfwd.com/privacy',
  reviewStatus: 'draft_principles',
  reviewNotice: REVIEW_NOTICE,
  sections: [
    {
      heading: 'Public website data',
      body: 'The public website can receive information someone deliberately submits through a public tool or contact workflow. Basic analytics may be added when a provider is configured. The website should not claim analytics collection that has not actually been enabled.',
    },
    {
      heading: 'Member information',
      body: 'Inside FairPath products, members can provide profile, application, readiness, document, and check-in information that is needed for the workflows they choose to use.',
    },
    {
      heading: 'Organization access',
      body: 'FairPath is designed so an employer, housing provider, or service organization sees information that is relevant to its role and the applicable sharing context—not an unrestricted copy of a member’s entire FairPath identity.',
    },
    {
      heading: 'Record Relief public check',
      body: 'The public Record Relief checker is a no-account starting point. The website version does not create a member case or personalized waiting-period countdown. When document analysis is enabled, an uploaded court record is processed in the current request to extract visible case facts; FairPath does not deliberately save that document as a permanent public-site record. The user reviews facts before applying them to the checker.',
    },
    {
      heading: 'Optional AI court-document processing',
      body: 'The optional document upload supports one image or PDF and requires explicit consent before sending file content to an external AI provider. The configured primary service is OpenAI; an independent fallback to Google Gemini requires separate consent. Provider processing and retention are governed by their own terms and applicable service agreements, and files may contain sensitive information. Users are asked to remove unnecessary identifiers and should not upload restricted juvenile or sealed materials without authorization. A security or privacy review is required before activating the public upload service.',
    },
    {
      heading: 'AI and provider services',
      body: 'Where FairPath Signal or an external provider is used, routing should be limited to the information required for that workflow. Sensitive provider credentials are not exposed to browser users.',
    },
    {
      heading: 'Your choices',
      body: 'Members should be able to review the sharing controls available in the relevant product workflow. In the mobile app, Privacy and account (Profile) describes what FairPath does not automatically share and how to request account deletion.',
    },
    {
      heading: 'Questions',
      body: 'Privacy questions can be sent through the Contact page on fairpathfwd.com until a dedicated privacy address is configured.',
    },
  ],
};

export function getMemberLegalDocument(slug: 'terms' | 'privacy'): MemberLegalDocument {
  return slug === 'terms' ? TERMS_V1 : PRIVACY_V1;
}

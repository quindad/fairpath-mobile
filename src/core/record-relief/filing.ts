export type SignatureMethod='none'|'electronic'|'wet'|'notary'|'court_portal';
export type FilingMethod='download'|'email'|'mail'|'court_portal'|'in_person';
export type FilingStatus='draft'|'ready_for_review'|'needs_signature'|'ready_to_file'|'submitted_to_mail'|'mailed'|'delivered'|'court_response_pending'|'complete';
export type FilingRule={jurisdictionId:string;formId:string;officialFormUrl:string;officialInstructionsUrl?:string;signature:SignatureMethod;methods:FilingMethod[];courtFeeUsd?:number;feeWaiverFormUrl?:string;verifiedAt:string;effectiveFrom:string};
export type FilingPacket={id:string;userId:string;ruleId:string;formId:string;status:FilingStatus;confirmedFields:Record<string,string|boolean|number|null>;generatedPdfUrl?:string;trackingNumber?:string;createdAt:string;updatedAt:string};
export type FilingQuote={serviceFeeUsd:number;postageUsd:number;courtFeeUsd:number;totalUsd:number};
export const FILING_STEPS=['Eligibility checked','Official forms selected','Information confirmed','Forms prepared','Signature complete','Filing method selected','Submitted','Delivery tracked'] as const;
export function filingQuote(serviceFeeUsd:number,postageUsd:number,courtFeeUsd=0):FilingQuote{return {serviceFeeUsd,postageUsd,courtFeeUsd,totalUsd:serviceFeeUsd+postageUsd+courtFeeUsd}}

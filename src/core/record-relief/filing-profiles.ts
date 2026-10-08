export type FilingProfile={jurisdictionCode:string;branch:string;form:string;feeCents:number|null;feeWaiver:boolean;filingScope:'case'|'charge';sourceUrl:string;verifiedOn:string;notes:string[]};
export const MARYLAND_FILING_PROFILES:readonly FilingProfile[]=[
{jurisdictionCode:'US-MD',branch:'favorable_disposition',form:'CC-DC-CR-072A',feeCents:0,feeWaiver:false,filingScope:'case',sourceUrl:'https://www.mdcourts.gov/legalhelp/expungement',verifiedOn:'2026-10-07',notes:['Acquittal, dismissal, PBJ, nolle prosequi, stet, or not criminally responsible branches use this form as applicable.']},
{jurisdictionCode:'US-MD',branch:'early_all_favorable',form:'CC-DC-CR-072C',feeCents:0,feeWaiver:false,filingScope:'case',sourceUrl:'https://www.mdcourts.gov/legalhelp/expungement',verifiedOn:'2026-10-07',notes:['For an all-favorable case entered October 1, 2021 or later when requesting relief before automatic three-year expungement.']},
{jurisdictionCode:'US-MD',branch:'eligible_guilty_non_cannabis',form:'CC-DC-CR-072B',feeCents:3000,feeWaiver:true,filingScope:'case',sourceUrl:'https://www.mdcourts.gov/legalhelp/expungement',verifiedOn:'2026-10-07',notes:['Maryland Courts states the $30 fee is per case, not per charge in a unit; waiver may be requested.']},
{jurisdictionCode:'US-MD',branch:'eligible_guilty_cannabis',form:'CC-DC-CR-072D',feeCents:3000,feeWaiver:true,filingScope:'case',sourceUrl:'https://www.mdcourts.gov/legalhelp/expungement',verifiedOn:'2026-10-07',notes:['Cannabis-related eligible guilty disposition form.']}
];
export const PENNSYLVANIA_FILING_PROFILES:readonly FilingProfile[]=[
{jurisdictionCode:'US-PA',branch:'criminal_history_access_review',form:'SP 4-170',feeCents:2000,feeWaiver:false,filingScope:'case',sourceUrl:'https://www.pa.gov/services/psp/apply-for-criminal-record-expungement',verifiedOn:'2026-10-07',notes:['PSP instructs the applicant to obtain the full arrest record, then contact the Clerk of Courts in the county where the arrest occurred for petition instructions. This $20 is the PSP access/review step, not a guessed county petition fee.']},
{jurisdictionCode:'US-PA',branch:'petition_limited_access',form:'Petition for Limited Access Pursuant to 791',feeCents:null,feeWaiver:true,filingScope:'case',sourceUrl:'https://wwwsecure.pacourts.us/forms/for-the-public',verifiedOn:'2026-10-07',notes:['Filed in the Court of Common Pleas where the conviction occurred. Local filing cost must remain unknown until verified for that court/county.']}
];

const ALL_FILING_PROFILES:readonly FilingProfile[]=[...MARYLAND_FILING_PROFILES,...PENNSYLVANIA_FILING_PROFILES];
// Bug fix: this previously only searched MARYLAND_FILING_PROFILES, silently ignoring every other
// jurisdiction's array (including Pennsylvania's, declared below it). It was never called from app
// code, so the bug had no live effect, but a caller relying on this function would have gotten a
// false "no profile" for every non-Maryland jurisdiction.
export function filingProfile(jurisdictionCode:string,branch:string){return ALL_FILING_PROFILES.find(x=>x.jurisdictionCode===jurisdictionCode&&x.branch===branch)??null}

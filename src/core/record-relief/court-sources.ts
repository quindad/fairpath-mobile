export type CourtSource={jurisdictionCode:string;authority:string;directoryUrl:string;structure:string;verifiedOn:string};
export const BATCH01_COURT_SOURCES:readonly CourtSource[]=[
{jurisdictionCode:'US-OH',authority:'Supreme Court of Ohio',directoryUrl:'https://www.supremecourt.ohio.gov/courts/judicial-system/ohio-trial-courts/',structure:'88 county common pleas courts plus municipal/county courts; route to court of case, never county-only guess',verifiedOn:'2026-10-07'},
{jurisdictionCode:'US-MD',authority:'Maryland Judiciary',directoryUrl:'https://www.mdcourts.gov/courtsdirectory',structure:'Circuit Court in 23 counties and Baltimore City; District Court statewide in 12 districts and multiple locations',verifiedOn:'2026-10-07'},
{jurisdictionCode:'US-PA',authority:'Unified Judicial System of Pennsylvania',directoryUrl:'https://www.pacourts.us/courts/courts-of-common-pleas/judicial-districts',structure:'Courts of Common Pleas organized into 60 judicial districts covering 67 counties',verifiedOn:'2026-10-07'},
{jurisdictionCode:'US-MI',authority:'Michigan Courts',directoryUrl:'https://www.courts.michigan.gov/courts/trial-courts/',structure:'Trial-court routing must preserve court of conviction; local identity must be verified before filing guidance',verifiedOn:'2026-10-07'},
{jurisdictionCode:'US-IN',authority:'Indiana Judicial Branch',directoryUrl:'https://www.in.gov/courts/directory/',structure:'Trial courts and clerks indexed by all 92 counties; statewide MyCase may aid case lookup but is not a filing destination',verifiedOn:'2026-10-07'}
];
export function courtSource(code:string){return BATCH01_COURT_SOURCES.find(x=>x.jurisdictionCode===code)??null}

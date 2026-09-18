import type {NormalizedHousing,NormalizedJob,OpportunitySource} from './types';
export interface JobSourceAdapter{source:OpportunitySource;fetchJobs(cursor?:string):Promise<{jobs:NormalizedJob[];nextCursor?:string}>}
export interface HousingSourceAdapter{source:OpportunitySource;fetchHousing(cursor?:string):Promise<{listings:NormalizedHousing[];nextCursor?:string}>}
export function assertSourceCanUseAI(source:OpportunitySource){if(!source.aiProcessingAllowed)throw new Error('SOURCE_AI_PROCESSING_NOT_AUTHORIZED');}
export function assertSourceActive(source:OpportunitySource){if(source.status!=='active')throw new Error('SOURCE_NOT_ACTIVE');}

export type FairPathExperience =
  | 'consumer-mobile'
  | 'consumer-web'
  | 'pre-release'
  | 'partner-web'
  | 'admin-web';

export const FairPathPlatform = {
  backend: 'supabase',
  experiences: {
    consumerMobile: 'consumer-mobile',
    consumerWeb: 'consumer-web',
    preRelease: 'pre-release',
    partnerWeb: 'partner-web',
    adminWeb: 'admin-web',
  },
} as const;

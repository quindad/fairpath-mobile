export type FairPathExperience =
  | 'consumer-mobile'
  | 'consumer-web'
  | 'partner-web'
  | 'admin-web';

export const FairPathPlatform = {
  backend: 'supabase',
  experiences: {
    consumerMobile: 'consumer-mobile',
    consumerWeb: 'consumer-web',
    partnerWeb: 'partner-web',
    adminWeb: 'admin-web',
  },
} as const;

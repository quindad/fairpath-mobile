/**
 * When jobs/housing inventory is thin, the app still needs a honest reason to stay.
 * Shared CTAs — not fake listings, not "coming soon" as if live.
 */
export type ThinMarketAction = {
  id: string;
  label: string;
  body: string;
  route: string;
};

export const THIN_MARKET_ACTIONS: ThinMarketAction[] = [
  { id: 'signal', label: 'Signal · next steps', body: 'Focus, credit, record relief, and resources — even without local listings.', route: '/fairpath-ai?q=' + encodeURIComponent('What should I focus on this week?') },
  { id: 'resources', label: 'Resources', body: 'Food, shelter, ID, transportation — often available when job boards are empty.', route: '/resources' },
  { id: 'credit', label: 'Credit Studio', body: 'Free report review, disputes you send, and practical help.', route: '/credit' },
  { id: 'relief', label: 'Record Relief', body: 'Check relief paths and paperwork for your state.', route: '/record-relief' },
  { id: 'resume', label: 'Resume Studio', body: 'Stay ready when listings show up.', route: '/resume-studio' },
  { id: 'path', label: 'My Path', body: 'Your plan and priorities on this device.', route: '/my-path' },
];

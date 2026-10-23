/** Member-facing copy for Community Exchange RPC failures (open board, post request, offer help). */

export type CommunityExchangeFlow =
  | 'open_board'
  | 'create_request'
  | 'offer_help'
  | 'respond_offer'
  | 'cancel_request'
  | 'fulfill_request';

export type CommunityExchangeNotifyCopy = {
  title: string;
  body: string;
  signedOut?: boolean;
  returnTo?: string;
};

function rpcMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e && 'message' in e) return String((e as { message: unknown }).message);
  return '';
}

function signedOutReturnTo(flow: CommunityExchangeFlow): string {
  switch (flow) {
    case 'open_board':
      return '/community/open-requests';
    case 'create_request':
      return '/community/need-help/new';
    case 'offer_help':
      return '/community/can-help';
    default:
      return '/community';
  }
}

const SIGNED_OUT: CommunityExchangeNotifyCopy = {
  title: 'Sign in required',
  body: 'Sign in to use Community Exchange.',
  signedOut: true,
};

/** Maps backend exception tokens to notify title/body for a given screen action. */
export function communityExchangeNotifyCopy(
  flow: CommunityExchangeFlow,
  e: unknown,
): CommunityExchangeNotifyCopy {
  const msg = rpcMessage(e);
  if (msg.includes('SIGNED_OUT')) {
    return { ...SIGNED_OUT, returnTo: signedOutReturnTo(flow) };
  }

  if (flow === 'open_board') {
    return {
      title: 'Could not load open requests',
      body: 'Check your connection and try again. You can still browse Marketplace or Food Rescue.',
    };
  }

  if (flow === 'create_request') {
    if (msg.includes('TOO_MANY_OPEN')) {
      return {
        title: 'Too many open requests',
        body: 'Close or mark fulfilled an existing request before posting another (limit is three open or matched).',
      };
    }
    if (msg.includes('DUPLICATE_REQUEST')) {
      return {
        title: 'Similar request recently',
        body: 'You already posted a matching open request in the last 24 hours. Open it from I need help or edit after it closes.',
      };
    }
    if (msg.includes('INVALID_EXPIRY')) {
      return {
        title: 'Could not set timing',
        body: 'Something went wrong with how long the request stays open. Try again or pick a different urgency.',
      };
    }
    if (msg.includes('INVALID_CATEGORY')) {
      return {
        title: 'Pick a category',
        body: 'Choose a category from the list so helpers know what you need.',
      };
    }
    return {
      title: 'Could not post request',
      body: 'Try again in a moment. If it keeps failing, sign out and back in.',
    };
  }

  if (flow === 'offer_help') {
    if (msg.includes('OWN_REQUEST')) {
      return {
        title: 'That is your request',
        body: 'You cannot offer on your own post. Browse other open requests under I can help.',
      };
    }
    if (msg.includes('REQUEST_UNAVAILABLE')) {
      return {
        title: 'Request no longer open',
        body: 'This ask was fulfilled, cancelled, or expired. Pick another open request or list a free Marketplace item.',
      };
    }
    if (msg.includes('INVALID_ITEM')) {
      return {
        title: 'Listing not linked',
        body: 'The Marketplace item must be yours and still available. List or update the item, then try again.',
      };
    }
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('one_active')) {
      return {
        title: 'Offer already sent',
        body: 'You already offered on this request. The member will see it when they review offers.',
      };
    }
    return {
      title: 'Could not send offer',
      body: 'Try again shortly, or list a free item on Marketplace to help neighbors another way.',
    };
  }

  if (flow === 'respond_offer') {
    if (msg.includes('NOT_FOUND')) {
      return {
        title: 'Offer unavailable',
        body: 'That offer may have been withdrawn or already handled. Pull to refresh and try again.',
      };
    }
    return { title: 'Could not update offer', body: 'Try again in a moment.' };
  }

  if (flow === 'cancel_request' || flow === 'fulfill_request') {
    if (msg.includes('NOT_FOUND')) {
      return {
        title: 'Request cannot be updated',
        body: 'It may already be closed or expired. Return to your requests list and refresh.',
      };
    }
    return {
      title: flow === 'fulfill_request' ? 'Could not mark fulfilled' : 'Could not cancel',
      body: 'Try again in a moment.',
    };
  }

  return { title: 'Something went wrong', body: 'Please try again.' };
}

export const COMMUNITY_BOARD_UNAVAILABLE = {
  title: 'Open requests unavailable',
  body: 'The community help board is not available on this environment yet. You can still donate goods on Marketplace or food through Food Rescue.',
} as const;

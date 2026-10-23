import { useCallback, useSyncExternalStore } from 'react';
import {
  getRegistrationDraft,
  patchRegistrationDraft,
  subscribeRegistrationDraft,
  type RegistrationDraft,
} from '@/core/auth/registration-draft';

export function useRegistrationDraft() {
  const draft = useSyncExternalStore(subscribeRegistrationDraft, getRegistrationDraft, getRegistrationDraft);
  const patch = useCallback((p: Partial<RegistrationDraft>) => patchRegistrationDraft(p), []);
  return { draft, patch };
}

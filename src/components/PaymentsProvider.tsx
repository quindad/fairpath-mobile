import type { ReactNode } from 'react';

/** Web/default: no Stripe native module. */
export function PaymentsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

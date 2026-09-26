import type { PreparedPayment } from '@/core/payments/payments-service';

export type SheetResult = { status: 'completed' } | { status: 'canceled' } | { status: 'error'; message: string };

/** Web has no native payment sheet. Payments are completed in the iPhone/Android app. */
export async function presentPaymentSheetFor(_payment: PreparedPayment): Promise<SheetResult> {
  return { status: 'error', message: 'Payments are available in the FairPath mobile app.' };
}

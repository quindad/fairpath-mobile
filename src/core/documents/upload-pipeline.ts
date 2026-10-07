// Document upload pipeline: validation and a state machine. Storage and extraction are injected, so this logic is
// testable without a backend. Uploads never trigger sharing; a document reaches review only after extraction finishes.

export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'] as const;
export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_PAGES = 50;
export const MAX_ATTEMPTS = 3;

export type FileCandidate = { name: string; mime: string; bytes: number; pages: number | null };

export type ValidationError = 'unsupported_type' | 'too_large' | 'too_many_pages' | 'empty_file' | 'missing_name';

export function validateFile(f: FileCandidate): { ok: true } | { ok: false; reason: ValidationError } {
  if (!f.name.trim()) return { ok: false, reason: 'missing_name' };
  if (f.bytes <= 0) return { ok: false, reason: 'empty_file' };
  if (!(ALLOWED_MIME as readonly string[]).includes(f.mime)) return { ok: false, reason: 'unsupported_type' };
  if (f.bytes > MAX_BYTES) return { ok: false, reason: 'too_large' };
  if (f.pages !== null && f.pages > MAX_PAGES) return { ok: false, reason: 'too_many_pages' };
  return { ok: true };
}

export const VALIDATION_MESSAGE: Record<ValidationError, string> = {
  missing_name: 'This file has no name. Choose another file.',
  empty_file: 'This file is empty. Choose another file.',
  unsupported_type: 'Use a PDF, JPEG, PNG or HEIC file.',
  too_large: 'This file is larger than 15 MB. Try a smaller scan.',
  too_many_pages: 'This document has more than 50 pages. Upload the most important pages.',
};

export type UploadState =
  | { step: 'idle' }
  | { step: 'uploading'; attempt: number }
  | { step: 'extracting'; attempt: number }
  | { step: 'ready_for_review'; documentId: string }
  | { step: 'failed'; attempt: number; retryable: boolean; message: string };

export type UploadEvent =
  | { type: 'start' }
  | { type: 'uploaded' }
  | { type: 'extracted'; documentId: string }
  | { type: 'error'; retryable: boolean; message: string }
  | { type: 'retry' };

export function nextUploadState(state: UploadState, event: UploadEvent): UploadState {
  switch (event.type) {
    case 'start':
      return state.step === 'idle' || state.step === 'failed' ? { step: 'uploading', attempt: attemptOf(state) + 1 } : state;
    case 'uploaded':
      return state.step === 'uploading' ? { step: 'extracting', attempt: state.attempt } : state;
    case 'extracted':
      return state.step === 'extracting' ? { step: 'ready_for_review', documentId: event.documentId } : state;
    case 'error':
      if (state.step !== 'uploading' && state.step !== 'extracting') return state;
      return { step: 'failed', attempt: state.attempt, retryable: event.retryable && state.attempt < MAX_ATTEMPTS, message: event.message };
    case 'retry':
      return state.step === 'failed' && state.retryable ? { step: 'uploading', attempt: state.attempt + 1 } : state;
  }
}

function attemptOf(state: UploadState): number {
  return 'attempt' in state ? state.attempt : 0;
}

/** Errors that a retry can fix (network, timeout, server busy). Validation and permission errors are never retried. */
export function classifyError(code: string): { retryable: boolean; message: string } {
  if (code === 'network' || code === 'timeout' || code === 'server_busy') {
    return { retryable: true, message: 'The upload was interrupted. You can try again.' };
  }
  if (code === 'unauthorized') {
    return { retryable: false, message: 'You need to sign in again before uploading.' };
  }
  return { retryable: false, message: 'We could not process this document. Your original file was not changed.' };
}

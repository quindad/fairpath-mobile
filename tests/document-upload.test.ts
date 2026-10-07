import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFile, nextUploadState, classifyError, MAX_ATTEMPTS, MAX_BYTES, MAX_PAGES, type UploadState } from '../src/core/documents/upload-pipeline.ts';

const OK = { name: 'court.pdf', mime: 'application/pdf', bytes: 1000, pages: 3 };

test('accepts a normal PDF', () => {
  assert.deepEqual(validateFile(OK), { ok: true });
});

test('rejects unsupported types, including text and office files', () => {
  assert.deepEqual(validateFile({ ...OK, mime: 'text/plain' }), { ok: false, reason: 'unsupported_type' });
  assert.deepEqual(validateFile({ ...OK, mime: 'application/msword' }), { ok: false, reason: 'unsupported_type' });
});

test('rejects oversize, empty, nameless and over-length files at exact boundaries', () => {
  assert.deepEqual(validateFile({ ...OK, bytes: MAX_BYTES + 1 }), { ok: false, reason: 'too_large' });
  assert.deepEqual(validateFile({ ...OK, bytes: MAX_BYTES }), { ok: true });
  assert.deepEqual(validateFile({ ...OK, bytes: 0 }), { ok: false, reason: 'empty_file' });
  assert.deepEqual(validateFile({ ...OK, name: '  ' }), { ok: false, reason: 'missing_name' });
  assert.deepEqual(validateFile({ ...OK, pages: MAX_PAGES + 1 }), { ok: false, reason: 'too_many_pages' });
});

test('page count unknown (images) is accepted', () => {
  assert.deepEqual(validateFile({ ...OK, mime: 'image/jpeg', pages: null }), { ok: true });
});

test('happy path: idle to ready for review', () => {
  let s: UploadState = { step: 'idle' };
  s = nextUploadState(s, { type: 'start' });
  assert.deepEqual(s, { step: 'uploading', attempt: 1 });
  s = nextUploadState(s, { type: 'uploaded' });
  assert.deepEqual(s, { step: 'extracting', attempt: 1 });
  s = nextUploadState(s, { type: 'extracted', documentId: 'doc-1' });
  assert.deepEqual(s, { step: 'ready_for_review', documentId: 'doc-1' });
});

test('a retryable failure can be retried, incrementing the attempt', () => {
  let s: UploadState = nextUploadState({ step: 'idle' }, { type: 'start' });
  s = nextUploadState(s, { type: 'error', retryable: true, message: 'x' });
  assert.equal(s.step, 'failed');
  s = nextUploadState(s, { type: 'retry' });
  assert.deepEqual(s, { step: 'uploading', attempt: 2 });
});

test('retries stop at the attempt limit', () => {
  let s: UploadState = { step: 'uploading', attempt: MAX_ATTEMPTS };
  s = nextUploadState(s, { type: 'error', retryable: true, message: 'x' });
  assert.equal(s.step === 'failed' && s.retryable, false);
  assert.equal(nextUploadState(s, { type: 'retry' }).step, 'failed');
});

test('non-retryable failures never offer retry', () => {
  const s = nextUploadState({ step: 'uploading', attempt: 1 }, { type: 'error', retryable: false, message: 'bad' });
  assert.equal(s.step === 'failed' && s.retryable, false);
});

test('invalid transitions are ignored', () => {
  const idle: UploadState = { step: 'idle' };
  assert.deepEqual(nextUploadState(idle, { type: 'extracted', documentId: 'x' }), idle);
  assert.deepEqual(nextUploadState(idle, { type: 'error', retryable: true, message: 'x' }), idle);
});

test('error classification: network is retryable, unauthorized and unknown are not', () => {
  assert.equal(classifyError('network').retryable, true);
  assert.equal(classifyError('timeout').retryable, true);
  assert.equal(classifyError('unauthorized').retryable, false);
  assert.equal(classifyError('mystery').retryable, false);
});

test('error messages never expose raw error codes', () => {
  for (const code of ['network', 'unauthorized', 'mystery']) {
    assert.equal(classifyError(code).message.includes(code), false);
  }
});

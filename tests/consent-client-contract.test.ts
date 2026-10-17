import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const service=readFileSync('src/core/profile/consent-service.ts','utf8');
const callback=readFileSync('src/app/auth/callback.tsx','utf8');
const signup=readFileSync('src/app/sign-up.tsx','utf8');
const accept=readFileSync('src/app/accept-terms.tsx','utf8');
test('document consent uses authenticated RPC and other events remain insert-only',()=>{
 assert.match(service,/rpc\('record_document_consent'/);
 assert.match(service,/from\('consent_events'\)\.insert/);
 assert.doesNotMatch(service,/\.update\(\{\s*(?:terms|privacy)_accepted_/);
});
test('auth callback never writes consent on authentication alone',()=>{
 assert.doesNotMatch(callback,/recordSignUpConsent/);
 assert.match(callback,/checkDocumentConsent/);
 assert.match(callback,/router\.replace\('\/accept-terms'/);
});
test('signup and accept terms surface failures and require deliberate agreement',()=>{
 assert.doesNotMatch(signup,/recordSignUpConsent\(\)\.catch\(\(\) => \{\}\)/);
 assert.match(signup,/if \(!agreedToTerms\)/);
 assert.match(accept,/if\(!agreedTerms\|\|!agreedPrivacy\|\|saving\)return/);
});
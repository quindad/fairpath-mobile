import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import {
  COMMUNITY_BOARD_UNAVAILABLE,
  communityExchangeNotifyCopy,
} from '../src/core/community/exchange-flow-errors.ts';

describe('community exchange flow errors', () => {
  it('maps create_request RPC tokens to member copy', () => {
    const tooMany = communityExchangeNotifyCopy('create_request', new Error('TOO_MANY_OPEN'));
    assert.match(tooMany.title, /too many/i);
    assert.match(tooMany.body, /three/i);

    const dup = communityExchangeNotifyCopy('create_request', new Error('DUPLICATE_REQUEST'));
    assert.match(dup.title, /similar/i);
    assert.match(dup.body, /24 hours/i);

    const signed = communityExchangeNotifyCopy('create_request', new Error('SIGNED_OUT'));
    assert.ok(signed.signedOut);
    assert.equal(signed.returnTo, '/community/need-help/new');
  });

  it('maps offer_help RPC tokens including unavailable and own request', () => {
    const own = communityExchangeNotifyCopy('offer_help', new Error('OWN_REQUEST'));
    assert.match(own.title, /your request/i);

    const gone = communityExchangeNotifyCopy('offer_help', new Error('REQUEST_UNAVAILABLE'));
    assert.match(gone.title, /no longer open/i);
    assert.match(gone.body, /Marketplace/i);

    const item = communityExchangeNotifyCopy('offer_help', new Error('INVALID_ITEM'));
    assert.match(item.body, /Marketplace/i);

    const signed = communityExchangeNotifyCopy('offer_help', new Error('SIGNED_OUT'));
    assert.equal(signed.returnTo, '/community/can-help');
  });

  it('maps open_board failures without leaking RPC tokens', () => {
    const copy = communityExchangeNotifyCopy('open_board', new Error('network timeout'));
    assert.doesNotMatch(copy.body, /SIGNED_OUT|REQUEST_UNAVAILABLE/);
    assert.match(copy.title, /load open requests/i);
  });

  it('exposes stable board-unavailable panel copy', () => {
    assert.match(COMMUNITY_BOARD_UNAVAILABLE.body, /Marketplace/);
    assert.match(COMMUNITY_BOARD_UNAVAILABLE.body, /Food Rescue/);
  });
});

describe('community exchange flow UI contract', () => {
  const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

  it('open-requests and need-help screens use centralized exchange error copy', () => {
    const open = read('src/app/community/open-requests.tsx');
    const post = read('src/app/community/need-help/new.tsx');
    const detail = read('src/app/community/need-help/[id].tsx');

    assert.match(open, /COMMUNITY_BOARD_UNAVAILABLE/);
    assert.match(open, /sign-in\?returnTo=\/community\/open-requests/);
    assert.match(post, /communityExchangeNotifyCopy\('create_request'/);
    assert.match(detail, /communityExchangeNotifyCopy\('offer_help'/);
    assert.doesNotMatch(post, /TOO_MANY_OPEN/);
    assert.doesNotMatch(detail, /OWN_REQUEST/);
  });
});

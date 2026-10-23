import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { interpretOpportunityQuery } from '../src/core/opportunity/intent-parser.ts';

describe('opportunity intent parser', () => {
  it('parses food + transportation constraints from one sentence', () => {
    const r = interpretOpportunityQuery('My family needs groceries tonight and we do not have transportation');
    assert.ok(r.needs.some((n) => n.category === 'groceries' || n.category === 'food_assistance'));
    assert.ok(r.needs.some((n) => n.category === 'transportation'));
    assert.equal(r.needs[0]?.urgency, 'today');
    assert.equal(r.needs.some((n) => n.constraints.noPersonalTransport), true);
  });

  it('parses multiple essentials', () => {
    const r = interpretOpportunityQuery('I need diapers and winter clothes');
    assert.ok(r.needs.some((n) => n.category === 'diapers'));
    assert.ok(r.needs.some((n) => n.category === 'clothing'));
  });

  it('detects give intent', () => {
    const r = interpretOpportunityQuery('I have groceries I want to give away');
    assert.equal(r.pillar, 'can_help');
  });

  it('detects growth intent for GED', () => {
    const r = interpretOpportunityQuery('I want to get my GED');
    assert.equal(r.pillar, 'want_to_grow');
    assert.ok(r.needs.some((n) => n.category === 'education' || n.category === 'education_scholarships'));
  });

  it('parses multi-need GED + childcare + utilities', () => {
    const r = interpretOpportunityQuery('I want my GED but need childcare and utility help');
    assert.equal(r.pillar, 'want_to_grow');
    assert.ok(r.needs.some((n) => n.category === 'education_scholarships' || n.category === 'education'));
    assert.ok(r.needs.some((n) => n.category === 'family_center'));
    assert.ok(r.needs.some((n) => n.category === 'benefits_navigator'));
  });
});

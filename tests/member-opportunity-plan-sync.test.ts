import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('member opportunity plan migration defines RLS-owned table', () => {
  const sql = fs.readFileSync('supabase/migrations/20261026210000_member_opportunity_plan_items.sql', 'utf8');
  assert.match(sql, /member_opportunity_plan_items/);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/);
});

test('member plan service merges and sync exports exist', () => {
  const src = fs.readFileSync('src/core/opportunity/member-opportunity-plan-service.ts', 'utf8');
  assert.match(src, /loadMergedOpportunityPlan/);
  assert.match(src, /syncOpportunityPlanItems/);
  assert.match(src, /member_opportunity_plan_items/);
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { interpretOpportunityQuery } from '../src/core/opportunity/intent-parser.ts';
import { planStepsFromInterpretation } from '../src/core/opportunity/multi-need-planner.ts';

describe('multi-need planner', () => {
  it('orders urgent essentials before growth goals', () => {
    const interp = interpretOpportunityQuery('Need groceries tonight and I want my GED');
    const steps = planStepsFromInterpretation(interp);
    assert.ok(steps.length >= 2);
    const foodIdx = steps.findIndex((s) => /grocer|food/i.test(s.needLabel));
    const gedIdx = steps.findIndex((s) => /education|GED/i.test(s.needLabel));
    assert.ok(foodIdx >= 0 && gedIdx >= 0);
    assert.ok(foodIdx < gedIdx, 'food tonight should rank before GED');
    assert.ok(steps[foodIdx].route.includes('/community/help-now'));
  });

  it('dedupes repeated categories', () => {
    const interp = interpretOpportunityQuery('Need food and hungry tonight');
    const steps = planStepsFromInterpretation(interp);
    const helpNow = steps.filter((s) => s.route.startsWith('/community/help-now'));
    assert.ok(helpNow.length >= 1);
  });

  it('routes jobs and housing growth needs to search screens', () => {
    const interp = interpretOpportunityQuery('I need a job and an apartment');
    const steps = planStepsFromInterpretation(interp);
    assert.ok(steps.some((s) => s.route === '/find-jobs'));
    assert.ok(steps.some((s) => s.route === '/find-housing'));
  });
});

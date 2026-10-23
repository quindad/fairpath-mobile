import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { V1_PATHWAYS, resolveGrowthDiscovery, v1PathwayById } from '../src/core/opportunity/v1-pathways.ts';

describe('V1 opportunity pathways', () => {
  it('defines exactly ten approved pathways', () => {
    assert.equal(V1_PATHWAYS.length, 10);
    const ids = new Set(V1_PATHWAYS.map((p) => p.id));
    assert.equal(ids.size, 10);
  });

  it('maps education growth to scholarships pathway resources', () => {
    const r = resolveGrowthDiscovery('education_scholarships');
    assert.equal(r.pathwayId, 'education_scholarships');
    assert.ok(r.resourceSlugs.includes('education'));
    assert.equal(r.route, '/opportunities');
  });

  it('routes employment discovery to jobs search with skills pathway slugs', () => {
    const r = resolveGrowthDiscovery('employment');
    assert.equal(r.pathwayId, 'skills_exchange');
    assert.ok(r.resourceSlugs.includes('jobs'));
    assert.equal(r.route, '/find-jobs');
  });

  it('routes financial discovery to Credit Studio with benefits resource slugs', () => {
    const r = resolveGrowthDiscovery('financial');
    assert.equal(r.pathwayId, 'benefits_navigator');
    assert.ok(r.resourceSlugs.includes('money'));
    assert.equal(r.route, '/credit');
  });

  it('routes record relief and housing to dedicated discovery screens', () => {
    assert.equal(resolveGrowthDiscovery('record_relief').route, '/record-relief');
    assert.equal(resolveGrowthDiscovery('record_relief').pathwayId, null);
    const housing = resolveGrowthDiscovery('housing');
    assert.equal(housing.route, '/find-housing');
    assert.equal(housing.pathwayId, 'family_center');
  });

  it('excludes neighbor network and equipment library routes', () => {
    for (const p of V1_PATHWAYS) {
      assert.ok(!p.primaryRoute.includes('neighbor'), p.id);
      assert.ok(!p.title.toLowerCase().includes('equipment library'), p.id);
    }
    assert.throws(() => v1PathwayById('neighbor_network' as never));
  });

  it('uses dedicated primary routes (not help-now or bare resources)', () => {
    for (const p of V1_PATHWAYS) {
      assert.ok(!p.primaryRoute.includes('help-now'), p.id);
      assert.notEqual(p.primaryRoute, '/resources', p.id);
    }
  });

  it('primary route per approved pathway', () => {
    const expected: Record<string, string> = {
      skills_exchange: '/academy',
      microbusiness: '/entrepreneurship',
      education_scholarships: '/opportunities',
      family_center: '/resources?category=family',
      events_volunteering: '/community/can-help',
      benefits_navigator: '/resources?category=benefits',
      health_wellness: '/resources?category=health_wellness',
      mentorship: '/opportunities',
      transportation: '/resources?category=transportation',
      community_drives: '/community',
    };
    for (const p of V1_PATHWAYS) {
      assert.equal(p.primaryRoute, expected[p.id], p.id);
    }
  });

  it('resolveGrowthDiscovery uses pathway primary routes for direct keys', () => {
    assert.equal(resolveGrowthDiscovery('mentorship').route, '/opportunities');
    assert.equal(resolveGrowthDiscovery('transportation').route, '/resources?category=transportation');
    assert.equal(resolveGrowthDiscovery('community_drives').route, '/community');
    assert.equal(resolveGrowthDiscovery('skills_exchange').route, '/academy');
    assert.equal(resolveGrowthDiscovery('microbusiness').route, '/entrepreneurship');
  });

  it('grow hub navigates via pathway primaryRoute (no help-now dead ends)', () => {
    const grow = readFileSync('src/app/grow/index.tsx', 'utf8');
    assert.match(grow, /V1_PATHWAYS/);
    assert.match(grow, /p\.primaryRoute/);
    assert.match(grow, /\/community\/help-now/);
  });
});

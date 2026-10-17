import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const root=new URL('../src/app/',import.meta.url);
const read=(name)=>readFileSync(new URL(name,root),'utf8');
test('discovery is universally positioned without separating people by status',()=>{
 const source=read('find.tsx');
 assert.match(source,/Opportunities for everyone/);
 assert.match(source,/Choose the filters that fit your needs/);
 assert.doesNotMatch(source,/\b(?:felon|veteran) (?:app|side|portal)\b/i);
});
test('jobs and housing remain accessible to every visitor from Find',()=>{
 const source=read('find.tsx');
 for(const route of ['/find-jobs','/find-housing','/resources'])assert.ok(source.includes("'"+route+"'"));
 assert.match(source,/router\.push\(route as never\)/);
});
test('existing optional barrier-aware housing filters remain available',()=>{
 const screen=read('find-housing.tsx');
 assert.match(screen,/felonyFriendly/);
 assert.match(screen,/veteranFriendly/);
 const jobs=read('find-jobs.tsx');
 assert.match(jobs,/veteranFriendly/);
});

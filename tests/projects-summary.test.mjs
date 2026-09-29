import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validState,switchProject,archiveProject,summarizeDays} from '../dist/core.mjs';
const base=()=>{const s=initialState();s.projects.push({id:'design',name:'Design',color:'#6285cb'});return s;};
test('switching projects stops old timer at the exact instant the new timer starts',()=>{
 const s=base();switchProject(s,'general',1000);s.active.note='Reviewed sketches';switchProject(s,'design',2000);
 assert.equal(s.entries.length,1);assert.equal(s.entries[0].note,'Reviewed sketches');assert.equal(s.entries[0].end,2000);assert.equal(s.active.start,2000);assert.equal(s.active.note,'');
});
test('archiving active project stops timer; restore preserves all entries and comments',()=>{
 const s=base();switchProject(s,'design',1000);s.active.note='A comment';archiveProject(s,'design',true,3000);
 assert.equal(s.active,null);assert.equal(s.entries[0].note,'A comment');assert.ok(validState(s));assert.throws(()=>switchProject(s,'design',4000));
 archiveProject(s,'design',false);switchProject(s,'design',5000);assert.equal(s.entries[0].note,'A comment');assert.equal(s.active.projectId,'design');
});
test('all projects may be archived and old backups without archived flags remain valid',()=>{
 const s=initialState();assert.ok(validState(s));archiveProject(s,'general');assert.ok(validState(s));assert.equal(s.projects.filter(p=>!p.archived).length,0);
 s.projects[0].archived='false';assert.equal(validState(s),false);
});
test('summary groups projects and comments per day including archived and overnight entries',()=>{
 const s=base();s.projects[1].archived=true;
 const at=s=>+new Date(s);
 s.entries=[{id:'a',projectId:'general',note:'Meeting\nNext steps',start:at('2026-09-28T09:00'),end:at('2026-09-28T10:00')},{id:'b',projectId:'design',note:'Overnight work',start:at('2026-09-28T23:30'),end:at('2026-09-29T00:30')}];
 const days=summarizeDays(s,'2026-09-28','2026-09-29');assert.equal(days.length,2);assert.equal(days[0].total,1800000);assert.equal(days[1].total,5400000);
 assert.equal(days[0].projects[0].project.archived,true);assert.equal(days[1].projects[0].entries[0].note,'Meeting\nNext steps');assert.equal(days[0].projects[0].entries[0].note,'Overnight work');
 assert.deepEqual(summarizeDays(s,'2026-09-30','2026-09-30'),[]);
});
test('active time and comments appear in current summary with a fixed current timestamp',()=>{
 const s=base(),now=+new Date('2026-09-29T12:00');switchProject(s,'design',now-3600000);s.active.note='Drafting';
 const days=summarizeDays(s,'2026-09-29','2026-09-29',now);assert.equal(days[0].total,3600000);assert.equal(days[0].projects[0].entries[0].note,'Drafting');
});

test('calendar weeks start on Monday and include leap day and adjacent months',async()=>{
 const {monthGrid}=await import('../dist/core.mjs');
 const february=monthGrid('2028-02');assert.equal(february.length,42);assert.equal(february[0],'2028-01-31');assert.ok(february.includes('2028-02-29'));assert.equal(new Date(february[0]+'T12:00').getDay(),1);
 assert.equal(monthGrid('2026-12')[0],'2026-11-30');assert.ok(monthGrid('2026-12').includes('2027-01-01'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRange,adjustRange,yToTime,timeToY,timelineHeight,layoutEntries} from '../dist/timeline-model.mjs';
import {dayBounds} from '../dist/core.mjs';
process.env.TZ='Europe/Stockholm';
const day='2026-09-28', at=s=>+new Date(`${day}T${s}:00`), now=at('23:00');
const entry=(id,start,end)=>({id,start:at(start),end:at(end),projectId:'general',note:''});
const morning=entry('a','09:00','10:00'), afternoon=entry('b','13:00','14:00');

test('draw forwards or backwards, snap five minutes and stop at neighboring entries',()=>{
 assert.deepEqual(createRange(at('10:00'),at('15:00'),day,[morning,afternoon],now),{start:at('10:00'),end:at('13:00')});
 assert.deepEqual(createRange(at('12:00'),at('08:00'),day,[morning],now),{start:at('10:00'),end:at('12:00')});
 assert.equal(createRange(at('09:30'),at('10:30'),day,[morning],now),null);
 assert.equal(yToTime(timeToY(at('10:03'),day),day),at('10:05'));
});
test('moves preserve duration and reject collisions',()=>{
 const moved=adjustRange(morning,'move',3600000,day,[morning,afternoon],now);
 assert.equal(moved.start,at('10:00'));assert.equal(moved.end-moved.start,3600000);
 assert.equal(adjustRange(morning,'move',4*3600000,day,[morning,afternoon],now),null);
});
test('resize docks against neighbors and retains at least five minutes',()=>{
 const resized=adjustRange(morning,'end',5*3600000,day,[morning,afternoon],now);
 assert.equal(resized.end,at('13:00'));
 const short=adjustRange(morning,'start',2*3600000,day,[morning],now);
 assert.equal(short.start,at('09:55'));assert.equal(short.end,at('10:00'));
});
test('future time is allowed while active timer and day boundaries still limit drawing',()=>{
 assert.deepEqual(createRange(at('23:00'),at('23:30'),day,[],now),{start:at('23:00'),end:at('23:30')});
 assert.deepEqual(createRange(at('22:55'),at('23:30'),day,[],now),{start:at('22:55'),end:at('23:30')});
 assert.deepEqual(createRange(at('22:00'),at('23:30'),day,[],now),{start:at('22:00'),end:at('23:30')});
 assert.equal(createRange(at('10:00'),at('11:00'),day,[{id:'run',start:at('09:00')}],now),null);
 const moved=adjustRange(morning,'move',-12*3600000,day,[morning],now);
 assert.equal(moved.start,dayBounds(day)[0]);assert.equal(moved.end-moved.start,3600000);
});
test('overnight entries cannot be moved accidentally and retain their other-day portion on resize',()=>{
 const overnight={...morning,start:dayBounds(day)[0]-3600000,end:at('02:00')};
 assert.equal(adjustRange(overnight,'move',3600000,day,[overnight],now),null);
 assert.equal(adjustRange(overnight,'end',3600000,day,[overnight],now).start,overnight.start);
});
test('DST days display actual elapsed hours and map correctly back to timestamps',()=>{
 assert.equal(timelineHeight('2026-10-25'),25*84);assert.equal(timelineHeight('2026-03-29'),23*84);
 const first=+new Date('2026-10-25T02:30:00+02:00'),second=+new Date('2026-10-25T02:30:00+01:00');
 assert.equal(timeToY(second,'2026-10-25')-timeToY(first,'2026-10-25'),84);
 assert.equal(yToTime(timeToY(second,'2026-10-25'),'2026-10-25'),second);
});
test('short adjacent records have independent hit targets',()=>{
 const {blocks,lanes}=layoutEntries([entry('a','09:00','09:01'),entry('b','09:01','09:02')],day,now);
 assert.equal(lanes,2);assert.notEqual(blocks[0].lane,blocks[1].lane);
});
test('an entry ending at midnight is not drawn again on the following day',()=>{
 const [start]=dayBounds(day);
 const {blocks}=layoutEntries([{id:'previous',start:start-3600000,end:start}],day,now);
 assert.equal(blocks.length,0);
});

test('moving and resizing can extend beyond the current time',()=>{
 const current=at('10:00');
 const moved=adjustRange(morning,'move',3*3600000,day,[morning],current);
 assert.equal(moved.start,at('12:00'));assert.equal(moved.end,at('13:00'));
 const resized=adjustRange(morning,'end',2*3600000,day,[morning],current);
 assert.equal(resized.end,at('12:00'));
});

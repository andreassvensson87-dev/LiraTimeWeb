import {dayBounds, overlap} from './core.mjs';
export const HOUR_HEIGHT = 84;
export const STEP = 5 * 60000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function snapTime(value, day) {
  const [start] = dayBounds(day);
  return start + Math.round((value - start) / STEP) * STEP;
}
export function timelineHeight(day) {
  const [start, end] = dayBounds(day);
  return (end - start) / 3600000 * HOUR_HEIGHT;
}
export function yToTime(y, day) {
  const [start, end] = dayBounds(day);
  return clamp(snapTime(start + y / HOUR_HEIGHT * 3600000, day), start, end);
}
export function timeToY(value, day) {
  const [start] = dayBounds(day);
  return (value - start) / 3600000 * HOUR_HEIGHT;
}
export function createRange(anchor, target, day, entries, now = Date.now()) {
  const [dayStart, dayEnd] = dayBounds(day);
  let lower = dayStart, upper = dayEnd;
  if (anchor >= upper || anchor < lower) return null;
  for (const entry of entries) {
    const end = entry.end ?? Infinity;
    if (entry.start <= anchor && end > anchor) return null;
    if (end <= anchor) lower = Math.max(lower, end);
    if (entry.start > anchor) upper = Math.min(upper, entry.start);
  }
  const backwards = target < anchor;
  const start = backwards ? Math.max(lower, Math.min(target, anchor - STEP)) : anchor;
  const end = backwards ? anchor : Math.min(upper, Math.max(target, anchor + STEP));
  return end - start >= STEP ? {start, end} : null;
}
export function adjustRange(entry, mode, delta, day, entries, now = Date.now()) {
  const [dayStart, dayEnd] = dayBounds(day);
  if (!entry.end) {
    if(mode!=='start'||entry.start<dayStart||entry.start>=dayEnd)return null;
    const others=entries.filter(e=>e.id!==entry.id);
    const lower=others.filter(e=>(e.end??Infinity)<=entry.start).reduce((n,e)=>Math.max(n,e.end),dayStart);
    const upper=Math.min(dayEnd-1,now-1);
    if(lower>upper)return null;
    const start=delta===0?entry.start:clamp(snapTime(entry.start+Math.round(delta/STEP)*STEP,day),lower,upper);
    if(start>=now||overlap(others,{start,end:now}))return null;
    return {...entry,start};
  }
  const amount = Math.round(delta / STEP) * STEP;
  if (amount === 0) return {...entry};
  let start = entry.start, end = entry.end;
  const others = entries.filter(e => e.id !== entry.id);
  // Overnight entries keep the portion outside this day. Edit all dates in the dialog.
  if (mode === 'move') {
    if (start < dayStart || end > dayEnd) return null;
    const duration = end - start;
    if (dayEnd - dayStart < duration) return null;
    start = clamp(snapTime(start + amount, day), dayStart, dayEnd - duration);
    // Dock to a neighboring edge when it is within half a snap interval.
    const candidates = others.flatMap(e => [e.end, e.start - duration]).filter(Number.isFinite);
    const edge = candidates.sort((a,b) => Math.abs(a-start)-Math.abs(b-start))[0];
    if (edge !== undefined && Math.abs(edge-start) <= STEP/2) start = edge;
    end = start + duration;
  } else if (mode === 'start') {
    if (start < dayStart) return null;
    const previous = others.filter(e => (e.end ?? Infinity) <= entry.start).reduce((n,e) => Math.max(n,e.end),dayStart);
    start = clamp(snapTime(start + amount, day),previous,end - STEP);
  } else if (mode === 'end') {
    if (end > dayEnd) return null;
    const next = others.filter(e => e.start >= entry.end).reduce((n,e) => Math.min(n,e.start),dayEnd);
    end = clamp(snapTime(end + amount, day),start + STEP,next);
  } else return null;
  const result = {...entry, start, end};
  if (end <= start || (mode !== 'move' && end-start < STEP) || overlap(others,result)) return null;
  if (mode === 'move' && (start < dayStart || end > dayEnd)) return null;
  return result;
}
export function rangeError(range, entries, ignoreId, now = Date.now()) {
  if (!range || (range.end??now) <= range.start) return 'Här finns inte tillräckligt med ledig tid.';
  if (overlap(entries,{...range,end:range.end??now},ignoreId)) return 'Tiden överlappar en annan registrering.';
  return '';
}
// Short entries get separate lanes when their minimum clickable height would collide.
export function layoutEntries(entries, day, now = Date.now()) {
  const [start,end] = dayBounds(day), laneEnds = [];
  const visible = entries.filter(e => e.start < end && (e.end ?? now) > start)
    .sort((a,b) => a.start-b.start);
  const blocks = visible.map(entry => {
    const top = timeToY(Math.max(entry.start,start),day);
    const height = Math.max(26,timeToY(Math.min(entry.end??now,end),day)-top);
    let lane = laneEnds.findIndex(bottom => bottom <= top);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = top + height;
    return {entry,top,height,lane};
  });
  return {blocks,lanes:Math.max(1,laneEnds.length)};
}

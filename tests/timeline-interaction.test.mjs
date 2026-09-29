import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimeline} from '../dist/timeline.mjs';
import {timeToY} from '../dist/timeline-model.mjs';
const day='2026-09-28',at=t=>+new Date(`${day}T${t}:00`);
const projects=[{id:'general',name:'Allmänt',color:'#197568'}];
function setup(entries=[],adjust){
 const listeners={}, globalListeners={},calls=[];
 let captured=false;
 const preview={hidden:true,style:{},classList:{toggle(){}},textContent:''};
 const viewport={scrollTop:0,clientHeight:550,getBoundingClientRect:()=>({top:0,bottom:550})};
 const surface={style:{},innerHTML:'',classList:{toggle(){},add(){},remove(){}},addEventListener:(name,fn)=>listeners[name]=fn,querySelector:()=>preview,querySelectorAll:()=>[],getBoundingClientRect:()=>({top:-viewport.scrollTop,left:0}),setPointerCapture(){captured=true;},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false;}};
 globalThis.window={addEventListener:(name,fn)=>globalListeners[name]=fn};globalThis.document={activeElement:null};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 const message={textContent:''};
 const controller=createTimeline({surface,viewport,message,onCreate:r=>calls.push({type:'create',...r}),onEdit:e=>calls.push({type:'edit',...e}),onAdjust:async(before,after)=>{calls.push({type:'adjust',before,after});if(adjust)return adjust(before,after);},onNotice:text=>calls.push({type:'notice',text})});
 const data={day,projects,entries,now:at('23:00')};controller.render(data);
 const event=(time,entry=null,mode=null)=>({button:0,pointerId:1,pointerType:'mouse',clientX:200,clientY:timeToY(at(time),day)-viewport.scrollTop,preventDefault(){},target:{closest(selector){if(selector==='[data-entry]')return entry?{dataset:{entry:entry.id}}:null;if(selector==='[data-mode]')return mode?{dataset:{mode}}:null;return null;}}});
 return {listeners,globalListeners,calls,controller,event,preview,surface,data};
}
test('dragging empty space previews a range then opens the form with those exact dates',async()=>{
 const s=setup();s.listeners.pointerdown(s.event('09:00'));s.listeners.pointermove(s.event('10:00'));
 assert.equal(s.preview.hidden,false);assert.equal(s.calls.length,0);
 await s.listeners.pointerup(s.event('10:00'));
 assert.deepEqual(s.calls,[{type:'create',start:at('09:00'),end:at('10:00')}]);
});
test('dragging a block keeps duration and commits once on release',async()=>{
 const entry={id:'a',projectId:'general',note:'Design',start:at('09:00'),end:at('10:00')};const s=setup([entry]);
 s.listeners.pointerdown(s.event('09:30',entry));s.listeners.pointermove(s.event('11:30',entry));
 s.controller.render({...s.data,now:at('23:01')});assert.equal(s.calls.length,0);
 await s.listeners.pointerup(s.event('11:30',entry));assert.equal(s.calls.length,1);
 assert.equal(s.calls[0].after.start,at('11:00'));assert.equal(s.calls[0].after.end,at('12:00'));
});
test('bottom resize changes end only, and tap opens editor',async()=>{
 const entry={id:'a',projectId:'general',note:'Design',start:at('09:00'),end:at('10:00')};const s=setup([entry]);
 s.listeners.pointerdown(s.event('10:00',entry,'end'));s.listeners.pointermove(s.event('10:30',entry,'end'));await s.listeners.pointerup(s.event('10:30',entry,'end'));
 assert.equal(s.calls[0].after.start,at('09:00'));assert.equal(s.calls[0].after.end,at('10:30'));
 s.listeners.pointerdown(s.event('09:30',entry));await s.listeners.pointerup(s.event('09:30',entry));assert.equal(s.calls[1].type,'edit');
});
test('Escape and pointer cancellation never save the preview',async()=>{
 for(const cancel of ['escape','pointercancel']){const s=setup();s.listeners.pointerdown(s.event('09:00'));s.listeners.pointermove(s.event('10:00'));
 if(cancel==='escape')s.globalListeners.keydown({key:'Escape'});else s.listeners.pointercancel();await s.listeners.pointerup(s.event('10:00'));assert.equal(s.calls.length,0);}
});
test('colliding moves are rejected without committing',async()=>{
 const a={id:'a',projectId:'general',note:'A',start:at('09:00'),end:at('10:00')},b={...a,id:'b',start:at('11:00'),end:at('12:00')};const s=setup([a,b]);
 s.listeners.pointerdown(s.event('09:30',a));s.listeners.pointermove(s.event('11:30',a));await s.listeners.pointerup(s.event('11:30',a));assert.equal(s.calls[0].type,'notice');assert.equal(s.calls.some(c=>c.type==='adjust'),false);
});

test('fast release uses pointerup coordinates, including when no move event arrived',async()=>{
 const entry={id:'a',projectId:'general',note:'Design',start:at('09:00'),end:at('10:00')};
 for(const moveEvent of [true,false]){
  const s=setup([entry]);s.listeners.pointerdown(s.event('09:30',entry));
  if(moveEvent)s.listeners.pointermove(s.event('09:31',entry));
  await s.listeners.pointerup(s.event('11:30',entry));
  assert.equal(s.calls[0].type,'adjust');assert.equal(s.calls[0].after.start,at('11:00'));
 }
});
test('release recalculates resize and new selections at the final position',async()=>{
 const entry={id:'a',projectId:'general',note:'Design',start:at('09:00'),end:at('10:00')};
 const s=setup([entry]);s.listeners.pointerdown(s.event('10:00',entry,'end'));s.listeners.pointermove(s.event('10:10',entry,'end'));
 await s.listeners.pointerup(s.event('10:30',entry,'end'));assert.equal(s.calls[0].after.end,at('10:30'));
 const empty=setup();empty.listeners.pointerdown(empty.event('11:00'));empty.listeners.pointermove(empty.event('11:10'));
 await empty.listeners.pointerup(empty.event('12:00'));assert.equal(empty.calls[0].end,at('12:00'));
});
test('release validates the final position instead of a stale valid or invalid preview',async()=>{
 const a={id:'a',projectId:'general',note:'A',start:at('09:00'),end:at('10:00')},b={...a,id:'b',start:at('11:00'),end:at('12:00')};
 const s=setup([a,b]);s.listeners.pointerdown(s.event('09:30',a));s.listeners.pointermove(s.event('11:30',a));await s.listeners.pointerup(s.event('13:30',a));assert.equal(s.calls[0].after.start,at('13:00'));
 const blocked=setup([a,b]);blocked.listeners.pointerdown(blocked.event('09:30',a));blocked.listeners.pointermove(blocked.event('13:30',a));await blocked.listeners.pointerup(blocked.event('11:30',a));assert.equal(blocked.calls[0].type,'notice');
});
test('keeps the preview during asynchronous saving and renders only the persisted result',async()=>{
 const entry={id:'a',projectId:'general',note:'Design',start:at('09:00'),end:at('10:00')};
 let resolve;const saved=new Promise(r=>resolve=r);const s=setup([entry],()=>saved);
 s.listeners.pointerdown(s.event('09:30',entry));s.listeners.pointermove(s.event('11:30',entry));
 const previous=s.surface.innerHTML;const pending=s.listeners.pointerup(s.event('11:30',entry));
 const moved=s.calls[0].after;s.controller.render({...s.data,entries:[moved]});
 assert.equal(s.surface.innerHTML,previous);assert.equal(s.preview.hidden,false);
 s.listeners.pointerdown(s.event('12:00'));await s.listeners.pointerup(s.event('13:00'));assert.equal(s.calls.length,1);
 resolve(true);await pending;assert.notEqual(s.surface.innerHTML,previous);assert.match(s.surface.innerHTML,/11:00–12:00/);
});

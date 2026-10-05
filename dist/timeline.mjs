import {dateKey, dayBounds, human} from './core.mjs';
import {HOUR_HEIGHT, timelineHeight, yToTime, timeToY, createRange, adjustRange, rangeError, layoutEntries} from './timeline-model.mjs';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock = value => new Date(value).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});

export function createTimeline({surface, viewport, message, onCreate, onEdit, onAdjust, onNotice}) {
  let data, gesture=null, saving=false, frame=0, drawTouch=false, lastDay=null, focusedEntry=null;
  const $ = selector => surface.querySelector(selector);
  function label(start,end) { return `${clock(start)}–${end===dayBounds(data.day)[1]?'24:00':clock(end)} · ${human(end-start)}`; }
  function render(next) {
    data=next;
    if (gesture || saving) return;
    const {day, entries, projects, now=Date.now()} = data;
    const [start,end]=dayBounds(day), height=timelineHeight(day);
    surface.style.height=`${height+28}px`;
    const {blocks,lanes}=layoutEntries(entries,day,now);
    const grid=[];
    for(let at=start;at<=end;at+=3600000){
      const text=at===end?'24:00':clock(at);
      const repeated=at<end && (clock(at-3600000)===text || clock(at+3600000)===text);
      const zone=repeated?` <small>${new Date(at).toLocaleTimeString('sv-SE',{timeZoneName:'shortOffset'}).split(' ').pop()}</small>`:'';
      grid.push(`<div class="hour-line" style="top:${timeToY(at,day)}px"><span>${text}${zone}</span></div>`);
    }
    const current=day===dateKey(now)?`<div class="now-line" style="top:${timeToY(now,day)}px"><span>${clock(now)}</span></div>`:'';
    const activeBlock=document.activeElement?.closest?.('[data-entry]');
    if(activeBlock && surface.contains(activeBlock))focusedEntry=activeBlock.dataset.entry;
    surface.innerHTML=grid.join('')+blocks.map(({entry,top,height:bh,lane})=>{
      const p=projects.find(p=>p.id===entry.projectId), running=!entry.end;
      const name=entry.note||p.name;
      const startHandle=entry.start>=start?'<span class="resize-handle top" data-mode="start" title="Dra för att ändra starttid"></span>':'';
      const endHandle=!running && entry.end<=end?'<span class="resize-handle bottom" data-mode="end" title="Dra för att ändra sluttid"></span>':'';
      return `<div class="time-block ${running?'is-running':''} ${bh<58?'compact-block':''}" role="button" tabindex="0" data-entry="${escape(entry.id)}" aria-label="${escape(name)}, ${label(entry.start,entry.end??now)}${running?', pågår. Dra överkanten eller använd Alt och pil upp eller ned för att ändra starttiden.':'. Enter för att redigera. Pil upp eller ned flyttar fem minuter.'}" title="${escape(name)} · ${label(entry.start,entry.end??now)}" style="--block-color:${p.color};top:${top}px;height:${bh}px;left:calc(70px + (100% - 86px) * ${lane/lanes});width:calc((100% - 86px) / ${lanes} - 4px)">${startHandle}<div class="block-body"><span class="block-time">${label(Math.max(entry.start,start),Math.min(entry.end??now,end))}${running?' · Pågår':''}</span><strong>${escape(name)}</strong><span class="block-project">${escape(p.name)}</span></div>${endHandle}</div>`;
    }).join('')+current+'<div class="drag-preview" hidden></div>';
    if (focusedEntry) { const el=Array.from(surface.querySelectorAll('[data-entry]')).find(el=>el.dataset.entry===focusedEntry);el?.focus({preventScroll:true});focusedEntry=null; }
    if(lastDay!==day){
      lastDay=day;
      const first=blocks[0]?.entry.start;
      const target=first ? Math.max(start,first-1800000) : day===dateKey(now) ? Math.max(start,now-2*3600000) : start+8*3600000;
      viewport.scrollTop=timeToY(target,day);
    }
  }
  function point(event){return yToTime(event.clientY-surface.getBoundingClientRect().top,data.day);}
  function showPreview(range,error){
    const preview=$('.drag-preview');
    if (!range){preview.hidden=true;message.textContent=error;return;}
    const end=Math.min(range.end??data.now??Date.now(),dayBounds(data.day)[1]);
    preview.hidden=false;
    preview.classList.toggle('invalid',!!error);
    preview.style.top=`${timeToY(range.start,data.day)}px`;
    preview.style.height=`${Math.max(26,(end-range.start)/3600000*HOUR_HEIGHT)}px`;
    preview.textContent=label(range.start,end);
    message.textContent=error || `${gesture.mode==='create'?'Ny tid':gesture.mode==='move'?'Flytta tid':'Ändra tid'}: ${label(range.start,end)}`;
  }
  function updatePreview(){
    if(!gesture?.moved)return;
    const current=point({clientY:gesture.clientY});
    const candidate=gesture.mode==='create'
      ? createRange(gesture.anchor,current,gesture.day,data.entries)
      : adjustRange(gesture.original,gesture.mode,current-gesture.anchor,gesture.day,data.entries,data.now??Date.now());
    gesture.candidate=candidate;
    const error=candidate?rangeError(candidate,data.entries,gesture.original?.id,data.now??Date.now()):'Ändringen ryms inte här. Välj ledig tid inom dagen.';
    gesture.error=error;
    gesture.preview=candidate||gesture.preview;
    showPreview(gesture.preview,error);
  }
  function autoScroll(){
    if(!gesture?.moved)return;
    const box=viewport.getBoundingClientRect();
    const delta=gesture.clientY<box.top+40?-12:gesture.clientY>box.bottom-40?12:0;
    if(delta){viewport.scrollTop+=delta;updatePreview();}
    frame=requestAnimationFrame(autoScroll);
  }
  function cancel(){
    if(!gesture)return;
    const id=gesture.pointerId;gesture=null;cancelAnimationFrame(frame);
    if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
    surface.classList.remove('is-dragging');message.textContent='Ändringen avbröts.';render(data);
  }
  surface.addEventListener('pointerdown',event=>{
    if(event.button!==0 || gesture || saving || !data)return;
    const block=event.target.closest('[data-entry]');
    if(!block && event.clientX-surface.getBoundingClientRect().left<65)return;
    if(event.pointerType==='touch' && !block && !drawTouch)return;
    const original=block && data.entries.find(e=>e.id===block.dataset.entry);
    const mode=block?(event.target.closest('[data-mode]')?.dataset.mode||'move'):'create';
    if(original && !original.end && mode!=='start'){onNotice('Dra i överkanten för att ändra starttiden medan klockan går.');return;}
    gesture={pointerId:event.pointerId,day:data.day,original:original?{...original}:null,mode,anchor:point(event),clientY:event.clientY,startY:event.clientY,moved:false};
    event.preventDefault();surface.setPointerCapture(event.pointerId);
  });
  function samplePointer(event){
    gesture.clientY=event.clientY;
    if(!gesture.moved && Math.abs(event.clientY-gesture.startY)>=4){gesture.moved=true;surface.classList.add('is-dragging');frame=requestAnimationFrame(autoScroll);}
    updatePreview();
  }
  surface.addEventListener('pointermove',event=>{
    if(!gesture || gesture.pointerId!==event.pointerId)return;
    samplePointer(event);
  });
  surface.addEventListener('pointerup',async event=>{
    if(!gesture || gesture.pointerId!==event.pointerId)return;
    // A fast release can arrive after the last delivered pointermove.
    // Recompute from the release coordinates and the current scroll position.
    samplePointer(event);
    const finished=gesture;gesture=null;cancelAnimationFrame(frame);
    if(surface.hasPointerCapture(event.pointerId))surface.releasePointerCapture(event.pointerId);
    saving=true;
    try {
      if(!finished.moved){
        if(finished.original){if(finished.original.end)onEdit(finished.original);else onNotice('Dra i överkanten för att ändra starttiden.');}
        else {const range=createRange(finished.anchor,finished.anchor+30*60000,finished.day,data.entries);if(range)onCreate(range);else onNotice('Välj ett ledigt intervall på dagen.');}
        message.textContent='';return;
      }
      if(finished.error || !finished.candidate){onNotice(finished.error||'Tiden kunde inte ändras.');return;}
      if(finished.mode==='create')onCreate(finished.candidate);
      else if(finished.candidate.start!==finished.original.start || finished.candidate.end!==finished.original.end) await onAdjust(finished.original,finished.candidate);
      message.textContent='';
    } catch {
      onNotice('Tiden kunde inte sparas. Försök igen.');
    } finally {
      // Keep the preview visible until persistence has supplied the updated data.
      saving=false;surface.classList.remove('is-dragging');render(data);
    }
  });
  surface.addEventListener('pointercancel',cancel);
  surface.addEventListener('lostpointercapture',()=>{if(gesture)cancel();});
  window.addEventListener('blur',cancel);
  window.addEventListener('keydown',event=>{if(event.key==='Escape')cancel();});
  surface.addEventListener('keydown',async event=>{
    if(saving)return;
    const block=event.target.closest('[data-entry]');if(!block)return;
    const entry=data.entries.find(e=>e.id===block.dataset.entry);if(!entry)return;
    if(event.key==='Enter' || event.key===' '){event.preventDefault();if(entry.end)onEdit(entry);else onNotice('Dra i överkanten eller använd Alt och pil upp eller ned för att ändra starttiden.');}
    if(['ArrowUp','ArrowDown'].includes(event.key) && (entry.end||event.altKey)){
      event.preventDefault();const mode=event.altKey?'start':event.shiftKey?'end':'move';
      const candidate=adjustRange(entry,mode,event.key==='ArrowUp'?-300000:300000,data.day,data.entries,data.now??Date.now());
      if(candidate){focusedEntry=entry.id;await onAdjust({...entry},candidate);}else onNotice('Ändringen ryms inte här eller överlappar annan tid.');
    }
  });
  return {render,cancel,setDrawTouch(enabled){drawTouch=enabled;surface.classList.toggle('touch-draw',enabled);},focusNow(){viewport.scrollTop=Math.max(0,timeToY(Date.now(),data.day)-viewport.clientHeight/2);}};
}

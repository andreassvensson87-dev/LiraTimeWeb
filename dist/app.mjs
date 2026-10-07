import {VERSION} from './version.mjs';
import {createUpdater} from './update.mjs';
import {KEY,colors,initialState,validState,dateKey,dayBounds,duration,clock,human,overlap,switchProject,archiveProject,summarizeDays,monthGrid} from './core.mjs';
import {createFileStore,createFileMemory} from './file-store.mjs';
import {createTimeline} from './timeline.mjs';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Date(value).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
const localInput=value=>`${dateKey(value)}T${time(value)}:${String(new Date(value).getSeconds()).padStart(2,'0')}`;
let state,route='timer',selectedDay=dateKey(),selectedProject=null,editingId=null,editingProject=null;
let pendingChanges=0;
let toastTimer,storageBroken=false,undoChange=null,showArchived=false,editorOriginal=null;
let summaryFrom=dateKey(),summaryTo=dateKey(),calendarMonth=dateKey().slice(0,7);
let fileConnected=false,rememberedHandle=null;
const fileMemory=createFileMemory();
const fileStore=createFileStore(info=>{fileConnected=info.connected;if(info.connected&&/Endast sparat|inte uppdaterad/.test(info.message))$('#reconnect-file').hidden=false;$('#file-status').textContent=(info.name?info.name+' · ':'')+info.message;$('#disconnect-file').hidden=!info.connected;$('#save-status').textContent=info.connected?(/Endast sparat|inte uppdaterad/.test(info.message)?'Filen är inte uppdaterad':info.message.startsWith('Sparar')?'Sparar till fil…':'Webbläsare + fil'):'Sparas lokalt';});
function read(){const raw=localStorage.getItem(KEY);if(raw===null)return initialState();const saved=JSON.parse(raw);if(!validState(saved))throw Error('Sparad data kunde inte läsas. Återställ en säkerhetskopia.');return saved;}
function storageFeedback(message,error=false){if(!$('#storage-dialog').open)return;const feedback=$('#storage-feedback');feedback.textContent=message;feedback.hidden=false;feedback.classList.toggle('form-error',error);}
function report(message){storageFeedback(message,true);$('#error').textContent=message;$('#error').hidden=false;}
try{state=read();if(localStorage.getItem(KEY)===null)localStorage.setItem(KEY,JSON.stringify(state));}
catch{storageBroken=true;state=initialState();report('Den lokala lagringen kunde inte läsas eller användas. Befintlig data har inte skrivits över.');}
function notify(message){storageFeedback(message);$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
async function change(fn,{restore=false,redraw=true}={}){
 pendingChanges++;
 const run=()=>{try{
  if(storageBroken&&!restore)throw Error('Lagringen är inte tillgänglig. Kontrollera webbläsarens inställningar eller återställ en säkerhetskopia.');
  const next=restore?structuredClone(state):read();fn(next);
  if(!validState(next))throw Error('Uppgifterna har ett ogiltigt format.');
  localStorage.setItem(KEY,JSON.stringify(next));state=next;storageBroken=false;
  $('#error').hidden=true;if(!fileConnected)$('#save-status').textContent=rememberedHandle?'Fil behöver anslutas':'Sparas lokalt';void fileStore.save(next);if(redraw)render();return true;
 }catch(error){report(error.message);$('#save-status').textContent='Ändringen sparades inte';return false;}};
 try{return await (navigator.locks?navigator.locks.request('liratime-write',run):run());}finally{pendingChanges--;}
}
const allEntries=()=>[...state.entries,...(state.active?[state.active]:[])];
const project=id=>state.projects.find(p=>p.id===id);
function options(current){return state.projects.filter(p=>!p.archived||p.id===current).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.archived?' (arkiverat)':''}</option>`).join('');}
function renderSidebar(){
 const active=state.projects.filter(p=>!p.archived).sort((a,b)=>a.name.localeCompare(b.name,'sv',{sensitivity:'base',numeric:true}));
 if(!active.some(p=>p.id===selectedProject))selectedProject=active.find(p=>p.id===state.active?.projectId)?.id||active[0]?.id||null;
 $('#sidebar-projects').innerHTML=active.length?active.map(p=>{
  const running=state.active?.projectId===p.id;
  const total=allEntries().filter(e=>e.projectId===p.id).reduce((sum,e)=>sum+duration(e,dateKey()),0);
  return `<div class="sidebar-project ${running?'running':''} ${selectedProject===p.id?'chosen':''}"><button class="project-select" data-select-project="${esc(p.id)}" title="Välj ${esc(p.name)} för manuell tid"><i style="background:${p.color}"></i><span><strong>${esc(p.name)}</strong><small data-project-total="${esc(p.id)}">${human(total)} idag</small></span></button><button class="project-play" data-project-start="${esc(p.id)}" aria-label="${running?'Stoppa':'Starta'} ${esc(p.name)}" title="${running?'Stoppa':'Starta'} ${esc(p.name)}">${running?'■':'▶'}</button></div>`;
 }).join(''):'<p class="sidebar-empty">Lägg till ett projekt för att börja registrera tid.</p>';
 $('#running-panel').hidden=!state.active;
 if(state.active){
  $('#running-project').textContent=project(state.active.projectId).name;
  const note=$('#running-note');
  if(note.dataset.entry!==state.active.id||document.activeElement!==note)note.value=state.active.note;
  note.dataset.entry=state.active.id;
 }
 tick();
}
function renderDay(){
 if(route!=='timer')return;
 timeline.render({day:selectedDay,entries:allEntries(),projects:state.projects,now:Date.now()});
 const total=allEntries().reduce((sum,e)=>sum+duration(e,selectedDay),0);
 $('#day-total').textContent=`${human(total)} registrerat`;
 $('#date-picker').value=selectedDay;
 $('#day-title').textContent=new Date(selectedDay+'T12:00').toLocaleDateString('sv-SE',{weekday:'short',day:'numeric',month:'long'});
 $('#today').hidden=selectedDay===dateKey();$('#timeline-now').hidden=selectedDay!==dateKey();
}
function renderProjects(){
 const projects=state.projects.filter(p=>!!p.archived===showArchived);
 for(const [id,value] of [['active',false],['archived',true]]){$('#show-'+id).setAttribute('aria-pressed',String(showArchived===value));$('#show-'+id).classList.toggle('selected',showArchived===value);}
 $('#project-list').innerHTML=projects.length?projects.map(p=>{
  const total=allEntries().filter(e=>e.projectId===p.id).reduce((sum,e)=>sum+Math.max(0,(e.end??Date.now())-e.start),0);
  return `<article class="project-row"><i style="background:${p.color}"></i><div class="project-details"><strong>${esc(p.name)}</strong><span>${human(total)} totalt${state.active?.projectId===p.id?' · Pågår':''}</span></div><div class="project-row-actions"><button class="secondary" data-edit-project="${esc(p.id)}">Redigera</button><button class="text-button" data-archive-project="${esc(p.id)}">${p.archived?'Återaktivera':state.active?.projectId===p.id?'Stoppa och arkivera':'Arkivera'}</button></div></article>`;
 }).join(''):`<div class="empty-state">${showArchived?'Inga arkiverade projekt.':'Inga aktiva projekt. Lägg till ett nytt eller återaktivera ett arkiverat.'}</div>`;
}
function reportRange(){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(summaryFrom)||!/^\d{4}-\d{2}-\d{2}$/.test(summaryTo)||summaryFrom>summaryTo)return 'Välj ett giltigt datumintervall.';
 if(new Date(summaryTo)-new Date(summaryFrom)>366*86400000)return 'Välj högst ett år i taget.';
 return '';
}
function renderCalendar(){
 const days=monthGrid(calendarMonth),today=dateKey();
 const totals=new Map(summarizeDays(state,days[0],days[41]).map(d=>[d.day,d.total]));
 $('#calendar-month').textContent=new Date(calendarMonth+'-01T12:00').toLocaleDateString('sv-SE',{month:'long',year:'numeric'});
 $('#calendar-days').innerHTML=days.map(day=>{
  const selected=day>=summaryFrom&&day<=summaryTo,total=totals.get(day)||0;
  const label=new Date(day+'T12:00').toLocaleDateString('sv-SE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return `<button class="calendar-day ${day.slice(0,7)!==calendarMonth?'outside-month':''} ${selected?'selected':''} ${day===today?'is-today':''}" data-calendar-day="${day}" aria-label="${label}${total?' · '+human(total):''}" aria-pressed="${selected}" ${day===today?'aria-current="date"':''} title="${label}${total?' · '+human(total):''}"><span>${Number(day.slice(-2))}</span>${total?'<i aria-hidden="true"></i>':''}</button>`;
 }).join('');
}
function renderSummary(){
 renderCalendar();
 const invalid=reportRange();
 if(invalid){$('#summary-days').innerHTML=`<p class="form-error">${invalid}</p>`;$('#summary-total').textContent='–';return;}
 const days=summarizeDays(state,summaryFrom,summaryTo);
 $('#summary-total').textContent=human(days.reduce((sum,d)=>sum+d.total,0));
 $('#summary-days').innerHTML=days.length?days.map(day=>{
  const [start,end]=dayBounds(day.day);
  return `<section class="report-day"><div class="report-day-heading"><button data-summary-day="${day.day}" title="Visa dagen i tidslinjen">${new Date(day.day+'T12:00').toLocaleDateString('sv-SE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</button><strong>${human(day.total)}</strong></div>${day.projects.map(group=>`<div class="report-project"><div class="report-project-heading"><i style="background:${group.project.color}"></i><strong>${esc(group.project.name)}</strong>${group.project.archived?'<span class="archived-label">Arkiverat</span>':''}<span>${human(group.total)}</span></div>${group.entries.map(e=>`<div class="report-entry"><span class="report-entry-time">${time(Math.max(e.start,start))}–${(e.end??Date.now())>=end?'24:00':time(e.end??Date.now())}${!e.end?' · Pågår':''}</span><p class="${e.note?'':'no-comment'}">${e.note?esc(e.note):'Ingen kommentar'}</p><span class="report-entry-duration">${human(duration(e,day.day))}</span>${e.end?`<button class="text-button" data-edit-entry="${esc(e.id)}" aria-label="Redigera kommentar och tid">✎</button>`:''}</div>`).join('')}</div>`).join('')}</section>`;
 }).join(''):'<div class="empty-state">Ingen registrerad tid under den här perioden.</div>';
}
function render(){
 renderSidebar();
 for(const name of ['timer','projects','summary']){
  $('#'+name+'-view').hidden=route!==name;$('#nav-'+name).classList.toggle('active',route===name);
  if(route===name)$('#nav-'+name).setAttribute('aria-current','page');else $('#nav-'+name).removeAttribute('aria-current');
 }
 if(route==='timer')renderDay();if(route==='projects')renderProjects();if(route==='summary')renderSummary();
}
function navigate(next){timeline.cancel();route=next;render();}
for(const name of ['timer','projects','summary'])$('#nav-'+name).onclick=()=>navigate(name);
function tick(){
 const elapsed=state.active?Date.now()-state.active.start:0;$('#timer-clock').textContent=clock(elapsed);
 document.title=state.active?`${clock(elapsed)} · LiraTime`:'LiraTime';
}
async function start(projectId){
 const ok=await change(s=>switchProject(s,projectId));
 if(ok){selectedProject=projectId;selectedDay=dateKey();navigate('timer');}
}
async function stop(){
 if(await change(s=>{if(s.active){s.entries.push({...s.active,end:Math.max(Date.now(),s.active.start+1)});s.active=null;}}))notify('Tiden är sparad.');
}
$('#stop-timer').onclick=stop;
$('#sidebar-projects').onclick=event=>{
 const play=event.target.closest('[data-project-start]'),select=event.target.closest('[data-select-project]');
 if(play)return state.active?.projectId===play.dataset.projectStart?stop():start(play.dataset.projectStart);
 if(select){selectedProject=select.dataset.selectProject;navigate('timer');}
};
$('#running-note').oninput=async event=>{
 const id=event.target.dataset.entry,note=event.target.value;
 const ok=await change(s=>{const entry=s.active?.id===id?s.active:s.entries.find(e=>e.id===id);if(!entry)throw Error('Registreringen finns inte längre.');entry.note=note;},{redraw:false});
 $('#note-status').textContent=ok?'Kommentaren är sparad':'Kommentaren kunde inte sparas';
};
function moveDay(delta){timeline.cancel();const d=new Date(selectedDay+'T12:00');d.setDate(d.getDate()+delta);selectedDay=dateKey(d);renderDay();}
$('#prev-day').onclick=()=>moveDay(-1);$('#next-day').onclick=()=>moveDay(1);
$('#today').onclick=()=>{timeline.cancel();selectedDay=dateKey();renderDay();};
$('#date-picker').onchange=event=>{if(event.target.value){timeline.cancel();selectedDay=event.target.value;renderDay();}};
function openEntry(entry,preset){
 editingId=entry?.id||null;editorOriginal=entry?{...entry}:null;
 const form=$('#entry-form');form.reset();$('#entry-error').textContent='';$('#entry-dialog-title').textContent=entry?'Redigera tid':'Lägg till tid';$('#delete-entry').hidden=!entry;
 $('#entry-project').innerHTML=options(entry?.projectId);
 const defaultProject=entry?.projectId||selectedProject||state.projects.find(p=>!p.archived)?.id;
 if(!defaultProject){notify('Skapa eller återaktivera ett projekt först.');navigate('projects');return;}
 const end=selectedDay===dateKey()?Date.now():+new Date(selectedDay+'T17:00');
 form.elements.projectId.value=defaultProject;form.elements.note.value=entry?.note||'';
 form.elements.start.value=localInput(entry?.start??preset?.start??end-3600000);form.elements.end.value=localInput(entry?.end??preset?.end??end);
 $('#entry-dialog').showModal();
}
$('#manual').onclick=()=>openEntry();
$('#entry-form').onsubmit=async event=>{
 event.preventDefault();const form=new FormData(event.target),original=editorOriginal;
 const start=original&&form.get('start')===localInput(original.start)?original.start:+new Date(form.get('start'));
 const end=original&&form.get('end')===localInput(original.end)?original.end:+new Date(form.get('end'));
 $('#entry-error').textContent='';
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start){$('#entry-error').textContent='Sluttiden behöver vara efter starttiden.';return;}
 const entry={id:editingId||crypto.randomUUID(),projectId:form.get('projectId'),note:form.get('note').trim(),start,end};
 const ok=await change(s=>{
  const existing=s.entries.find(e=>e.id===editingId),p=s.projects.find(p=>p.id===entry.projectId);
  if(!p||p.archived&&existing?.projectId!==p.id)throw Error('Välj ett aktivt projekt för ny tid.');
  if(editingId&&(!existing||JSON.stringify(existing)!==JSON.stringify(original)))throw Error('Registreringen har ändrats i en annan flik. Öppna den igen.');
  if(overlap([...s.entries,...(s.active?[s.active]:[])],entry,editingId))throw Error('Tiden överlappar en annan registrering.');
  s.entries=[...s.entries.filter(e=>e.id!==editingId),entry];
 });
 if(ok){$('#entry-dialog').close();notify('Registreringen är sparad.');}else $('#entry-error').textContent=$('#error').textContent;
};
$('#delete-entry').onclick=async()=>{
 if(!confirm('Ta bort den här tidsregistreringen?'))return;
 if(await change(s=>{s.entries=s.entries.filter(e=>e.id!==editingId);})){ $('#entry-dialog').close();notify('Registreringen är borttagen.');}
};
function openProject(p){
 editingProject=p?.id||null;$('#project-form').reset();$('#project-error').textContent='';$('#project-dialog-title').textContent=p?'Redigera projekt':'Nytt projekt';
 $('#project-form').elements.name.value=p?.name||'';$('#project-form').elements.color.value=p?.color||colors[state.projects.length%colors.length];$('#project-dialog').showModal();
}
$('#add-project').onclick=()=>openProject();$('#new-project-bottom').onclick=()=>openProject();
$('#project-form').onsubmit=async event=>{
 event.preventDefault();const form=new FormData(event.target),name=form.get('name').trim(),id=editingProject||crypto.randomUUID();
 if(!name){$('#project-error').textContent='Ange ett projektnamn.';return;}
 const ok=await change(s=>{if(editingProject){const p=s.projects.find(p=>p.id===id);if(!p)throw Error('Projektet finns inte längre.');p.name=name;p.color=form.get('color');}else s.projects.push({id,name,color:form.get('color'),archived:false});});
 if(ok){if(!editingProject){selectedProject=id;showArchived=false;render();}$('#project-dialog').close();notify('Projektet är sparat.');}else $('#project-error').textContent=$('#error').textContent;
};
$('#project-list').onclick=async event=>{
 const edit=event.target.closest('[data-edit-project]'),archive=event.target.closest('[data-archive-project]');
 if(edit)openProject(project(edit.dataset.editProject));
 if(archive){const id=archive.dataset.archiveProject,archived=!project(id).archived;if(await change(s=>archiveProject(s,id,archived)))notify(archived?'Projektet är arkiverat. Tid och kommentarer finns kvar.':'Projektet är aktivt igen.');}
};
$('#show-active').onclick=()=>{showArchived=false;renderProjects();};$('#show-archived').onclick=()=>{showArchived=true;renderProjects();};
$('#summary-from').value=summaryFrom;$('#summary-to').value=summaryTo;
$('#summary-from').onchange=event=>{summaryFrom=event.target.value;if(summaryFrom)calendarMonth=summaryFrom.slice(0,7);renderSummary();};$('#summary-to').onchange=event=>{summaryTo=event.target.value;renderSummary();};
function setSummaryRange(from,to){summaryFrom=from;summaryTo=to;calendarMonth=from.slice(0,7);$('#summary-from').value=from;$('#summary-to').value=to;renderSummary();}
$('#calendar-days').onclick=event=>{const button=event.target.closest('[data-calendar-day]');if(button)setSummaryRange(button.dataset.calendarDay,button.dataset.calendarDay);};
function moveCalendar(delta){const month=new Date(calendarMonth+'-01T12:00');month.setMonth(month.getMonth()+delta);calendarMonth=dateKey(month).slice(0,7);renderCalendar();}
$('#calendar-prev').onclick=()=>moveCalendar(-1);$('#calendar-next').onclick=()=>moveCalendar(1);
$('#calendar-today').onclick=()=>setSummaryRange(dateKey(),dateKey());
$('#summary-today').onclick=()=>setSummaryRange(dateKey(),dateKey());
$('#summary-week').onclick=()=>{const monday=new Date();monday.setDate(monday.getDate()-(monday.getDay()+6)%7);setSummaryRange(dateKey(monday),dateKey());};
$('#summary-days').onclick=event=>{
 const date=event.target.closest('[data-summary-day]'),edit=event.target.closest('[data-edit-entry]');
 if(date){selectedDay=date.dataset.summaryDay;navigate('timer');}
 if(edit)openEntry(state.entries.find(e=>e.id===edit.dataset.editEntry));
};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$('#'+button.dataset.close).close();
async function adjustEntry(original,candidate,{undo=false}={}){
 const ok=await change(s=>{const existing=original.end?s.entries.find(e=>e.id===original.id):s.active?.id===original.id?s.active:null;
  if(!existing||existing.start!==original.start||existing.end!==original.end)throw Error('Tiden ändrades i en annan flik. Ladda om och försök igen.');
  if(!original.end){
   if(candidate.end!==undefined||!Number.isFinite(candidate.start)||candidate.start<=0||candidate.start>=Date.now())throw Error('Starttiden måste vara före nu.');
   if(overlap(s.entries,{start:candidate.start,end:Date.now()}))throw Error('Tiden överlappar en annan registrering.');
   existing.start=candidate.start;return;
  }
  if(candidate.end<=candidate.start)throw Error('Sluttiden behöver vara efter starttiden.');
  if(overlap([...s.entries,...(s.active?[s.active]:[])],candidate,original.id))throw Error('Tiden överlappar en annan registrering.');
  existing.start=candidate.start;existing.end=candidate.end;
 });
 if(ok){undoChange=undo?null:{before:original,after:candidate};$('#undo-time').hidden=!undoChange;notify(undo?'Tidsändringen är ångrad.':'Tiden är uppdaterad.');}return ok;
}
const timeline=createTimeline({surface:$('#timeline-surface'),viewport:$('#timeline-scroll'),message:$('#timeline-message'),onCreate:range=>openEntry(null,range),onEdit:openEntry,onAdjust:adjustEntry,onNotice:notify});
$('#undo-time').onclick=()=>{if(undoChange)return adjustEntry(undoChange.after,undoChange.before,{undo:true});};
$('#draw-touch').onclick=()=>{const enabled=$('#draw-touch').getAttribute('aria-pressed')!=='true';$('#draw-touch').setAttribute('aria-pressed',String(enabled));timeline.setDrawTouch(enabled);};
$('#timeline-now').onclick=()=>timeline.focusNow();

$('#storage-settings').onclick=()=>{$('#storage-feedback').hidden=true;$('#storage-dialog').showModal();};

const fileSupported=typeof window.showSaveFilePicker==='function'&&typeof window.showOpenFilePicker==='function';
$('#create-file').disabled=!fileSupported;$('#open-file').disabled=!fileSupported;
if(!fileSupported)$('#file-help').textContent='Direkt fillagring kräver Chrome eller Edge på datorn. Webbläsarlagring och säkerhetskopior fungerar här.';
const pickerTypes=[{description:'LiraTime tidsfil',accept:{'application/json':['.json']}}];
let choosingFile=false;
function pendingFile(message,{conflict=false}={}){
 $('#save-status').textContent='Fil behöver anslutas';
 $('#file-status').textContent=rememberedHandle.name+' · '+message+' Ändringar sparas tills vidare i webbläsaren.';
 $('#reconnect-file').hidden=false;$('#disconnect-file').hidden=false;
 $('#read-remembered-file').hidden=!conflict;$('#write-remembered-file').hidden=!conflict;
}
function hideFileChoices(){for(const id of ['reconnect-file','read-remembered-file','write-remembered-file'])$('#'+id).hidden=true;}
async function rememberFile(handle){
 rememberedHandle=handle;hideFileChoices();
 try{await fileMemory.save(handle);}catch{ $('#file-help').textContent='Filen fungerar nu, men filvalet kunde inte kommas ihåg. Välj filen igen efter omladdning.'; }
}
async function readTimeFile(handle){
 const file=await handle.getFile();if(file.size>10000000)throw Error('Välj en fil under 10 MB.');
 const text=await file.text(),data=JSON.parse(text);
 if(!validState(data))throw Error('Filen är inte en giltig LiraTime-tidsfil.');
 return {text,data};
}
async function resumeFile(mode='compare',request=false){
 if(choosingFile||!rememberedHandle)return;
 choosingFile=true;const handle=rememberedHandle;
 try{
  // Permission prompts must be initiated by the user's click.
  const permission=request?await handle.requestPermission({mode:'readwrite'}):await handle.queryPermission({mode:'readwrite'});
  if(permission!=='granted'){pendingFile('Godkänn åtkomsten med Anslut sparad fil.');return;}
  const {text,data}=await readTimeFile(handle);
  const run=async()=>{
   const local=read(),same=JSON.stringify(local)===JSON.stringify(data);
   if(!same&&mode==='compare'){pendingFile('Filen och webbläsaren innehåller olika uppgifter. Välj vilken version som ska användas.',{conflict:true});return;}
   if(!same&&!confirm(mode==='read'?'Ersätt webbläsarens uppgifter med den sparade filens uppgifter?':'Ersätt filens uppgifter med uppgifterna från webbläsaren?'))return;
   await fileStore.disconnect();
   if(mode==='read'){localStorage.setItem(KEY,JSON.stringify(data));state=data;storageBroken=false;render();}
   await fileStore.connect(handle,text);hideFileChoices();
   if(mode==='write')await fileStore.save(local);
  };
  await (navigator.locks?navigator.locks.request('liratime-write',run):run());
 }catch(error){pendingFile('Filen kunde inte anslutas. '+(error instanceof SyntaxError?'Ogiltigt filinnehåll.':error.message));}
 finally{choosingFile=false;}
}
async function chooseFile(open){
 if(choosingFile)return;choosingFile=true;$('#storage-feedback').hidden=true;
 try{
  const handle=open?(await window.showOpenFilePicker({types:pickerTypes,multiple:false}))[0]:await window.showSaveFilePicker({suggestedName:'LiraTime.json',types:pickerTypes});
  const file=await handle.getFile();if(file.size>10000000)throw Error('Välj en fil under 10 MB.');
  const text=await file.text();
  if(open){
   const data=JSON.parse(text);if(!validState(data))throw Error('Filen är inte en giltig LiraTime-tidsfil.');
   if(!confirm(`Öppna ${handle.name} med ${data.projects.length} projekt och ${data.entries.length} registreringar? Det ersätter uppgifterna i webbläsaren. Ta en säkerhetskopia först om du vill behålla dem.`))return;
   if(await handle.requestPermission({mode:'readwrite'})!=='granted')throw Error('Skrivåtkomst till filen behövs.');
   await fileStore.disconnect();
   if(!await change(s=>Object.assign(s,data),{restore:true}))return;
   await fileStore.connect(handle,text);await rememberFile(handle);
  }else{
   if(text&&!confirm('Filen innehåller redan data. Ersätt den med uppgifterna från webbläsaren?'))return;
   const run=async()=>{await fileStore.connect(handle,text);await fileStore.save(read());await rememberFile(handle);};
   await (navigator.locks?navigator.locks.request('liratime-write',run):run());
  }
 }catch(error){if(error.name!=='AbortError')report(error instanceof SyntaxError?'Filen kunde inte läsas som en LiraTime-tidsfil.':error.message);}
 finally{choosingFile=false;}
}
$('#create-file').onclick=()=>chooseFile(false);$('#open-file').onclick=()=>chooseFile(true);
$('#reconnect-file').onclick=()=>resumeFile('compare',true);
$('#read-remembered-file').onclick=()=>resumeFile('read',true);
$('#write-remembered-file').onclick=()=>resumeFile('write',true);
$('#disconnect-file').onclick=async()=>{
 if(choosingFile)return;
 await fileStore.disconnect();rememberedHandle=null;hideFileChoices();
 try{await fileMemory.clear();}catch{report('Filen är frånkopplad nu, men det sparade filvalet kunde inte tas bort.');}
};
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#backup').onclick=()=>{try{const data=read();download(JSON.stringify(data,null,2),`LiraTime-backup-${dateKey()}.json`,'application/json');notify('Säkerhetskopian har laddats ner.');}catch{report('Säkerhetskopian kunde inte skapas eftersom sparad data inte kunde läsas.');}};
$('#restore').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>10000000)throw Error('Filen är för stor. Välj en säkerhetskopia under 10 MB.');const data=JSON.parse(await file.text());if(!validState(data))throw Error('Filen är inte en giltig LiraTime-säkerhetskopia.');if(!confirm(`Återställ ${data.entries.length} registreringar och ${data.projects.length} projekt? Det ersätter all data i den här webbläsaren${data.active?' och återupptar säkerhetskopians pågående klocka':''}.`))return;if(await change(s=>{Object.assign(s,data);},{restore:true}))notify('Säkerhetskopian är återställd.');}catch(err){report(err instanceof SyntaxError?'Filen kunde inte läsas som en säkerhetskopia.':err.message);}finally{e.target.value='';}};
$('#restore-button').onclick=()=>$('#restore').click();
$('#export-csv').onclick=()=>{
 const invalid=reportRange();if(invalid){notify(invalid);return;}
 const days=summarizeDays(state,summaryFrom,summaryTo);if(!days.length){notify('Det finns ingen tid att exportera i perioden.');return;}
 const cell=value=>'"'+String(value).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 const rows=[['Datum','Projekt','Kommentar','Start','Slut','Sekunder','Status']];
 for(const day of [...days].reverse()){const [start,end]=dayBounds(day.day);for(const group of day.projects)for(const entry of group.entries)rows.push([day.day,group.project.name,entry.note,time(Math.max(entry.start,start)),(entry.end??Date.now())>=end?'24:00':time(entry.end??Date.now()),Math.floor(duration(entry,day.day)/1000),entry.end?'Sparad':'Pågår']);}
 download('\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),`LiraTime-${summaryFrom}-${summaryTo}.csv`,'text/csv;charset=utf-8');
};
window.addEventListener('storage',event=>{if(event.key===KEY){try{state=read();void fileStore.save(state);render();}catch(error){report(error.message);}}});
let lastDay=dateKey(),lastMinute=Math.floor(Date.now()/60000);
setInterval(()=>{
 tick();const now=Date.now(),minute=Math.floor(now/60000);
 if(state.active&&route==='timer')renderDay();
 if(minute!==lastMinute){renderSidebar();if(route==='summary')renderSummary();else if(route==='timer')renderDay();lastMinute=minute;}
 const today=dateKey();if(today!==lastDay){if(selectedDay===lastDay)selectedDay=today;lastDay=today;render();}
},1000);
render();

window.addEventListener('beforeunload',event=>{if(fileStore.pending){event.preventDefault();event.returnValue='';}});

export const fileReady=(async()=>{
 if(!fileSupported)return;
 $('#create-file').disabled=true;$('#open-file').disabled=true;
 try{rememberedHandle=await fileMemory.load();if(rememberedHandle)await resumeFile();}
 catch{ $('#file-help').textContent='Det sparade filvalet kunde inte läsas. Du kan välja filen på nytt.'; }
 finally{$('#create-file').disabled=false;$('#open-file').disabled=false;}
})();

const updater=createUpdater({
 version:VERSION,button:$('#update-app'),status:$('#update-status'),container:$('#app-update'),
 fetchVersion:async()=>{const url=new URL('./version.json',import.meta.url);url.searchParams.set('check',Date.now());const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Offline');return response.json();},
 beforeUpdate:()=>{
  if($('#entry-dialog').open||$('#project-dialog').open)return 'Spara eller stäng formuläret innan du uppdaterar.';
  if(storageBroken)return 'Säkra dina uppgifter innan du uppdaterar. Webbläsarlagringen fungerar inte.';
  if(pendingChanges||fileStore.pending||choosingFile)return 'En ändring sparas. Försök igen om en stund.';
  timeline.cancel();return '';
 },
 reload:version=>{const url=new URL(window.location.href);url.searchParams.set('release',version);window.location.replace(url.href);}
});
void updater.check();
window.addEventListener('focus',()=>void updater.check());
setInterval(()=>{if(!document.hidden)void updater.check();},15*60*1000);

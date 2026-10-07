export const KEY = 'liratime.v1';
export const colors = ['#197568', '#6285cb', '#b17ac1', '#db9b47', '#df7570', '#74878e'];
export function initialState() { return {version:1,projects:[{id:'general',name:'Allmänt',color:colors[0]}],entries:[],active:null}; }
export function validState(s) {
 const project = p => p && typeof p.id==='string' && typeof p.name==='string' && p.name.length>0 && (p.archived===undefined||typeof p.archived==='boolean') && /^#[0-9a-f]{6}$/i.test(p.color);
 const entry = e => e && typeof e.id==='string' && typeof e.note==='string' && s.projects.some(p=>p.id===e.projectId) && Number.isFinite(e.start) && e.start>0;
 return !!(s && s.version===1 && Array.isArray(s.projects) && s.projects.length && s.projects.every(project) && new Set(s.projects.map(p=>p.id)).size===s.projects.length && Array.isArray(s.entries) && s.entries.every(e=>entry(e)&&Number.isFinite(e.end)&&e.end>e.start) && new Set(s.entries.map(e=>e.id)).size===s.entries.length && (s.active===null || entry(s.active)));
}
export function dateKey(date=new Date()) { const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function dayBounds(key) { const start=new Date(key+'T00:00:00'); const end=new Date(start); end.setDate(end.getDate()+1); return [+start,+end]; }
export function duration(entry,key,now=Date.now()) {const [a,b]=dayBounds(key); return Math.max(0,Math.min(entry.end??now,b)-Math.max(entry.start,a));}
export function clock(ms) {const s=Math.max(0,Math.floor(ms/1000)); return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');}
export function human(ms) {const m=Math.floor(ms/60000); return `${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')} min`;}
export function overlap(entries,entry,ignoreId) {return entries.some(e=>e.id!==ignoreId && entry.start<(e.end??Infinity) && entry.end>e.start);}

export function switchProject(state, projectId, now=Date.now()) {
 const p=state.projects.find(p=>p.id===projectId);
 if(!p || p.archived)throw Error('Projektet är arkiverat eller finns inte längre.');
 if(state.active?.projectId===projectId)return;
 if(state.active){const end=Math.max(now,state.active.start+1);state.entries.push({...state.active,end});now=end;}
 state.active={id:crypto.randomUUID(),projectId,note:'',start:now};
}
export function archiveProject(state, projectId, archived=true, now=Date.now()) {
 const p=state.projects.find(p=>p.id===projectId);
 if(!p)throw Error('Projektet finns inte längre.');
 if(archived && state.active?.projectId===projectId){state.entries.push({...state.active,end:Math.max(now,state.active.start+1)});state.active=null;}
 p.archived=archived;
}
export function summarizeDays(state, from, to, now=Date.now()) {
 const result=[],all=[...state.entries,...(state.active?[state.active]:[])];
 let day=from;
 while(day<=to){
  const projects=state.projects.map(project=>{
   const entries=all.filter(e=>e.projectId===project.id && duration(e,day,now)>0).sort((a,b)=>a.start-b.start);
   return {project,entries,total:entries.reduce((s,e)=>s+duration(e,day,now),0)};
  }).filter(group=>group.entries.length);
  if(projects.length)result.push({day,projects,total:projects.reduce((s,p)=>s+p.total,0)});
  const next=new Date(day+'T12:00:00');next.setDate(next.getDate()+1);day=dateKey(next);
 }
 return result.reverse();
}

export function monthGrid(month) {
 const first=new Date(month+'-01T12:00:00');
 first.setDate(first.getDate()-(first.getDay()+6)%7);
 return Array.from({length:42},(_,index)=>{const day=new Date(first);day.setDate(day.getDate()+index);return dateKey(day);});
}

export function sortedProjects(state, mode='name', now=Date.now()) {
 const entries=[...state.entries,...(state.active?[state.active]:[])], totals=new Map(), recent=new Map();
 for(const entry of entries){
  totals.set(entry.projectId,(totals.get(entry.projectId)||0)+duration(entry,dateKey(now),now));
  if(entry.start<=now)recent.set(entry.projectId,Math.max(recent.get(entry.projectId)||0,Math.min(entry.end??now,now)));
 }
 const name=(a,b)=>a.name.localeCompare(b.name,'sv',{sensitivity:'base',numeric:true});
 return state.projects.filter(p=>!p.archived).sort((a,b)=>{
  if(mode==='name-desc')return name(b,a);
  if(mode==='today')return (totals.get(b.id)||0)-(totals.get(a.id)||0)||name(a,b);
  if(mode==='recent')return (recent.get(b.id)||0)-(recent.get(a.id)||0)||name(a,b);
  return name(a,b);
 });
}

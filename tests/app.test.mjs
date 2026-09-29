import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY,initialState} from '../dist/core.mjs';

// Minimal DOM adapter lets us exercise the application's event handlers and storage
// without depending on a browser driver. Layout is checked separately in-browser.
const nodes=new Map(),data=new Map();
function element(){return {value:'',dataset:{},hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},setAttribute(){},removeAttribute(){},classList:{toggle(){},add(){},remove(){}},elements:{name:{value:'',setCustomValidity(){}},color:{value:'#197568'}},querySelectorAll(){return [];},append(){},reset(){},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},dispatchEvent(){}};}
globalThis.document={title:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},querySelectorAll(){return [];},createElement:element};
globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
globalThis.window={addEventListener(){},scrollTo(){}};
const interval=globalThis.setInterval,timeout=globalThis.setTimeout;
globalThis.setInterval=()=>0;globalThis.setTimeout=()=>0;
const $=s=>document.querySelector(s);
const saved=()=>JSON.parse(data.get(KEY));
await import('../dist/app.mjs');

test('timer start persists selected project and note immediately',async()=>{
 await $('#sidebar-projects').onclick({target:{closest:selector=>selector==='[data-project-start]'?{dataset:{projectStart:'general'}}:null}});
 $('#running-note').value='Focused work';await $('#running-note').oninput({target:$('#running-note')});
 assert.equal(saved().active.note,'Focused work');assert.equal(saved().active.projectId,'general');assert.equal($('#running-panel').hidden,false);
});
test('reload restores the same active timer; stop saves a completed entry',async()=>{
 const start=saved().active.start;
 await import('../dist/app.mjs?reload');
 assert.equal(saved().active.start,start);assert.equal($('#running-note').value,'Focused work');
 await $('#stop-timer').onclick();
 assert.equal(saved().active,null);assert.equal(saved().entries.length,1);assert.equal(saved().entries[0].start,start);assert.ok(saved().entries[0].end>start);
});
test('switching projects uses current persisted state and retains comments',async()=>{
 const other=saved();other.projects.push({id:'second',name:'Other',color:'#6285cb'});other.active={id:'external',projectId:'general',note:'Other tab comment',start:Date.now()-10000};localStorage.setItem(KEY,JSON.stringify(other));
 await $('#sidebar-projects').onclick({target:{closest:selector=>selector==='[data-project-start]'?{dataset:{projectStart:'second'}}:null}});
 assert.equal(saved().active.projectId,'second');assert.equal(saved().entries.at(-1).note,'Other tab comment');assert.equal(saved().entries.at(-1).end,saved().active.start);
});
test('storage failure never claims a timer was saved',async()=>{
 localStorage.setItem(KEY,JSON.stringify(initialState()));const write=localStorage.setItem;
 localStorage.setItem=()=>{throw Error('Storage full');};
 await $('#sidebar-projects').onclick({target:{closest:selector=>selector==='[data-project-start]'?{dataset:{projectStart:'general'}}:null}});assert.equal(saved().active,null);assert.equal($('#save-status').textContent,'Ändringen sparades inte');localStorage.setItem=write;
});
test('timeline adjustments persist and undo restores the exact original timestamps',async()=>{
 const fixture=initialState();const start=+new Date('2026-09-28T09:00:00');
 fixture.entries=[{id:'dragged',projectId:'general',note:'Design',start,end:start+3600000}];
 localStorage.setItem(KEY,JSON.stringify(fixture));
 await import('../dist/app.mjs?timeline-undo');
 $('#date-picker').onchange({target:{value:'2026-09-28'}});
 await $('#timeline-surface').listeners.keydown({key:'ArrowDown',preventDefault(){},target:{closest:()=>({dataset:{entry:'dragged'}})}});
 assert.equal(saved().entries[0].start,start+300000);assert.equal(saved().entries[0].end,start+3900000);
 assert.equal($('#undo-time').hidden,false);
 await $('#undo-time').onclick();assert.equal(saved().entries[0].start,start);assert.equal(saved().entries[0].end,start+3600000);
 assert.equal($('#undo-time').hidden,true);
});

test.after(()=>{globalThis.setInterval=interval;globalThis.setTimeout=timeout;});

test('calendar day click filters summary to that day and synchronizes date inputs',()=>{
 $('#nav-summary').onclick();
 $('#calendar-days').onclick({target:{closest:()=>({dataset:{calendarDay:'2026-09-28'}})}});
 assert.equal($('#summary-from').value,'2026-09-28');assert.equal($('#summary-to').value,'2026-09-28');
 assert.match($('#summary-days').innerHTML,/Design/);assert.equal($('#summary-total').textContent,'1 h 00 min');
 $('#calendar-days').onclick({target:{closest:()=>({dataset:{calendarDay:'2026-09-27'}})}});
 assert.match($('#summary-days').innerHTML,/Ingen registrerad tid/);
 $('#calendar-prev').onclick();assert.match($('#calendar-month').textContent,/augusti/);
 assert.equal($('#summary-from').value,'2026-09-27');
});

test('optional file saves subsequent changes and disconnect keeps browser data',async()=>{
 let text='',writes=0;
 const handle={name:'test.json',async getFile(){return {size:text.length,text:async()=>text};},async createWritable(){return {async write(value){text=value;},async close(){writes++;},async abort(){}};}};
 window.showSaveFilePicker=async()=>handle;
 await $('#create-file').onclick();assert.deepEqual(JSON.parse(text),saved());
 await $('#sidebar-projects').onclick({target:{closest:s=>s==='[data-project-start]'?{dataset:{projectStart:'general'}}:null}});
 await $('#disconnect-file').onclick();assert.deepEqual(JSON.parse(text),saved());assert.ok(writes>=2);
 const before=text;await $('#stop-timer').onclick();assert.equal(text,before);assert.equal(saved().active,null);
});
test('opening a file loads its state; invalid files leave browser data intact',async()=>{
 const imported=initialState();imported.projects[0].name='From file';let text=JSON.stringify(imported);
 window.showOpenFilePicker=async()=>[{name:'existing.json',async getFile(){return {size:text.length,text:async()=>text};},async requestPermission(){return 'granted';}}];
 globalThis.confirm=()=>true;
 await $('#open-file').onclick();assert.equal(saved().projects[0].name,'From file');await $('#disconnect-file').onclick();
 const before=JSON.stringify(saved());text='invalid';await $('#open-file').onclick();assert.equal(JSON.stringify(saved()),before);
 delete globalThis.confirm;
});

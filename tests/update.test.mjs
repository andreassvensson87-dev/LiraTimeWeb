import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createUpdater} from '../dist/update.mjs';
function fixture(){let remote='one',reason='',offline=false;const reloads=[],button={},status={},container={};const updater=createUpdater({version:'one',button,status,container,fetchVersion:async()=>{if(offline)throw Error('Offline');return {version:remote};},beforeUpdate:()=>reason,reload:v=>reloads.push(v)});return {button,status,container,updater,reloads,set remote(v){remote=v;},set reason(v){reason=v;},set offline(v){offline=v;}};}
test('new release is offered but never automatically reloads',async()=>{const f=fixture();await f.updater.check();assert.equal(f.button.hidden,true);assert.equal(f.container.hidden,true);f.remote='two';await f.updater.check();assert.equal(f.button.textContent,'Uppdatera appen');assert.equal(f.button.hidden,false);assert.equal(f.container.hidden,false);assert.deepEqual(f.reloads,[]);await f.button.onclick();assert.deepEqual(f.reloads,['two']);});
test('unsaved forms and pending storage block update until ready',async()=>{const f=fixture();f.remote='two';await f.updater.check();f.reason='Spara först';await f.button.onclick();assert.deepEqual(f.reloads,[]);assert.equal(f.status.textContent,'Spara först');assert.equal(f.button.disabled,false);f.reason='';await f.button.onclick();assert.deepEqual(f.reloads,['two']);});
test('manual checks report offline without losing an available release',async()=>{const f=fixture();f.remote='two';await f.updater.check();f.offline=true;await f.updater.check(true);assert.match(f.status.textContent,/internetanslutningen/);assert.equal(f.button.textContent,'Uppdatera appen');assert.equal(f.button.hidden,false);assert.equal(f.container.hidden,false);assert.equal(f.button.disabled,false);});
test('release markup and every module import use the same content version',async()=>{
 const root=new URL('../site/',import.meta.url),{version}=JSON.parse(await readFile(new URL('version.json',root)));
 assert.match(version,/^[a-f0-9]{16}$/);
 const html=await readFile(new URL('index.html',root),'utf8');assert.ok(html.includes('app.mjs?v='+version));assert.ok(html.includes('style.css?v='+version));
 const app=await readFile(new URL('app.mjs',root),'utf8');const imports=[...app.matchAll(/from ['"]([^'"]+)['"]/g)];assert.ok(imports.length>=4);
 for(const [,path] of imports){assert.ok(path.endsWith('?v='+version));await readFile(new URL(path.split('?')[0],root));}
 assert.ok((await readFile(new URL('version.mjs',root),'utf8')).includes(version));
});

test('update controls stay hidden on startup and offline, and hide when current',async()=>{const f=fixture();assert.equal(f.button.hidden,true);assert.equal(f.container.hidden,true);f.offline=true;await f.updater.check();assert.equal(f.container.hidden,true);f.offline=false;f.remote='two';await f.updater.check();assert.equal(f.container.hidden,false);f.remote='one';await f.updater.check();assert.equal(f.button.hidden,true);assert.equal(f.container.hidden,true);});

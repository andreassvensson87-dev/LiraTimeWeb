import test from 'node:test';
import assert from 'node:assert/strict';
import {createFileStore} from '../dist/file-store.mjs';
function fixture(){let text='{}',fail=false,writes=0;return {name:'test.json',get text(){return text;},set text(v){text=v;},set fail(v){fail=v;},get writes(){return writes;},async getFile(){return {text:async()=>text};},async createWritable(){if(fail)throw Error('Permission denied');let next;return {async write(value){next=value;},async close(){text=next;writes++;},async abort(){}};}};}
test('without a file, saving is a no-op; connected writes preserve order',async()=>{const f=fixture(),s=createFileStore();await s.save({a:0});await s.connect(f,'{}');await Promise.all([s.save({a:1}),s.save({a:2})]);assert.deepEqual(JSON.parse(f.text),{a:2});assert.equal(f.writes,2);await s.disconnect();await s.save({a:3});assert.equal(f.writes,2);});
test('external changes block writes until reconnection',async()=>{const f=fixture(),statuses=[],s=createFileStore(x=>statuses.push(x));await s.connect(f,'{}');f.text='external';await s.save({a:1});await s.save({a:2});assert.equal(f.text,'external');assert.equal(f.writes,0);assert.match(statuses.at(-1).message,/inte uppdaterad/);await s.connect(f,'external');await s.save({a:3});assert.equal(JSON.parse(f.text).a,3);});
test('write failures report local-only storage and do not overwrite file',async()=>{const f=fixture(),statuses=[],s=createFileStore(x=>statuses.push(x));await s.connect(f,'{}');f.fail=true;await s.save({a:1});assert.equal(f.text,'{}');assert.match(statuses.at(-1).message,/Endast sparat i webbläsaren/);});

import {createFileMemory} from '../dist/file-store.mjs';
import {memoryDB} from './file-memory-helper.mjs';
test('file handle survives a new memory instance and explicit disconnect removes it',async()=>{
 const db=memoryDB(),first=createFileMemory(db),handle=fixture();
 assert.equal(await first.load(),null);await first.save(handle);
 const reopened=createFileMemory(db);assert.equal(await reopened.load(),handle);
 await reopened.clear();assert.equal(await first.load(),null);
});
test('unsupported persistent storage reports failure instead of claiming to remember',async()=>{
 await assert.rejects(createFileMemory(null).save(fixture()),/komma ihåg/);
});

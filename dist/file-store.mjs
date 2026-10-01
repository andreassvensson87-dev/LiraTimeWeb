// Writes are serialized. An externally changed file is never silently replaced.
export function createFileStore(onStatus=()=>{}) {
 let handle=null,expected='',queue=Promise.resolve(),blocked=false,pending=0;
 const status=(message)=>onStatus({connected:!!handle,name:handle?.name||'',message});
 return {
  get pending(){return pending>0;},
  async connect(next,text){await queue;handle=next;expected=text;blocked=false;status('Filen är ansluten');},
  async disconnect(){await queue;handle=null;blocked=false;status('Endast webbläsarlagring');},
  save(data){
   if(!handle)return Promise.resolve();
   const target=handle,payload=JSON.stringify(data,null,2);
   pending++;status('Sparar till fil…');
   queue=queue.then(async()=>{
    if(blocked){status('Filen är inte uppdaterad. Anslut filen igen eller skapa en ny fil.');return;}
    try{
     if(await (await target.getFile()).text()!==expected)throw Error('Filen har ändrats utanför appen.');
     const stream=await target.createWritable();
     try{await stream.write(payload);await stream.close();}catch(error){try{await stream.abort();}catch{}throw error;}
     expected=payload;status('Sparad till fil '+new Date().toLocaleTimeString('sv-SE'));
    }catch(error){blocked=true;status('Endast sparat i webbläsaren. '+error.message+' Anslut filen igen eller skapa en ny fil.');}
   }).finally(()=>{pending--;});
   return queue;
  }
 };
}

// IndexedDB can retain a FileSystemFileHandle; localStorage cannot.
export function createFileMemory(indexedDB=globalThis.indexedDB) {
 async function access(mode,operation){
  if(!indexedDB)throw Error('Webbläsaren kan inte komma ihåg filkopplingen.');
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('liratime-files',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('settings');
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  try{return await new Promise((resolve,reject)=>{
   const transaction=db.transaction('settings',mode);
   const request=operation(transaction.objectStore('settings'));
   transaction.oncomplete=()=>resolve(request.result??null);
   transaction.onerror=()=>reject(transaction.error);
   transaction.onabort=()=>reject(transaction.error||Error('Filkopplingen kunde inte sparas.'));
  });}finally{db.close();}
 }
 return {
  load:()=>access('readonly',store=>store.get('handle')),
  save:handle=>access('readwrite',store=>store.put(handle,'handle')),
  clear:()=>access('readwrite',store=>store.delete('handle'))
 };
}

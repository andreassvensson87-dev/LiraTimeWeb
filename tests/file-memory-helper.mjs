export function memoryDB(){
 const values=new Map();let created=false;
 return {
  open(){
   const request={};
   const db={createObjectStore(){created=true;},close(){},transaction(){
    const tx={};
    tx.objectStore=()=>({
     get:key=>({result:values.get(key)}),
     put:(value,key)=>{values.set(key,value);return {result:key};},
     delete:key=>{values.delete(key);return {};}
    });
    queueMicrotask(()=>tx.oncomplete?.());return tx;
   }};
   queueMicrotask(()=>{request.result=db;if(!created)request.onupgradeneeded?.();request.onsuccess?.();});
   return request;
  }
 };
}

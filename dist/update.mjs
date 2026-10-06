export function createUpdater({version,button,status,container,fetchVersion,beforeUpdate,reload}){
 let latest=null,busy=false;
 button.hidden=true;if(container)container.hidden=true;
 async function check(manual=false){
  if(busy)return;busy=true;button.disabled=true;
  if(manual)status.textContent='Söker uppdatering…';
  try{
   const result=await fetchVersion();
   if(!result||typeof result.version!=='string'||!result.version)throw Error('Invalid version');
   latest=result.version!==version?result.version:null;
   button.textContent='Uppdatera appen';
   button.hidden=!latest;if(container)container.hidden=!latest;
   status.textContent=latest?'En ny version finns att hämta.':manual?'Du har senaste versionen.':'';
  }catch{if(manual)status.textContent='Kunde inte söka uppdateringar. Kontrollera internetanslutningen.';}
  finally{busy=false;button.disabled=false;}
 }
 button.onclick=async()=>{
  if(busy)return;
  if(!latest)return check(true);
  busy=true;button.disabled=true;
  try{
   const reason=await beforeUpdate();
   if(reason){status.textContent=reason;return;}
   status.textContent='Hämtar den nya versionen…';reload(latest);
  }catch{status.textContent='Kunde inte uppdatera. Försök igen.';}
  finally{busy=false;button.disabled=false;}
 };
 return {check};
}

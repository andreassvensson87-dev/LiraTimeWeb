import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
const source=new URL('../dist/',import.meta.url),out=new URL('../site/',import.meta.url);
const files=(await readdir(source)).sort();
const hash=createHash('sha256');
hash.update(await readFile(new URL('./build.mjs',import.meta.url)));
for(const file of files)hash.update(file).update(await readFile(new URL(file,source)));
const version=hash.digest('hex').slice(0,16);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const file of files){
 let content=await readFile(new URL(file,source));
 if(file.endsWith('.mjs'))content=content.toString().replace(/(['"])(\.\/[^'"?]+\.mjs)\1/g,(_,quote,path)=>quote+path+'?v='+version+quote);
 if(file==='index.html')content=content.toString().replace(/((?:src|href)="\.\/[^"?]+\.(?:mjs|css))"/g,'$1?v='+version+'"');
 if(file==='version.mjs')content=`export const VERSION = ${JSON.stringify(version)};\n`;
 if(file==='version.json')content=JSON.stringify({version});
 await writeFile(new URL(file,out),content);
}
await writeFile(new URL('.nojekyll',out),'');
console.log('LiraTime release '+version);

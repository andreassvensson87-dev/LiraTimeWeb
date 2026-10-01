import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/file-store.mjs':'file-store.mjs','/app.mjs':'app.mjs','/core.mjs':'core.mjs','/timeline.mjs':'timeline.mjs','/timeline-model.mjs':'timeline-model.mjs','/favicon.svg':'favicon.svg'};
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',mjs:'text/javascript; charset=utf-8',svg:'image/svg+xml',png:'image/png'};
for (const file of ['lira-icon.svg','favicon-32.png','apple-touch-icon.png','icon-192.png','icon-512.png']) files['/'+file]=file;
const port=Number(process.env.PORT||5187);
http.createServer(async(req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);res.end('Not found');return;}try{const body=await readFile(new URL('./dist/'+file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-cache'});res.end(body);}catch{res.writeHead(500);res.end('Could not read application');}}).listen(port,'127.0.0.1',()=>console.log(`LiraTime is ready at http://localhost:${port}`));

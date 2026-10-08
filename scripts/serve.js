import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot=resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
/** Standalone zero-dependency HTTP host. Exported for route tests. */
export function createGameServer(root=projectRoot){
  return createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const filename=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
      if(filename!==root&&!filename.startsWith(root+sep)){res.writeHead(403);res.end();return;}
      const info=await stat(filename);
      if(!info.isFile()){res.writeHead(404);res.end('Not found');return;}
      const bytes=await readFile(filename);
      res.writeHead(200,{'Content-Type':mime[extname(filename)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(bytes);
    }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT??4173);
  const server=createGameServer();
  server.listen(port,()=>console.log(`Piggy Quest: http://localhost:${server.address().port}`));
}

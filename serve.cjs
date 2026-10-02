// Optional localhost preview. The portable HTML also opens directly without a server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = __dirname;
const port = Number(process.env.UTILITY_PORT || 8765);
http.createServer((req,res)=>{
  let relative;
  try {relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch {res.writeHead(400);res.end();return;}
  const file=path.resolve(base,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404);res.end('Not found');return;}
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  });
}).listen(port,'127.0.0.1',()=>console.log('Utility Explorer: http://127.0.0.1:'+port));

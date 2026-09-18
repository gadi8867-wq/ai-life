import { spawn } from 'node:child_process';
import process from 'node:process';

const server=spawn(process.execPath,['server/index.js'],{
  stdio:'inherit',
  env:process.env
});

let shuttingDown=false;
const stop=()=>{
  if(shuttingDown)return;
  shuttingDown=true;
  try{server.kill('SIGTERM')}catch{}
};

process.on('SIGINT',stop);
process.on('SIGTERM',stop);

server.on('exit',(code)=>{
  if(!shuttingDown)process.exitCode=code||0;
});

await new Promise((resolve,reject)=>{
  const timer=setTimeout(resolve,1200);
  server.once('error',error=>{clearTimeout(timer);reject(error)});
});

if(shuttingDown)process.exit(0);

await import('./twitch-stream.js');

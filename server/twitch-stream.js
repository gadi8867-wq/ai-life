import { spawn } from 'node:child_process';
import process from 'node:process';
import { chromium } from 'playwright';

const port=Number(process.env.PORT||8787);
const pageUrl=process.env.AI_LIFE_URL||`http://127.0.0.1:${port}/`;
const rtmpUrl=process.env.TWITCH_RTMP_URL||'rtmps://live.twitch.tv/app/';
const streamKey=process.env.TWITCH_STREAM_KEY||'';

if(!streamKey){
  console.error('TWITCH_STREAM_KEY is missing');
  process.exit(1);
}

const width=1280;
const height=720;
const fps=30;

const browser=await chromium.launch({
  headless:true,
  args:[
    '--use-gl=swiftshader',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required'
  ]
});

const page=await browser.newPage({
  viewport:{width,height},
  deviceScaleFactor:1
});

await page.goto(pageUrl,{waitUntil:'networkidle'});
await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ai-life:stream-mode',{detail:{mode:'twitch',width:1280,height:720}})));

const ffmpeg=spawn('ffmpeg',[
  '-loglevel','warning',
  '-f','image2pipe',
  '-vcodec','mjpeg',
  '-r',String(fps),
  '-i','pipe:0',
  '-an',
  '-c:v','libx264',
  '-preset','veryfast',
  '-tune','zerolatency',
  '-pix_fmt','yuv420p',
  '-b:v','4500k',
  '-maxrate','4500k',
  '-bufsize','9000k',
  '-g',String(fps*2),
  '-f','flv',
  `${rtmpUrl.replace(/\/$/,'')}/${streamKey}`
],{stdio:['pipe','inherit','inherit']});

let stopped=false;
const stop=async(code=0)=>{
  if(stopped)return;
  stopped=true;
  try{ffmpeg.stdin.end()}catch{}
  try{await browser.close()}catch{}
  process.exitCode=code;
};

ffmpeg.on('exit',(code,signal)=>{
  if(!stopped)console.error(`ffmpeg exited code=${code} signal=${signal||''}`);
  stop(code&&code>0?1:0);
});

process.on('SIGINT',()=>stop(0));
process.on('SIGTERM',()=>stop(0));

const interval=setInterval(async()=>{
  if(stopped)return;
  try{
    const frame=await page.screenshot({type:'jpeg',quality:78});
    if(!ffmpeg.stdin.destroyed)ffmpeg.stdin.write(frame);
  }catch(error){
    console.error('stream frame error:',error.message);
  }
},Math.round(1000/fps));

await new Promise(()=>{});
clearInterval(interval);

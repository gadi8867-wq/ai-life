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

const cdp=await page.context().newCDPSession(page);
let frameBusy=false;
cdp.on('Page.screencastFrame',async event=>{
  try{
    if(frameBusy||stopped){await cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId});return;}
    frameBusy=true;
    const frame=Buffer.from(event.data,'base64');
    if(!ffmpeg.stdin.destroyed)ffmpeg.stdin.write(frame);
  }catch(error){
    console.error('stream frame error:',error.message);
  }finally{
    frameBusy=false;
    try{await cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId})}catch{}
  }
});

await cdp.send('Page.startScreencast',{
  format:'jpeg',
  quality:78,
  maxWidth:width,
  maxHeight:height,
  everyNthFrame:1
});

console.log(`AI Life Twitch stream started: ${width}x${height} @ ${fps}fps`);
await new Promise(()=>{});

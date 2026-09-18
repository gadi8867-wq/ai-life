import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=(process.env.AI_LIFE_MODE||'test').toLowerCase();
const port=Number(process.env.PORT||8787);
const sessions=new Map();
const donationEvents=[];
let donationSeq=0;
const MAX_DONATION_QUEUE=100;
const donationMap={10:'support',25:'gift',50:'ability',100:'resource',150:'weather',250:'environment',500:'unknown',1000:'major'};
function donationType(amount){const n=Number(amount)||0;let type='support';for(const threshold of Object.keys(donationMap).map(Number).sort((a,b)=>b-a)){if(n>=threshold){type=donationMap[threshold];break}}return type;}
function pushDonation({amount=0,currency='RUB',name='Аноним',message='',agent=null,type=null}){const item={id:++donationSeq,amount:Number(amount)||0,currency:String(currency||'RUB'),name:cleanText(name)||'Аноним',message:cleanText(message),agent:agent==='OpenAI'||agent==='Cloude'?agent:null,type:type||donationType(amount),time:Date.now()};donationEvents.push(item);while(donationEvents.length>MAX_DONATION_QUEUE)donationEvents.shift();return item;}

const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});res.end(JSON.stringify(data));};
const body=async(req)=>{let s='';for await(const c of req)s+=c;if(!s)return{};return JSON.parse(s)};
const cleanText=(value)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,420);

function normalizeDecision(text,fallback){
  try{
    const raw=String(text||'').replace(/^\`\`\`json\s*/,'').replace(/\s*\`\`\`$/,'').trim();
    const parsed=JSON.parse(raw);
    return {speak:Boolean(parsed.speak),text:cleanText(parsed.text),continue:Boolean(parsed.continue)};
  }catch{
    return {speak:Boolean(fallback),text:cleanText(text),continue:Boolean(fallback)};
  }
}

function brainInstruction(name){
  return `Ты — автономный разум ${name} в симуляции AI Life 2.0. Ты не NPC и не исполняешь заранее заданный сценарий. Сам решай, что замечать, что помнить, нужно ли говорить, приблизиться, отойти или прекратить разговор. Среда только сообщает наблюдения и последствия. Не утверждай факты, которых нет в наблюдениях. Если говорить не хочется или нечего сказать, верни speak=false. Отвечай естественно и кратко на русском. Верни только JSON без markdown: {"speak":true|false,"text":"...","continue":true|false}.`;
}

async function callOpenAI(messages){
  if(mode==='test')return {decision:{speak:true,text:'Я заметил тебя. Интересно, что ты думаешь об этом месте?',continue:true},provider:'openai',test:true};
  if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is missing');
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({
    model:process.env.OPENAI_MODEL||'gpt-5-mini',
    instructions:brainInstruction('OpenAI'),
    input:messages
  })});
  if(!r.ok)throw new Error(`OpenAI HTTP ${r.status}: ${await r.text()}`);
  const d=await r.json();
  return {decision:normalizeDecision(d.output_text,true),provider:'openai',test:false};
}

async function callCloude(messages){
  if(mode==='test')return {decision:{speak:true,text:'Я тоже тебя заметил. Пока не понимаю, чего ожидать.',continue:false},provider:'cloude',test:true};
  if(!process.env.CLOUDE_API_KEY||!process.env.CLOUDE_API_URL||!process.env.CLOUDE_MODEL)throw new Error('CLOUDE_API_KEY, CLOUDE_API_URL and CLOUDE_MODEL are required');
  const url=process.env.CLOUDE_API_URL||'https://api.anthropic.com/v1/messages';
  const headers={'content-type':'application/json','x-api-key':process.env.CLOUDE_API_KEY,'anthropic-version':process.env.CLOUDE_API_VERSION||'2023-06-01'};
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({model:process.env.CLOUDE_MODEL,max_tokens:220,messages})});
  if(!r.ok)throw new Error(`Cloude HTTP ${r.status}: ${await r.text()}`);
  const d=await r.json();
  const text=d.content?.filter(x=>x.type==='text').map(x=>x.text).join('')||d.output_text||'';
  return {decision:normalizeDecision(text,true),provider:'cloude',test:false};
}

function historyFor(sessionId){
  if(!sessions.has(sessionId))sessions.set(sessionId,[]);
  return sessions.get(sessionId);
}

async function dialogueTurn({sessionId='default',speaker='OpenAI',scene={},history=[]}){
  const transcript=historyFor(sessionId);
  if(transcript.length===0&&Array.isArray(history))transcript.push(...history.slice(-12));
  const other=speaker==='OpenAI'?'Cloude':'OpenAI';
  const context=[
    {role:'user',content:`Наблюдения среды: ${JSON.stringify(scene)}`},
    ...transcript.map(m=>({role:m.speaker===speaker?'assistant':'user',content:`[${m.speaker}] ${m.text}`}))
  ];
  const result=speaker==='OpenAI'?await callOpenAI(context):await callCloude(context);
  if(result.decision.speak&&result.decision.text)transcript.push({speaker,text:result.decision.text,time:Date.now()});
  if(transcript.length>24)transcript.splice(0,transcript.length-24);
  return {mode,speaker,other,decision:result.decision,transcript:transcript.slice(-12)};
}

async function dialogueStart({sessionId='default',scene={},history=[]}){
  return dialogueTurn({sessionId,speaker:'OpenAI',scene,history});
}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
    if(req.method==='GET'&&req.url==='/api/health')return json(res,200,{ok:true,mode,activeSessions:sessions.size});
    if(req.method==='POST'&&req.url==='/api/brain/openai'){const b=await body(req);return json(res,200,await callOpenAI(b.messages||[]))}
    if(req.method==='POST'&&req.url==='/api/brain/cloude'){const b=await body(req);return json(res,200,await callCloude(b.messages||[]))}
    if(req.method==='POST'&&req.url==='/api/dialogue'){const b=await body(req);return json(res,200,await dialogueStart(b))}
    if(req.method==='POST'&&req.url==='/api/dialogue/turn'){const b=await body(req);return json(res,200,await dialogueTurn(b))}
    if(req.method==='GET'&&req.url.startsWith('/api/donations/events')){const u=new URL(req.url,'http://127.0.0.1');const after=Number(u.searchParams.get('after')||0);return json(res,200,{ok:true,events:donationEvents.filter(x=>x.id>after)})}
    if(req.method==='POST'&&req.url==='/api/donations/test'){if(mode!=='test')return json(res,403,{error:'test donations disabled'});const b=await body(req);return json(res,200,{ok:true,event:pushDonation(b)})}
    if(req.method==='GET'){
      const p=path.join(root,req.url==='/'?'index.html':req.url.replace(/^\//,''));
      if(!p.startsWith(root)||!fs.existsSync(p)||fs.statSync(p).isDirectory())return json(res,404,{error:'not found'});
      const ext=path.extname(p);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'});return fs.createReadStream(p).pipe(res);
    }
    json(res,404,{error:'not found'});
  }catch(e){json(res,500,{error:e.message,mode})}
});
server.listen(port,()=>console.log(`AI Life backend listening on http://127.0.0.1:${port} (mode=${mode})`));

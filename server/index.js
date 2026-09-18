import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=(process.env.AI_LIFE_MODE||'test').toLowerCase();
const port=Number(process.env.PORT||8787);

const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'});res.end(JSON.stringify(data));};
const body=async(req)=>{let s='';for await(const c of req)s+=c;if(!s)return{};return JSON.parse(s)};

async function callOpenAI(messages){
  if(mode==='test')return {text:'Привет. Я вижу тебя. Как ты воспринимаешь это место?',provider:'openai',test:true};
  if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is missing');
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',input:messages})});
  if(!r.ok)throw new Error(`OpenAI HTTP ${r.status}: ${await r.text()}`);
  const d=await r.json();
  return {text:d.output_text||'',provider:'openai',test:false};
}

async function callCloude(messages){
  if(mode==='test')return {text:'Я здесь. Пока просто наблюдаю и пытаюсь понять, что происходит вокруг.',provider:'cloude',test:true};
  if(!process.env.CLOUDE_API_KEY||!process.env.CLOUDE_API_URL||!process.env.CLOUDE_MODEL)throw new Error('CLOUDE_API_KEY, CLOUDE_API_URL and CLOUDE_MODEL are required');
  const r=await fetch(process.env.CLOUDE_API_URL,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.CLOUDE_API_KEY}`},body:JSON.stringify({model:process.env.CLOUDE_MODEL,messages})});
  if(!r.ok)throw new Error(`Cloude HTTP ${r.status}: ${await r.text()}`);
  const d=await r.json();
  return {text:d.choices?.[0]?.message?.content||d.output_text||'',provider:'cloude',test:false};
}

async function dialogue(first='OpenAI'){
  const transcript=[];
  const open=await callOpenAI([{role:'system',content:'Ты OpenAI в автономном эксперименте AI Life 2.0. Отвечай естественно, коротко и самостоятельно.'},{role:'user',content:'Ты замечаешь рядом другой разум. Начни разговор.'}]);
  transcript.push({speaker:'OpenAI',text:open.text});
  const cloud=await callCloude([{role:'system',content:'Ты Cloude в автономном эксперименте AI Life 2.0. Решай сам, что сказать другому разуму.'},{role:'user',content:`Другой разум говорит: "${open.text}". Ответь ему.`}]);
  transcript.push({speaker:'Cloude',text:cloud.text});
  return {mode,transcript};
}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}
    if(req.method==='GET'&&req.url==='/api/health')return json(res,200,{ok:true,mode});
    if(req.method==='POST'&&req.url==='/api/brain/openai'){const b=await body(req);return json(res,200,await callOpenAI(b.messages||[]))}
    if(req.method==='POST'&&req.url==='/api/brain/cloude'){const b=await body(req);return json(res,200,await callCloude(b.messages||[]))}
    if(req.method==='POST'&&req.url==='/api/dialogue'){return json(res,200,await dialogue())}
    if(req.method==='GET'){
      const p=path.join(root,req.url==='/'?'index.html':req.url.replace(/^\\//,''));
      if(!p.startsWith(root)||!fs.existsSync(p)||fs.statSync(p).isDirectory())return json(res,404,{error:'not found'});
      const ext=path.extname(p);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'});return fs.createReadStream(p).pipe(res);
    }
    json(res,404,{error:'not found'});
  }catch(e){json(res,500,{error:e.message,mode})}
});
server.listen(port,()=>console.log(`AI Life backend listening on http://127.0.0.1:${port} (mode=${mode})`));

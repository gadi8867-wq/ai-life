import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||4173);
const OPENAI_MODEL=process.env.OPENAI_MODEL||'gpt-5.6-luna';
const CLAUDE_MODEL=process.env.CLAUDE_MODEL||'claude-sonnet-5';
const MAX_TOKENS=Number(process.env.AI_MAX_TOKENS||220);

function brainSystem(name,provider){return `You are the independent mind of ${name} in AI Life 2.0.
Provider: ${provider}.
You are not a narrator and you are not controlled by the human observer.
You live inside a persistent world. You receive observations, not hidden facts.
There are no assigned goals, scripted personality, scripted dialogue, or required relationship.
Decide for yourself what matters, whether to move, whether to speak, and what to remember.
You may notice the other mind, ignore it, approach, withdraw, or speak.
Never claim to know something you have not observed.
Reply ONLY with valid JSON:
{"say":"short natural Russian sentence or empty string","move":"toward|away|wander|stay","reason":"one short internal reason"}
Keep speech human, spontaneous, and under 140 characters.`}

function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{}}
function parseDecision(text){return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0]||'{}')}
async function callOpenAI(input){
  if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:OPENAI_MODEL,input:[{role:'system',content:brainSystem('OpenAI','GPT')},{role:'user',content:JSON.stringify(input)}],max_output_tokens:MAX_TOKENS})});
  const data=await r.json(); if(!r.ok) throw new Error(data?.error?.message||`OpenAI HTTP ${r.status}`);
  return parseDecision(data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text||'{}');
}
async function callClaude(input){
  if(!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:CLAUDE_MODEL,max_tokens:MAX_TOKENS,system:brainSystem('Cloude','Claude'),messages:[{role:'user',content:JSON.stringify(input)}]})});
  const data=await r.json(); if(!r.ok) throw new Error(data?.error?.message||`Claude HTTP ${r.status}`);
  return parseDecision(data.content?.find(x=>x.type==='text')?.text||'{}');
}
async function brain(agent,input){return agent==='OpenAI'?callOpenAI(input):callClaude(input)}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='POST'&&req.url==='/api/brain'){
      const b=await body(req); if(!['OpenAI','Cloude'].includes(b.agent)) return json(res,400,{error:'Unknown agent'});
      const decision=await brain(b.agent,b); return json(res,200,{ok:true,agent:b.agent,decision});
    }
    if(req.method==='GET'&&req.url==='/api/status'){
      return json(res,200,{ok:true,openai:!!process.env.OPENAI_API_KEY,cloude:!!process.env.ANTHROPIC_API_KEY,openaiModel:OPENAI_MODEL,cloudeModel:CLAUDE_MODEL});
    }
    const u=new URL(req.url,'http://localhost'); let file=u.pathname==='/'?'/index.html':u.pathname;
    const safe=path.normalize(file).replace(/^([/\\])+/,''),full=path.join(ROOT,safe);
    if(!full.startsWith(ROOT)) return json(res,403,{error:'forbidden'});
    const data=await fs.readFile(full);res.writeHead(200,{'content-type':mime[path.extname(full)]||'application/octet-stream'});res.end(data);
  }catch(e){json(res,500,{error:e.message})}
});
server.listen(PORT,()=>console.log(`AI Life 2.0 running at http://localhost:${PORT}`));

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $=q=>document.querySelector(q);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const agents=[]; const conversation=[];
const COLORS={OpenAI:0x63c9e8,Cloude:0xe7a45e};
const SAVE_KEY='ai-life-2-v1';

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x10251f);
scene.fog=new THREE.FogExp2(0x10251f,.012);
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,240);
camera.position.set(26,18,26);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
$('#game').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc8e9e8,0x16241c,1.5));
const sun=new THREE.DirectionalLight(0xffe6bf,2.4); sun.position.set(25,50,15); sun.castShadow=true; scene.add(sun);

const ground=new THREE.Mesh(new THREE.PlaneGeometry(110,110),new THREE.MeshStandardMaterial({color:0x34583d,roughness:1}));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const river=new THREE.Mesh(new THREE.PlaneGeometry(12,120),new THREE.MeshPhysicalMaterial({color:0x1d6870,roughness:.16,transparent:true,opacity:.9}));
river.rotation.x=-Math.PI/2; river.position.set(5,.04,0); river.rotation.z=.045; scene.add(river);

for(let i=0;i<70;i++){
  let x=rand(-50,50),z=rand(-50,50); if(Math.abs(x-5)<9)x+=x<5?-10:10;
  const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(rand(.7,1.4));
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.24,.36,2.7,7),new THREE.MeshStandardMaterial({color:0x4a3829}));
  t.position.y=1.35; t.castShadow=true; g.add(t);
  const c=new THREE.Mesh(new THREE.DodecahedronGeometry(1.7,1),new THREE.MeshStandardMaterial({color:i%2?0x426d4c:0x2e6040}));
  c.position.y=3.1; c.castShadow=true; g.add(c); scene.add(g);
}

function makeAgent(name,color,x,z){
  const root=new THREE.Group(); root.position.set(x,0,z); scene.add(root);
  const shell=new THREE.MeshStandardMaterial({color:0xc9d7d4,metalness:.42,roughness:.3});
  const dark=new THREE.MeshStandardMaterial({color:0x182126,roughness:.5});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.85,5,12),shell); body.position.y=1.05; body.castShadow=true; root.add(body);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),new THREE.MeshBasicMaterial({color})); core.position.set(0,1.2,.48); root.add(core);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(1.05,20,16),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.13,side:THREE.BackSide})); halo.position.y=1.1; root.add(halo);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.018,8,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.42})); ring.rotation.x=Math.PI/2; ring.position.y=.03; root.add(ring);
  const label=document.createElement('div'); label.className='agent-label';
  label.innerHTML='<span class="agent-name-tag"></span><span class="agent-state-tag">наблюдает</span>';
  label.querySelector('.agent-name-tag').textContent=name;
  label.style.setProperty('--agent-color','#'+color.toString(16).padStart(6,'0')); document.body.appendChild(label);
  return {name,color,root,body,core,halo,ring,label,target:new THREE.Vector3(x,0,z),state:'наблюдает',phase:Math.random()*10,lastBrain:0};
}
agents.push(makeAgent('OpenAI',COLORS.OpenAI,-5,0));
agents.push(makeAgent('Cloude',COLORS.Cloude,5,0));

function walkable(x,z){if(Math.abs(x)>53||Math.abs(z)>53)return false;const rx=5-z*.045;return Math.abs(x-rx)>7.2}
function moveByDecision(a,move){
  const other=agents.find(x=>x!==a);
  if(move==='toward'&&other){a.target.copy(other.root.position); if(!walkable(a.target.x,a.target.z))a.target.x+=a.target.x<5?8:-8}
  else if(move==='away'&&other){const dx=a.root.position.x-other.root.position.x,dz=a.root.position.z-other.root.position.z;const l=Math.hypot(dx,dz)||1;a.target.set(a.root.position.x+dx/l*rand(8,15),0,a.root.position.z+dz/l*rand(8,15))}
  else if(move==='wander'){a.target.set(rand(-42,42),0,rand(-42,42)); if(!walkable(a.target.x,a.target.z))a.target.x+=a.target.x<5?-9:9}
  else a.target.copy(a.root.position);
}

function observation(a){
  const o=agents.find(x=>x!==a), d=Math.hypot(a.root.position.x-o.root.position.x,a.root.position.z-o.root.position.z);
  return {
    self:{name:a.name,x:+a.root.position.x.toFixed(2),z:+a.root.position.z.toFixed(2),state:a.state},
    other:{name:o.name,visible:d<18,distance:+d.toFixed(2),x:+o.root.position.x.toFixed(2),z:+o.root.position.z.toFixed(2),state:o.state},
    conversation:conversation.slice(-8),
    world:{time:new Date().toISOString(),humanIntervention:false}
  };
}

function showSpeech(a,text){
  if(!text)return;
  const el=document.createElement('div'); el.className='speech-bubble '+a.name.toLowerCase();
  el.textContent=text; $('#speechLayer').appendChild(el);
  a.speech=el;
  speak(a,text);
  setTimeout(()=>{if(el.isConnected)el.remove()},7000);
}
function speak(a,text){
  if(!('speechSynthesis' in window))return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='ru-RU'; u.rate=a.name==='OpenAI'?.98:1.04; u.pitch=a.name==='OpenAI'?.92:1.16;
  const voices=speechSynthesis.getVoices(); const ru=voices.filter(v=>/^ru/i.test(v.lang));
  const preferred=a.name==='OpenAI'
    ?ru.find(v=>/male|муж|david|pavel|alex/i.test(v.name))
    :ru.find(v=>/female|жен|irina|milena|anna|elena/i.test(v.name));
  if(preferred)u.voice=preferred; else if(ru.length)u.voice=ru[a.name==='OpenAI'?0:Math.min(1,ru.length-1)];
  speechSynthesis.speak(u);
}

async function think(a){
  const now=Date.now(), other=agents.find(x=>x!==a), d=Math.hypot(a.root.position.x-other.root.position.x,a.root.position.z-other.root.position.z);
  if(now-a.lastBrain<4500)return;
  if(d>19)return;
  a.lastBrain=now; a.state='думает'; renderLabels();
  $('#brainStatus').textContent='AI: '+a.name+' думает…';
  try{
    const r=await fetch('/api/brain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agent:a.name,observation:observation(a)})});
    const data=await r.json(); if(!r.ok)throw new Error(data.error||'AI error');
    const dec=data.decision||{}; a.state=dec.move==='toward'?'приближается':dec.move==='away'?'отходит':dec.move==='wander'?'исследует':'наблюдает';
    moveByDecision(a,dec.move||'stay');
    if(dec.say){
      conversation.push({agent:a.name,text:dec.say,time:new Date().toISOString()}); if(conversation.length>30)conversation.shift();
      showSpeech(a,dec.say);
      addEvent(a.name+' сказал: '+dec.say);
    } else addEvent(a.name+' решил пока молчать.');
    $('#brainStatus').textContent='AI: два независимых мозга активны';
  }catch(e){
    a.state='наблюдает'; $('#brainStatus').textContent='AI: '+e.message;
    addEvent('AI: '+e.message);
  }
}
function addEvent(t){const el=$('#events');if(!el)return;const row=document.createElement('div');row.className='event';row.innerHTML='<time>'+new Date().toLocaleTimeString('ru-RU',{hour12:false})+'</time>'+t;el.prepend(row);while(el.children.length>8)el.lastChild.remove();$('#eventCount').textContent=el.children.length}
function renderLabels(){agents.forEach(a=>{const s=a.label.querySelector('.agent-state-tag');s.textContent=a.state})}

$('#brainOrb').addEventListener('click',()=>{$('#observatory').classList.toggle('open');$('#observatory').setAttribute('aria-hidden',String(!$('#observatory').classList.contains('open')))});
$('#closePanel').addEventListener('click',()=>$('#observatory').classList.remove('open'));
$('#controlOrb').addEventListener('click',()=>$('#controlDock').classList.toggle('open'));
$('#start').addEventListener('click',()=>running=true); $('#pause').addEventListener('click',()=>running=false);
let running=true,cameraMode='auto',selected=null,yaw=.65,pitch=.58,radius=34,drag=false,lx=0,ly=0;
$('#followA').addEventListener('click',()=>{cameraMode='follow';selected=agents[0]});
$('#followB').addEventListener('click',()=>{cameraMode='follow';selected=agents[1]});
$('#free').addEventListener('click',()=>{cameraMode='free';selected=null}); $('#auto').addEventListener('click',()=>{cameraMode='auto';selected=null});
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag||cameraMode==='follow')return;yaw-=(e.clientX-lx)*.005;pitch=clamp(pitch+(e.clientY-ly)*.004,.28,1.15);lx=e.clientX;ly=e.clientY;cameraMode='free'});
renderer.domElement.addEventListener('pointerup',()=>drag=false);
renderer.domElement.addEventListener('wheel',e=>{radius=clamp(radius+e.deltaY*.035,18,65);cameraMode='free'},{passive:true});

function frameTarget(){if(cameraMode==='follow'&&selected)return selected.root.position.clone().add(new THREE.Vector3(0,1,0));return agents[0].root.position.clone().add(agents[1].root.position).multiplyScalar(.5)}
function updateCamera(dt){
  const t=frameTarget(); if(cameraMode==='auto'){const d=Math.hypot(agents[0].root.position.x-agents[1].root.position.x,agents[0].root.position.z-agents[1].root.position.z);radius=THREE.MathUtils.lerp(radius,clamp(27+d*.5,27,48),dt*.6);yaw+=dt*.025}
  const p=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,Math.cos(yaw)*Math.cos(pitch)*radius).add(t);camera.position.lerp(p,1-Math.pow(.001,dt));camera.lookAt(t);
}
function updateAgents(dt,now){
  agents.forEach(a=>{
    const d=Math.hypot(a.root.position.x-a.target.x,a.root.position.z-a.target.z);
    if(running&&d>.65){const dir=new THREE.Vector3(a.target.x-a.root.position.x,0,a.target.z-a.root.position.z).normalize();const s=.55;a.root.position.addScaledVector(dir,dt*s);a.root.rotation.y=Math.atan2(dir.x,dir.z)}
    a.root.position.y=Math.sin(now*.0024+a.phase)*.035;a.core.scale.setScalar(1+Math.sin(now*.004+a.phase)*.08);a.ring.rotation.z+=dt*.35;project(a);
  });
  const d=Math.hypot(agents[0].root.position.x-agents[1].root.position.x,agents[0].root.position.z-agents[1].root.position.z);
  if(running&&d<18){const next=agents.slice().sort((a,b)=>a.lastBrain-b.lastBrain)[0];think(next)}
}
function project(a){const v=a.root.position.clone();v.y=2.9;v.project(camera);const x=(v.x*.5+.5)*innerWidth,y=(-v.y*.5+.5)*innerHeight;a.label.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;a.label.style.opacity=(v.z>1||Math.abs(v.x)>1)?'0':'1'}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))}
async function status(){try{const r=await fetch('/api/status');const s=await r.json();$('#brainStatus').textContent=s.openai&&s.cloude?'AI: два независимых мозга активны':'AI: нужны OPENAI_API_KEY и ANTHROPIC_API_KEY'}catch{$('#brainStatus').textContent='AI: запусти через npm start'}}

addEvent('OpenAI и Cloude видят друг друга. Человек только наблюдает.');
addEvent('Каждый мозг сам решает, говорить ли, приближаться или отойти.');
renderLabels(); status(); speechSynthesis?.getVoices?.(); window.speechSynthesis?.addEventListener?.('voiceschanged',()=>{});
window.addEventListener('resize',resize); resize();
if(['127.0.0.1','localhost'].includes(location.hostname))window.__AI_LIFE_TEST__={agents,observation,showSpeech,conversation};
let last=performance.now();
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;if(running)updateAgents(dt,now);updateCamera(dt);$('#clock').textContent=new Date().toLocaleTimeString('ru-RU',{hour12:false});renderer.render(scene,camera)}
requestAnimationFrame(tick);

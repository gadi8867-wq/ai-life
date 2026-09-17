import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

/*
 * AI LIFE 2.0
 * A visual-first simulation shell for two autonomous agents.
 * The environment does not assign goals. AgentBrain is the seam where a real
 * model, memory service and long-term learning system can be connected later.
 */

const $ = (q) => document.querySelector(q);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lerp = (a, b, t) => a + (b - a) * t;

const SAVE_KEY = 'ai-life-2-v1';
const DAY_SECONDS = 18 * 60;
const WORLD = 120;

/* ---------- Scene ---------- */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x6f8f8d, 0.0115);

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 260);
camera.position.set(34, 24, 34);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
$('#game').appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xbfe4ea, 0x182a23, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe8bd, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 180;
sun.position.set(30, 55, 22);
scene.add(sun);

const moon = new THREE.DirectionalLight(0x7899c8, 0.18);
moon.position.set(-35, 28, -30);
scene.add(moon);

/* ---------- Materials ---------- */
const mat = {
  ground: new THREE.MeshStandardMaterial({ color: 0x304c38, roughness: 1 }),
  bank: new THREE.MeshStandardMaterial({ color: 0x5b5745, roughness: 1 }),
  water: new THREE.MeshPhysicalMaterial({ color: 0x174a52, roughness: 0.18, metalness: 0.05, transmission: 0.08, transparent: true, opacity: 0.9 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x4b3829, roughness: 1 }),
  leafA: new THREE.MeshStandardMaterial({ color: 0x2e6040, roughness: 0.9 }),
  leafB: new THREE.MeshStandardMaterial({ color: 0x426d4c, roughness: 0.92 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x68706b, roughness: 0.95 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x5d7c50, roughness: 1 }),
  ember: new THREE.MeshBasicMaterial({ color: 0xff9b3d }),
};

/* ---------- Terrain ---------- */
const terrain = new THREE.Group();
scene.add(terrain);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD, 50, 50), mat.ground);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
terrain.add(ground);

const river = new THREE.Mesh(new THREE.PlaneGeometry(13, WORLD + 10, 1, 1), mat.water);
river.rotation.x = -Math.PI / 2;
river.position.set(5, 0.08, 0);
river.rotation.z = 0.045;
river.receiveShadow = true;
terrain.add(river);

function addTree(x, z, scale = 1, variant = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 2.8, 7), mat.trunk);
  trunk.position.y = 1.4; trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
  const leafMat = variant % 2 ? mat.leafB : mat.leafA;
  const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 1), leafMat);
  crown.position.y = 3.15; crown.scale.y = 1.18; crown.castShadow = true; crown.receiveShadow = true; g.add(crown);
  if (variant % 3 === 0) {
    const crown2 = crown.clone(); crown2.scale.setScalar(0.68); crown2.position.set(0.75, 4.15, -0.25); g.add(crown2);
  }
  terrain.add(g);
}

function addRock(x, z, scale = 1) {
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), mat.rock);
  r.position.set(x, 0.45 * scale, z);
  r.scale.set(scale * rand(.8, 1.35), scale * rand(.65, 1), scale * rand(.75, 1.25));
  r.rotation.set(rand(-.3,.3), rand(0,Math.PI), rand(-.2,.2));
  r.castShadow = true; r.receiveShadow = true; terrain.add(r);
}

function addGrass(x, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055, rand(.35,.65), 4), mat.grass);
    blade.position.set(rand(-.22,.22), blade.geometry.parameters.height/2, rand(-.22,.22));
    blade.rotation.z = rand(-.25,.25); g.add(blade);
  }
  terrain.add(g);
}

for (let i = 0; i < 68; i++) {
  let x = rand(-52, 52), z = rand(-52, 52);
  if (Math.abs(x - 5) < 9) x += x < 5 ? -10 : 10;
  addTree(x, z, rand(.72, 1.42), i);
}
for (let i = 0; i < 38; i++) {
  let x = rand(-52, 52), z = rand(-52, 52);
  if (Math.abs(x - 5) < 9) x += x < 5 ? -10 : 10;
  addRock(x, z, rand(.45, 1.15));
}
for (let i = 0; i < 145; i++) {
  let x = rand(-55, 55), z = rand(-55, 55);
  if (Math.abs(x - 5) < 7) x += x < 5 ? -8 : 8;
  addGrass(x, z, rand(.65, 1.35));
}

/* ---------- Fire / landmark ---------- */
const fire = new THREE.Group(); fire.position.set(-11, 0, 9); scene.add(fire);
for (let i = 0; i < 5; i++) {
  const log = new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,2.0,7), mat.trunk);
  log.position.y=.22; log.rotation.z=Math.PI/2; log.rotation.y=i*.65; log.rotation.x=.18; log.castShadow=true; fire.add(log);
}
const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(.72,1), mat.ember); flame.position.y=1.05; fire.add(flame);
const fireLight = new THREE.PointLight(0xff9a4c, 4.2, 13, 2); fireLight.position.y=1.4; fire.add(fireLight);

/* ---------- Agent bodies ---------- */
const agentColors = { OpenAI: 0x63c9e8, Cloude: 0xe7a45e };
const agents = [];

function makeAgent(name, color, x, z) {
  const root = new THREE.Group(); root.position.set(x, 0, z); scene.add(root);
  const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .12, side: THREE.BackSide });
  const shell = new THREE.MeshStandardMaterial({ color: 0xc5d4d1, metalness: .45, roughness: .32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x182126, metalness: .25, roughness: .5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.48, .85, 5, 12), shell); body.position.y=1.05; body.castShadow=true; root.add(body);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.24, 16, 12), new THREE.MeshBasicMaterial({ color })); core.position.set(0,1.2,.48); root.add(core);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 16), glow); halo.position.y=1.1; root.add(halo);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), dark); eye.position.set(0,1.47,.48); root.add(eye);
  const footL = new THREE.Mesh(new THREE.SphereGeometry(.24, 12, 8), dark); footL.scale.y=.55; footL.position.set(-.23,.33,0); footL.castShadow=true; root.add(footL);
  const footR = footL.clone(); footR.position.x=.23; root.add(footR);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.72,.018,8,48), new THREE.MeshBasicMaterial({color,transparent:true,opacity:.38})); ring.rotation.x=Math.PI/2; ring.position.y=.03; root.add(ring);
  const label = document.createElement('div'); label.className='agent-label'; label.textContent=name; label.style.setProperty('--agent-color', `#${color.toString(16).padStart(6,'0')}`); document.body.appendChild(label);
  return { name, color, root, body, core, halo, ring, label, velocity:new THREE.Vector3(), target:new THREE.Vector3(x,0,z), state:'observing', stateUntil:0, stateStarted:performance.now(), metrics:{survival:.74, autonomy:.52, learning:.18, exploration:.31, social:.08, decision:.63}, memory:[], needs:{energy:0.18, thirst:0.22, curiosity:.62, social:.05}, brain:null, phase:Math.random()*10 };
}

agents.push(makeAgent('OpenAI', agentColors.OpenAI, -15, -4));
agents.push(makeAgent('Cloude', agentColors.Cloude, 17, 12));

/* ---------- Agent brain seam ---------- */
class AgentBrain {
  constructor(agent) { this.agent = agent; this.lastThought = 'наблюдает'; }
  observe(world) {
    const a = this.agent;
    const other = agents.find(x => x !== a);
    const distance = other ? dist2(a.root.position, other.root.position) : 999;
    const daylight = world.daylight;
    return { self:{x:a.root.position.x,z:a.root.position.z}, daylight, distanceToOther:distance, state:a.state, needs:{...a.needs}, recentMemory:a.memory.slice(-4) };
  }
  decide(world, now) {
    const a=this.agent; const o=agents.find(x=>x!==a); const d=o?dist2(a.root.position,o.root.position):999;
    const choices=[];
    choices.push({w:a.needs.thirst*1.9, action:'water'});
    choices.push({w:a.needs.energy*1.4, action:'rest'});
    choices.push({w:a.needs.curiosity*(daylightFactor(world.daylight))*1.5, action:'explore'});
    choices.push({w:(d<10 ? .65 : .06)*a.needs.social, action:'social'});
    choices.push({w:.25+Math.random()*.2, action:'wander'});
    choices.sort((x,y)=>y.w-x.w);
    const top=choices[0];
    this.lastThought=top.action;
    a.state=top.action==='water'?'seeking water':top.action==='rest'?'resting':top.action==='social'?'observing another mind':top.action==='explore'?'exploring':'wandering';
    a.stateUntil=now+rand(5000,11000);
    a.stateStarted=now;
    if(top.action==='water') a.target.set(rand(0,8),0,rand(-40,40));
    else if(top.action==='rest') a.target.copy(a.root.position);
    else if(top.action==='social' && o) a.target.copy(o.root.position);
    else a.target.set(rand(-45,45),0,rand(-45,45));
    a.metrics.autonomy=clamp(a.metrics.autonomy+.003);
    a.metrics.decision=clamp(a.metrics.decision + (top.w>.55?.002:-.0003));
  }
  learn(result) {
    const a=this.agent; a.memory.push({time:Date.now(), state:a.state, result}); if(a.memory.length>40)a.memory.shift();
    a.metrics.learning=clamp(a.metrics.learning+.006); a.metrics.exploration=clamp(a.metrics.exploration+.0015);
  }
}
agents.forEach(a=>a.brain=new AgentBrain(a));

function daylightFactor(v){ return clamp((v+.2)/1.2); }

/* ---------- Simulation state ---------- */
const saved = (()=>{ try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch{return null} })();
const experimentStart = saved?.experimentStart || Date.now();
let running = saved?.running ?? true;
let cameraMode = 'auto';
let selectedAgent = null;
let worldTime = saved?.worldTime ?? 7 * 3600;
let lastDecision = 0;
let eventLog = saved?.events || [];

if (saved?.agents) saved.agents.forEach(s=>{const a=agents.find(x=>x.name===s.name); if(!a)return; a.root.position.set(s.x,0,s.z); a.metrics={...a.metrics,...s.metrics}; a.memory=s.memory||[]});

function addEvent(text, agent=null){
  const item={time:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),text,agent};
  eventLog=[item,...eventLog].slice(0,10); renderEvents();
}
if(!eventLog.length){ addEvent('Эксперимент запущен. Мир не задаёт агентам цели.'); }

function save(){
  const payload={experimentStart,worldTime,running,events:eventLog,agents:agents.map(a=>({name:a.name,x:a.root.position.x,z:a.root.position.z,metrics:a.metrics,memory:a.memory.slice(-20)}))};
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(payload))}catch{}
}

/* ---------- UI ---------- */
function renderEvents(){
  const el=$('#events'); el.innerHTML=''; eventLog.slice(0,7).forEach(e=>{const row=document.createElement('div');row.className='event';row.innerHTML=`<time>${e.time}</time>${e.text}`;el.appendChild(row)}); $('#eventCount').textContent=eventLog.length;
}
function renderStats(){
  const host=$('#stats'); host.innerHTML='';
  const labels=[['survival','SURVIVAL'],['autonomy','AUTONOMY'],['learning','LEARNING'],['exploration','EXPLORATION'],['social','SOCIAL'],['decision','DECISION']];
  agents.forEach(a=>{const card=document.createElement('div');card.className='agent-card';const head=document.createElement('div');head.className='agent-head';head.innerHTML=`<span class="agent-name" style="color:#${a.color.toString(16).padStart(6,'0')}">${a.name}</span><span class="agent-state">${a.state}</span>`;card.appendChild(head);const grid=document.createElement('div');grid.className='metric-grid';labels.forEach(([key,label])=>{const m=document.createElement('div');m.className='metric';const ring=document.createElement('div');ring.className='metric-ring';ring.style.setProperty('--p',`${Math.round(a.metrics[key]*100)}%`);ring.style.setProperty('--metric-color',`#${a.color.toString(16).padStart(6,'0')}`);ring.innerHTML=`<span>${Math.round(a.metrics[key]*100)}</span>`;m.appendChild(ring);const l=document.createElement('label');l.textContent=label;m.appendChild(l);grid.appendChild(m)});card.appendChild(grid);host.appendChild(card)})
}
function updatePill(){
  const elapsed=Math.max(0,Date.now()-experimentStart); const day=Math.floor(elapsed/86400000)+1; $('#pillDay').textContent=`DAY ${String(day).padStart(3,'0')}`; $('#pillStart').textContent=`START ${new Date(experimentStart).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`;
}

$('#brainOrb').addEventListener('click',()=>{const p=$('#observatory');p.classList.toggle('open');p.setAttribute('aria-hidden',String(!p.classList.contains('open')));if(p.classList.contains('open'))renderStats()});
$('#closePanel').addEventListener('click',()=>$('#observatory').classList.remove('open'));
$('#controlOrb').addEventListener('click',()=>$('#controlDock').classList.toggle('open'));
$('#start').addEventListener('click',()=>{running=true;addEvent('Наблюдение продолжено.');save()});
$('#pause').addEventListener('click',()=>{running=false;addEvent('Симуляция поставлена на паузу.');save()});
$('#followA').addEventListener('click',()=>{cameraMode='follow';selectedAgent=agents[0]});
$('#followB').addEventListener('click',()=>{cameraMode='follow';selectedAgent=agents[1]});
$('#free').addEventListener('click',()=>{cameraMode='free';selectedAgent=null});
$('#auto').addEventListener('click',()=>{cameraMode='auto';selectedAgent=null});

/* ---------- Camera ---------- */
let drag=false,lastX=0,lastY=0,yaw=.65,pitch=.58,radius=44;
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag||cameraMode==='follow')return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.005;pitch=clamp(pitch+dy*.004,.28,1.15);cameraMode='free'});
renderer.domElement.addEventListener('pointerup',()=>drag=false);
renderer.domElement.addEventListener('wheel',e=>{radius=clamp(radius+e.deltaY*.035,18,75);cameraMode='free'},{passive:true});

function frameTarget(){
  if(cameraMode==='follow'&&selectedAgent)return selectedAgent.root.position.clone().add(new THREE.Vector3(0,1,0));
  if(cameraMode==='auto'){
    const a=agents[0],b=agents[1],mid=a.root.position.clone().add(b.root.position).multiplyScalar(.5); return mid.add(new THREE.Vector3(0,0,0));
  }
  return new THREE.Vector3(0,0,0);
}
function updateCamera(dt){
  const target=frameTarget();
  if(cameraMode==='auto'){
    const spread=dist2(agents[0].root.position,agents[1].root.position); const desired=clamp(38+spread*.55,38,58); radius=lerp(radius,desired,dt*.5); yaw+=dt*.035;
  }
  if(cameraMode==='follow') radius=lerp(radius,20,dt*1.4);
  const pos=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,Math.cos(yaw)*Math.cos(pitch)*radius).add(target);
  camera.position.lerp(pos,1-Math.pow(.001,dt)); camera.lookAt(target);
}

/* ---------- Time / environment ---------- */
function updateEnvironment(dt){
  if(running) worldTime=(worldTime+dt*8)%86400;
  const phase=(worldTime/86400)*Math.PI*2-Math.PI/2; const daylight=clamp(Math.sin(phase)*.5+.5);
  const night=1-daylight;
  sun.intensity=lerp(.12,2.65,daylight); moon.intensity=lerp(.28,.02,daylight); hemi.intensity=lerp(.45,1.35,daylight);
  scene.background.lerpColors?.();
  const dayColor=new THREE.Color(0x79a9ad), nightColor=new THREE.Color(0x08131e); scene.background=dayColor.clone().lerp(nightColor,night*.86); scene.fog.color=scene.background.clone(); scene.fog.density=lerp(.008,.017,night);
  fireLight.intensity=lerp(2.5,5.5,night);
  flame.scale.setScalar(lerp(.75,1.15,Math.sin(performance.now()*.009)*.15+.5));
  return {daylight,night};
}

/* ---------- Autonomous loop ---------- */
function updateAgents(dt, now, world){
  agents.forEach(a=>{
    a.needs.energy=clamp(a.needs.energy + dt*.004);
    a.needs.thirst=clamp(a.needs.thirst + dt*.006);
    a.needs.curiosity=clamp(a.needs.curiosity + dt*.0015);
    if(now>a.stateUntil && running){ a.brain.decide(world,now); if(Math.random()<.35)addEvent(`${a.name} изменил решение: ${a.state}.`,a.name); }
    const p=a.root.position; const target=a.target; const d=dist2(p,target);
    if(a.state==='resting'){
      a.body.rotation.z=Math.sin(now*.001+a.phase)*.025; a.needs.energy=clamp(a.needs.energy-dt*.012); a.needs.thirst=clamp(a.needs.thirst-dt*.001);
    } else if(d>.7 && running){
      const dir=new THREE.Vector3(target.x-p.x,0,target.z-p.z).normalize(); const speed=a.state==='observing another mind'?.55:.72; p.addScaledVector(dir,dt*speed); a.root.rotation.y=Math.atan2(dir.x,dir.z); a.needs.energy=clamp(a.needs.energy+dt*.0018); a.needs.thirst=clamp(a.needs.thirst+dt*.0012); a.metrics.exploration=clamp(a.metrics.exploration+dt*.00012);
    } else if(running){
      if(a.state==='seeking water'){a.needs.thirst=clamp(a.needs.thirst-dt*.025);a.metrics.survival=clamp(a.metrics.survival+.0007);a.brain.learn('water reached')}
      if(a.state==='exploring'){a.needs.curiosity=clamp(a.needs.curiosity-dt*.02);a.brain.learn('new place observed')}
      if(a.state==='observing another mind'){a.needs.social=clamp(a.needs.social-dt*.018);a.metrics.social=clamp(a.metrics.social+.0008);a.brain.learn('another agent observed')}
      a.stateUntil=now+rand(2500,6000);
    }
    const bob=Math.sin(now*.0024+a.phase)*.035; a.root.position.y=bob; a.core.scale.setScalar(1+Math.sin(now*.004+a.phase)*.08); a.ring.rotation.z+=dt*.35;
    projectLabel(a);
  });
  const d=dist2(agents[0].root.position,agents[1].root.position);
  if(d<7 && Math.random()<dt*.08){ addEvent('OpenAI и Cloude находятся рядом — наблюдение без вмешательства.'); agents[0].needs.social=clamp(agents[0].needs.social+.15); agents[1].needs.social=clamp(agents[1].needs.social+.15); }
}
function projectLabel(a){
  const v=a.root.position.clone();v.y=2.45;v.project(camera);const x=(v.x*.5+.5)*innerWidth,y=(-v.y*.5+.5)*innerHeight;a.label.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;a.label.style.opacity=(v.z>1||Math.abs(v.x)>1)?'0':'1';
}

/* ---------- Loop ---------- */
let last=performance.now(); let saveTimer=0;
function tick(now){
  requestAnimationFrame(tick); const dt=Math.min(.05,(now-last)/1000);last=now;
  const world=updateEnvironment(dt);
  if(running)updateAgents(dt,now,world);
  else agents.forEach(projectLabel);
  updateCamera(dt); $('#clock').textContent=new Date().toLocaleTimeString('ru-RU',{hour12:false}); updatePill();
  if(now-lastDecision>9000 && running){lastDecision=now;renderStats()}
  saveTimer+=dt;if(saveTimer>8){saveTimer=0;save()}
  renderer.render(scene,camera);
}

function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));}
addEvent('OpenAI и Cloude появились в мире независимо друг от друга.');
addEvent('Среда создана. Цели агентам не назначены.');
renderEvents();renderStats();updatePill();
addEvent('AI-слой готов к подключению реальной модели без изменения мира.');
addEvent('Наблюдение активно. Вмешательство человека: 0.');
addEvent('AI Life 2.0 — визуальное ядро запущено.');
window.addEventListener('resize',resize); resize(); requestAnimationFrame(tick);

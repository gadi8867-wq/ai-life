import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

/* AI LIFE 2.0 — visual simulation shell. */
const $=q=>document.querySelector(q);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const lerp=(a,b,t)=>a+(b-a)*t;
const SAVE_KEY='ai-life-2-v1',WORLD=120;

const scene=new THREE.Scene();
const dayColor=new THREE.Color(0x79a9ad),nightColor=new THREE.Color(0x08131e);
scene.background=dayColor.clone();
scene.fog=new THREE.FogExp2(0x79a9ad,0.0115);
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,260);
camera.position.set(34,24,34);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
$('#game').appendChild(renderer.domElement);

const hemi=new THREE.HemisphereLight(0xbfe4ea,0x182a23,1.35);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe8bd,2.6);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-60;sun.shadow.camera.right=60;sun.shadow.camera.top=60;sun.shadow.camera.bottom=-60;sun.shadow.camera.near=1;sun.shadow.camera.far=180;scene.add(sun);scene.add(sun.target);
const moon=new THREE.DirectionalLight(0x7899c8,.18);scene.add(moon);scene.add(moon.target);

const mat={
 ground:new THREE.MeshStandardMaterial({color:0x304c38,roughness:1}),
 water:new THREE.MeshPhysicalMaterial({color:0x174a52,roughness:.18,metalness:.05,transmission:.08,transparent:true,opacity:.9}),
 trunk:new THREE.MeshStandardMaterial({color:0x4b3829,roughness:1}),
 leafA:new THREE.MeshStandardMaterial({color:0x2e6040,roughness:.9}),leafB:new THREE.MeshStandardMaterial({color:0x426d4c,roughness:.92}),
 rock:new THREE.MeshStandardMaterial({color:0x68706b,roughness:.95}),grass:new THREE.MeshStandardMaterial({color:0x5d7c50,roughness:1}),ember:new THREE.MeshBasicMaterial({color:0xff9b3d})
};
const terrain=new THREE.Group();scene.add(terrain);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(WORLD,WORLD,50,50),mat.ground);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;terrain.add(ground);
const river=new THREE.Mesh(new THREE.PlaneGeometry(13,WORLD+10),mat.water);river.rotation.x=-Math.PI/2;river.position.set(5,.08,0);river.rotation.z=.045;terrain.add(river);
function addTree(x,z,s=1,v=0){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);const t=new THREE.Mesh(new THREE.CylinderGeometry(.25,.38,2.8,7),mat.trunk);t.position.y=1.4;t.castShadow=true;g.add(t);const c=new THREE.Mesh(new THREE.DodecahedronGeometry(1.7,1),v%2?mat.leafB:mat.leafA);c.position.y=3.15;c.scale.y=1.18;c.castShadow=true;g.add(c);if(v%3===0){const c2=c.clone();c2.scale.setScalar(.68);c2.position.set(.75,4.15,-.25);g.add(c2)}terrain.add(g)}
function addRock(x,z,s=1){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(.75),mat.rock);r.position.set(x,.45*s,z);r.scale.set(s*rand(.8,1.35),s*rand(.65,1),s*rand(.75,1.25));r.rotation.set(rand(-.3,.3),rand(0,Math.PI),rand(-.2,.2));r.castShadow=true;terrain.add(r)}
function addGrass(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);for(let i=0;i<4;i++){const b=new THREE.Mesh(new THREE.ConeGeometry(.055,rand(.35,.65),4),mat.grass);b.position.set(rand(-.22,.22),b.geometry.parameters.height/2,rand(-.22,.22));b.rotation.z=rand(-.25,.25);g.add(b)}terrain.add(g)}
for(let i=0;i<68;i++){let x=rand(-52,52),z=rand(-52,52);if(Math.abs(x-5)<9)x+=x<5?-10:10;addTree(x,z,rand(.72,1.42),i)}
for(let i=0;i<38;i++){let x=rand(-52,52),z=rand(-52,52);if(Math.abs(x-5)<9)x+=x<5?-10:10;addRock(x,z,rand(.45,1.15))}
for(let i=0;i<145;i++){let x=rand(-55,55),z=rand(-55,55);if(Math.abs(x-5)<7)x+=x<5?-8:8;addGrass(x,z,rand(.65,1.35))}

const fire=new THREE.Group();fire.position.set(-11,0,9);scene.add(fire);
for(let i=0;i<5;i++){const l=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,2,7),mat.trunk);l.position.y=.22;l.rotation.z=Math.PI/2;l.rotation.y=i*.65;l.rotation.x=.18;l.castShadow=true;fire.add(l)}
const flame=new THREE.Mesh(new THREE.IcosahedronGeometry(.72,1),mat.ember);flame.position.y=1.05;fire.add(flame);
const fireLight=new THREE.PointLight(0xff9a4c,4.2,13,2);fireLight.position.y=1.4;fire.add(fireLight);

const agentColors={OpenAI:0x63c9e8,Cloude:0xe7a45e},agents=[];
function makeAgent(name,color,x,z){const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);const glow=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,side:THREE.BackSide});const shell=new THREE.MeshStandardMaterial({color:0xc5d4d1,metalness:.45,roughness:.32});const dark=new THREE.MeshStandardMaterial({color:0x182126,metalness:.25,roughness:.5});const body=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.85,5,12),shell);body.position.y=1.05;body.castShadow=true;root.add(body);const core=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),new THREE.MeshBasicMaterial({color}));core.position.set(0,1.2,.48);root.add(core);const halo=new THREE.Mesh(new THREE.SphereGeometry(1.05,20,16),glow);halo.position.y=1.1;root.add(halo);const eye=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),dark);eye.position.set(0,1.47,.48);root.add(eye);const footL=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),dark);footL.scale.y=.55;footL.position.set(-.23,.33,0);root.add(footL);const footR=footL.clone();footR.position.x=.23;root.add(footR);const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.018,8,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.38}));ring.rotation.x=Math.PI/2;ring.position.y=.03;root.add(ring);const label=document.createElement('div');label.className='agent-label';label.innerHTML=`<span class="agent-name-tag">${name}</span><span class="agent-state-tag">наблюдает</span>`;label.style.setProperty('--agent-color',`#${color.toString(16).padStart(6,'0')}`);document.body.appendChild(label);return{name,color,root,body,core,halo,ring,label,target:new THREE.Vector3(x,0,z),state:'observing',stateUntil:0,metrics:{survival:.74,autonomy:.52,learning:.18,exploration:.31,social:.08,decision:.63},memory:[],needs:{energy:.18,thirst:.22,curiosity:.62,social:.05},brain:null,phase:Math.random()*10,recentTargets:[],routeHistory:[],lastRouteSignature:''}}
agents.push(makeAgent('OpenAI',agentColors.OpenAI,-15,-4));agents.push(makeAgent('Cloude',agentColors.Cloude,17,12));

class AgentBrain{constructor(agent){this.agent=agent;this.lastThought='наблюдает'}observe(world){const a=this.agent,o=agents.find(x=>x!==a),d=o?dist2(a.root.position,o.root.position):999;return{self:{x:a.root.position.x,z:a.root.position.z},daylight:world.daylight,distanceToOther:d,state:a.state,needs:{...a.needs},recentMemory:a.memory.slice(-4)}}decide(world,now){const a=this.agent,o=agents.find(x=>x!==a),d=o?dist2(a.root.position,o.root.position):999;const choices=[{w:a.needs.thirst*1.9,action:'water'},{w:a.needs.energy*1.4,action:'rest'},{w:a.needs.curiosity*daylightFactor(world.daylight)*1.5,action:'explore'},{w:(d<10?.65:.06)*a.needs.social,action:'social'},{w:.25+Math.random()*.2,action:'wander'}];choices.sort((x,y)=>y.w-x.w);const top=choices[0];this.lastThought=top.action;a.state=top.action==='water'?'seeking water':top.action==='rest'?'resting':top.action==='social'?'observing another mind':top.action==='explore'?'exploring':'wandering';a.stateUntil=now+rand(5000,11000);if(top.action==='water')chooseLandTarget(a,'water');else if(top.action==='rest')a.target.copy(a.root.position);else if(top.action==='social'&&o){a.target.copy(o.root.position);if(!isWalkable(a.target.x,a.target.z))a.target.x+=a.target.x<5?9:-9}else chooseLandTarget(a,top.action);a.metrics.autonomy=clamp(a.metrics.autonomy+.003);a.metrics.decision=clamp(a.metrics.decision+(top.w>.55?.002:-.0003))}learn(result){const a=this.agent;a.memory.push({time:Date.now(),state:a.state,result});if(a.memory.length>40)a.memory.shift();a.metrics.learning=clamp(a.metrics.learning+.006);a.metrics.exploration=clamp(a.metrics.exploration+.0015)}}
agents.forEach(a=>a.brain=new AgentBrain(a));
function daylightFactor(v){return clamp((v+.2)/1.2)}
function isWalkable(x,z){if(Math.abs(x)>55||Math.abs(z)>55)return false;const riverX=5-z*.045;return Math.abs(x-riverX)>7.2}
function chooseSafeSpawn(x,z){let best=null,bestD=Infinity;for(let i=0;i<120;i++){const a=rand(-50,50),b=rand(-50,50);if(!isWalkable(a,b))continue;const d=Math.hypot(a-x,b-z);if(d<bestD){bestD=d;best={x:a,z:b}}}return best||{x:0,z:0}}
function chooseLandTarget(a,action){
  const candidates=[];
  for(let i=0;i<80;i++){
    let x=rand(-50,50),z=rand(-50,50);
    if(action==='water'){const z0=rand(-48,48),riverX=5-z0*.045;const side=Math.random()<.5?-1:1;x=riverX+side*rand(7.6,10.5);z=z0}
    if(!isWalkable(x,z))continue;
    const fromCurrent=Math.hypot(x-a.root.position.x,z-a.root.position.z);
    if(fromCurrent<8)continue;
    const recent=a.recentTargets.some(t=>Math.hypot(x-t.x,z-t.z)<10);
    if(recent)continue;
    const other=agents.find(o=>o!==a);
    const separation=other?Math.hypot(x-other.root.position.x,z-other.root.position.z):999;
    const gridX=Math.round(x/5),gridZ=Math.round(z/5);
    const lastRoute=a.routeHistory[a.routeHistory.length-1];
    const routeRepeat=lastRoute&&lastRoute.length>=3&&lastRoute.slice(-3).some(p=>p.x===gridX&&p.z===gridZ);
    const score=fromCurrent*.7+Math.random()*30+separation*.04-(routeRepeat?55:0);
    candidates.push({x,z,score,gridX,gridZ});
  }
  candidates.sort((u,v)=>v.score-u.score);
  const pick=candidates[0];
  if(!pick){a.target.copy(a.root.position);return}
  a.target.set(pick.x,0,pick.z);
  a.recentTargets.unshift({x:pick.x,z:pick.z});
  if(a.recentTargets.length>8)a.recentTargets.pop();
  const route=a.routeHistory[a.routeHistory.length-1]||[];
  route.push({x:pick.gridX,z:pick.gridZ});
  if(route.length>6)route.shift();
  const signature=route.map(p=>p.x+':'+p.z).join('|');
  if(signature===a.lastRouteSignature&&route.length>=3){
    const alternatives=candidates.slice(1).filter(p=>!route.slice(-3).some(r=>r.x===p.gridX&&r.z===p.gridZ));
    const alt=alternatives[0];
    if(alt){a.target.set(alt.x,0,alt.z);route[route.length-1]={x:alt.gridX,z:alt.gridZ}}
  }
  a.lastRouteSignature=route.map(p=>p.x+':'+p.z).join('|');
  if(route.length===6){a.routeHistory.push(route.slice());if(a.routeHistory.length>4)a.routeHistory.shift()}
}

/* ---------- Real solar time ----------
 * Fixed experiment location: Nuremberg, Germany.
 * The simulation clock is the real local clock; DST is handled by the browser.
 * Solar elevation is calculated from the current UTC instant, latitude and longitude.
 */
const SOLAR={lat:49.4542,lon:11.0775};
const RAD=Math.PI/180;
function solarPosition(date=new Date()){const y=date.getUTCFullYear(),start=Date.UTC(y,0,0),day=(date-start)/86400000;const hour=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600+date.getUTCMilliseconds()/3600000;const g=2*Math.PI/365*(day-1+(hour-12)/24);const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));const utcMin=date.getUTCHours()*60+date.getUTCMinutes()+date.getUTCSeconds()/60;const solarMin=utcMin+eq+4*SOLAR.lon;const ha=(solarMin/4-180)*RAD;const lat=SOLAR.lat*RAD;const elevation=Math.asin(Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(ha))/RAD;let azimuth=Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(lat)-Math.tan(decl)*Math.cos(lat))/RAD+180;azimuth=(azimuth+360)%360;return{elevation,azimuth,decl,eq}}
function applySolarLighting(date=new Date()){const s=solarPosition(date),e=s.elevation;const daylight=clamp((e+6)/18);const night=1-daylight;const fullDay=clamp((e+12)/30);const az=s.azimuth*RAD;const er=Math.max(e, -4)*RAD;const horizontal=Math.cos(er);const radius=70;sun.position.set(Math.sin(az)*horizontal*radius,Math.sin(er)*radius,Math.cos(az)*horizontal*radius);sun.target.position.set(0,0,0);moon.position.set(-Math.sin(az)*45,Math.max(8,Math.sin(-er)*45),-Math.cos(az)*45);moon.target.position.set(0,0,0);sun.intensity=lerp(.05,2.7,fullDay);moon.intensity=lerp(.32,.015,daylight);hemi.intensity=lerp(.38,1.35,daylight);sun.color.setHSL(.10+night*.08,.62,lerp(.56,.78,daylight));scene.background.copy(dayColor).lerp(nightColor,clamp(night*.92));scene.fog.color.copy(scene.background);scene.fog.density=lerp(.008,.018,night);fireLight.intensity=lerp(2.5,5.8,night);return{daylight,night,solarElevation:e,solarAzimuth:s.azimuth}}

/* ---------- Persistence ---------- */
const saved=(()=>{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch{return null}})();
const experimentStart=saved?.experimentStart||Date.now();let running=saved?.running??true;let cameraMode='auto',selectedAgent=null,lastDecision=0,eventLog=saved?.events||[];
if(saved?.agents)saved.agents.forEach(s=>{const a=agents.find(x=>x.name===s.name);if(!a)return;a.root.position.set(s.x,0,s.z);if(!isWalkable(a.root.position.x,a.root.position.z)){const safe=chooseSafeSpawn(a.root.position.x,a.root.position.z);a.root.position.set(safe.x,0,safe.z);a.target.copy(a.root.position)}a.metrics={...a.metrics,...s.metrics};a.memory=s.memory||[]});
function addEvent(text,agent=null){const item={time:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),text,agent};eventLog=[item,...eventLog].slice(0,10);renderEvents();renderSceneEvents()}
function save(){const payload={experimentStart,running,events:eventLog,agents:agents.map(a=>({name:a.name,x:a.root.position.x,z:a.root.position.z,metrics:a.metrics,memory:a.memory.slice(-20)}))};try{localStorage.setItem(SAVE_KEY,JSON.stringify(payload))}catch{}}

function renderEvents(){const el=$('#events');el.innerHTML='';eventLog.slice(0,7).forEach(e=>{const row=document.createElement('div');row.className='event';row.innerHTML=`<time>${e.time}</time>${e.text}`;el.appendChild(row)});$('#eventCount').textContent=eventLog.length}
function renderStats(){const host=$('#stats');host.innerHTML='';const labels=[['survival','ВЫЖИВАНИЕ'],['autonomy','АВТОНОМИЯ'],['learning','ОБУЧЕНИЕ'],['exploration','ИССЛЕДОВАНИЕ'],['social','СОЦИАЛЬНОСТЬ'],['decision','КАЧЕСТВО РЕШЕНИЙ']];agents.forEach(a=>{const card=document.createElement('div');card.className='agent-card';const head=document.createElement('div');head.className='agent-head';head.innerHTML=`<span class="agent-name" style="color:#${a.color.toString(16).padStart(6,'0')}">${a.name}</span><span class="agent-state">${a.state}</span>`;card.appendChild(head);const grid=document.createElement('div');grid.className='metric-grid';labels.forEach(([key,label])=>{const m=document.createElement('div');m.className='metric';const ring=document.createElement('div');ring.className='metric-ring';ring.style.setProperty('--p',`${Math.round(a.metrics[key]*100)}%`);ring.style.setProperty('--metric-color',`#${a.color.toString(16).padStart(6,'0')}`);ring.innerHTML=`<span>${Math.round(a.metrics[key]*100)}</span>`;m.appendChild(ring);const l=document.createElement('label');l.textContent=label;m.appendChild(l);grid.appendChild(m)});card.appendChild(grid);host.appendChild(card)})}
function updatePill(){const elapsed=Math.max(0,Date.now()-experimentStart);const day=Math.floor(elapsed/86400000)+1;$('#pillDay').textContent=`ДЕНЬ ${String(day).padStart(3,'0')}`;$('#pillStart').textContent=`СТАРТ ${new Date(experimentStart).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`}
$('#brainOrb').addEventListener('click',()=>{const p=$('#observatory');p.classList.toggle('open');p.setAttribute('aria-hidden',String(!p.classList.contains('open')));if(p.classList.contains('open'))renderStats()});
$('#closePanel').addEventListener('click',()=>$('#observatory').classList.remove('open'));$('#controlOrb').addEventListener('click',()=>$('#controlDock').classList.toggle('open'));
$('#start').addEventListener('click',()=>{running=true;addEvent('Наблюдение продолжено.');save()});$('#pause').addEventListener('click',()=>{running=false;addEvent('Симуляция поставлена на паузу.');save()});
$('#followA').addEventListener('click',()=>{cameraMode='follow';selectedAgent=agents[0]});$('#followB').addEventListener('click',()=>{cameraMode='follow';selectedAgent=agents[1]});$('#free').addEventListener('click',()=>{cameraMode='free';selectedAgent=null});$('#auto').addEventListener('click',()=>{cameraMode='auto';selectedAgent=null});

let drag=false,lastX=0,lastY=0,yaw=.65,pitch=.58,radius=44;
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag||cameraMode==='follow')return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.005;pitch=clamp(pitch+dy*.004,.28,1.15);cameraMode='free'});
renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('wheel',e=>{radius=clamp(radius+e.deltaY*.035,18,75);cameraMode='free'},{passive:true});
function frameTarget(){if(cameraMode==='follow'&&selectedAgent)return selectedAgent.root.position.clone().add(new THREE.Vector3(0,1,0));if(cameraMode==='auto'){return agents[0].root.position.clone().add(agents[1].root.position).multiplyScalar(.5)}return new THREE.Vector3(0,0,0)}
function updateCamera(dt){const target=frameTarget();if(cameraMode==='auto'){const spread=dist2(agents[0].root.position,agents[1].root.position);radius=lerp(radius,clamp(38+spread*.55,38,58),dt*.5);yaw+=dt*.035}if(cameraMode==='follow')radius=lerp(radius,20,dt*1.4);const pos=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,Math.cos(yaw)*Math.cos(pitch)*radius).add(target);camera.position.lerp(pos,1-Math.pow(.001,dt));camera.lookAt(target)}

function updateAgents(dt,now,world){agents.forEach(a=>{a.needs.energy=clamp(a.needs.energy+dt*.004);a.needs.thirst=clamp(a.needs.thirst+dt*.006);a.needs.curiosity=clamp(a.needs.curiosity+dt*.0015);if(now>a.stateUntil&&running){a.brain.decide(world,now);if(Math.random()<.35)addEvent(`${a.name} изменил решение: ${a.state}.`,a.name)}const p=a.root.position,target=a.target,d=dist2(p,target);if(a.state==='resting'){a.body.rotation.z=Math.sin(now*.001+a.phase)*.025;a.needs.energy=clamp(a.needs.energy-dt*.012);a.needs.thirst=clamp(a.needs.thirst-dt*.001)}else if(d>.7&&running){const dir=new THREE.Vector3(target.x-p.x,0,target.z-p.z).normalize();const speed=a.state==='observing another mind'?.55:.72;const nextX=p.x+dir.x*dt*speed,nextZ=p.z+dir.z*dt*speed;if(isWalkable(nextX,nextZ)){p.addScaledVector(dir,dt*speed);a.root.rotation.y=Math.atan2(dir.x,dir.z)}
else {const safe=chooseSafeSpawn(p.x,p.z);a.target.set(safe.x,0,safe.z);chooseLandTarget(a,a.state==='seeking water'?'water':'explore')}a.needs.energy=clamp(a.needs.energy+dt*.0018);a.needs.thirst=clamp(a.needs.thirst+dt*.0012);a.metrics.exploration=clamp(a.metrics.exploration+dt*.00012)}else if(running){if(a.state==='seeking water'){a.needs.thirst=clamp(a.needs.thirst-dt*.025);a.metrics.survival=clamp(a.metrics.survival+.0007);a.brain.learn('достиг воды')}if(a.state==='exploring'){a.needs.curiosity=clamp(a.needs.curiosity-dt*.02);a.brain.learn('обнаружено новое место')}if(a.state==='observing another mind'){a.needs.social=clamp(a.needs.social-dt*.018);a.metrics.social=clamp(a.metrics.social+.0008);a.brain.learn('замечен другой разум')}a.stateUntil=now+rand(2500,6000)}const bob=Math.sin(now*.0024+a.phase)*.035;a.root.position.y=bob;a.core.scale.setScalar(1+Math.sin(now*.004+a.phase)*.08);a.ring.rotation.z+=dt*.35;projectLabel(a)});const d=dist2(agents[0].root.position,agents[1].root.position);if(d<7&&Math.random()<dt*.08){addEvent('OpenAI и Cloude находятся рядом — наблюдение без вмешательства.');agents[0].needs.social=clamp(agents[0].needs.social+.15);agents[1].needs.social=clamp(agents[1].needs.social+.15)}}
function projectLabel(a){const v=a.root.position.clone();v.y=2.9;v.project(camera);const x=(v.x*.5+.5)*innerWidth,y=(-v.y*.5+.5)*innerHeight;a.label.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;a.label.style.opacity=(v.z>1||Math.abs(v.x)>1)?'0':'1';const state=a.label.querySelector('.agent-state-tag');if(state)state.textContent=({resting:'отдыхает','seeking water':'ищет воду','observing another mind':'наблюдает','exploring':'исследует',wandering:'бродит',observing:'наблюдает'})[a.state]||a.state}

let last=performance.now(),saveTimer=0;
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;const world=applySolarLighting(new Date());if(running)updateAgents(dt,now,world);else agents.forEach(projectLabel);updateCamera(dt);$('#clock').textContent=new Date().toLocaleTimeString('ru-RU',{hour12:false});updatePill();if(now-lastDecision>9000&&running){lastDecision=now;renderStats()}saveTimer+=dt;if(saveTimer>8){saveTimer=0;save()}renderer.render(scene,camera)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75))}
addEvent('OpenAI и Cloude появились в мире независимо друг от друга.');addEvent('Среда создана. Цели агентам не назначены.');addEvent('Реальное солнечное время синхронизировано с Нюрнбергом.');addEvent('Наблюдение активно. Вмешательство человека: 0.');addEvent('AI Life 2.0 — визуальное ядро запущено.');
renderEvents();renderStats();updatePill();window.addEventListener('resize',resize);resize();if(['127.0.0.1','localhost'].includes(location.hostname))window.__AI_LIFE_TEST__={agents,isWalkable,chooseSafeSpawn,save};
requestAnimationFrame(tick);

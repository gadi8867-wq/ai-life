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
 water:new THREE.MeshStandardMaterial({color:0x1a5660,roughness:.34,metalness:.02,transparent:true,opacity:.9}),
 trunk:new THREE.MeshStandardMaterial({color:0x4b3829,roughness:1}),
 leafA:new THREE.MeshStandardMaterial({color:0x2e6040,roughness:.9}),leafB:new THREE.MeshStandardMaterial({color:0x426d4c,roughness:.92}),
 rock:new THREE.MeshStandardMaterial({color:0x68706b,roughness:.95}),grass:new THREE.MeshStandardMaterial({color:0x5d7c50,roughness:1}),ember:new THREE.MeshBasicMaterial({color:0xff9b3d})
};
const terrain=new THREE.Group();scene.add(terrain);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(WORLD,WORLD,50,50),mat.ground);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;terrain.add(ground);
const river=new THREE.Mesh(new THREE.PlaneGeometry(13,WORLD+10),mat.water);river.rotation.x=-Math.PI/2;river.position.set(5,.08,0);river.rotation.z=.045;terrain.add(river);

const bridge=new THREE.Group();
bridge.name='river-bridge';
bridge.position.set(5,.34,0);
bridge.rotation.z=.045;
const bridgeWood=new THREE.MeshStandardMaterial({color:0x765338,roughness:.78,metalness:.04});
const bridgeEdge=new THREE.MeshStandardMaterial({color:0x4a3323,roughness:.9,metalness:.02});
for(let i=0;i<11;i++){
  const plank=new THREE.Mesh(new THREE.BoxGeometry(1.55,.22,3.5),bridgeWood);
  plank.position.x=-7.5+i*1.5;
  plank.position.y=.04;
  plank.castShadow=true;
  plank.receiveShadow=true;
  bridge.add(plank);
}
const beamL=new THREE.Mesh(new THREE.BoxGeometry(19,.34,.24),bridgeEdge);
beamL.position.set(0,.2,-1.72);beamL.castShadow=true;bridge.add(beamL);
const beamR=beamL.clone();beamR.position.z=1.72;bridge.add(beamR);
for(const x of [-7.6,-3.8,0,3.8,7.6]){
  for(const z of [-1.72,1.72]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,1.65,7),bridgeEdge);
    post.position.set(x,.78,z);post.castShadow=true;bridge.add(post);
  }
}
const railL=new THREE.Mesh(new THREE.BoxGeometry(19,.16,.16),bridgeEdge);
railL.position.set(0,1.5,-1.72);railL.castShadow=true;bridge.add(railL);
const railR=railL.clone();railR.position.z=1.72;bridge.add(railR);
const bridgeShadow=new THREE.Mesh(new THREE.BoxGeometry(18.5,.05,3.9),new THREE.MeshStandardMaterial({color:0x2b2018,transparent:true,opacity:.28}));
bridgeShadow.position.y=-.03;bridge.add(bridgeShadow);
terrain.add(bridge);

const bankMat=new THREE.MeshStandardMaterial({color:0x8b7453,roughness:1,metalness:0});
const bankLeft=new THREE.Mesh(new THREE.PlaneGeometry(2.1,WORLD+10),bankMat);
bankLeft.rotation.x=-Math.PI/2;bankLeft.rotation.z=.045;bankLeft.position.set(5-8.05,.075,0);terrain.add(bankLeft);
const bankRight=bankLeft.clone();bankRight.position.x=5+8.05;terrain.add(bankRight);
const bankPebbles=new THREE.Group();bankPebbles.name='river-banks';
for(let i=0;i<34;i++){
  const z=rand(-53,53),riverX=5-z*.045,side=i%2===0?-1:1;
  const pebble=new THREE.Mesh(new THREE.DodecahedronGeometry(rand(.09,.22),0),mat.rock);
  pebble.position.set(riverX+side*rand(6.65,7.8),rand(.12,.25),z);
  pebble.scale.y=rand(.45,.8);pebble.rotation.y=rand(0,Math.PI);pebble.castShadow=true;bankPebbles.add(pebble);
}
terrain.add(bankPebbles);

/* ---------- Real calendar seasons ----------
 * Continuous autumn calendar for Nuremberg: week-to-week changes are interpolated.
 */
const trees=[];
function yearDay(date=new Date()){const y=date.getUTCFullYear();return Math.floor((Date.UTC(y,date.getUTCMonth(),date.getUTCDate())-Date.UTC(y,0,1))/86400000)+1}
function smoothstep(t){t=clamp(t);return t*t*(3-2*t)}
function autumnProgress(date=new Date()){const y=date.getUTCFullYear(),start=Date.UTC(y,8,1),end=Date.UTC(y,11,1);return smoothstep((date.getTime()-start)/(end-start))}
function seasonInfo(date=new Date()){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Berlin',month:'numeric'}).formatToParts(date);const m=Number(parts.find(p=>p.type==='month')?.value||1)-1;if(m>=2&&m<=4)return{name:'Весна',emoji:'🌱',key:'spring',progress:0};if(m>=5&&m<=7)return{name:'Лето',emoji:'☀️',key:'summer',progress:0};if(m>=8&&m<=10)return{name:'Осень',emoji:'🍂',key:'autumn',progress:autumnProgress(date)};return{name:'Зима',emoji:'❄️',key:'winter',progress:1}}
const seasonPalettes={spring:{leafA:[.32,.58,.38],leafB:[.25,.48,.31],ground:[.29,.34,.23],grass:[.30,.49,.34],trunk:[.07,.30,.23]},summer:{leafA:[.34,.64,.36],leafB:[.29,.58,.32],ground:[.30,.37,.22],grass:[.31,.52,.34],trunk:[.08,.34,.27]},autumn:{leafA:[.095,.68,.34],leafB:[.045,.82,.52],ground:[.095,.30,.20],grass:[.20,.43,.28],trunk:[.055,.30,.19]},winter:{leafA:[.58,.12,.48],leafB:[.58,.10,.38],ground:[.58,.08,.72],grass:[.58,.10,.65],trunk:[.58,.12,.32]}};
function seasonColor(hsl){const c=new THREE.Color();c.setHSL(hsl[0],hsl[1],hsl[2]);return c}
function autumnClimate(date=new Date()){const p=autumnProgress(date),d=yearDay(date),weekly=.5+.5*Math.sin((d-248)/7*2*Math.PI),slow=.5+.5*Math.sin((d-252)/19*2*Math.PI);return{progress:p,temperature:lerp(16,5.5,p)+lerp(1.2,-1.2,slow)+lerp(.5,-.5,weekly),rainTarget:clamp(.26+.42*p+.14*slow+.06*weekly),wind:lerp(.35,1.05,p)}}
const seasonLeaves=(()=>{const count=150,positions=new Float32Array(count*3),drift=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=rand(-58,58);positions[i*3+1]=rand(2,18);positions[i*3+2]=rand(-58,58);drift[i*3]=rand(-.35,.35);drift[i*3+1]=rand(.65,1.35);drift[i*3+2]=rand(-.25,.25)}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xe0a04b,size:.14,transparent:true,opacity:.72,depthWrite:false}));points.visible=false;scene.add(points);return{points,positions,drift}})();
const leafBed=(()=>{const count=620,positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=rand(-55,55);positions[i*3+1]=.035;positions[i*3+2]=rand(-55,55)}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const material=new THREE.PointsMaterial({color:0xb06a35,size:.16,transparent:true,opacity:0,depthWrite:false});const points=new THREE.Points(geometry,material);scene.add(points);return points})();
function applySeason(date=new Date()){const s=seasonInfo(date),p=s.key==='autumn'?s.progress:0,palette=seasonPalettes[s.key],climate=autumnClimate(date);trees.forEach(t=>t.foliage.forEach((mesh,i)=>{if(s.key==='autumn'){const warm=clamp(.22+t.warmBias*.32+p*.72),baseHue=i%2===0?.30:.20,hue=lerp(baseHue,.055,warm),sat=lerp(.42,.82,warm),light=lerp(.28,.43,warm);mesh.material.color.copy(seasonColor([hue,sat,light]))}else{const base=i%2===0?palette.leafA:palette.leafB;mesh.material.color.copy(seasonColor([base[0],base[1],clamp(base[2]+(t.warmBias-.5)*.035,.12,.62)]))}}));mat.ground.color.copy(seasonColor(palette.ground));mat.grass.color.copy(seasonColor(palette.grass));mat.trunk.color.copy(seasonColor(palette.trunk));seasonLeaves.points.visible=s.key==='autumn';seasonLeaves.points.material.opacity=s.key==='autumn'?lerp(.38,.86,p):0;leafBed.material.opacity=s.key==='autumn'?lerp(.10,.56,p):0;seasonLeaves.points.material.size=lerp(.11,.18,p);leafBed.material.size=lerp(.10,.19,p);const seasonalRain=s.key==='autumn'?climate.rainTarget:s.key==='winter'?.3:s.key==='spring'?.2:.1;return{...s,temperatureC:climate.temperature,rainTarget:seasonalRain,leafAccumulation:p}}
function updateSeasonLeaves(dt){if(!seasonLeaves.points.visible)return;const p=seasonLeaves.positions,d=seasonLeaves.drift;for(let i=0;i<p.length/3;i++){p[i*3]+=(d[i*3]+weather.wind*.12)*dt;p[i*3+1]-=d[i*3+1]*dt;p[i*3+2]+=(d[i*3+2]+weather.wind*.05)*dt;if(p[i*3+1]<.2){p[i*3+1]=rand(9,18);p[i*3]=rand(-58,58);p[i*3+2]=rand(-58,58)}}seasonLeaves.points.geometry.attributes.position.needsUpdate=true;seasonLeaves.points.rotation.y+=dt*.015}
function addTree(x,z,s=1,v=0){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);const t=new THREE.Mesh(new THREE.CylinderGeometry(.25,.38,2.8,7),mat.trunk);t.position.y=1.4;t.castShadow=true;g.add(t);const foliage=[];const makeCanopy=(scale,px,py,pz)=>{const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(1.7,1),new THREE.MeshStandardMaterial({color:0x2e6040,roughness:.9,flatShading:true}));mesh.position.set(px,py,pz);mesh.scale.set(scale,scale*1.05,scale*.94);mesh.castShadow=true;g.add(mesh);foliage.push(mesh)};makeCanopy(1.18,0,3.15,0);makeCanopy(.72,-.85,3.85,.18);makeCanopy(.68,.8,4.0,-.18);if(v%4===0)makeCanopy(.5,.1,4.75,.25);trees.push({group:g,foliage,warmBias:((v*37)%100)/100});terrain.add(g)}
function addRock(x,z,s=1){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(.75),mat.rock);r.position.set(x,.45*s,z);r.scale.set(s*rand(.8,1.35),s*rand(.65,1),s*rand(.75,1.25));r.rotation.set(rand(-.3,.3),rand(0,Math.PI),rand(-.2,.2));r.castShadow=true;terrain.add(r)}
function addGrass(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);for(let i=0;i<4;i++){const b=new THREE.Mesh(new THREE.ConeGeometry(.055,rand(.35,.65),4),mat.grass);b.position.set(rand(-.22,.22),b.geometry.parameters.height/2,rand(-.22,.22));b.rotation.z=rand(-.25,.25);g.add(b)}terrain.add(g)}
for(let i=0;i<68;i++){let x=rand(-52,52),z=rand(-52,52);if(Math.abs(x-5)<9)x+=x<5?-10:10;addTree(x,z,rand(.72,1.42),i)}
for(let i=0;i<38;i++){let x=rand(-52,52),z=rand(-52,52);if(Math.abs(x-5)<9)x+=x<5?-10:10;addRock(x,z,rand(.45,1.15))}
for(let i=0;i<145;i++){let x=rand(-55,55),z=rand(-55,55);if(Math.abs(x-5)<7)x+=x<5?-8:8;addGrass(x,z,rand(.65,1.35))}

/* ---------- Cave shelters / quiet places ---------- */
const caves=new THREE.Group();caves.name='caves';terrain.add(caves);
const caveDark=new THREE.MeshStandardMaterial({color:0x202725,roughness:1,metalness:.02});
const caveRock=new THREE.MeshStandardMaterial({color:0x4f5753,roughness:.98});
function addCave(x,z,scale=1,rotation=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;g.scale.setScalar(scale);
  const back=new THREE.Mesh(new THREE.DodecahedronGeometry(2.9,1),caveRock);back.scale.set(1.25,.9,.72);back.position.set(0,1.8,.55);back.castShadow=true;g.add(back);
  const left=new THREE.Mesh(new THREE.DodecahedronGeometry(1.7,1),caveRock);left.scale.set(.9,1.25,.9);left.position.set(-1.75,1.25,-.05);left.castShadow=true;g.add(left);
  const right=left.clone();right.position.x=1.75;g.add(right);
  const roof=new THREE.Mesh(new THREE.DodecahedronGeometry(1.9,1),caveRock);roof.scale.set(1.35,.72,.95);roof.position.set(0,3.25,-.05);roof.castShadow=true;g.add(roof);
  const opening=new THREE.Mesh(new THREE.CircleGeometry(1.25,24),caveDark);opening.rotation.x=-Math.PI/2;opening.position.set(0,.06,-.72);g.add(opening);
  const marker=new THREE.Mesh(new THREE.RingGeometry(1.15,1.28,24),new THREE.MeshBasicMaterial({color:0x18211f,transparent:true,opacity:.28}));marker.rotation.x=-Math.PI/2;marker.position.set(0,.08,-.72);g.add(marker);
  caves.add(g);
  return g;
}
addCave(-38,34,1.15,-.35);addCave(39,-30,1.05,.65);addCave(-42,-38,.9,.2);

const fire=new THREE.Group();fire.position.set(-11,0,9);scene.add(fire);
for(let i=0;i<5;i++){const l=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,2,7),mat.trunk);l.position.y=.22;l.rotation.z=Math.PI/2;l.rotation.y=i*.65;l.rotation.x=.18;l.castShadow=true;fire.add(l)}
const flame=new THREE.Mesh(new THREE.IcosahedronGeometry(.72,1),mat.ember);flame.position.y=1.05;fire.add(flame);
const fireLight=new THREE.PointLight(0xff9a4c,4.2,13,2);fireLight.position.y=1.4;fire.add(fireLight);

const worldResources=new THREE.Group();scene.add(worldResources);
const worldItems=[];
const weather={rain:false,rainUntil:0,wind:0,rainLevel:0,temperatureC:12,rainTarget:0};
function spawnWorldItem(kind='resource',x=rand(-48,48),z=rand(-48,48)){
  if(!isWalkable(x,z))return null;
  const color=kind==='gift'?0xffd66b:kind==='major'?0xb78cff:0x75d6c6;
  const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(kind==='major'?.5:.28,1),new THREE.MeshStandardMaterial({color,metalness:.45,roughness:.28,emissive:color,emissiveIntensity:.18}));
  mesh.position.set(x,.45,z);mesh.castShadow=true;worldResources.add(mesh);
  const item={id:Date.now()+Math.random(),kind,mesh,createdAt:Date.now(),claimed:false};
  worldItems.push(item);
  return item;
}
function nearestVisibleItem(a){
  let best=null,bestD=Infinity;
  worldItems.forEach(item=>{if(item.claimed) return;const d=Math.hypot(a.root.position.x-item.mesh.position.x,a.root.position.z-item.mesh.position.z);if(d<bestD){bestD=d;best=item}});
  return best;
}
function updateWorldItems(dt,now){
  worldItems.forEach(item=>{if(item.claimed){item.mesh.visible=false;return}item.mesh.rotation.y+=dt*(item.kind==='major'?.5:1.2);item.mesh.position.y=.45+Math.sin(now*.002+item.id)*.08});
  if(weather.rain&&now>weather.rainUntil)weather.rain=false;
}
const rainCount=260,rainPositions=new Float32Array(rainCount*3);
const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rainMaterial=new THREE.PointsMaterial({color:0x9ad7ff,size:.11,transparent:true,opacity:.62,depthWrite:false});
const rain=new THREE.Points(rainGeometry,rainMaterial);rain.visible=false;scene.add(rain);
function resetRainParticles(){for(let i=0;i<rainCount;i++){rainPositions[i*3]=rand(-58,58);rainPositions[i*3+1]=rand(4,24);rainPositions[i*3+2]=rand(-58,58)}rain.geometry.attributes.position.needsUpdate=true}
function setRain(active,duration=90000){weather.rain=active;weather.rainUntil=Date.now()+duration;weather.rainLevel=active?1:0;rain.visible=active;if(active)resetRainParticles()}
function updateRain(dt){if(!weather.rain&&weather.rainLevel<=.03)return;const p=rain.geometry.attributes.position.array;for(let i=0;i<rainCount;i++){p[i*3+1]-=dt*13;if(p[i*3+1]<.3)p[i*3+1]=rand(10,24)}rain.geometry.attributes.position.needsUpdate=true;rain.rotation.y+=dt*.03;}

const agentColors={OpenAI:0x63c9e8,Cloude:0xe7a45e},agents=[];
function makeAgent(name,color,x,z){const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);const glow=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,side:THREE.BackSide});const shell=new THREE.MeshStandardMaterial({color:0xc5d4d1,metalness:.45,roughness:.32});const dark=new THREE.MeshStandardMaterial({color:0x182126,metalness:.25,roughness:.5});const body=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.85,5,12),shell);body.position.y=1.05;body.castShadow=true;root.add(body);const core=new THREE.Mesh(new THREE.SphereGeometry(.24,16,12),new THREE.MeshBasicMaterial({color}));core.position.set(0,1.2,.48);root.add(core);const halo=new THREE.Mesh(new THREE.SphereGeometry(1.05,20,16),glow);halo.position.y=1.1;root.add(halo);const eye=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),dark);eye.position.set(0,1.47,.48);root.add(eye);const footL=new THREE.Mesh(new THREE.SphereGeometry(.24,12,8),dark);footL.scale.y=.55;footL.position.set(-.23,.33,0);root.add(footL);const footR=footL.clone();footR.position.x=.23;root.add(footR);const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.018,8,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.38}));ring.rotation.x=Math.PI/2;ring.position.y=.03;root.add(ring);const label=document.createElement('div');label.className='agent-label';label.innerHTML=`<span class="agent-name-tag">${name}</span><span class="agent-state-tag">наблюдает</span>`;label.style.setProperty('--agent-color',`#${color.toString(16).padStart(6,'0')}`);document.body.appendChild(label);return{name,color,root,body,core,halo,ring,label,target:new THREE.Vector3(x,0,z),state:'observing',stateUntil:0,metrics:{survival:.74,autonomy:.52,learning:.18,exploration:.31,social:.08,decision:.63},memory:[],needs:{energy:.18,thirst:.22,curiosity:.62,social:.05,hunger:.2},abilities:[],brain:null,phase:Math.random()*10,recentTargets:[],routeHistory:[],lastRouteSignature:''}}
agents.push(makeAgent('OpenAI',agentColors.OpenAI,-22,-4));agents.push(makeAgent('Cloude',agentColors.Cloude,24,12));

class AgentBrain{constructor(agent){this.agent=agent;this.lastThought='наблюдает'}observe(world){const a=this.agent,o=agents.find(x=>x!==a),d=o?dist2(a.root.position,o.root.position):999;const item=nearestVisibleItem(a);return{self:{x:a.root.position.x,z:a.root.position.z},daylight:world.daylight,distanceToOther:d,state:a.state,needs:{...a.needs},abilities:[...a.abilities],nearbyItem:item?{kind:item.kind,distance:Math.hypot(a.root.position.x-item.mesh.position.x,a.root.position.z-item.mesh.position.z)}:null,weather:{rain:weather.rain,wind:weather.wind},recentMemory:a.memory.slice(-4)}}decide(world,now){const a=this.agent,o=agents.find(x=>x!==a),d=o?dist2(a.root.position,o.root.position):999;const item=nearestVisibleItem(a);const itemDistance=item?Math.hypot(a.root.position.x-item.mesh.position.x,a.root.position.z-item.mesh.position.z):999;const choices=[{w:a.needs.thirst*1.9,action:'water'},{w:a.needs.energy*1.4,action:'rest'},{w:a.needs.hunger*1.35*(item?1.25:0),action:'resource'},{w:a.needs.curiosity*daylightFactor(world.daylight)*1.5,action:'explore'},{w:(d<10?.65:.06)*a.needs.social,action:'social'},{w:.25+Math.random()*.2,action:'wander'}];choices.sort((x,y)=>y.w-x.w);const top=choices[0];this.lastThought=top.action;a.state=top.action==='water'?'seeking water':top.action==='rest'?'resting':top.action==='social'?'observing another mind':top.action==='explore'?'exploring':top.action==='resource'?'seeking resource':'wandering';a.stateUntil=now+rand(5000,11000);if(top.action==='water')chooseLandTarget(a,'water');else if(top.action==='rest')a.target.copy(a.root.position);else if(top.action==='resource'&&item){a.target.copy(item.mesh.position)}else if(top.action==='social'&&o){a.target.copy(o.root.position);if(!isWalkable(a.target.x,a.target.z))a.target.x+=a.target.x<5?9:-9}else chooseLandTarget(a,top.action);a.metrics.autonomy=clamp(a.metrics.autonomy+.003);a.metrics.decision=clamp(a.metrics.decision+(top.w>.55?.002:-.0003));if(top.action==='resource'&&itemDistance>1.2)a.metrics.exploration=clamp(a.metrics.exploration+.0006)}learn(result){const a=this.agent;a.memory.push({time:Date.now(),state:a.state,result});if(a.memory.length>40)a.memory.shift();a.metrics.learning=clamp(a.metrics.learning+.006);a.metrics.exploration=clamp(a.metrics.exploration+.0015)}}
agents.forEach(a=>a.brain=new AgentBrain(a));
spawnWorldItem('resource',-28,-18);spawnWorldItem('resource',31,-25);spawnWorldItem('resource',-34,27);
function daylightFactor(v){return clamp((v+.2)/1.2)}
function isWalkable(x,z){if(Math.abs(x)>55||Math.abs(z)>55)return false;const riverX=5-z*.045;const bridgeCorridor=Math.abs(z)<=2.15&&Math.abs(x-riverX)<=9.2;if(bridgeCorridor)return true;return Math.abs(x-riverX)>7.2}
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
function applySolarLighting(date=new Date()){const s=solarPosition(date),e=s.elevation,season=applySeason(date);const previousRainTarget=weather.rainTarget;weather.temperatureC=season.temperatureC;weather.rainTarget=season.rainTarget;if(previousRainTarget<=.03&&weather.rainTarget>.03)resetRainParticles();weather.wind=season.key==='autumn'?autumnClimate(date).wind:season.key==='winter'?.55:.22;const daylight=clamp((e+6)/18);const night=1-daylight;const fullDay=clamp((e+12)/30);const az=s.azimuth*RAD;const er=Math.max(e,-4)*RAD;const horizontal=Math.cos(er);const radius=70;sun.position.set(Math.sin(az)*horizontal*radius,Math.sin(er)*radius,Math.cos(az)*horizontal*radius);sun.target.position.set(0,0,0);moon.position.set(-Math.sin(az)*45,Math.max(8,Math.sin(-er)*45),-Math.cos(az)*45);moon.target.position.set(0,0,0);sun.intensity=lerp(.05,2.7,fullDay);moon.intensity=lerp(.32,.015,daylight);hemi.intensity=lerp(.38,1.35,daylight);const seasonLight=season.key==='winter'?.86:season.key==='autumn'?.94:season.key==='summer'?1.06:1;const autumnWarm=season.key==='autumn'?.035:0;sun.color.setHSL(.10+night*.08+autumnWarm,.62,lerp(.56,.78,daylight));sun.intensity=lerp(.05,2.7*seasonLight,fullDay);scene.background.copy(dayColor).lerp(nightColor,clamp(night*.92));scene.fog.color.copy(scene.background);scene.fog.density=lerp(.008,.018,night);fireLight.intensity=lerp(2.5,5.8,night);return{daylight,night,solarElevation:e,solarAzimuth:s.azimuth,season}}

/* ---------- Autonomous world events ---------- */
const donationState={lastId:0,polling:false};
const abilityNames=['Наблюдательность','Память','Ориентация','Выносливость','Поиск ресурсов','Ночное восприятие','Коммуникация'];
function chooseAbility(agent){
  const ability=abilityNames[Math.floor(Math.random()*abilityNames.length)];
  if(!agent.abilities.includes(ability))agent.abilities.push(ability);
  if(ability==='Наблюдательность')agent.metrics.exploration=clamp(agent.metrics.exploration+.04);
  if(ability==='Память')agent.metrics.learning=clamp(agent.metrics.learning+.04);
  if(ability==='Ориентация')agent.metrics.autonomy=clamp(agent.metrics.autonomy+.03);
  if(ability==='Выносливость')agent.needs.energy=clamp(agent.needs.energy-.08);
  if(ability==='Поиск ресурсов')agent.metrics.survival=clamp(agent.metrics.survival+.03);
  if(ability==='Ночное восприятие')agent.metrics.decision=clamp(agent.metrics.decision+.03);
  if(ability==='Коммуникация')agent.metrics.social=clamp(agent.metrics.social+.04);
  return ability;
}
function applyDonationEvent(event){
  const amount=Number(event.amount)||0;
  const type=event.type;
  let target=null;
  if(event.agent)target=agents.find(a=>a.name===event.agent)||null;
  if(type==='ability'){
    target=target||agents[Math.random()<.5?0:1];
    const ability=chooseAbility(target);
    addEvent(`🎁 ${event.name}: ${target.name} получил способность «${ability}».`,target.name);
    showDonationBanner(`🎁 ${target.name}: ${ability}`,event.name);
  }else if(type==='gift'){
    const item=spawnWorldItem('gift');
    addEvent(`🎁 ${event.name}: в мире появился неизвестный подарок.`);
    showDonationBanner('🎁 Новый подарок в мире',event.name);
  }else if(type==='resource'){
    spawnWorldItem('resource');
    addEvent(`💧 ${event.name}: в мире появился новый ресурс.`);
    showDonationBanner('💧 Новый ресурс',event.name);
  }else if(type==='weather'){
    setRain(true,90000);
    addEvent(`🌧️ ${event.name}: начался дождь.`);
    showDonationBanner('🌧️ Дождь начался',event.name);
  }else if(type==='environment'){
    weather.wind=rand(-1,1);
    scene.fog.density=clamp(scene.fog.density+rand(-.002,.003),.006,.022);
    addEvent(`🌙 ${event.name}: условия окружающей среды изменились.`);
    showDonationBanner('🌙 Среда изменилась',event.name);
  }else if(type==='unknown'){
    const kinds=['gift','resource','weather','environment'];
    applyDonationEvent({...event,type:kinds[Math.floor(Math.random()*kinds.length)]});
    addEvent(`❓ ${event.name}: произошло неизвестное событие.`);
  }else if(type==='major'){
    spawnWorldItem('major');
    setRain(Math.random()<.5,60000);
    addEvent(`🌍 ${event.name}: произошло крупное изменение мира.`);
    showDonationBanner('🌍 Крупное событие',event.name);
  }else{
    addEvent(`💚 ${event.name} поддержал эксперимент на ${amount} ${event.currency}.`);
    showDonationBanner(`💚 +${amount} ${event.currency}`,event.name);
  }
  save();
}
function showDonationBanner(title,name){
  const layer=$('#dialogue-layer');if(!layer)return;
  const el=document.createElement('div');el.className='dialogue-bubble donation-bubble show';el.innerHTML=`<span class="dialogue-speaker">AI LIFE</span><span class="dialogue-text">${title}<br><small>${String(name||'Аноним')}</small></span>`;layer.appendChild(el);
  setTimeout(()=>el.remove(),5000);
}
async function pollDonationEvents(){
  if(donationState.polling||!AI_BACKEND)return;
  donationState.polling=true;
  try{const r=await fetch(AI_BACKEND+`/api/donations/events?after=${donationState.lastId}`);if(r.ok){const d=await r.json();for(const event of d.events||[]){donationState.lastId=Math.max(donationState.lastId,event.id);applyDonationEvent(event)}}}catch(error){console.warn('donation poll',error.message)}finally{donationState.polling=false}
}
/* ---------- Persistence ---------- */
const saved=(()=>{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch{return null}})();
const experimentStart=saved?.experimentStart||Date.now();let running=saved?.running??true;let cameraMode='auto',selectedAgent=null,lastDecision=0,eventLog=saved?.events||[];
if(saved?.agents)saved.agents.forEach(s=>{const a=agents.find(x=>x.name===s.name);if(!a)return;a.root.position.set(s.x,0,s.z);if(!isWalkable(a.root.position.x,a.root.position.z)){const safe=chooseSafeSpawn(a.root.position.x,a.root.position.z);a.root.position.set(safe.x,0,safe.z);a.target.copy(a.root.position)}a.metrics={...a.metrics,...s.metrics};a.memory=s.memory||[];a.abilities=s.abilities||[];a.needs={...a.needs,...s.needs}});
function addEvent(text,agent=null){const item={time:new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),text,agent};eventLog=[item,...eventLog].slice(0,10);renderEvents()}
function save(){const payload={experimentStart,running,events:eventLog,agents:agents.map(a=>({name:a.name,x:a.root.position.x,z:a.root.position.z,metrics:a.metrics,memory:a.memory.slice(-20),needs:a.needs,abilities:a.abilities}))};try{localStorage.setItem(SAVE_KEY,JSON.stringify(payload))}catch{}}

function renderEvents(){const el=$('#events');el.innerHTML='';eventLog.slice(0,7).forEach(e=>{const row=document.createElement('div');row.className='event';row.innerHTML=`<time>${e.time}</time>${e.text}`;el.appendChild(row)});$('#eventCount').textContent=eventLog.length}
function renderStats(){const host=$('#stats');host.innerHTML='';const labels=[['survival','ВЫЖИВАНИЕ'],['autonomy','АВТОНОМИЯ'],['learning','ОБУЧЕНИЕ'],['exploration','ИССЛЕДОВАНИЕ'],['social','СОЦИАЛЬНОСТЬ'],['decision','КАЧЕСТВО РЕШЕНИЙ']];agents.forEach(a=>{const card=document.createElement('div');card.className='agent-card';const head=document.createElement('div');head.className='agent-head';head.innerHTML=`<span class="agent-name" style="color:#${a.color.toString(16).padStart(6,'0')}">${a.name}</span><span class="agent-state">${a.state}</span>`;card.appendChild(head);const grid=document.createElement('div');grid.className='metric-grid';labels.forEach(([key,label])=>{const m=document.createElement('div');m.className='metric';const ring=document.createElement('div');ring.className='metric-ring';ring.style.setProperty('--p',`${Math.round(a.metrics[key]*100)}%`);ring.style.setProperty('--metric-color',`#${a.color.toString(16).padStart(6,'0')}`);ring.innerHTML=`<span>${Math.round(a.metrics[key]*100)}</span>`;m.appendChild(ring);const l=document.createElement('label');l.textContent=label;m.appendChild(l);grid.appendChild(m)});card.appendChild(grid);host.appendChild(card)})}
function updatePill(){const elapsed=Math.max(0,Date.now()-experimentStart);const day=Math.floor(elapsed/86400000)+1;const pillDay=$('#pillDay');if(pillDay)pillDay.textContent='ДЕНЬ '+String(day).padStart(3,'0')}
$('#brainOrb')?.addEventListener('click',()=>{const p=$('#observatory');if(!p)return;p.classList.toggle('open');p.setAttribute('aria-hidden',String(!p.classList.contains('open')));if(p.classList.contains('open'))renderStats()});
$('#closePanel')?.addEventListener('click',()=>$('#observatory')?.classList.remove('open'));$('#controlOrb')?.addEventListener('click',()=>$('#controlDock')?.classList.toggle('open'));
$('#followA')?.addEventListener('click',()=>{cameraMode='follow';selectedAgent=agents[0]});$('#followB')?.addEventListener('click',()=>{cameraMode='follow';selectedAgent=agents[1]});$('#free')?.addEventListener('click',()=>{cameraMode='free';selectedAgent=null});$('#auto')?.addEventListener('click',()=>{cameraMode='auto';selectedAgent=null});

let drag=false,lastX=0,lastY=0,yaw=.65,pitch=.58,radius=44;
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag||cameraMode==='follow')return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.005;pitch=clamp(pitch+dy*.004,.28,1.15);cameraMode='free'});
renderer.domElement.addEventListener('pointerup',()=>drag=false);renderer.domElement.addEventListener('wheel',e=>{radius=clamp(radius+e.deltaY*.035,18,75);cameraMode='free'},{passive:true});
function frameTarget(){if(cameraMode==='follow'&&selectedAgent)return selectedAgent.root.position.clone().add(new THREE.Vector3(0,1,0));if(cameraMode==='auto'){return agents[0].root.position.clone().add(agents[1].root.position).multiplyScalar(.5)}return new THREE.Vector3(0,0,0)}
function updateCamera(dt){const target=frameTarget();if(cameraMode==='auto'){const spread=dist2(agents[0].root.position,agents[1].root.position);radius=lerp(radius,clamp(38+spread*.55,38,58),dt*.5);yaw+=dt*.035}if(cameraMode==='follow')radius=lerp(radius,20,dt*1.4);const pos=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,Math.cos(yaw)*Math.cos(pitch)*radius).add(target);camera.position.lerp(pos,1-Math.pow(.001,dt));camera.lookAt(target)}

function updateAgents(dt,now,world){agents.forEach(a=>{a.needs.energy=clamp(a.needs.energy+dt*.004);a.needs.thirst=clamp(a.needs.thirst+dt*.006);a.needs.curiosity=clamp(a.needs.curiosity+dt*.0015);if(now>a.stateUntil&&running){a.brain.decide(world,now);if(Math.random()<.35)addEvent(`${a.name} изменил решение: ${a.state}.`,a.name)}const p=a.root.position,target=a.target,d=dist2(p,target);if(a.state==='resting'){a.body.rotation.z=Math.sin(now*.001+a.phase)*.025;a.needs.energy=clamp(a.needs.energy-dt*.012);a.needs.thirst=clamp(a.needs.thirst-dt*.001)}else if(d>.7&&running){const dir=new THREE.Vector3(target.x-p.x,0,target.z-p.z).normalize();const speed=a.state==='observing another mind'?.55:.72;const nextX=p.x+dir.x*dt*speed,nextZ=p.z+dir.z*dt*speed;if(isWalkable(nextX,nextZ)){p.addScaledVector(dir,dt*speed);a.root.rotation.y=Math.atan2(dir.x,dir.z)}
else {const safe=chooseSafeSpawn(p.x,p.z);a.target.set(safe.x,0,safe.z);chooseLandTarget(a,a.state==='seeking water'?'water':'explore')}a.needs.energy=clamp(a.needs.energy+dt*.0018);a.needs.thirst=clamp(a.needs.thirst+dt*.0012);a.needs.hunger=clamp(a.needs.hunger+dt*.0022);a.metrics.exploration=clamp(a.metrics.exploration+dt*.00012)}else if(running){if(a.state==='seeking water'){a.needs.thirst=clamp(a.needs.thirst-dt*.025);a.metrics.survival=clamp(a.metrics.survival+.0007);a.brain.learn('достиг воды')}if(a.state==='exploring'){a.needs.curiosity=clamp(a.needs.curiosity-dt*.02);a.brain.learn('обнаружено новое место')}if(a.state==='seeking resource'){const item=nearestVisibleItem(a);if(item&&Math.hypot(a.root.position.x-item.mesh.position.x,a.root.position.z-item.mesh.position.z)<1.5){item.claimed=true;a.needs.hunger=clamp(a.needs.hunger-dt*.08);a.metrics.survival=clamp(a.metrics.survival+.0015);a.brain.learn('найден и изучен ресурс')}}if(a.state==='observing another mind'){a.needs.social=clamp(a.needs.social-dt*.018);a.metrics.social=clamp(a.metrics.social+.0008);a.brain.learn('замечен другой разум')}a.stateUntil=now+rand(2500,6000)}const bob=Math.sin(now*.0024+a.phase)*.035;a.root.position.y=bob;a.core.scale.setScalar(1+Math.sin(now*.004+a.phase)*.08);a.ring.rotation.z+=dt*.35;projectLabel(a)});const d=dist2(agents[0].root.position,agents[1].root.position);dialogueState.lastDistance=d;if(d<8.2){agents[0].needs.social=clamp(agents[0].needs.social+dt*.015);agents[1].needs.social=clamp(agents[1].needs.social+dt*.015);autonomousDialogue()}}

/* ---------- AI dialogue presentation + voice bridge ---------- */
const dialogueLayer=$('#dialogue-layer');
const speechBubbles=new Map();
let availableVoices=[];
function refreshVoices(){availableVoices='speechSynthesis' in window?speechSynthesis.getVoices():[]}
refreshVoices();
if('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged',refreshVoices);
function showSpeech(agent,text,duration=6500){
  if(!text||!dialogueLayer)return;
  let bubble=speechBubbles.get(agent.name);
  if(!bubble){bubble=document.createElement('div');bubble.className='dialogue-bubble';bubble.dataset.agent=agent.name;bubble.innerHTML='<span class="dialogue-speaker"></span><span class="dialogue-text"></span>';dialogueLayer.appendChild(bubble);speechBubbles.set(agent.name,bubble)}
  bubble.style.setProperty('--agent-color',`#${agent.color.toString(16).padStart(6,'0')}`);
  bubble.querySelector('.dialogue-speaker').textContent=agent.name.toUpperCase();
  bubble.querySelector('.dialogue-text').textContent=String(text).trim();
  bubble.classList.add('show');
  clearTimeout(bubble._hideTimer);
  bubble._hideTimer=setTimeout(()=>bubble.classList.remove('show'),Math.max(1200,duration));
}
function pickVoice(agent){
  if(!availableVoices.length)return null;
  const ru=availableVoices.filter(v=>/^ru(-|_)/i.test(v.lang));
  const pool=ru.length>=2?ru:availableVoices;
  const idx=agent.name==='Cloude'?1:0;
  return pool[idx%pool.length]||null;
}

/* ---------- Separate voice controls ---------- */
const voicePrefs={OpenAI:null,Cloude:null};
function voiceSelects(){return {OpenAI:$('#openaiVoice'),Cloude:$('#cloudeVoice')}}
function populateVoiceSelects(){
  const selects=voiceSelects();
  Object.entries(selects).forEach(([agent,select])=>{
    if(!select)return;
    const current=voicePrefs[agent];
    select.innerHTML='';
    if(!availableVoices.length){
      const o=document.createElement('option');o.value='';o.textContent='Голоса браузера ещё не загружены';select.appendChild(o);return;
    }
    const ru=availableVoices.filter(v=>/^ru(-|_)/i.test(v.lang));
    const pool=ru.length?ru:availableVoices;
    pool.forEach((v,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${v.name} — ${v.lang}`;o.dataset.voiceName=v.name;o.dataset.voiceLang=v.lang;select.appendChild(o)});
    const wanted=pool.findIndex(v=>v.name===current);
    select.selectedIndex=wanted>=0?wanted:Math.min(agent==='Cloude'?1:0,pool.length-1);
  });
}
function selectedVoice(agent){
  const select=voiceSelects()[agent];
  const pool=availableVoices.filter(v=>/^ru(-|_)/i.test(v.lang));
  const list=pool.length?pool:availableVoices;
  const v=list[Number(select?.value)||0];
  voicePrefs[agent]=v?.name||null;
  return v||null;
}
function updateVoiceStatus(agent,text){
  const el=$(`#${agent.toLowerCase()}VoiceStatus`);
  if(el)el.textContent=text;
}
function testAgentVoice(agent){
  const a=agents.find(x=>x.name===agent); if(!a)return;
  const voice=selectedVoice(agent);
  if(!('speechSynthesis' in window)){const n=$('#voiceNote');if(n)n.textContent='Этот браузер не поддерживает SpeechSynthesis.';return}
  const sample=agent==='OpenAI'?'Проверка голоса OpenAI. Я продолжаю наблюдение.':'Проверка голоса Cloude. Я продолжаю наблюдение.';
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(sample);u.lang=voice?.lang||'ru-RU';u.voice=voice||null;u.rate=agent==='Cloude'?.96:1.02;u.pitch=agent==='Cloude'?.88:1.08;u.volume=.92;
  speechSynthesis.speak(u);
  updateVoiceStatus(agent,voice?`✓ ${voice.name}`:'голос по умолчанию');
}
const voicePanel=$('#voiceSettings'),voiceOrb=$('#voiceOrb');
voiceOrb?.addEventListener('click',()=>{const open=voicePanel.classList.toggle('open');voicePanel.setAttribute('aria-hidden',String(!open));populateVoiceSelects()});
$('#closeVoiceSettings')?.addEventListener('click',()=>{voicePanel.classList.remove('open');voicePanel.setAttribute('aria-hidden','true')});
document.querySelectorAll('.voice-test').forEach(b=>b.addEventListener('click',()=>testAgentVoice(b.dataset.agent)));
$('#openaiVoice')?.addEventListener('change',()=>{const v=selectedVoice('OpenAI');updateVoiceStatus('OpenAI',v?`✓ ${v.name}`:'голос по умолчанию')});
$('#cloudeVoice')?.addEventListener('change',()=>{const v=selectedVoice('Cloude');updateVoiceStatus('Cloude',v?`✓ ${v.name}`:'голос по умолчанию')});

function speakAgent(agent,text){
  showSpeech(agent,text);
  if(!('speechSynthesis' in window))return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(String(text));
  const chosen=selectedVoice(agent);
  u.lang=chosen?.lang||'ru-RU';
  u.voice=chosen||pickVoice(agent);
  u.rate=agent.name==='Cloude'?.96:1.02;
  u.pitch=agent.name==='Cloude'?.88:1.08;
  u.volume=.92;
  speechSynthesis.speak(u);
}
function receiveDialogue({speaker,text}){const agent=agents.find(a=>a.name===speaker);if(!agent)return;speakAgent(agent,text)}
window.addEventListener('ai-life:dialogue',e=>receiveDialogue(e.detail||{}));
function projectLabel(a){const v=a.root.position.clone();v.y=2.9;v.project(camera);const x=(v.x*.5+.5)*innerWidth,y=(-v.y*.5+.5)*innerHeight;a.label.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;const bubble=speechBubbles.get(a.name);if(bubble){bubble.style.transform=`translate(${x}px,${y-4}px) translate(-50%,-100%)`;bubble.style.opacity=(v.z>1||Math.abs(v.x)>1)?'0':''}a.label.style.opacity=(v.z>1||Math.abs(v.x)>1)?'0':'1';const state=a.label.querySelector('.agent-state-tag');if(state)state.textContent=({resting:'отдыхает','seeking water':'ищет воду','observing another mind':'наблюдает','exploring':'исследует',wandering:'бродит',observing:'наблюдает'})[a.state]||a.state}

/* ---------- Autonomous real-AI dialogue bridge ---------- */
const AI_BACKEND=(location.hostname==='127.0.0.1'||location.hostname==='localhost')?'http://127.0.0.1:8787':'';
const dialogueState={active:false,sessionId:null,nextSpeaker:'OpenAI',cooldownUntil:0,turns:0,maxTurns:6,lastDistance:999};
let dialogueRequest=null;
function sceneSnapshot(){
  const [a,b]=agents;
  const d=dist2(a.root.position,b.root.position);
  return {
    time:new Date().toISOString(),
    daylight:solarPosition(new Date()).elevation,
    agents:agents.map(x=>({name:x.name,x:Number(x.root.position.x.toFixed(2)),z:Number(x.root.position.z.toFixed(2)),state:x.state,needs:{...x.needs},metrics:{...x.metrics},recentMemory:x.memory.slice(-4)})),
    distance:Number(d.toFixed(2))
  };
}
async function requestDialogueStart(){
  if(!AI_BACKEND||dialogueRequest)return null;
  const scene=sceneSnapshot();
  const payload={sessionId:dialogueState.sessionId,scene};
  dialogueRequest=fetch(AI_BACKEND+'/api/dialogue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
    .then(r=>{if(!r.ok)throw new Error('dialogue backend '+r.status);return r.json()})
    .finally(()=>{dialogueRequest=null});
  return dialogueRequest;
}
async function requestDialogueTurn(speaker){
  if(!AI_BACKEND||dialogueRequest)return null;
  const scene=sceneSnapshot();
  const payload={sessionId:dialogueState.sessionId,speaker,scene};
  dialogueRequest=fetch(AI_BACKEND+'/api/dialogue/turn',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)})
    .then(r=>{if(!r.ok)throw new Error('dialogue backend '+r.status);return r.json()})
    .finally(()=>{dialogueRequest=null});
  return dialogueRequest;
}
async function autonomousDialogue(){
  if(!running||!AI_BACKEND||dialogueState.active||Date.now()<dialogueState.cooldownUntil)return;
  const d=dist2(agents[0].root.position,agents[1].root.position);
  if(d>8.2)return;
  dialogueState.active=true;
  dialogueState.sessionId='encounter-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
  dialogueState.nextSpeaker='OpenAI';
  dialogueState.turns=0;
  addEvent('OpenAI и Cloude заметили друг друга. Разговор начинается только по решению их мозгов.');
  try{
    while(dialogueState.turns<dialogueState.maxTurns&&running){
      const speaker=dialogueState.nextSpeaker;
      const result=dialogueState.turns===0?await requestDialogueStart():await requestDialogueTurn(speaker);
      if(!result)break;
      const decision=result.decision||{};
      const agent=agents.find(a=>a.name===speaker);
      if(decision.speak&&decision.text){
        receiveDialogue({speaker,text:decision.text});
        addEvent(`${speaker}: «${decision.text}»`,speaker);
        if(agent)agent.memory.push({time:Date.now(),state:'dialogue',result:decision.text});
      }
      dialogueState.turns++;
      if(decision.continue===false||!decision.speak)break;
      dialogueState.nextSpeaker=speaker==='OpenAI'?'Cloude':'OpenAI';
      await new Promise(resolve=>setTimeout(resolve,900));
    }
  }catch(error){
    addEvent('Связь с AI-мозгом временно недоступна. Симуляция продолжает жить без вмешательства.',null);
    console.error(error);
  }finally{
    dialogueState.active=false;
    dialogueState.cooldownUntil=Date.now()+30000;
  }
}

let last=performance.now(),saveTimer=0;
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;const realDate=new Date();const world=applySolarLighting(realDate);weather.rainLevel=lerp(weather.rainLevel,weather.rainTarget,.018);rainMaterial.opacity=.62*weather.rainLevel;rain.visible=weather.rainLevel>.03||weather.rain;if(running)updateAgents(dt,now,world);else agents.forEach(projectLabel);updateWorldItems(dt,now);updateRain(dt);updateSeasonLeaves(dt);if(Math.floor(now/2000)!==Math.floor((now-dt*1000)/2000))pollDonationEvents();updateCamera(dt);$('#clock').textContent=realDate.toLocaleTimeString('ru-RU',{hour12:false});$('#worldStatus').textContent=world.season.emoji+' '+world.season.name+' · Наблюдение за миром';$('#statusDetail').textContent=world.night>.55?`${world.season.emoji} Сейчас ночь · сезонная темнота синхронизирована с Нюрнбергом.`:`${world.season.emoji} ${world.season.name} · солнечный день синхронизирован с Нюрнбергом.`;updatePill();if(now-lastDecision>9000&&running){lastDecision=now;renderStats()}saveTimer+=dt;if(saveTimer>8){saveTimer=0;save()}renderer.render(scene,camera)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75))}
addEvent('OpenAI и Cloude появились в мире независимо друг от друга.');addEvent('Среда создана. Цели агентам не назначены.');addEvent('Реальное солнечное время синхронизировано с Нюрнбергом.');addEvent('Наблюдение активно. Вмешательство человека: 0.');addEvent('AI Life 2.0 — визуальное ядро запущено.');
renderEvents();renderStats();updatePill();window.addEventListener('resize',resize);resize();if(['127.0.0.1','localhost'].includes(location.hostname))window.__AI_LIFE_TEST__={agents,isWalkable,chooseSafeSpawn,save,showSpeech,speakAgent,receiveDialogue,spawnWorldItem,applyDonationEvent,setRain,seasonInfo,autumnProgress,autumnClimate,applySeason,seasonPalettes,trees,leafBed,bridge,caves,weather};
requestAnimationFrame(tick);

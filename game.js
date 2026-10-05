(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const canvas = $('#game'), ctx = canvas.getContext('2d');
const replayCanvas = $('#replay'), rctx = replayCanvas.getContext('2d');
const SAVE_KEY='ruf_save_v1', SETTINGS_KEY='ruf_settings_v1';

const WORLD={spawn:{x:0,z:3}, waterfall:{x:0,z:-17}, fire:{x:12,z:-5}, shop:{x:-12,z:-4}, house:{x:0,z:13}, bamboo:{x:3,z:-13.5}};
const magicOrder=['plant','water','fire','music','tech'];
const magicEmoji={plant:'🌱',water:'💧',fire:'🔥',music:'♪',tech:'🔧'};
const magicName={plant:'식물',water:'물',fire:'불',music:'음악',tech:'기술'};

let selectedGender=null, state=null, keys={}, last=performance.now(), saveTimer=0, recordTimer=0;
let joystick={active:false,id:null,dx:0,dy:0}, pointerLook={active:false,id:null,lastX:0,lastY:0};
let hintUntil=0, toastTimer=0, currentInteract=null, holdTimer=null, replayRAF=null, tutorialStep=0;
let audio={ctx:null,music:true,sfx:true,ambientTimer:null};
const settings=Object.assign({music:true,sfx:true},JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'));
audio.music=settings.music;audio.sfx=settings.sfx; $('#musicToggle').checked=audio.music;$('#sfxToggle').checked=audio.sfx;

function defaultState(gender='girl'){
  return {gender,player:{x:WORLD.spawn.x,z:WORLD.spawn.z},yaw:0,mode:'walk',spells:{plant:false,water:false,fire:false,music:false,tech:false},potion:false,potionActive:false,fairyActive:false,fairyPos:{x:WORLD.house.x,z:WORLD.house.z},fairyDelayUntil:0,tower:false,completed:false,tutorialDone:false,record:[],events:[],lastSafe:{x:WORLD.spawn.x,z:WORLD.spawn.z},startedAt:Date.now()};
}
function save(){ if(!state) return; try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch(e){ if(state.record.length>1000){state.record=state.record.filter((_,i)=>i%2===0);localStorage.setItem(SAVE_KEY,JSON.stringify(state));}} updateContinue(); }
function load(){try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch{return null}}
function updateContinue(){const has=!!load();$('#continueBtn').disabled=!has;$('#continueBtn').style.opacity=has?'1':'.45'}
updateContinue();

function resize(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0);replayCanvas.width=Math.floor(replayCanvas.clientWidth*dpr||800);replayCanvas.height=Math.floor(replayCanvas.clientHeight*dpr||450);rctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();

function showScreen(id){$$('.screen').forEach(x=>x.classList.remove('active')); if(id) $(id).classList.add('active')}
function showHud(on){$('#hud').classList.toggle('hidden',!on)}
function openOverlay(id){$(id).classList.remove('hidden')}
function closeOverlay(id){$(id).classList.add('hidden')}
function toast(html,ms=1900){clearTimeout(toastTimer);const t=$('#toast');t.innerHTML=html;t.classList.remove('hidden');toastTimer=setTimeout(()=>t.classList.add('hidden'),ms)}
function distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return a+(b-a)*t}

function initAudio(){if(audio.ctx)return; audio.ctx=new (window.AudioContext||window.webkitAudioContext)(); if(audio.music) startAmbient()}
function beep(freq,dur=.12,type='sine',gain=.045,delay=0){if(!audio.ctx||!audio.sfx)return;const c=audio.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime+delay);g.gain.setValueAtTime(0,c.currentTime+delay);g.gain.linearRampToValueAtTime(gain,c.currentTime+delay+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+delay+dur);o.connect(g).connect(c.destination);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+dur+.02)}
function magicChime(){[660,880,1100].forEach((f,i)=>beep(f,.22,'sine',.055,i*.08))}
function startAmbient(){if(!audio.ctx||audio.ambientTimer||!audio.music)return; const play=()=>{if(!audio.music)return; const base=[392,440,523,659];base.forEach((f,i)=>beep(f,.9,'sine',.014,i*.35));};play();audio.ambientTimer=setInterval(play,5600)}
function stopAmbient(){clearInterval(audio.ambientTimer);audio.ambientTimer=null}

function beginGame(gender,isContinue=false){initAudio();state=isContinue?load():defaultState(gender); if(!state)return; if(!state.record)state.record=[];if(!state.events)state.events=[];selectedGender=state.gender;showScreen(null);showHud(true);updateMagicUI();setMode(state.mode||'walk'); if(!isContinue){setTimeout(()=>gainMagic('plant'),700);startTutorial()}else if(!state.tutorialDone){startTutorial()} save();}

$('#newGameBtn').onclick=()=>{initAudio(); if(load())openOverlay('#confirmNew'); else {showScreen('#selectScreen');showHud(false)}};
$('#continueBtn').onclick=()=>beginGame(null,true);
$$('.characterCard').forEach(c=>c.onclick=()=>{selectedGender=c.dataset.gender;$$('.characterCard').forEach(x=>x.classList.toggle('selected',x===c));$('#startSelectedBtn').disabled=false});
$('#startSelectedBtn').onclick=()=>{localStorage.removeItem(SAVE_KEY);beginGame(selectedGender,false)};
$('#cancelNewBtn').onclick=()=>closeOverlay('#confirmNew');
$('#holdNewBtn').addEventListener('pointerdown',()=>{holdTimer=setTimeout(()=>{localStorage.removeItem(SAVE_KEY);closeOverlay('#confirmNew');showScreen('#selectScreen');showHud(false)},2000)});
['pointerup','pointercancel','pointerleave'].forEach(ev=>$('#holdNewBtn').addEventListener(ev,()=>clearTimeout(holdTimer)));

function startTutorial(){tutorialStep=0;showTutorial('왼쪽 동그라미를 움직여 봐! 👆');}
function showTutorial(text){const b=$('#tutorialBubble');b.textContent=text;b.classList.remove('hidden')}
function tutorialProgress(type){if(!state||state.tutorialDone)return;if(tutorialStep===0&&type==='move'){tutorialStep=1;showTutorial('오른쪽 화면을 밀어 둘러봐! 👆')}else if(tutorialStep===1&&type==='look'){tutorialStep=2;showTutorial('걷기나 뛰기를 눌러 봐!')}else if(tutorialStep===2&&type==='mode'){state.tutorialDone=true;$('#tutorialBubble').classList.add('hidden');save()}}

function setMode(mode){if(!state)return;state.mode=mode;$('#walkBtn').classList.toggle('selected',mode==='walk');$('#runBtn').classList.toggle('selected',mode==='run');tutorialProgress('mode')}
$('#walkBtn').onclick=()=>setMode('walk');$('#runBtn').onclick=()=>setMode('run');

function joyPos(e){const r=$('#joystick').getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,m=Math.hypot(dx,dy),max=r.width*.32;if(m>max){dx*=max/m;dy*=max/m}joystick.dx=dx/max;joystick.dy=dy/max;$('#stick').style.transform=`translate(${dx}px,${dy}px)`;if(Math.hypot(joystick.dx,joystick.dy)>.1)tutorialProgress('move')}
$('#joystick').addEventListener('pointerdown',e=>{e.preventDefault();joystick.active=true;joystick.id=e.pointerId;$('#joystick').setPointerCapture(e.pointerId);joyPos(e)});
$('#joystick').addEventListener('pointermove',e=>{if(joystick.active&&e.pointerId===joystick.id)joyPos(e)});
function joyEnd(e){if(e.pointerId!==joystick.id)return;joystick.active=false;joystick.dx=joystick.dy=0;$('#stick').style.transform=''}
$('#joystick').addEventListener('pointerup',joyEnd);$('#joystick').addEventListener('pointercancel',joyEnd);

canvas.addEventListener('pointerdown',e=>{if(!state)return;pointerLook.active=true;pointerLook.id=e.pointerId;pointerLook.lastX=e.clientX;pointerLook.lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!pointerLook.active||e.pointerId!==pointerLook.id||!state)return;const dx=e.clientX-pointerLook.lastX;state.yaw-=dx*.008;pointerLook.lastX=e.clientX;pointerLook.lastY=e.clientY;tutorialProgress('look')});
function lookEnd(e){if(e.pointerId===pointerLook.id)pointerLook.active=false}canvas.addEventListener('pointerup',lookEnd);canvas.addEventListener('pointercancel',lookEnd);
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});

$('#hintBtn').onclick=()=>{hintUntil=performance.now()+5000;beep(740,.16)};
$('#settingsBtn').onclick=()=>openOverlay('#settings');$('#closeSettingsBtn').onclick=()=>closeOverlay('#settings');
$('#musicToggle').onchange=e=>{audio.music=e.target.checked;settings.music=audio.music;localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));audio.music?startAmbient():stopAmbient()};
$('#sfxToggle').onchange=e=>{audio.sfx=e.target.checked;settings.sfx=audio.sfx;localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))};
$('#homeBtn').onclick=()=>{save();closeOverlay('#settings');showHud(false);showScreen('#titleScreen');state=null;updateContinue()};
$('#enterBtn').onclick=()=>{if(currentInteract)enterPlace(currentInteract)};

function updateMagicUI(){$$('#magicBar [data-magic]').forEach(el=>el.classList.toggle('owned',!!state?.spells?.[el.dataset.magic]))}
function gainMagic(type){if(!state||state.spells[type])return;state.spells[type]=true;state.events.push({t:Date.now(),type:'magic',magic:type,x:state.player.x,z:state.player.z});updateMagicUI();magicChime();toast(`${magicEmoji[type]}<br><b>${magicName[type]} 마법을 얻었어요!</b>`,2100);save();if(type==='tech')completeGame()}
function firstFour(){return ['plant','water','fire','music'].every(m=>state.spells[m])}
function completeGame(){if(state.completed)return;state.completed=true;state.tower=true;state.events.push({t:Date.now(),type:'complete',x:state.player.x,z:state.player.z});save();setTimeout(()=>toast('🌈 <b>축하합니다!</b><br>다섯 마법을 모두 찾았어요!<br><small>집이 마법 탑으로 변했어요!</small>',4300),400)}

function enterPlace(place){ if(place==='shop'){openInterior('🏪 상점','🎵 🧪','상점에 들어왔어요. 음악 마법과 가시 방지 물약은 공짜예요!',[{text:'🚪 나가기',cls:'blue',fn:closeInterior}]); if(!state.spells.music)gainMagic('music'); if(!state.potion){state.potion=true;state.events.push({t:Date.now(),type:'potion',x:state.player.x,z:state.player.z});setTimeout(()=>toast('🧪 가시 방지 물약을 무료로 얻었어요!',1900),500);save();}}
 else if(place==='house'){state.lastSafe={x:WORLD.house.x,z:WORLD.house.z}; if(state.tower){enterTower()} else {openInterior('🏠 집','🛏️ ✨','따뜻한 집이에요.',[{text:'🚪 나가기',cls:'blue',fn:closeInterior}]); if(firstFour()&&!state.fairyActive){state.fairyActive=true;state.fairyPos={x:WORLD.house.x,z:WORLD.house.z};state.events.push({t:Date.now(),type:'fairy',x:WORLD.house.x,z:WORLD.house.z});setTimeout(()=>toast('🧚 요정이 나타났어요!<br>요정을 따라가 보세요.',2300),500);save();}} }
 else if(place==='tower')enterTower(); }
function openInterior(title,emoji,text,actions){$('#interiorTitle').textContent=title;$('#interiorScene').textContent=emoji;$('#interiorText').textContent=text;const a=$('#interiorActions');a.innerHTML='';actions.forEach(x=>{const b=document.createElement('button');b.className='bigBtn '+x.cls;b.textContent=x.text;b.onclick=x.fn;a.appendChild(b)});openOverlay('#interior')}
function closeInterior(){closeOverlay('#interior')}
function enterTower(){openInterior('🗼 끝없는 마법 탑','✨ 🏛️ 🎬','탑 안을 자유롭게 돌아볼 수 있어요. 기록 영화관도 열려 있어요.',[{text:'🎬 영화관',cls:'purple',fn:()=>{closeInterior();openTheater()}},{text:'🚪 탑 밖으로',cls:'blue',fn:closeInterior}])}

function openTheater(){openOverlay('#theater');startReplay()}
$('#exitTheaterBtn').onclick=()=>{cancelAnimationFrame(replayRAF);replayRAF=null;closeOverlay('#theater')};
function startReplay(){const rec=state.record.length?state.record:[{x:0,z:3}];const start=performance.now();function frame(now){drawReplay(rec,(now-start)/80);replayRAF=requestAnimationFrame(frame)}replayRAF=requestAnimationFrame(frame)}
function drawReplay(rec,t){const w=replayCanvas.clientWidth,h=replayCanvas.clientHeight;rctx.clearRect(0,0,w,h);const g=rctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#b9ecff');g.addColorStop(1,'#76cf70');rctx.fillStyle=g;rctx.fillRect(0,0,w,h);const map=(p)=>({x:w/2+p.x*10,y:h/2+p.z*8});
  const markers=[['🏠',WORLD.house],['🏪',WORLD.shop],['💧',WORLD.waterfall],['🔥',WORLD.fire]];rctx.font='30px sans-serif';rctx.textAlign='center';markers.forEach(([e,p])=>{const q=map(p);rctx.fillText(e,q.x,q.y)});
  rctx.strokeStyle='#ffffff99';rctx.lineWidth=4;rctx.beginPath();rec.forEach((p,i)=>{const q=map(p);i?rctx.lineTo(q.x,q.y):rctx.moveTo(q.x,q.y)});rctx.stroke();const p=rec[Math.floor(t)%rec.length],q=map(p);rctx.beginPath();rctx.fillStyle='#7c3aed';rctx.arc(q.x,q.y,13,0,Math.PI*2);rctx.fill();rctx.fillStyle='white';rctx.font='18px sans-serif';rctx.fillText('🧙',q.x,q.y+7)}

function teleportHome(){state.player={x:WORLD.house.x,z:WORLD.house.z+2};state.lastSafe={x:WORLD.house.x,z:WORLD.house.z+2};state.fairyDelayUntil=Date.now()+120000;state.events.push({t:Date.now(),type:'thorn',x:WORLD.bamboo.x,z:WORLD.bamboo.z});toast('🎋 앗! 가시가 나왔어요.<br>집으로 돌아왔어요!',2300);beep(220,.25,'triangle',.05);save()}

function update(dt,now){if(!state||!$('#hud')||$('#hud').classList.contains('hidden'))return;
  let ix=joystick.dx,iy=-joystick.dy;if(keys['a']||keys['arrowleft'])ix-=1;if(keys['d']||keys['arrowright'])ix+=1;if(keys['w']||keys['arrowup'])iy+=1;if(keys['s']||keys['arrowdown'])iy-=1;let m=Math.hypot(ix,iy);if(m>1){ix/=m;iy/=m}
  if(m>.04){const speed=(state.mode==='run'?6.2:3.4)*dt;const sy=Math.sin(state.yaw),cy=Math.cos(state.yaw);const vx=ix*cy+iy*sy,vz=-ix*sy+iy*cy;state.player.x=clamp(state.player.x+vx*speed,-23,23);state.player.z=clamp(state.player.z+vz*speed,-23,23);state.lastSafe={x:state.player.x,z:state.player.z}}

  if(!state.spells.water&&distance(state.player,WORLD.waterfall)<4.7)gainMagic('water');
  if(!state.spells.fire&&distance(state.player,WORLD.fire)<3.7)gainMagic('fire');
  if(state.potion&&!state.potionActive&&distance(state.player,WORLD.waterfall)<7){state.potionActive=true;toast('🧪 가시 방지 물약이 자동으로 발동했어요!',1900);beep(880,.2);save()}
  if(!state.potionActive&&distance(state.player,WORLD.bamboo)<1.5)teleportHome();

  if(state.fairyDelayUntil&&Date.now()>state.fairyDelayUntil&&!state.fairyActive){state.fairyDelayUntil=0;state.fairyActive=true;state.fairyPos={x:WORLD.house.x,z:WORLD.house.z};toast('🧚 2분이 지나 요정이 다시 나타났어요!',2200);save()}
  if(state.fairyActive&&!state.spells.tech){const fp=state.fairyPos,target=WORLD.waterfall,pd=distance(state.player,fp);if(pd<6){const dx=target.x-fp.x,dz=target.z-fp.z,d=Math.hypot(dx,dz);if(d>.2){fp.x+=dx/d*dt*2.2;fp.z+=dz/d*dt*2.2}}if(distance(fp,target)<1.8&&distance(state.player,target)<5.2)startUnicornCutscene()}

  currentInteract=null; if(distance(state.player,WORLD.shop)<2.8)currentInteract='shop';if(distance(state.player,WORLD.house)<3.0)currentInteract=state.tower?'tower':'house';$('#enterBtn').classList.toggle('hidden',!currentInteract);
  saveTimer+=dt;if(saveTimer>2){saveTimer=0;save()}recordTimer+=dt;if(recordTimer>.5){recordTimer=0;state.record.push({x:+state.player.x.toFixed(1),z:+state.player.z.toFixed(1)});if(state.record.length>3000)state.record=state.record.filter((_,i)=>i%2===0)}
}
let cutsceneRunning=false;
function startUnicornCutscene(){if(cutsceneRunning||state.spells.tech)return;cutsceneRunning=true;state.events.push({t:Date.now(),type:'unicorn',x:state.player.x,z:state.player.z});showHud(false);$('#cutsceneText').textContent='아름다운 유니콘이 나타났어요!';openOverlay('#cutscene');setTimeout(()=>{$('#cutsceneText').textContent='🔧 기술 마법을 얻었어요!';gainMagic('tech')},4300);setTimeout(()=>{closeOverlay('#cutscene');showHud(true);cutsceneRunning=false;save()},7000)}

const trees=[];let seed=42;function rnd(){seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296}for(let i=0;i<95;i++){let x=rnd()*44-22,z=rnd()*44-22;if(Math.hypot(x,z)<5||distance({x,z},WORLD.house)<5||distance({x,z},WORLD.shop)<4||distance({x,z},WORLD.waterfall)<6||distance({x,z},WORLD.fire)<4){i--;continue}trees.push({x,z,s:.7+rnd()*.9})}
function camData(){const yaw=state?.yaw||0,fd={x:Math.sin(yaw),y:-.42,z:Math.cos(yaw)},target={x:state?.player.x||0,y:1.1,z:state?.player.z||0};const cam={x:target.x-fd.x*10,y:6.1,z:target.z-fd.z*10};let fx=target.x-cam.x,fy=target.y-cam.y,fz=target.z-cam.z,fl=Math.hypot(fx,fy,fz);fx/=fl;fy/=fl;fz/=fl;let rx=-fz,ry=0,rz=fx,rl=Math.hypot(rx,rz);rx/=rl;rz/=rl;const ux=ry*fz-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy-ry*fx;return{cam,f:{x:fx,y:fy,z:fz},r:{x:rx,y:ry,z:rz},u:{x:ux,y:uy,z:uz}}}
function project(p,c){const rel={x:p.x-c.cam.x,y:p.y-c.cam.y,z:p.z-c.cam.z};const xc=rel.x*c.r.x+rel.y*c.r.y+rel.z*c.r.z,yc=rel.x*c.u.x+rel.y*c.u.y+rel.z*c.u.z,zc=rel.x*c.f.x+rel.y*c.f.y+rel.z*c.f.z;if(zc<.3)return null;const f=Math.min(innerWidth,innerHeight)*.92;return{x:innerWidth/2+xc/zc*f,y:innerHeight*.52-yc/zc*f,z:zc,s:f/zc}}
function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
function box(c,x,z,w,d,h,color){const pts=[];[[x-w/2,0,z-d/2],[x+w/2,0,z-d/2],[x+w/2,0,z+d/2],[x-w/2,0,z+d/2],[x-w/2,h,z-d/2],[x+w/2,h,z-d/2],[x+w/2,h,z+d/2],[x-w/2,h,z+d/2]].forEach(([px,py,pz])=>pts.push(project({x:px,y:py,z:pz},c)));if(pts.some(p=>!p))return;poly([pts[0],pts[1],pts[5],pts[4]],color,'#ffffff55');poly([pts[1],pts[2],pts[6],pts[5]],shade(color,-15),'#ffffff44');poly([pts[4],pts[5],pts[6],pts[7]],shade(color,15),'#ffffff66')}
function shade(hex,amt){let n=parseInt(hex.replace('#',''),16),r=clamp((n>>16)+amt,0,255),g=clamp(((n>>8)&255)+amt,0,255),b=clamp((n&255)+amt,0,255);return'#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
function label(c,p,text,emoji){const q=project({x:p.x,y:2.6,z:p.z},c);if(!q)return;ctx.font=`${clamp(q.s*.42,14,32)}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,.9)';const tw=ctx.measureText(text).width+22;ctx.fillRect(q.x-tw/2,q.y-35,tw,38);ctx.fillStyle='#27324d';ctx.fillText(`${emoji} ${text}`,q.x,q.y-9)}
function drawTree(c,t){const b=project({x:t.x,y:0,z:t.z},c),top=project({x:t.x,y:3*t.s,z:t.z},c);if(!b||!top)return;const r=clamp(top.s*.75*t.s,5,40);ctx.strokeStyle='#7a4b2b';ctx.lineWidth=clamp(top.s*.12,2,8);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(top.x,top.y+r*.5);ctx.stroke();ctx.fillStyle='#49a942';ctx.beginPath();ctx.arc(top.x,top.y,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#73c95f';ctx.beginPath();ctx.arc(top.x-r*.45,top.y+r*.2,r*.62,0,Math.PI*2);ctx.fill()}
function drawWorld(){const w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#78d8ff');sky.addColorStop(.5,'#dff8ff');sky.addColorStop(.51,'#9be07b');sky.addColorStop(1,'#61bd55');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);if(!state)return;const c=camData();
  // ground sparkles/grid
  ctx.globalAlpha=.15;for(let x=-22;x<=22;x+=4){let a=project({x,y:0,z:-22},c),b=project({x,y:0,z:22},c);if(a&&b){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}ctx.globalAlpha=1;
  const objs=[];trees.forEach(t=>{const q=project({x:t.x,y:0,z:t.z},c);if(q)objs.push({z:q.z,draw:()=>drawTree(c,t)})});
  const add=(p,fn)=>{const q=project({x:p.x,y:0,z:p.z},c);if(q)objs.push({z:q.z,draw:fn})};
  add(WORLD.house,()=>{if(state.tower){box(c,WORLD.house.x,WORLD.house.z,4.2,4.2,11,'#b8b5ff');box(c,WORLD.house.x,WORLD.house.z,2.7,2.7,16,'#d8d5ff');label(c,WORLD.house,'마법 탑','🗼')}else{box(c,WORLD.house.x,WORLD.house.z,5,4,3.6,'#d69a62');label(c,WORLD.house,'집','🏠')}});
  add(WORLD.shop,()=>{box(c,WORLD.shop.x,WORLD.shop.z,5,4,3.8,'#f0a45d');label(c,WORLD.shop,'상점','🏪')});
  add(WORLD.fire,()=>{const q=project({x:WORLD.fire.x,y:.7,z:WORLD.fire.z},c);if(q){ctx.fillStyle='#ff5a1f';ctx.beginPath();ctx.arc(q.x,q.y,clamp(q.s*.45,7,34),0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd84a';ctx.beginPath();ctx.arc(q.x,q.y+5,clamp(q.s*.22,4,18),0,Math.PI*2);ctx.fill();label(c,WORLD.fire,'불','🔥')}});
  add(WORLD.waterfall,()=>{box(c,WORLD.waterfall.x,WORLD.waterfall.z,9,2.2,5.3,'#7690a7');const top=project({x:WORLD.waterfall.x,y:4.5,z:WORLD.waterfall.z-1.2},c),bot=project({x:WORLD.waterfall.x,y:.15,z:WORLD.waterfall.z-1.2},c);if(top&&bot){ctx.strokeStyle='#62cfff';ctx.lineWidth=clamp(top.s*1.4,10,60);ctx.beginPath();ctx.moveTo(top.x,top.y);ctx.lineTo(bot.x,bot.y);ctx.stroke()}label(c,WORLD.waterfall,'폭포','💧')});
  add(WORLD.bamboo,()=>{const q=project({x:WORLD.bamboo.x,y:1.6,z:WORLD.bamboo.z},c);if(q){ctx.font=`${clamp(q.s*.9,18,54)}px sans-serif`;ctx.textAlign='center';ctx.fillText(state.potionActive?'🎋✨':'🎋',q.x,q.y);if(!state.potionActive&&distance(state.player,WORLD.bamboo)<3){ctx.font=`${clamp(q.s*.5,14,30)}px sans-serif`;ctx.fillText('✦✦✦',q.x,q.y-20)}}});
  if(state.fairyActive&&!state.spells.tech)add(state.fairyPos,()=>{const q=project({x:state.fairyPos.x,y:2.3,z:state.fairyPos.z},c);if(q){ctx.font=`${clamp(q.s*.8,20,60)}px sans-serif`;ctx.textAlign='center';ctx.fillText('🧚',q.x,q.y);ctx.fillStyle='#fff76a';ctx.beginPath();ctx.arc(q.x,q.y-10,clamp(q.s*.12,4,12),0,Math.PI*2);ctx.fill()}});
  if(state.spells.tech)add(WORLD.waterfall,()=>{const q=project({x:WORLD.waterfall.x-2,y:2,z:WORLD.waterfall.z+1},c);if(q){ctx.font=`${clamp(q.s*.7,22,58)}px sans-serif`;ctx.textAlign='center';ctx.fillText('🦄',q.x,q.y)}});
  objs.sort((a,b)=>b.z-a.z).forEach(o=>o.draw());
  drawPlayer(c); if(performance.now()<hintUntil)drawHint(c);
}
function drawPlayer(c){const p=project({x:state.player.x,y:1.1,z:state.player.z},c);if(!p)return;const s=clamp(p.s*.8,26,75);ctx.textAlign='center';ctx.font=`${s}px sans-serif`;ctx.fillText('🧙',p.x,p.y);ctx.fillStyle='#f9a8d4';ctx.beginPath();ctx.arc(p.x-s*.12,p.y-s*.55,s*.13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c4b5fd';ctx.beginPath();ctx.arc(p.x+s*.12,p.y-s*.55,s*.13,0,Math.PI*2);ctx.fill()}
function nextTarget(){if(!state.spells.water)return WORLD.waterfall;if(!state.spells.fire)return WORLD.fire;if(!state.spells.music)return WORLD.shop;if(firstFour()&&!state.fairyActive)return WORLD.house;if(state.fairyActive&&!state.spells.tech)return state.fairyPos;if(state.tower)return WORLD.house;return WORLD.house}
function drawHint(c){const t=nextTarget(),a=state.player;for(let i=1;i<=7;i++){const u=i/8,p={x:lerp(a.x,t.x,u),y:.15,z:lerp(a.z,t.z,u)},q=project(p,c);if(q){ctx.globalAlpha=.85;ctx.fillStyle='#fff7a8';ctx.beginPath();ctx.arc(q.x,q.y,clamp(q.s*.07,3,9),0,Math.PI*2);ctx.fill()}}ctx.globalAlpha=1}

function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt,now);drawWorld();requestAnimationFrame(loop)}requestAnimationFrame(loop);

if('serviceWorker' in navigator && /^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
window.__RUFS_READY=true;
try{ if(new URLSearchParams(location.search).get('demo')==='1'){ localStorage.removeItem(SAVE_KEY); beginGame('girl',false); } }catch(e){}
})();

import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

(async function(){
'use strict';
var $=function(s){return document.querySelector(s)};
var $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var boot=$('#bootMessage');
if(boot)boot.classList.add('hidden');

var SAVE='ruf_save_v1', SETTINGS='ruf_settings_v1';
var W={spawn:{x:0,z:3},water:{x:0,z:-17},fire:{x:12,z:-5},shop:{x:-12,z:-4},house:{x:0,z:13},bamboo:{x:3.4,z:-13.2}};
var names={plant:'식물',water:'물',fire:'불',music:'음악',tech:'기술'};
var icons={plant:'🌱',water:'💧',fire:'🔥',music:'♪',tech:'🔧'};
var state=null,gender=null,keys={},last=performance.now(),saveClock=0,recordClock=0,interact=null,toastTimer=0,holdTimer=null,replayRAF=null;
var joy={on:false,id:null,x:0,y:0},look={on:false,id:null,x:0};
var hintUntil=0,cut=false,cutStart=0,moving=0;
var audio={ctx:null,music:true,sfx:true,timer:null};
var st=Object.assign({music:true,sfx:true},JSON.parse(localStorage.getItem(SETTINGS)||'{}'));
audio.music=st.music;audio.sfx=st.sfx;$('#musicToggle').checked=audio.music;$('#sfxToggle').checked=audio.sfx;

function fresh(g){return{gender:g||'girl',area:'world',player:{x:0,z:3},yaw:0,mode:'walk',spells:{plant:false,water:false,fire:false,music:false,tech:false},potion:false,potionActive:false,fairy:false,fairyPos:{x:0,z:13},fairyAt:0,tower:false,completed:false,tutorialDone:false,record:[],events:[],lastSafe:{x:0,z:3}}}
function norm(s){if(!s)return null;var d=fresh(s.gender),o=Object.assign(d,s);o.player=Object.assign({},d.player,s.player||{});o.spells=Object.assign({},d.spells,s.spells||{});o.fairyPos=Object.assign({},d.fairyPos,s.fairyPos||{});o.record=Array.isArray(s.record)?s.record:[];o.events=Array.isArray(s.events)?s.events:[];o.area=s.area==='tower'?'tower':'world';if(s.fairyActive&&!s.fairy)o.fairy=true;if(s.fairyDelayUntil&&!s.fairyAt)o.fairyAt=s.fairyDelayUntil;return o}
function load(){try{return norm(JSON.parse(localStorage.getItem(SAVE)||'null'))}catch(e){return null}}
function save(){if(!state)return;try{localStorage.setItem(SAVE,JSON.stringify(state))}catch(e){if(state.record.length>800){state.record=state.record.filter(function(_,i){return i%2===0});localStorage.setItem(SAVE,JSON.stringify(state))}}updateContinue()}
function updateContinue(){var ok=!!load();$('#continueBtn').disabled=!ok;$('#continueBtn').style.opacity=ok?'1':'.45'}
updateContinue();
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function showScreen(id){$$('.screen').forEach(function(x){x.classList.remove('active')});if(id)$(id).classList.add('active')}
function hud(v){$('#hud').classList.toggle('hidden',!v)}
function open(id){$(id).classList.remove('hidden')}
function close(id){$(id).classList.add('hidden')}
function toast(s,ms){clearTimeout(toastTimer);var t=$('#toast');t.innerHTML=s;t.classList.remove('hidden');toastTimer=setTimeout(function(){t.classList.add('hidden')},ms||1800)}
function initAudio(){if(audio.ctx)return;audio.ctx=new (window.AudioContext||window.webkitAudioContext)();if(audio.music)ambient()}
function tone(f,d,g){if(!audio.ctx||!audio.sfx)return;var c=audio.ctx,o=c.createOscillator(),a=c.createGain();o.frequency.value=f;a.gain.value=g||.04;o.connect(a).connect(c.destination);o.start();a.gain.exponentialRampToValueAtTime(.0001,c.currentTime+(d||.15));o.stop(c.currentTime+(d||.15)+.02)}
function chime(){tone(660,.22,.045);setTimeout(function(){tone(880,.22,.045)},80);setTimeout(function(){tone(1100,.22,.045)},160)}
function ambient(){if(!audio.ctx||audio.timer||!audio.music)return;var p=function(){if(!audio.music)return;[392,440,523,659].forEach(function(f,i){setTimeout(function(){tone(f,.7,.012)},i*250)})};p();audio.timer=setInterval(p,5200)}
function stopAmbient(){clearInterval(audio.timer);audio.timer=null}

var canvas=$('#game');
var renderer=new T.WebGLRenderer({canvas:canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
var scene=new T.Scene();scene.background=new T.Color(0xade8ff);scene.fog=new T.Fog(0xade8ff,26,60);
var camera=new T.PerspectiveCamera(58,innerWidth/innerHeight,.1,120);
scene.add(new T.HemisphereLight(0xeaf9ff,0x587947,2.1));var sun=new T.DirectionalLight(0xfff0cf,3.1);sun.position.set(-14,24,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-28;sun.shadow.camera.right=28;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;scene.add(sun);
var world=new T.Group(),towerInside=new T.Group();scene.add(world,towerInside);towerInside.visible=false;
var player,fairy,unicorn,sparkles,house,tower,bambooThorns,fireLight,waterShader;
var anim=[],hintDots=[];
var gltfLoader=new GLTFLoader();
var playerMixer=null,playerActions={},playerActionName='',playerLoadToken=0;
var unicornMixer=null,unicornAction=null,unicornLoaded=false;
var MODEL_URLS={
  wizard:'https://cdn.jsdelivr.net/gh/naufaldi/echoes-below@54909ebf11635ebdb163c4f50ddf4d3111d28017/public/assets/quaternius/Wizard.gltf',
  horse:'https://cdn.jsdelivr.net/gh/BibliothecaDAO/eternum@ebdd23c5f605ed8340289c1d7f9f0a8c85ac78d3/apps/game/public/models/characters/quaternius-horse/horse.glb'
};
function M(c,r,m){return new T.MeshStandardMaterial({color:c,roughness:r==null?.7:r,metalness:m||0})}
function me(g,m,cast){var x=new T.Mesh(g,m);x.castShadow=cast!==false;x.receiveShadow=true;return x}
function box(p,w,h,d,c,x,y,z){var q=me(new T.BoxGeometry(w,h,d),M(c));q.position.set(x,y,z);p.add(q);return q}
function sph(p,r,c,x,y,z,s){var q=me(new T.SphereGeometry(r,20,14),M(c));q.position.set(x,y,z);s=s||[1,1,1];q.scale.set(s[0],s[1],s[2]);p.add(q);return q}
function cyl(p,a,b,h,c,x,y,z){var q=me(new T.CylinderGeometry(a,b,h,14),M(c));q.position.set(x,y,z);p.add(q);return q}
function label(p,text,x,y,z){var c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=420;c.height=110;ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(0,0,420,110);ctx.font='900 48px system-ui';ctx.fillStyle='#27324d';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,210,55);var tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;var s=new T.Sprite(new T.SpriteMaterial({map:tx,transparent:true,depthTest:false}));s.scale.set(3.8,1,1);s.position.set(x,y,z);p.add(s);return s}
function ground(){var g=me(new T.PlaneGeometry(52,52),M(0x74ca69),false);g.rotation.x=-Math.PI/2;world.add(g);[[0,-7,3,40],[-6,-4,15,2.4],[6,-5,15,2.4],[0,8,3,10]].forEach(function(v){var q=me(new T.PlaneGeometry(v[2],v[3]),M(0xddcba4),false);q.rotation.x=-Math.PI/2;q.position.set(v[0],.01,v[1]);world.add(q)})}
function tree(x,z,s){var g=new T.Group();cyl(g,.2*s,.32*s,2.3*s,0x7b4e31,0,1.15*s,0);sph(g,1.1*s,0x3e9f50,0,2.7*s,0);sph(g,.8*s,0x65bf61,-.55*s,2.5*s,.15*s);sph(g,.82*s,0x4cab55,.55*s,2.55*s,-.1*s);g.position.set(x,0,z);world.add(g)}
function trees(){var seed=31;function r(){seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296}for(var i=0;i<100;i++){var x=r()*48-24,z=r()*48-24,p={x:x,z:z};if(Math.hypot(x,z)<5||dist(p,W.house)<5.5||dist(p,W.shop)<4.5||dist(p,W.water)<7||dist(p,W.fire)<4.5||dist(p,W.bamboo)<2.5){i--;continue}tree(x,z,.72+r()*.55)}}
function meadow(){
  var seed=911;function r(){seed=(seed*1103515245+12345)>>>0;return seed/4294967296}
  var bladeG=new T.ConeGeometry(.055,.5,5),bladeM=M(0x4aaf56,.88,0),grass=new T.InstancedMesh(bladeG,bladeM,260),dummy=new T.Object3D(),n=0;
  for(var i=0;i<330&&n<260;i++){var x=r()*46-23,z=r()*46-23,p={x:x,z:z};if(dist(p,W.house)<5||dist(p,W.shop)<4||dist(p,W.water)<6||dist(p,W.fire)<3.7||Math.abs(x)<1.7&&z>-16&&z<14)continue;dummy.position.set(x,.23,z);dummy.rotation.y=r()*Math.PI;var s=.65+r()*.85;dummy.scale.set(s,s,s);dummy.updateMatrix();grass.setMatrixAt(n++,dummy.matrix)}
  grass.count=n;grass.receiveShadow=true;world.add(grass);
  var stemG=new T.CylinderGeometry(.025,.035,.34,5),stemM=M(0x348c49,.8,0),stems=new T.InstancedMesh(stemG,stemM,70);
  var flowerG=new T.SphereGeometry(.09,7,5),colors=[0xffb6d9,0xfff18a,0xcbb7ff,0xffffff],flowers=[];
  for(var ci=0;ci<colors.length;ci++)flowers.push(new T.InstancedMesh(flowerG,M(colors[ci],.62,0),22));
  var fc=[0,0,0,0];
  for(i=0;i<70;i++){x=r()*42-21;z=r()*42-21;p={x:x,z:z};if(dist(p,W.water)<6||dist(p,W.house)<4.5){i--;continue}dummy.position.set(x,.17,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);var k=i%4;dummy.position.y=.39;dummy.scale.set(1,1,1);dummy.updateMatrix();flowers[k].setMatrixAt(fc[k]++,dummy.matrix)}
  world.add(stems);flowers.forEach(function(f,i){f.count=fc[i];f.castShadow=false;world.add(f)});
  var rockG=new T.DodecahedronGeometry(.45,0),rockM=M(0x7c8a82,.92,0),rocks=new T.InstancedMesh(rockG,rockM,24);
  for(i=0;i<24;i++){x=(r()>.5?1:-1)*(16+r()*7);z=r()*42-21;dummy.position.set(x,.25,z);dummy.rotation.set(r()*.25,r()*Math.PI,r()*.18);var rs=.55+r()*.9;dummy.scale.set(rs,rs*.7,rs);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix)}world.add(rocks);
}
function horizon(){
  var m=M(0x7c9f83,.95,0);
  for(var i=0;i<12;i++){var a=i/12*Math.PI*2,rad=34+(i%3)*2,h=8+(i%4)*2;var q=me(new T.ConeGeometry(5.5,h,7),m,false);q.position.set(Math.sin(a)*rad,h/2-1,Math.cos(a)*rad);q.rotation.y=a;world.add(q)}
  for(i=0;i<10;i++){var g=new T.Group(),cx=(i-5)*8,cz=-29-(i%3)*2,cy=12+(i%4);for(var j=0;j<3;j++)sph(g,1.2+j*.25,0xffffff,(j-1)*1.2,.1*j,0,[1.6,.72,.7]);g.position.set(cx,cy,cz);g.children.forEach(function(o){if(o.material){o.material.transparent=true;o.material.opacity=.72;o.castShadow=false}});world.add(g)}
}
function makeHouse(){var g=new T.Group();box(g,5,3.2,4.2,0xf4d3ad,0,1.6,0);var roof=me(new T.ConeGeometry(3.7,2.2,4),M(0x8550c7));roof.rotation.y=Math.PI/4;roof.position.y=4;g.add(roof);box(g,1.15,2.1,.2,0x8a5a37,0,1.1,-2.2);label(g,'🏠 집',0,5.3,0);g.position.set(W.house.x,0,W.house.z);world.add(g);return g}
function makeShop(){var g=new T.Group();box(g,5,3.3,4.4,0xffd6a1,0,1.65,0);var roof=me(new T.ConeGeometry(3.8,2.1,4),M(0xd85a5a));roof.rotation.y=Math.PI/4;roof.position.y=4.1;g.add(roof);box(g,1.2,2,.2,0x895634,0,1,-2.3);label(g,'♪ 상점',0,5.3,0);g.position.set(W.shop.x,0,W.shop.z);world.add(g)}
function makeFire(){var g=new T.Group();for(var i=0;i<8;i++){var a=i/8*Math.PI*2,d=me(new T.DodecahedronGeometry(.34),M(0x67676d));d.position.set(Math.cos(a)*1.05,.25,Math.sin(a)*1.05);g.add(d)}var f=me(new T.ConeGeometry(.72,2,18),new T.MeshStandardMaterial({color:0xff7620,emissive:0xff3500,emissiveIntensity:2.2}));f.position.y=1.2;g.add(f);fireLight=new T.PointLight(0xff7b31,18,12,2);fireLight.position.y=2;g.add(fireLight);label(g,'🔥 불',0,3.6,0);g.position.set(W.fire.x,0,W.fire.z);world.add(g);anim.push({kind:'fire',o:f})}
function makeWater(){
  var g=new T.Group();box(g,11,7,2.5,0x718a70,0,3.5,1.3);
  waterShader=new T.ShaderMaterial({
    transparent:true,side:T.DoubleSide,depthWrite:false,
    uniforms:{uTime:{value:0},uTop:{value:new T.Color(0xa9f2ff)},uDeep:{value:new T.Color(0x28a9dc)}},
    vertexShader:'varying vec2 vUv;uniform float uTime;void main(){vUv=uv;vec3 p=position;p.z+=sin((uv.y*18.0+uTime*3.0)+uv.x*7.0)*0.035;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
    fragmentShader:'varying vec2 vUv;uniform float uTime;uniform vec3 uTop;uniform vec3 uDeep;void main(){float stripe=.5+.5*sin((vUv.y*28.0-uTime*5.0)+sin(vUv.x*17.0)*1.6);float foam=smoothstep(.76,1.0,stripe);vec3 c=mix(uDeep,uTop,vUv.y*.45+foam*.38);float edge=smoothstep(0.0,.08,vUv.x)*smoothstep(0.0,.08,1.0-vUv.x);gl_FragColor=vec4(c,.72*edge+.16);}'
  });
  var sh=me(new T.PlaneGeometry(6.8,7,28,36),waterShader,false);sh.position.set(0,3.5,0);g.add(sh);
  var poolMat=new T.MeshPhysicalMaterial({color:0x58c9e7,roughness:.16,metalness:0,transparent:true,opacity:.72,clearcoat:1,clearcoatRoughness:.12,side:T.DoubleSide});
  var pool=me(new T.CircleGeometry(5.8,48),poolMat,false);pool.rotation.x=-Math.PI/2;pool.position.set(0,.04,-2.2);g.add(pool);
  for(var i=0;i<18;i++){var mist=me(new T.SphereGeometry(.22+Math.random()*.18,8,6),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.17}),false);mist.position.set(-3+Math.random()*6,.3+Math.random()*.8,-.6-Math.random()*2.2);mist.scale.set(1.7,.55,1);g.add(mist);anim.push({kind:'mist',o:mist,base:mist.position.clone(),s:.6+Math.random()})}
  label(g,'💧 폭포',0,8.2,.2);g.position.set(W.water.x,0,W.water.z);world.add(g)
}
function makeBamboo(){var g=new T.Group();for(var i=0;i<5;i++){var x=(i-2)*.45;cyl(g,.11,.13,4.3,0x55a84e,x,2.15,(i%2)*.15)}bambooThorns=new T.Group();for(i=0;i<16;i++){var t=me(new T.ConeGeometry(.1,.7,8),M(0xe9e2b4));t.rotation.z=Math.PI/2*(i%2?1:-1);t.position.set(-.9+(i%4)*.6,.6+(i%8)*.45,.05);bambooThorns.add(t)}bambooThorns.visible=false;g.add(bambooThorns);g.position.set(W.bamboo.x,0,W.bamboo.z);world.add(g)}
function makeTower(){var g=new T.Group();var a=me(new T.CylinderGeometry(2.8,4.2,5,8),M(0xe6dcff,.35,.15));a.position.y=2.5;g.add(a);var b=me(new T.CylinderGeometry(1.7,2.8,8,8),M(0xc6c4ff,.3,.18));b.position.y=9;g.add(b);var c=me(new T.CylinderGeometry(.7,1.7,8,8),M(0xaaa7f8,.28,.2));c.position.y=17;g.add(c);var sp=me(new T.ConeGeometry(.7,7,10),M(0xf7d75f,.25,.65));sp.position.y=24.5;g.add(sp);label(g,'🗼 마법 탑',0,28,0);g.position.set(W.house.x,0,W.house.z);g.visible=false;world.add(g);return g}
function wizard(g){var p=new T.Group(),shirt=M(0xb9a2f3),pur=M(0x7b45d2);var body=me(new T.CylinderGeometry(.52,.62,1.15,16),shirt);body.position.y=1.62;p.add(body);sph(p,.5,0xffd3bf,0,2.55,0);sph(p,.53,0xf59bc6,-.08,2.72,.02,[.55,1,.9]);sph(p,.53,0x7b45d2,.08,2.72,.02,[.55,1,.9]);var brim=me(new T.CylinderGeometry(.72,.72,.12,24),pur);brim.position.y=3.03;p.add(brim);var hat=me(new T.ConeGeometry(.52,1.15,24),pur);hat.position.set(.08,3.57,.02);hat.rotation.z=-.12;p.add(hat);var l1=cyl(p,.16,.18,.9,0x4f79b8,-.25,.72,0),l2=cyl(p,.16,.18,.9,0x4f79b8,.25,.72,0),a1=cyl(p,.13,.15,.92,0xb9a2f3,-.69,1.7,0),a2=cyl(p,.13,.15,.92,0xb9a2f3,.69,1.7,0);a1.rotation.z=-.18;a2.rotation.z=.18;if(g==='girl'){var sk=me(new T.ConeGeometry(.72,.55,20),M(0xcdb9fa));sk.position.y=1.13;sk.rotation.x=Math.PI;p.add(sk)}p.userData={l1:l1,l2:l2,a1:a1,a2:a2};p.scale.set(.75,.75,.75);scene.add(p);return p}
function modelNormalize(obj,height,turnY){
  if(turnY)obj.rotation.y=turnY;
  obj.updateMatrixWorld(true);
  var b=new T.Box3().setFromObject(obj),s=b.getSize(new T.Vector3()),k=height/Math.max(.001,s.y);
  obj.scale.multiplyScalar(k);obj.updateMatrixWorld(true);b.setFromObject(obj);
  var ctr=b.getCenter(new T.Vector3());obj.position.x-=ctr.x;obj.position.z-=ctr.z;obj.position.y-=b.min.y;obj.updateMatrixWorld(true);
}
function signatureHair(root){
  var pink=new T.MeshStandardMaterial({color:0xf3a0c8,roughness:.5}),lav=new T.MeshStandardMaterial({color:0xbda7f3,roughness:.5});
  var g=new T.SphereGeometry(.28,14,9),a=new T.Mesh(g,pink),b=new T.Mesh(g,lav);
  a.scale.set(.8,.42,.7);b.scale.set(.8,.42,.7);a.position.set(-.14,2.48,.05);b.position.set(.14,2.48,.05);a.castShadow=b.castShadow=true;root.add(a,b);
}
function chooseAction(name){
  if(!playerMixer||!playerActions[name]||playerActionName===name)return;
  var next=playerActions[name],prev=playerActions[playerActionName];if(prev)prev.fadeOut(.18);
  next.reset().fadeIn(.18).play();playerActionName=name;
}
function loadWizardGLTF(genderValue,token){
  gltfLoader.load(MODEL_URLS.wizard,function(gltf){
    if(token!==playerLoadToken||!state)return;
    var visual=gltf.scene;visual.traverse(function(o){if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material=o.material.clone();if(o.material.roughness!=null)o.material.roughness=Math.min(.78,o.material.roughness+.08)}}});
    modelNormalize(visual,2.85,Math.PI);
    var root=new T.Group();root.add(visual);signatureHair(root);root.position.set(state.player.x,0,state.player.z);root.rotation.copy(player.rotation);scene.add(root);
    scene.remove(player);player=root;
    playerMixer=new T.AnimationMixer(visual);playerActions={};(gltf.animations||[]).forEach(function(clip){playerActions[clip.name]=playerMixer.clipAction(clip)});
    var idle=playerActions.Idle||playerActions.Idle_Weapon||Object.values(playerActions)[0];if(idle){idle.play();playerActionName=Object.keys(playerActions).find(function(k){return playerActions[k]===idle})||'Idle'}
    player.userData.gltf=true;player.userData.gender=genderValue;
  },undefined,function(e){console.warn('Wizard glTF fallback active',e)})
}
function feather(mat,len,side,angle){
  var q=me(new T.SphereGeometry(1,12,8),mat);q.scale.set(.16,len,.075);q.position.set(0,len*.7,side*(.25+len*.23));q.rotation.x=side*(.52+angle);return q
}
function decorateHorse(root,visual){
  var red=new T.MeshPhysicalMaterial({color:0xb5122e,roughness:.32,clearcoat:.72,clearcoatRoughness:.2}),gold=new T.MeshPhysicalMaterial({color:0xf1bd43,metalness:.7,roughness:.22,clearcoat:.8}),ivory=new T.Color(0xfff8e8);
  visual.traverse(function(o){if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material=o.material.clone();if(o.material.color)o.material.color.lerp(ivory,.78);if(o.material.roughness!=null)o.material.roughness=.38}}});
  var box3=new T.Box3().setFromObject(visual),size=box3.getSize(new T.Vector3());
  var wl=new T.Group(),wr=new T.Group();for(var i=0;i<11;i++){var L=.72+i*.09,m=i%3===0?gold:red;wl.add(feather(m,L,1,i*.018));wr.add(feather(m,L,-1,i*.018))}
  wl.position.set(0,size.y*.58,.48);wr.position.set(0,size.y*.58,-.48);root.add(wl,wr);
  var head=null;visual.traverse(function(o){if(!head&&/head/i.test(o.name))head=o});visual.updateMatrixWorld(true);
  var hp=new T.Vector3(0,size.y*.78,-size.z*.35);if(head){head.getWorldPosition(hp);root.worldToLocal(hp)}
  var fwd=hp.x>=0?1:-1;var horn=me(new T.ConeGeometry(.12,1.38,18),gold);horn.position.set(hp.x+fwd*.2,hp.y+.43,hp.z);horn.rotation.z=-fwd*.82;root.add(horn);
  var armor=me(new T.TorusGeometry(.66,.09,10,28),gold);armor.rotation.y=Math.PI/2;armor.position.set(fwd*.38,size.y*.54,0);armor.scale.set(1,1.12,1);root.add(armor);
  for(i=0;i<8;i++){var mg=me(new T.SphereGeometry(.22,10,7),i%3===0?gold:red);mg.scale.set(1.4,.58,.68);mg.position.set(hp.x-fwd*(.18+i*.2),hp.y-.1-i*.12,.18*Math.sin(i*.8));root.add(mg)}
  for(i=0;i<7;i++){var tg=me(new T.SphereGeometry(.28,10,7),i%4===0?gold:red);tg.scale.set(1.55,.5,.62);tg.position.set(-fwd*(size.x*.42+i*.18),size.y*.49-i*.07,.13*Math.sin(i));root.add(tg)}
  root.userData.wl=wl;root.userData.wr=wr
}
function loadUnicornGLTF(){
  gltfLoader.load(MODEL_URLS.horse,function(gltf){
    var visual=gltf.scene;modelNormalize(visual,3.9,Math.PI/2);
    while(unicorn.children.length)unicorn.remove(unicorn.children[0]);
    unicorn.add(visual);decorateHorse(unicorn,visual);unicornLoaded=true;
    unicornMixer=new T.AnimationMixer(visual);var clips=gltf.animations||[],clip=clips.find(function(x){return /idle|stand/i.test(x.name)})||clips.find(function(x){return /walk/i.test(x.name)})||clips[0];if(clip){unicornAction=unicornMixer.clipAction(clip);unicornAction.play()}
    unicorn.visible=false
  },undefined,function(e){console.warn('Horse GLB fallback active',e)})
}
function makeFairy(){var g=new T.Group();sph(g,.28,0xffd3bf,0,1.05,0);var b=me(new T.ConeGeometry(.34,.8,14),M(0x61b85b));b.position.y=.55;b.rotation.x=Math.PI;g.add(b);var h=me(new T.ConeGeometry(.34,.75,16),M(0x3c9147));h.position.y=1.55;g.add(h);var wm=new T.MeshStandardMaterial({color:0xdffcff,transparent:true,opacity:.68,side:T.DoubleSide,emissive:0x98e9ff,emissiveIntensity:.2});var wl=me(new T.SphereGeometry(.42,16,10),wm,false);wl.scale.set(.38,1,.08);wl.position.set(-.36,.88,.15);wl.rotation.z=.55;g.add(wl);var wr=wl.clone();wr.position.x=.36;wr.rotation.z=-.55;g.add(wr);g.userData={wl:wl,wr:wr};g.visible=false;world.add(g);return g}
function makeUnicorn(){var g=new T.Group(),white=M(0xfffbef,.38,.05),red=M(0xc51f32,.42,0),gold=M(0xf3c14e,.25,.75);function S(r,m,x,y,z,sc){var q=me(new T.SphereGeometry(r,22,14),m);q.position.set(x,y,z);if(sc)q.scale.set(sc[0],sc[1],sc[2]);g.add(q);return q}S(1.25,white,0,2.25,0,[1.55,.9,.75]);S(.75,white,-.95,2.75,0,[.8,1.3,.8]);var neck=me(new T.CylinderGeometry(.5,.72,2.4,18),white);neck.position.set(-1.35,3.45,0);neck.rotation.z=-.38;g.add(neck);S(.67,white,-2.1,4.35,0,[1.15,.85,.75]);S(.38,white,-2.65,4.18,0,[1.1,.7,.78]);var horn=me(new T.ConeGeometry(.16,1.7,16),gold);horn.position.set(-2.1,5.33,0);horn.rotation.z=.25;g.add(horn);for(var i=0;i<8;i++)S(.35,red,-1.25+i*.18,4.3-i*.26,.24,[.6,1,.45]);for(i=0;i<7;i++)S(.42,red,1.65+i*.2,2.45-i*.18,.15,[1.1,.55,.5]);[[-.8,-.45],[-.8,.45],[.85,-.45],[.85,.45]].forEach(function(v){var l=me(new T.CylinderGeometry(.18,.22,1.8,14),white);l.position.set(v[0],1.1,v[1]);g.add(l);var hf=me(new T.CylinderGeometry(.24,.25,.25,14),gold);hf.position.set(v[0],.16,v[1]);g.add(hf)});var wl=new T.Group(),wr=new T.Group();for(i=0;i<8;i++){var len=1.7+i*.16,fe=me(new T.ConeGeometry(.24,len,10),i%2?red:gold);fe.position.set(0,len*.45,0);fe.rotation.z=-.32-i*.075;wl.add(fe);var f2=fe.clone();f2.rotation.z=.32+i*.075;wr.add(f2)}wl.position.set(-.1,3.2,.52);wr.position.set(-.1,3.2,-.52);g.add(wl,wr);g.userData={wl:wl,wr:wr};g.scale.set(.82,.82,.82);g.rotation.y=Math.PI/2;g.position.set(1.5,.15,-14.5);g.visible=false;world.add(g);return g}
function makeSparkles(){var n=100,a=new Float32Array(n*3);for(var i=0;i<n;i++){a[i*3]=(Math.random()-.5)*8;a[i*3+1]=Math.random()*7;a[i*3+2]=(Math.random()-.5)*5}var ge=new T.BufferGeometry();ge.setAttribute('position',new T.BufferAttribute(a,3));var p=new T.Points(ge,new T.PointsMaterial({color:0xfff1a6,size:.11,transparent:true,opacity:.9}));p.position.set(0,0,-15);p.visible=false;world.add(p);return p}
function makeTowerInside(){var fl=me(new T.CircleGeometry(11,48),M(0xf5f0ff,.45,.12),false);fl.rotation.x=-Math.PI/2;towerInside.add(fl);for(var i=0;i<10;i++){var a=i/10*Math.PI*2,c=me(new T.CylinderGeometry(.36,.5,10,18),M(i%2?0xf3e5ff:0xe3ddff,.35,.18));c.position.set(Math.cos(a)*8.5,5,Math.sin(a)*8.5);towerInside.add(c)}var li=new T.PointLight(0xbda5ff,42,28,2);li.position.set(0,8,0);towerInside.add(li);box(towerInside,4.2,4.8,.4,0x6d214d,0,2.4,-9.2);label(towerInside,'🎬 기록 영화관',0,5.6,-9);box(towerInside,3.6,4.4,.4,0x8b6b44,0,2.2,9.2);label(towerInside,'🚪 숲으로',0,5.3,9)}
ground();trees();meadow();horizon();house=makeHouse();makeShop();makeFire();makeWater();makeBamboo();tower=makeTower();fairy=makeFairy();unicorn=makeUnicorn();sparkles=makeSparkles();makeTowerInside();player=wizard('girl');player.visible=false;loadUnicornGLTF();
function sync(){if(!state)return;world.visible=state.area!=='tower';towerInside.visible=state.area==='tower';house.visible=!state.tower;tower.visible=!!state.tower;fairy.visible=!!state.fairy&&!state.spells.tech&&state.area==='world'}
function newPlayer(){if(player)scene.remove(player);playerMixer=null;playerActions={};playerActionName='';player=wizard(state?state.gender:(gender||'girl'));player.visible=!!state;var tok=++playerLoadToken;loadWizardGLTF(state?state.gender:(gender||'girl'),tok);sync()}

function updateMagic(){$$('#magicBar [data-magic]').forEach(function(e){e.classList.toggle('owned',!!(state&&state.spells[e.dataset.magic]))})}
function firstFour(){return state.spells.plant&&state.spells.water&&state.spells.fire&&state.spells.music}
function gain(k){if(!state||state.spells[k])return;state.spells[k]=true;state.events.push({t:Date.now(),type:'magic',magic:k,x:state.player.x,z:state.player.z,area:state.area});updateMagic();chime();toast(icons[k]+'<br><b>'+names[k]+' 마법을 얻었어요!</b>',2100);save();if(k==='tech'&&Object.values(state.spells).every(Boolean))finish()}
function finish(){if(state.completed)return;state.completed=true;state.tower=true;state.events.push({t:Date.now(),type:'complete'});save();setTimeout(function(){toast('🌈 <b>축하합니다!</b><br>다섯 마법을 모두 찾았어요!<br><small>집이 마법 탑으로 변했어요!</small>',4300);sync()},400)}
function begin(g,cont){initAudio();state=cont?load():fresh(g);if(!state)return;gender=state.gender;newPlayer();showScreen(null);hud(true);updateMagic();mode(state.mode||'walk');sync();if(!cont){setTimeout(function(){gain('plant')},650);tutorial(0)}else if(!state.tutorialDone)tutorial(0);save()}
$('#newGameBtn').onclick=function(){initAudio();if(load())open('#confirmNew');else{showScreen('#selectScreen');hud(false)}};$('#continueBtn').onclick=function(){begin(null,true)};
$$('.characterCard').forEach(function(c){c.onclick=function(){gender=c.dataset.gender;$$('.characterCard').forEach(function(x){x.classList.toggle('selected',x===c)});$('#startSelectedBtn').disabled=false}});$('#startSelectedBtn').onclick=function(){localStorage.removeItem(SAVE);begin(gender,false)};$('#cancelNewBtn').onclick=function(){close('#confirmNew')};$('#holdNewBtn').addEventListener('pointerdown',function(){holdTimer=setTimeout(function(){localStorage.removeItem(SAVE);close('#confirmNew');showScreen('#selectScreen');hud(false)},2000)});['pointerup','pointercancel','pointerleave'].forEach(function(e){$('#holdNewBtn').addEventListener(e,function(){clearTimeout(holdTimer)})});

var tut=0;function tutorial(n){tut=n;var b=$('#tutorialBubble');b.classList.remove('hidden');b.textContent=n===0?'왼쪽 동그라미를 움직여 봐! 👆':n===1?'오른쪽 화면을 밀어 둘러봐! 👆':'걷기나 뛰기를 눌러 봐!'}function prog(t){if(!state||state.tutorialDone)return;if(tut===0&&t==='move')tutorial(1);else if(tut===1&&t==='look')tutorial(2);else if(tut===2&&t==='mode'){state.tutorialDone=true;$('#tutorialBubble').classList.add('hidden');save()}}
function mode(m){if(!state)return;state.mode=m;$('#walkBtn').classList.toggle('selected',m==='walk');$('#runBtn').classList.toggle('selected',m==='run');prog('mode')}$('#walkBtn').onclick=function(){mode('walk')};$('#runBtn').onclick=function(){mode('run')};
function joyMove(e){var r=$('#joystick').getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,m=Math.hypot(dx,dy);if(m>max){dx*=max/m;dy*=max/m}joy.x=dx/max;joy.y=dy/max;$('#stick').style.transform='translate('+dx+'px,'+dy+'px)';if(Math.hypot(joy.x,joy.y)>.1)prog('move')}
$('#joystick').addEventListener('pointerdown',function(e){e.preventDefault();joy.on=true;joy.id=e.pointerId;$('#joystick').setPointerCapture(e.pointerId);joyMove(e)});$('#joystick').addEventListener('pointermove',function(e){if(joy.on&&e.pointerId===joy.id)joyMove(e)});function joyEnd(e){if(e.pointerId!==joy.id)return;joy.on=false;joy.x=joy.y=0;$('#stick').style.transform=''}$('#joystick').addEventListener('pointerup',joyEnd);$('#joystick').addEventListener('pointercancel',joyEnd);
canvas.addEventListener('pointerdown',function(e){if(!state||cut)return;look.on=true;look.id=e.pointerId;look.x=e.clientX;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',function(e){if(!look.on||e.pointerId!==look.id||!state)return;state.yaw+=(e.clientX-look.x)*.0065;look.x=e.clientX;prog('look')});function lookEnd(e){if(e.pointerId===look.id)look.on=false}canvas.addEventListener('pointerup',lookEnd);canvas.addEventListener('pointercancel',lookEnd);addEventListener('keydown',function(e){keys[e.key.toLowerCase()]=true});addEventListener('keyup',function(e){keys[e.key.toLowerCase()]=false});

$('#settingsBtn').onclick=function(){open('#settings')};$('#closeSettingsBtn').onclick=function(){close('#settings')};$('#musicToggle').onchange=function(e){audio.music=e.target.checked;st.music=audio.music;localStorage.setItem(SETTINGS,JSON.stringify(st));audio.music?ambient():stopAmbient()};$('#sfxToggle').onchange=function(e){audio.sfx=e.target.checked;st.sfx=audio.sfx;localStorage.setItem(SETTINGS,JSON.stringify(st))};$('#homeBtn').onclick=function(){save();close('#settings');hud(false);showScreen('#titleScreen');if(player)player.visible=false;state=null;updateContinue()};$('#enterBtn').onclick=function(){if(interact)enter(interact)};
function enter(p){if(p==='shop'){inside('🏪 상점','🎵 🧪','음악 마법과 가시 방지 물약은 공짜예요!');if(!state.spells.music)gain('music');if(!state.potion){state.potion=true;setTimeout(function(){toast('🧪 가시 방지 물약을 무료로 얻었어요!',1900)},450);save()}}else if(p==='house'){inside('🏠 집','🛏️ ✨','따뜻한 집이에요.');if(firstFour()&&!state.fairy){state.fairy=true;state.fairyPos={x:0,z:13};toast('🧚 요정이 나타났어요!<br>요정을 따라가 보세요.',2300);save();sync()}}else if(p==='tower'){state.area='tower';state.player={x:0,z:6.5};state.yaw=0;sync();save();toast('🗼 마법 탑 안에 들어왔어요!',1700)}else if(p==='exit'){state.area='world';state.player={x:0,z:17.5};state.yaw=0;sync();save()}else if(p==='theater')theater()}
function inside(title,emoji,text){$('#interiorTitle').textContent=title;$('#interiorScene').textContent=emoji;$('#interiorText').textContent=text;var a=$('#interiorActions');a.innerHTML='';var b=document.createElement('button');b.className='bigBtn blue';b.textContent='🚪 나가기';b.onclick=function(){close('#interior')};a.appendChild(b);open('#interior')}
function theater(){open('#theater');startReplay()}$('#exitTheaterBtn').onclick=function(){cancelAnimationFrame(replayRAF);replayRAF=null;close('#theater')};function startReplay(){var r=state.record.length?state.record:[{x:0,z:3,area:'world'}],s=performance.now();function f(n){drawReplay(r,(n-s)/80);replayRAF=requestAnimationFrame(f)}replayRAF=requestAnimationFrame(f)}
var rc=$('#replay'),rx=rc.getContext('2d');function drawReplay(rec,t){var w=rc.clientWidth,h=rc.clientHeight,d=Math.min(2,devicePixelRatio||1);if(rc.width!==Math.floor(w*d)){rc.width=Math.floor(w*d);rc.height=Math.floor(h*d);rx.setTransform(d,0,0,d,0,0)}rx.clearRect(0,0,w,h);var gr=rx.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#b9ecff');gr.addColorStop(1,'#76cf70');rx.fillStyle=gr;rx.fillRect(0,0,w,h);var p=rec[Math.floor(t)%rec.length];if((p.area||'world')==='tower'){rx.font='80px sans-serif';rx.textAlign='center';rx.fillText('🗼',w/2,h/2)}else{var x=w/2+p.x*9,y=h/2+p.z*7;rx.font='28px sans-serif';rx.textAlign='center';rx.fillText('🧙',x,y)}}

function nextTarget(){if(!state)return null;if(state.area==='tower')return{x:0,z:-8};if(!state.spells.water)return W.water;if(!state.spells.fire)return W.fire;if(!state.spells.music)return W.shop;if(firstFour()&&!state.fairy)return W.house;if(state.fairy&&!state.spells.tech)return state.fairyPos;if(state.tower)return W.house;return null}
function clearHint(){hintDots.forEach(function(x){x.removeFromParent()});hintDots=[]}function makeHint(){clearHint();var tg=nextTarget();if(!tg)return;var p=state.area==='tower'?towerInside:world;for(var i=1;i<=8;i++){var d=me(new T.OctahedronGeometry(.16),new T.MeshStandardMaterial({color:0xffef7b,emissive:0xffcc30,emissiveIntensity:1.1}),false);var k=i/9;d.position.set(state.player.x+(tg.x-state.player.x)*k,.24,state.player.z+(tg.z-state.player.z)*k);p.add(d);hintDots.push(d)}}$('#hintBtn').onclick=function(){hintUntil=performance.now()+5000;makeHint();tone(740,.16,.04)};
function home(){state.area='world';state.player={x:0,z:15};state.fairyAt=Date.now()+120000;toast('🎋 앗! 가시가 나왔어요.<br>집으로 돌아왔어요!',2300);tone(220,.25,.05);sync();save()}
function move(dt){var ix=joy.x,iy=-joy.y;if(keys.a||keys.arrowleft)ix--;if(keys.d||keys.arrowright)ix++;if(keys.w||keys.arrowup)iy++;if(keys.s||keys.arrowdown)iy--;var m=Math.hypot(ix,iy);if(m>1){ix/=m;iy/=m;m=1}moving=m;if(m<.04||cut)return;var sp=(state.mode==='run'?6.4:3.5)*dt;var f={x:Math.sin(state.yaw),z:-Math.cos(state.yaw)},r={x:Math.cos(state.yaw),z:Math.sin(state.yaw)};var dx=r.x*ix+f.x*iy,dz=r.z*ix+f.z*iy;var nx=state.player.x+dx*sp,nz=state.player.z+dz*sp;if(state.area==='world'){nx=clamp(nx,-23,23);nz=clamp(nz,-23,23)}else{var rr=Math.hypot(nx,nz);if(rr>9.4){nx*=9.4/rr;nz*=9.4/rr}}state.player.x=nx;state.player.z=nz;player.rotation.y=Math.atan2(-dx,-dz)}
function update(dt,now){if(!state)return;if(!$('#hud').classList.contains('hidden')&&!cut)move(dt);if(state.area==='world'){if(!state.spells.water&&dist(state.player,W.water)<5.1)gain('water');if(!state.spells.fire&&dist(state.player,W.fire)<3.8)gain('fire');if(state.potion&&!state.potionActive&&dist(state.player,W.water)<7){state.potionActive=true;toast('🧪 가시 방지 물약이 자동으로 발동했어요!',1900);save()}bambooThorns.visible=dist(state.player,W.bamboo)<2.2&&!state.potionActive;if(!state.potionActive&&dist(state.player,W.bamboo)<1.3)home();if(state.fairyAt&&Date.now()>state.fairyAt&&!state.fairy){state.fairyAt=0;state.fairy=true;state.fairyPos={x:0,z:13};toast('🧚 2분이 지나 요정이 다시 나타났어요!',2200);sync();save()}if(state.fairy&&!state.spells.tech){var fp=state.fairyPos;if(firstFour()){var dx=W.water.x-fp.x,dz=W.water.z-fp.z,dd=Math.hypot(dx,dz);if(dist(state.player,fp)<6&&dd>.2){fp.x+=dx/dd*dt*2.1;fp.z+=dz/dd*dt*2.1}if(dist(fp,W.water)<1.8&&dist(state.player,W.water)<5.2)unicornCut()}else{dx=state.player.x-fp.x;dz=state.player.z-fp.z;dd=Math.hypot(dx,dz);if(dd>3.2){fp.x+=dx/dd*dt*1.8;fp.z+=dz/dd*dt*1.8}}fairy.position.set(fp.x,1.2+Math.sin(now*.004)*.16,fp.z)}interact=null;if(dist(state.player,W.shop)<3)interact='shop';if(dist(state.player,W.house)<3.4)interact=state.tower?'tower':'house'}else{interact=null;if(Math.hypot(state.player.x,state.player.z+9)<2.2)interact='theater';if(Math.hypot(state.player.x,state.player.z-9)<2.2)interact='exit'}$('#enterBtn').classList.toggle('hidden',!interact);saveClock+=dt;if(saveClock>2){saveClock=0;save()}recordClock+=dt;if(recordClock>.5){recordClock=0;state.record.push({x:+state.player.x.toFixed(1),z:+state.player.z.toFixed(1),area:state.area});if(state.record.length>3000)state.record=state.record.filter(function(_,i){return i%2===0})}if(now>hintUntil&&hintDots.length)clearHint()}
function unicornCut(){if(cut||state.spells.tech||!firstFour())return;cut=true;cutStart=performance.now();unicorn.visible=true;sparkles.visible=true;hud(false);$('#unicornImg').classList.add('hidden');$('#cutsceneText').textContent='아름다운 유니콘이 나타났어요!';open('#cutscene');setTimeout(function(){$('#cutsceneText').textContent='🔧 기술 마법을 얻었어요!';gain('tech')},4200);setTimeout(function(){close('#cutscene');hud(true);cut=false;sparkles.visible=false;save()},7600)}
function animate(now,dt){
  var t=now*.001;
  anim.forEach(function(a){
    if(a.kind==='fire'){a.o.scale.y=1+Math.sin(t*8)*.12;if(fireLight)fireLight.intensity=17+Math.sin(t*9)*3}
    else if(a.kind==='mist'){a.o.position.x=a.base.x+Math.sin(t*a.s)*.22;a.o.position.y=a.base.y+Math.sin(t*a.s*.7)*.11}
  });
  if(waterShader)waterShader.uniforms.uTime.value=t;
  if(fairy.visible&&fairy.userData.wl){fairy.userData.wl.rotation.y=Math.sin(t*14)*.55;fairy.userData.wr.rotation.y=-Math.sin(t*14)*.55}
  if(unicorn.visible){
    unicorn.position.y=.15+Math.sin(t*2.4)*.08;
    if(unicorn.userData.wl){unicorn.userData.wl.rotation.x=.08+Math.sin(t*3.25)*.22;unicorn.userData.wr.rotation.x=-.08-Math.sin(t*3.25)*.22}
    if(unicornMixer)unicornMixer.update(dt*.7);
    sparkles.rotation.y+=dt*.18
  }
  if(player&&state){
    player.visible=true;player.position.set(state.player.x,player.userData.gltf?0:Math.sin(t*(state.mode==='run'?11:7))*moving*.045,state.player.z);
    if(playerMixer){chooseAction(moving>.08?(state.mode==='run'?(playerActions.Run?'Run':(playerActions.Run_Weapon?'Run_Weapon':'Walk')):'Walk'):'Idle');playerMixer.update(dt)}
    else if(player.userData.l1){var u=player.userData,stp=Math.sin(t*(state.mode==='run'?12:8))*moving*.55;u.l1.rotation.x=stp;u.l2.rotation.x=-stp;u.a1.rotation.x=-stp*.75;u.a2.rotation.x=stp*.75}
  }
}
function cam(dt,now){if(!state)return;if(cut){var el=(now-cutStart)/1000,up=new T.Vector3(1.5,2.5,-14.5),des;if(el<2.6){var a=-1.1+1.45*(el/2.6);des=new T.Vector3(up.x+Math.sin(a)*8,4.8,up.z+Math.cos(a)*8)}else if(el<5.2){a=.35+.85*((el-2.6)/2.6);des=new T.Vector3(up.x+Math.sin(a)*6,3.7,up.z+Math.cos(a)*6)}else des=new T.Vector3(up.x-4.5,4.7,up.z+4.1);camera.position.lerp(des,1-Math.exp(-dt*3.2));camera.lookAt(up);return}var f=new T.Vector3(Math.sin(state.yaw),0,-Math.cos(state.yaw)),p=new T.Vector3(state.player.x,1.55,state.player.z),des=p.clone().addScaledVector(f,-8.2).add(new T.Vector3(0,4.9,0));camera.position.lerp(des,1-Math.exp(-dt*7));camera.lookAt(p.clone().addScaledVector(f,1.6))}
function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();
function loop(now){var dt=Math.min(.04,(now-last)/1000||.016);last=now;update(dt,now);animate(now,dt);cam(dt,now);renderer.render(scene,camera);requestAnimationFrame(loop)}requestAnimationFrame(loop);
if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){})});
})();
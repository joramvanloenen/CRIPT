/* CRIPT 3D runtime — grid exploration + seamless free combat */
(function(){
'use strict';
const C=window.Cript, T=window.THREE, $=id=>document.getElementById(id);
if(!T){$('gameOverlay').innerHTML='<div class="opening"><h2>3D renderer unavailable</h2><p>Three.js needs a network connection on first load.</p></div>';return}
const TAU=Math.PI*2, clamp=C.clamp;
class CryptGame{
constructor(){
 this.scene=new T.Scene();this.scene.background=new T.Color('#101a19');this.scene.fog=new T.FogExp2('#193d38',.063);
 this.camera=new T.PerspectiveCamera(76,1,.07,105);this.camera.rotation.order='YXZ';
 this.renderer=new T.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});
 this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.setPixelRatio(1);this.renderer.domElement.style.touchAction='none';$('webgl').appendChild(this.renderer.domElement);
 this.world=new T.Group();this.actors=new T.Group();this.scene.add(this.world,this.actors,this.camera);
 this.hemi=new T.HemisphereLight(0x7c9991,0x111917,.55);this.scene.add(this.hemi);
 this.lantern=new T.PointLight(0xf1ae68,1.8,9,2);this.scene.add(this.lantern);
 this.images={};this.keys=new Set();this.running=false;this.paused=false;this.mode='free';this.time=0;this.bell=0;this.last=performance.now();this.frame=0;this.room=null;this.enemies=[];this.props=[];this.effects=[];this.torches=[];this.marks=[];this.secretGates=[];this.seen=new Set();this.flags=new Set();this.chests=new Set();
 this.hero=this.freshHero();this.weaponView=new T.Group();this.camera.add(this.weaponView);this.makeWeapon();
 this.buildWorld();this.resetActors();this.bind();this.resize();window.addEventListener('resize',()=>this.resize());requestAnimationFrame(t=>this.loop(t));
}
freshHero(){return{x:4.5*1.8,z:4.5*1.8,yaw:Math.PI/2,pitch:0,vx:0,vz:0,hp:100,st:100,mp:80,weapon:'rust',souls:0,kills:0,journal:false,step:null,wait:0,attack:0,dodge:0,injured:0,regen:0,safe:0,veil:0}}
sceneTexture(asset){if(!asset)return null;if(this.images[asset.id])return this.images[asset.id];const t=new T.CanvasTexture(C.spriteCanvas(asset));t.magFilter=T.NearestFilter;t.minFilter=T.NearestFilter;t.wrapS=T.RepeatWrapping;t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;this.images[asset.id]=t;return t}
pos(room,x,z){return{x:(room.gx*9+x+.5)*1.8,z:(room.gz*9+z+.5)*1.8}}
buildWorld(){
 if(this.lighting)this.lighting.dispose();
 if(this.architecture)this.architecture.dispose();
 this.world.clear();
 Object.values(this.images).forEach(t=>t.dispose());
 this.images={};
 this.architecture=C.Masonry.build(this.world,C.project,asset=>this.sceneTexture(asset));
 this.lighting=new C.Lighting.BakedLighting(this.scene,this.world,C.project);
 for(const mat of this.architecture.mats.values())this.lighting.attach(mat);
 this.lighting.schedule();
}

resetActors(){
 this.actors.clear();this.torches=[];this.enemies=[];this.props=[];this.effects=[];this.marks=[];this.secretGates=[];
 for(const room of Object.values(C.project.rooms)){
  for(const e of room.enemies||[]){const def=C.project.assets.characters[e.kind];if(!def)continue;const p=this.pos(room,e.x,e.z);
   const mesh=new T.Mesh(new T.PlaneGeometry(1.25,1.85),new T.MeshBasicMaterial({map:this.sceneTexture(def),transparent:true,alphaTest:.13,side:T.DoubleSide}));mesh.position.set(p.x,1,p.z);this.actors.add(mesh);
   this.enemies.push({id:e.id,kind:e.kind,def,x:p.x,z:p.z,mesh,hp:def.hp,attack:Math.random(),stun:0,phase:Math.random()*5,alive:true})}
  for(const o of room.props||[]){const def=C.project.assets.props[o.kind];if(!def)continue;const p=this.pos(room,o.x,o.z),g=new T.Group();
   if(o.kind==='torch'){
    const iron=new T.MeshStandardMaterial({color:0x54473c,roughness:.73,metalness:.47});
    const stick=new T.Mesh(new T.CylinderGeometry(.055,.082,1.35,8),iron);stick.position.y=.7;g.add(stick);
    const cup=new T.Mesh(new T.CylinderGeometry(.19,.10,.18,7),iron);cup.position.y=1.43;g.add(cup);
    const flame=new T.Mesh(new T.ConeGeometry(.16,.49,6),new T.MeshBasicMaterial({color:0xffbe74}));flame.position.y=1.7;g.add(flame);
    const light=new T.PointLight(0xffa95b,0,9,2);light.position.y=1.65;g.add(light);
    this.torches.push({g,light,flame,hearth:false,phase:Math.random()*10});
   }else if(o.kind==='fireplace'){
    // Real masonry hearth and low-poly coals, set against the chamber wall.
    const stone=new T.MeshStandardMaterial({color:0x696b5e,roughness:.96});
    const soot=new T.MeshStandardMaterial({color:0x252421,roughness:1});
    const wood=new T.MeshStandardMaterial({color:0x4e3025,roughness:1});
    const glow=new T.MeshBasicMaterial({color:0xd36e39});
    const box=(w,h,d,x,y,z,mat)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);g.add(mesh);return mesh};
    box(2.55,.22,1.32,0,.13,0,stone);
    box(.32,2.13,1.21,-1.08,1.16,0,stone);
    box(.32,2.13,1.21,1.08,1.16,0,stone);
    box(2.5,.26,1.30,0,2.22,0,stone);
    box(1.93,1.85,.085,0,1.14,-.54,soot);
    box(1.65,.13,.77,0,.29,.14,glow);
    for(let i=0;i<3;i++){const log=new T.Mesh(new T.CylinderGeometry(.10,.13,1.24,6),wood);log.rotation.z=Math.PI/2;log.rotation.y=(i-1)*.4;log.position.set(0,.37+i*.12,.16);g.add(log)}
    const flames=[];
    for(let i=0;i<5;i++){const flame=new T.Mesh(new T.ConeGeometry(.17+i*.018,.65+i*.11,5),
      new T.MeshBasicMaterial({color:i%2?0xffbf71:0xf18a42,transparent:true,opacity:.82}));
      flame.position.set((i-2)*.28,.65+(i%2)*.12,.24);g.add(flame);flames.push(flame)}
    const light=new T.PointLight(0xff8848,0,12,2);light.position.set(0,1.0,.53);g.add(light);
    this.torches.push({g,light,flame:flames[0],flames,hearth:true,phase:Math.random()*10});
   }
   else{const plane=new T.Mesh(new T.PlaneGeometry(1.17,1.17),new T.MeshBasicMaterial({map:this.sceneTexture(def),transparent:true,alphaTest:.15,side:T.DoubleSide}));plane.position.y=.59;g.add(plane)}
   g.position.set(p.x,0,p.z);this.actors.add(g);this.props.push({id:o.id,kind:o.kind,def,x:p.x,z:p.z,g,active:true})}
 }
 this.createSecretGates();
}

createSecretGates(){
 // Secret annexes are physical rooms, hidden behind movable mortared panels.
 // Never create a visible arch or doorway until the wall is discovered.
 for(const secret of C.project.secretPassages||[]){
  const from=C.project.rooms[secret.from];if(!from)continue;
  const cell=secret.side==='E'?{x:9,z:4.5}:secret.side==='W'?{x:0,z:4.5}:
    secret.side==='S'?{x:4.5,z:9}:{x:4.5,z:0};
  const x=(from.gx*9+cell.x)*1.8,z=(from.gz*9+cell.z)*1.8;
  const g=new T.Group();g.position.set(x,0,z);
  const across=secret.side==='E'||secret.side==='W';
  if(across)g.rotation.y=Math.PI/2;
  const mat=this.architecture.mats.get(from.theme==='sand'?'goldstone':'stone');
  const stone=new T.Mesh(new T.BoxGeometry(1.82,3.28,.29),mat);
  stone.position.y=1.64;g.add(stone);
  const crack=new T.MeshBasicMaterial({color:0x243332,transparent:true,opacity:.65,depthWrite:false});
  for(let i=0;i<4;i++){
   const c=new T.Mesh(new T.BoxGeometry(.022,.32+i*.12,.018),crack);
   c.position.set((i-1.5)*.28,.72+i*.53,.157);
   c.rotation.z=i%2?.32:-.22;g.add(c);
  }
  const faint=new T.Mesh(new T.BoxGeometry(.48,.11,.028),
    new T.MeshBasicMaterial({color:0x82ccb9,transparent:true,opacity:.24,depthWrite:false}));
  faint.position.set(.28,1.24,.18);g.add(faint);
  this.actors.add(g);
  this.secretGates.push({...secret,x,z,g,stone,faint,open:false,opening:0,kind:'secretGate',
    def:{name:secret.name||'Suspicious masonry'}});
 }
}

makeWeapon(){
 C.WeaponRig.resetTrail?.(this);
 this.weaponView.clear();
 const def=C.project.assets.weapons[this.hero.weapon]||C.project.assets.weapons.rust;
 this.weaponView.add(C.WeaponRig.create(def));
 this.attackAnim=null;this.queuedStrike=null;
 $('weaponName').textContent=def.name;
}

bind(){
 const resume=()=>this.pause(false);$('startBtn').onclick=()=>this.start();$('retryBtn').onclick=()=>this.start();$('newBtn').onclick=()=>this.start();$('resumeBtn').onclick=resume;
 $('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=$('closeHelp2').onclick=()=>$('helpDialog').close();
 $('mapClose').onclick=()=>{$('mapPanel').classList.add('hide');this.paused=false};
 window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||$('helpDialog').open)return;if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k))e.preventDefault();this.keys.add(k);
  if(!this.running||this.paused||e.repeat)return;
  if(k==='escape'){this.pause(true);return}if(k==='f')this.interact();if(k==='c')this.chalk();if(k==='m')this.map();if(k==='1')this.spell('ember');if(k==='2')this.spell('veil');if(k==='shift')this.dodge();if(k===' '||k==='enter')this.strike(false)});
 window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
 window.addEventListener('blur',()=>{this.keys.clear();if(this.running)this.pause(true)});
 this.lookDrag=null;
 this.renderer.domElement.addEventListener('pointerdown',e=>{
  if(!this.running||this.paused)return;
  if(e.pointerType==='touch'){this.lookDrag={id:e.pointerId,x:e.clientX,y:e.clientY};this.renderer.domElement.setPointerCapture?.(e.pointerId);e.preventDefault();return}
  if(e.button===2){this.strike(true);return}
  if(e.button!==0)return;
  if(document.pointerLockElement!==this.renderer.domElement)this.renderer.domElement.requestPointerLock?.();
  this.strike(false);
 });
 this.renderer.domElement.addEventListener('pointermove',e=>{
  if(!this.running||this.paused||e.pointerType!=='touch'||!this.lookDrag||this.lookDrag.id!==e.pointerId)return;
  const dx=e.clientX-this.lookDrag.x,dy=e.clientY-this.lookDrag.y;
  this.lookDrag.x=e.clientX;this.lookDrag.y=e.clientY;
  this.hero.yaw=(this.hero.yaw+dx*.007+TAU)%TAU;
  this.hero.pitch=clamp(this.hero.pitch-dy*.005,-1.08,1.08);e.preventDefault();
 });
 const stopTouchLook=e=>{if(this.lookDrag?.id===e.pointerId)this.lookDrag=null};
 this.renderer.domElement.addEventListener('pointerup',stopTouchLook);
 this.renderer.domElement.addEventListener('pointercancel',stopTouchLook);
 this.renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 document.addEventListener('mousemove',e=>{if(!this.running||this.paused||document.pointerLockElement!==this.renderer.domElement)return;this.hero.yaw=(this.hero.yaw+e.movementX*.0024+TAU)%TAU;this.hero.pitch=clamp(this.hero.pitch-e.movementY*.002,-1.08,1.08)});
 const touchRoot=document.getElementById('touchpad');for(const type of ['contextmenu','selectstart','dragstart'])touchRoot.addEventListener(type,e=>e.preventDefault());
 document.querySelectorAll('[data-touch]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();const k=b.dataset.touch;if(k==='attack')this.strike(false);else if(k==='spell')this.spell('ember');else if(k==='dodge')this.dodge();else if(k==='f')this.interact();else{this.keys.add(k);b.setPointerCapture(e.pointerId)}});b.addEventListener('pointerup',()=>this.keys.delete(b.dataset.touch));b.addEventListener('pointercancel',()=>this.keys.delete(b.dataset.touch))});
}
start(){this.hero=this.freshHero();this.flags.clear();this.chests.clear();this.seen.clear();this.time=0;this.bell=0;this.mode='free';this.room=null;this.running=true;this.paused=false;this.resetActors();this.makeWeapon();$('gameOverlay').classList.add('hide');$('pausePanel').classList.add('hide');$('deathPanel').classList.add('hide');this.checkRoom(true);this.hud()}
pause(value){this.paused=value;this.keys.clear();$('pausePanel').classList.toggle('hide',!value);if(value&&document.pointerLockElement)document.exitPointerLock?.()}
checkRoom(force=false){const r=C.roomAt(this.hero.x,this.hero.z);if(!r||(!force&&r===this.room))return;this.room=r;this.seen.add(r.id);$('roomName').textContent=r.name.toUpperCase();$('roomHint').textContent=r.clue||'Listen to the stones. They are not always silent.';$('depthChip').textContent='DEPTH '+String(r.gz+1).padStart(2,'0');const a=C.project.assets.atmosphere[r.theme]||C.project.assets.atmosphere.crypt;this.scene.fog.color.set(a.fog);this.scene.fog.density=a.density;this.scene.background.set(a.fog).multiplyScalar(.21);this.hemi.intensity=Math.min(.3,a.ambient*.56);this.lantern.intensity=a.torch*.48;this.lighting?.setFog(a);}
can(x,z,r=.29){if(C.isSolid(x-r,z-r)||C.isSolid(x+r,z-r)||C.isSolid(x-r,z+r)||C.isSolid(x+r,z+r))return false;if(this.architecture?.blocked(x,z,r)||this.gateBlocks(x,z,r))return false;for(const o of this.props||[]){if(!o.active||!o.def.solid)continue;if(Math.abs(x-o.x)<r+.44&&Math.abs(z-o.z)<r+.44)return false}return true}
move(dx,dz){const p=this.hero;if(this.can(p.x+dx,p.z))p.x+=dx;if(this.can(p.x,p.z+dz))p.z+=dz}
turn(dir){if(!this.running||this.paused)return;this.hero.yaw=(this.hero.yaw+dir*.22+TAU)%TAU}
gateBlocks(x,z,r=0){
 for(const gate of this.secretGates||[]){
  if(gate.open)continue;
  const sideways=gate.side==='E'||gate.side==='W';
  if(Math.abs(x-gate.x)<(sideways?.23:.92)+r&&
     Math.abs(z-gate.z)<(sideways?.92:.23)+r)return true;
 }
 return false;
}
alert(){/* All movement is free, whether or not an enemy is present. */}
lineOfSight(x,z,tx,tz){
 const length=Math.hypot(tx-x,tz-z),steps=Math.ceil(length/.23);
 for(let i=1;i<steps;i++){
  const k=i/steps,px=x+(tx-x)*k,pz=z+(tz-z)*k;
  if(C.isSolid(px,pz)||this.gateBlocks(px,pz,.02))return false;
 }
 return true;
}
free(dt){
 const p=this.hero,turn=(this.keys.has('e')?1:0)-(this.keys.has('q')?1:0);
 if(turn)p.yaw=(p.yaw+turn*dt*2.85+TAU)%TAU;
 let a=0,b=0;
 if(this.keys.has('w')||this.keys.has('arrowup'))a++;
 if(this.keys.has('s')||this.keys.has('arrowdown'))a--;
 if(this.keys.has('d')||this.keys.has('arrowright'))b++;
 if(this.keys.has('a')||this.keys.has('arrowleft'))b--;
 const norm=Math.max(1,Math.hypot(a,b)),spd=p.dodge>0?9.7:4.65;
 const fx=Math.sin(p.yaw),fz=-Math.cos(p.yaw),rx=Math.cos(p.yaw),rz=Math.sin(p.yaw);
 const tx=(fx*a+rx*b)*spd/norm,tz=(fz*a+rz*b)*spd/norm,k=1-Math.exp(-dt*13);
 p.vx+=(tx-p.vx)*k;p.vz+=(tz-p.vz)*k;
 this.move(p.vx*dt,p.vz*dt);
}
strike(heavy){
 if(!this.running||this.paused)return false;
 const p=this.hero,w=C.project.assets.weapons[p.weapon];
 if(!w)return false;
 if(p.attack>0||this.attackAnim){
  // One buffered follow-up during recovery, never an unbounded attack queue.
  const remaining=this.attackAnim?this.attackAnim.duration-this.attackAnim.t:Infinity;
  if(remaining<.20)this.queuedStrike={heavy:!!heavy};
  return false;
 }
 const cost=w.stamina*(heavy?1.7:1);
 if(p.st<cost){C.notice('NOT ENOUGH STAMINA');return false;}
 this.alert();p.st-=cost;p.regen=heavy?.83:.51;
 const tier=Math.max(1,Math.min(4,Math.round(w.weight||w.tier||1)));
 // Blade speed ≠ raw weapon cooldown: rapid sword slashes, committed heavy
 // cleaves. Damage triggers when the animated blade crosses the aim point.
 const speed=[0,.90,.78,.72,.75][tier];
 const duration=Math.max(.30,w.cooldown*speed*(heavy?1.38:1));
 p.attack=duration;
 this.attackCount=(this.attackCount||0)+1;
 this.queuedStrike=null;
 this.attackAnim={t:0,duration,tier,heavy:!!heavy,
  side:this.attackCount%2?1:-1,hit:false,released:false,hitStop:0};
 this.hud();return true;
}
resolveStrike(heavy){
 const p=this.hero,w=C.project.assets.weapons[p.weapon];
 if(!w)return 0;
 let hits=0;
 for(const e of this.enemies){
  if(!e.alive)continue;
  const d=Math.hypot(e.x-p.x,e.z-p.z),
   dot=((e.x-p.x)*Math.sin(p.yaw)-(e.z-p.z)*Math.cos(p.yaw))/Math.max(.001,d);
  if(d<w.reach*(heavy?1.16:1)&&dot>(heavy?.13:.31)&&this.lineOfSight(p.x,p.z,e.x,e.z)){
   e.hp-=w.damage*(heavy?1.85:1);
   e.stun=heavy?.73:.27;
   e.flash=.115;hits++;
   this.emit(e.x,1,e.z,'blood');
   if(e.hp<=0)this.kill(e);
  }
 }
 if(hits){
  const weight=w.weight||1;
  this.impactPitch=heavy?-.074:-.029-.005*weight;
  this.impactRoll=this.attackAnim?.side>0?-.016:.016;
  this.impactPush=heavy?.06:.03;
  if(C.audio)C.audio.effect(heavy?'hitHeavy':'hit');
 }
 return hits;
}
kill(e){e.alive=false;this.actors.remove(e.mesh);this.hero.kills++;this.hero.souls+=e.def.reward;if(e.kind==='brute'&&this.room?.id==='room-15'){this.flags.add('bell-rung');C.notice('THE BELL KEEPER FALLS — CHAPTER COMPLETE');this.hero.hp=Math.min(100,this.hero.hp+30)}}
spell(type){if(!this.running||this.paused)return;const p=this.hero,cost=type==='ember'?22:30;if(p.mp<cost){C.notice('NOT ENOUGH ARCANA');return}p.mp-=cost;this.alert();this.emit(p.x+Math.sin(p.yaw)*1.5,1.4,p.z-Math.cos(p.yaw)*1.5,'magic');
 if(type==='veil'){p.veil=12;if(this.room?.id==='room-9')this.flags.add('veil-clue');C.notice('VEIL SIGHT — THE INVISIBLE SPEAKS')}else{for(const e of this.enemies){if(!e.alive)continue;const d=Math.hypot(e.x-p.x,e.z-p.z),dot=((e.x-p.x)*Math.sin(p.yaw)-(e.z-p.z)*Math.cos(p.yaw))/Math.max(.001,d);if(d<6&&dot>.65&&this.lineOfSight(p.x,p.z,e.x,e.z)){e.hp-=32;e.stun=.7;this.emit(e.x,1,e.z,'flame');if(e.hp<=0)this.kill(e)}}C.notice('EMBER BURST')}
 this.hud()}
dodge(){if(!this.running||this.paused||this.hero.st<24)return;this.alert();this.hero.st-=24;this.hero.dodge=.24;this.hero.regen=.85;C.notice('DODGE')}
hurt(amount){const p=this.hero;if(p.injured>0||p.dodge>.08)return;this.alert();p.hp=Math.max(0,p.hp-amount);p.injured=.8;this.emit(p.x,1,p.z,'blood');if(p.hp<=0){this.running=false;this.paused=true;$('deathText').textContent='Lost after '+p.kills+' enemies and '+this.seen.size+' discovered rooms.';$('deathPanel').classList.remove('hide');if(document.pointerLockElement)document.exitPointerLock?.()}this.hud()}
updateEnemies(dt){const p=this.hero;for(const e of this.enemies){if(!e.alive)continue;const dist=Math.hypot(e.x-p.x,e.z-p.z);e.mesh.lookAt(this.camera.position.x,e.mesh.position.y,this.camera.position.z);e.attack-=dt;e.stun=Math.max(0,e.stun-dt);e.phase+=dt;
  if(e.flash>0){e.flash=Math.max(0,e.flash-dt);e.mesh.material.color?.setHex?.(e.flash>0?0xffae91:0xffffff);}
  if(dist>17||e.stun>0)continue;
 if(dist<e.def.aggro&&this.lineOfSight(e.x,e.z,p.x,p.z)){this.alert();const dx=(p.x-e.x)/Math.max(dist,.01),dz=(p.z-e.z)/Math.max(dist,.01);if(dist>1.3){const speed=e.def.speed*(e.def.ai==='charge'&&e.phase%5<.5?2.4:1);if(this.can(e.x+dx*dt*speed,e.z+dz*dt*speed,.26)){e.x+=dx*dt*speed;e.z+=dz*dt*speed}}
 if(dist<1.35&&e.attack<=0){this.hurt(e.def.damage);e.attack=e.def.ai==='charge'?1.7:1.1}}
 e.mesh.position.set(e.x,1+Math.sin(e.phase*3)*.055,e.z)}}
emit(x,y,z,id){const d=C.project.assets.vfx[id]||C.project.assets.vfx.magic,mat=new T.MeshBasicMaterial({color:d.color,transparent:true,opacity:.8,depthWrite:false}),geo=new T.PlaneGeometry(d.size,d.size);
 for(let i=0;i<Math.min(40,d.count);i++){const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);this.actors.add(mesh);this.effects.push({mesh,vx:(Math.random()-.5)*4,vy:(Math.random()-.2)*4,vz:(Math.random()-.5)*4,life:d.life*(.5+Math.random()*.5),max:d.life,gravity:d.gravity})}}
nearest(){
 let found=null,dist=2.65;
 for(const gate of this.secretGates){
  if(gate.open||gate.opening>0)continue;
  const dx=gate.x-this.hero.x,dz=gate.z-this.hero.z,d=Math.hypot(dx,dz);
  const facing=(dx*Math.sin(this.hero.yaw)-dz*Math.cos(this.hero.yaw))/Math.max(d,.001);
  if(d<dist&&facing>.22){dist=d;found=gate}
 }
 for(const a of this.props){
  if(!a.active)continue;const d=Math.hypot(a.x-this.hero.x,a.z-this.hero.z);
  if(d<dist){dist=d;found=a}
 }
 return found;
}
interact(){if(!this.running||this.paused)return;const o=this.nearest(),p=this.hero;
 if(o?.kind==='secretGate'){
  o.opening=.00001;this.flags.add(o.id);
  C.notice('A HIDDEN PASSAGE OPENS');
  this.emit(o.x,1,o.z,'dust');
  if(C.audio)C.audio.effect('interact');
  return;
 }
 if(this.room?.id==='room-9'&&!this.flags.has('mortar-open')){const loc=this.pos(this.room,4,7);if(Math.hypot(loc.x-p.x,loc.z-p.z)<2.5){if(!this.flags.has('veil-clue')){C.notice('THE MORTAR IS HOLLOW. A VEIL HIDES SOMETHING.');return}this.flags.add('mortar-open');p.weapon='maul';this.makeWeapon();C.notice('SECRET FOUND — BONE CRUSHER');this.emit(loc.x,1,loc.z,'magic');return}}
 if(!o){C.notice('NOTHING ANSWERS');return}o.active=false;this.actors.remove(o.g);
 if(o.kind==='journal'){p.journal=true;C.notice('CARTOGRAPHER JOURNAL · PRESS M')}
 else if(o.kind==='chest'){p.weapon=p.weapon==='rust'?'axe':p.weapon==='axe'?'cleaver':'maul';this.makeWeapon();C.notice('WEAPON ACQUIRED: '+C.project.assets.weapons[p.weapon].name)}
 else if(o.kind==='relic'){p.mp=Math.min(80,p.mp+45);C.notice('ARCANA RESTORED')}
 else if(o.kind==='urn'){p.souls+=8;this.emit(o.x,.6,o.z,'dust');C.notice('8 SOULS RECOVERED')}
 else C.notice('THE FLAME FLICKERS OUT');this.hud()}
chalk(){if(!this.running||this.paused)return;const mesh=new T.Mesh(new T.BoxGeometry(.23,.02,.065),new T.MeshBasicMaterial({color:0xe8dbb0}));mesh.position.set(this.hero.x,.01,this.hero.z);mesh.rotation.y=this.hero.yaw;this.actors.add(mesh);this.marks.push(mesh);C.notice('A CHALK MARK ON THE STONE')}
map(){if(!this.hero.journal){C.notice('NO MAP — FIND THE CARTOGRAPHER JOURNAL');return}this.paused=true;$('mapPanel').classList.remove('hide');const ctx=$('mapCanvas').getContext('2d');ctx.fillStyle='#131e1b';ctx.fillRect(0,0,400,320);for(const r of Object.values(C.project.rooms)){if(!this.seen.has(r.id))continue;const x=30+r.gx*87,y=15+r.gz*72;ctx.fillStyle=r===this.room?'#a08a56':'#395e57';ctx.fillRect(x,y,75,58);ctx.strokeStyle='#b4a179';ctx.strokeRect(x,y,75,58);ctx.fillStyle='#e6d9af';ctx.font='10px monospace';ctx.fillText(r.name.slice(0,12),x+3,y+30)}}
hud(){$('hpValue').textContent=Math.ceil(this.hero.hp);$('stValue').textContent=Math.ceil(this.hero.st);$('mpValue').textContent=Math.ceil(this.hero.mp);$('hpFill').style.width=this.hero.hp+'%';$('stFill').style.width=this.hero.st+'%';$('mpFill').style.width=this.hero.mp/80*100+'%'}
update(dt){if(!this.running||this.paused)return;const p=this.hero;this.time+=dt;this.bell+=dt;p.attack=Math.max(0,p.attack-dt);p.injured=Math.max(0,p.injured-dt);p.dodge=Math.max(0,p.dodge-dt);p.regen=Math.max(0,p.regen-dt);p.veil=Math.max(0,p.veil-dt);p.st=Math.min(100,p.st+dt*(p.regen>0?8:27));p.mp=Math.min(80,p.mp+dt*2.8);
 this.free(dt);this.checkRoom();this.updateEnemies(dt);if(this.frame%15===0&&this.architecture){for(const store of this.architecture.rooms.values()){const room=store.room,x=(room.gx*9+4.5)*1.8,z=(room.gz*9+4.5)*1.8;store.group.visible=Math.hypot(x-p.x,z-p.z)<35;}}
 for(const gate of this.secretGates){if(gate.open||gate.opening<=0)continue;gate.opening+=dt;const t=Math.min(1,gate.opening/.76);gate.stone.position.y=1.64-t*3.5;gate.faint.visible=false;for(const child of gate.g.children){if(child!==gate.stone&&child!==gate.faint)child.visible=t<.36}if(t>=1){gate.open=true;gate.opening=0;gate.g.visible=false}}
 if(this.bell>(C.project.settings.bellPeriod||100)){this.bell=0;C.notice('THE DISTANT BELL TOLLS');p.mp=Math.min(80,p.mp+12)}
 for(const e of this.effects){e.life-=dt;e.vy-=e.gravity*dt;e.mesh.position.x+=e.vx*dt;e.mesh.position.y+=e.vy*dt;e.mesh.position.z+=e.vz*dt;e.mesh.lookAt(this.camera.position);e.mesh.scale.setScalar(Math.max(.01,e.life/e.max))}
 this.effects=this.effects.filter(e=>{if(e.life>0)return true;this.actors.remove(e.mesh);return false});
 for(const o of this.props)if(o.active&&o.kind!=='torch'&&o.kind!=='fireplace')o.g.children[0]?.lookAt(this.camera.position.x,.59,this.camera.position.z);
 // Baked indirect firelight remains visible across the dungeon. Spend realtime
 // light evaluations only on the three nearest flame sources for flicker/specular.
 const nearestLights=this.torches.map(t=>({t,d:Math.hypot(t.g.position.x-p.x,t.g.position.z-p.z)}))
   .sort((a,b)=>a.d-b.d);
 const realTimeBudget=C.project.editor?.quality==='low'?2:3;
 for(let i=0;i<nearestLights.length;i++){
  const {t,d}=nearestLights[i],enabled=i<realTimeBudget&&d<14;
  const flicker=.91+.09*Math.sin(this.time*12+t.phase)+.055*Math.sin(this.time*21+t.phase*1.3);
  t.light.intensity=enabled?(t.hearth?2.0:1.35)*flicker:0;
  t.flame.scale.y=1+.14*Math.sin(this.time*11+t.phase);
  if(t.flames)for(let n=0;n<t.flames.length;n++)t.flames[n].scale.y=.87+.18*Math.sin(this.time*(8+n)+t.phase+n);
 }
 this.lighting?.update(p.x,p.z,this.time);
 const nearest=this.nearest();$('interaction').textContent=nearest?'F · '+nearest.def.name.toUpperCase():'';
 if(this.frame%10===0)this.hud()}
loop(now){requestAnimationFrame(t=>this.loop(t));const dt=Math.min(.04,Math.max(0,(now-this.last)/1000));this.last=now;this.frame++;this.update(dt);
 const p=this.hero;const targetFloor=this.architecture?.floorHeightAt(p.x,p.z)||0;this.eyeFloor=(this.eyeFloor||0)+(targetFloor-(this.eyeFloor||0))*Math.min(1,dt*12);this.camera.position.set(p.x,1.62+this.eyeFloor+Math.sin(this.time*9)*(Math.hypot(p.vx,p.vz)>.35?.023:.008),p.z);this.camera.rotation.set(p.pitch,-p.yaw,0,'YXZ');this.lantern.position.copy(this.camera.position);this.lantern.position.y-=.15;
 C.WeaponRig.tick(this,this.paused?0:dt);
 // A damped directional recoil replaces the previous random camera jitter.
 const settle=Math.exp(-dt*16);
 this.impactPitch=(this.impactPitch||0)*settle;
 this.impactRoll=(this.impactRoll||0)*settle;
 this.impactPush=(this.impactPush||0)*settle;
 this.camera.rotation.x+=this.impactPitch;
 this.camera.rotation.z=this.impactRoll;
 this.camera.position.x-=Math.sin(p.yaw)*this.impactPush;
 this.camera.position.z+=Math.cos(p.yaw)*this.impactPush;
 this.renderer.render(this.scene,this.camera);if(this.frame%40===0)$('fps').textContent=Math.round(1/Math.max(.001,dt))+' FPS'}
resize(){const w=$('webgl').clientWidth||window.innerWidth,h=$('webgl').clientHeight||600,scale=(C.project.editor.quality==='low'?.6:C.project.editor.quality==='high'?1:.8);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(Math.max(320,Math.floor(w*scale)),Math.max(220,Math.floor(h*scale)),false)}
refresh(){this.buildWorld();this.resetActors();this.checkRoom(true);this.resize()}
playtest(id){this.start();const r=C.project.rooms[id];if(r){this.hero.x=(r.gx*9+4.5)*1.8;this.hero.z=(r.gz*9+4.5)*1.8;this.checkRoom(true)}}
}
C.game=new CryptGame();
})();
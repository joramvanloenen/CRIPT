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
 this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.setPixelRatio(1);$('webgl').appendChild(this.renderer.domElement);
 this.world=new T.Group();this.actors=new T.Group();this.scene.add(this.world,this.actors,this.camera);
 this.hemi=new T.HemisphereLight(0x7c9991,0x111917,.55);this.scene.add(this.hemi);
 this.lantern=new T.PointLight(0xf1ae68,1.8,9,2);this.scene.add(this.lantern);
 this.images={};this.keys=new Set();this.running=false;this.paused=false;this.mode='grid';this.time=0;this.bell=0;this.last=performance.now();this.frame=0;this.room=null;this.enemies=[];this.props=[];this.effects=[];this.torches=[];this.marks=[];this.seen=new Set();this.flags=new Set();this.chests=new Set();
 this.hero=this.freshHero();this.weaponView=new T.Group();this.camera.add(this.weaponView);this.makeWeapon();
 this.buildWorld();this.resetActors();this.bind();this.resize();window.addEventListener('resize',()=>this.resize());requestAnimationFrame(t=>this.loop(t));
}
freshHero(){return{x:4.5*1.8,z:4.5*1.8,yaw:Math.PI/2,pitch:0,vx:0,vz:0,hp:100,st:100,mp:80,weapon:'rust',souls:0,kills:0,journal:false,step:null,wait:0,attack:0,dodge:0,injured:0,regen:0,safe:0,veil:0}}
sceneTexture(asset){if(!asset)return null;if(this.images[asset.id])return this.images[asset.id];const t=new T.CanvasTexture(C.spriteCanvas(asset));t.magFilter=T.NearestFilter;t.minFilter=T.NearestFilter;t.colorSpace=T.SRGBColorSpace;this.images[asset.id]=t;return t}
pos(room,x,z){return{x:(room.gx*9+x+.5)*1.8,z:(room.gz*9+z+.5)*1.8}}
buildWorld(){
 this.world.clear();Object.values(this.images).forEach(t=>t.dispose());this.images={};
 const groups={};for(const id of Object.keys(C.project.assets.textures))groups[id]={floor:[],wall:[],roof:[]};
 for(const r of Object.values(C.project.rooms)){for(let z=0;z<9;z++)for(let x=0;x<9;x++){
  const id=r.tiles[z*9+x],loc=this.pos(r,x,z),g=groups[id];if(!g)continue;
  if(C.project.assets.textures[id].solid){if(!C.isSolid(loc.x+1.8,loc.z)||!C.isSolid(loc.x-1.8,loc.z)||!C.isSolid(loc.x,loc.z+1.8)||!C.isSolid(loc.x,loc.z-1.8))g.wall.push(loc)}
  else{g.floor.push(loc);g.roof.push(loc)}
 }}
 const box=new T.BoxGeometry(1.8,1,1.8),dummy=new T.Object3D();
 for(const [id,g]of Object.entries(groups)){const mat=new T.MeshLambertMaterial({map:this.sceneTexture(C.project.assets.textures[id])});
  for(const part of ['floor','wall','roof']){if(!g[part].length)continue;const mesh=new T.InstancedMesh(box,mat,g[part].length);mesh.frustumCulled=false;g[part].forEach((p,i)=>{dummy.position.set(p.x,part==='floor'?-0.125:part==='roof'?3.42:1.64,p.z);dummy.scale.set(1,part==='wall'?3.4:.25,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.instanceMatrix.needsUpdate=true;this.world.add(mesh)}}
 // A few strongly lit volumetric-looking fog layers; distance fog always remains active.
 const mistMat=new T.MeshBasicMaterial({color:0x416a61,transparent:true,opacity:.055,side:T.DoubleSide,depthWrite:false});
 for(let i=0;i<18;i++){const m=new T.Mesh(new T.PlaneGeometry(14,11),mistMat);m.rotation.x=-Math.PI/2;m.position.set(6+i%5*12,.045,7+Math.floor(i/5)*15);this.world.add(m)}
 const stone=new T.MeshLambertMaterial({color:0x95896d});
 for(const room of Object.values(C.project.rooms))for(const edge of room.doors){let x=(room.gx*9+4.5)*1.8,z=(room.gz*9+4.5)*1.8,rot=0;
  if(edge==='W'){x=(room.gx*9+.5)*1.8;rot=Math.PI/2}
  if(edge==='E'){x=(room.gx*9+8.5)*1.8;rot=Math.PI/2}
  if(edge==='N')z=(room.gz*9+.5)*1.8;
  if(edge==='S')z=(room.gz*9+8.5)*1.8;
  const arch=new T.Mesh(new T.BoxGeometry(2.1,.25,.4),stone);arch.rotation.y=rot;arch.position.set(x,2.85,z);this.world.add(arch);
 }
}
resetActors(){
 this.actors.clear();this.torches=[];this.enemies=[];this.props=[];this.effects=[];this.marks=[];
 for(const room of Object.values(C.project.rooms)){
  for(const e of room.enemies||[]){const def=C.project.assets.characters[e.kind];if(!def)continue;const p=this.pos(room,e.x,e.z);
   const mesh=new T.Mesh(new T.PlaneGeometry(1.25,1.85),new T.MeshBasicMaterial({map:this.sceneTexture(def),transparent:true,alphaTest:.13,side:T.DoubleSide}));mesh.position.set(p.x,1,p.z);this.actors.add(mesh);
   this.enemies.push({id:e.id,kind:e.kind,def,x:p.x,z:p.z,mesh,hp:def.hp,attack:Math.random(),stun:0,phase:Math.random()*5,alive:true})}
  for(const o of room.props||[]){const def=C.project.assets.props[o.kind];if(!def)continue;const p=this.pos(room,o.x,o.z),g=new T.Group();
   if(o.kind==='torch'){const stick=new T.Mesh(new T.CylinderGeometry(.075,.09,.86,6),new T.MeshLambertMaterial({color:0x62513b}));stick.position.y=.48;g.add(stick);
    const flame=new T.Mesh(new T.ConeGeometry(.14,.4,5),new T.MeshBasicMaterial({color:0xffbe71}));flame.position.y=1.12;g.add(flame);
    const light=new T.PointLight(0xffb46b,1.7,9.5,2);light.position.y=1.18;g.add(light);this.torches.push({g,light,flame,phase:Math.random()*10});}
   else{const plane=new T.Mesh(new T.PlaneGeometry(1.17,1.17),new T.MeshBasicMaterial({map:this.sceneTexture(def),transparent:true,alphaTest:.15,side:T.DoubleSide}));plane.position.y=.59;g.add(plane)}
   g.position.set(p.x,0,p.z);this.actors.add(g);this.props.push({id:o.id,kind:o.kind,def,x:p.x,z:p.z,g,active:true})}
 }
}
makeWeapon(){
 this.weaponView.clear();const h=this.hero,w=C.project.assets.weapons[h.weapon]||C.project.assets.weapons.rust;
 const g=new T.Group(),metal=new T.MeshStandardMaterial({color:w.color,metalness:.55,roughness:.52}),handle=new T.MeshStandardMaterial({color:0x574434,roughness:1});
 const grip=new T.Mesh(new T.CylinderGeometry(.045,.05,.45,6),handle);grip.position.y=-.23;g.add(grip);
 const blade=new T.Mesh(new T.BoxGeometry(w.weight>=3?.3:.13,w.weight>=3?.77:.63,w.weight>=3?.18:.09),metal);blade.position.y=.37;g.add(blade);
 const tip=new T.Mesh(new T.ConeGeometry(w.weight>=3?.16:.09,.24,4),metal);tip.rotation.y=Math.PI/4;tip.position.y=.81;g.add(tip);
 const guard=new T.Mesh(new T.BoxGeometry(.35,.08,.11),handle);guard.position.y=.02;g.add(guard);g.scale.setScalar(.72);this.weaponView.add(g);this.weaponView.position.set(.4,-.33,-.65);$('weaponName').textContent=w.name;
}
bind(){
 const resume=()=>this.pause(false);$('startBtn').onclick=()=>this.start();$('retryBtn').onclick=()=>this.start();$('newBtn').onclick=()=>this.start();$('resumeBtn').onclick=resume;
 $('helpBtn').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=$('closeHelp2').onclick=()=>$('helpDialog').close();
 $('mapClose').onclick=()=>{$('mapPanel').classList.add('hide');this.paused=false};
 window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||$('helpDialog').open)return;if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k))e.preventDefault();this.keys.add(k);
  if(!this.running||this.paused||e.repeat)return;
  if(k==='escape'){this.pause(true);return}if(k==='q')this.turn(-1);if(k==='e')this.turn(1);if(k==='f')this.interact();if(k==='c')this.chalk();if(k==='m')this.map();if(k==='1')this.spell('ember');if(k==='2')this.spell('veil');if(k==='shift')this.dodge();if(k===' '||k==='enter')this.strike(false)});
 window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
 window.addEventListener('blur',()=>{this.keys.clear();if(this.running)this.pause(true)});
 this.renderer.domElement.addEventListener('pointerdown',e=>{if(!this.running||this.paused)return;if(e.button===2){this.strike(true);return}if(document.pointerLockElement!==this.renderer.domElement)this.renderer.domElement.requestPointerLock?.();this.strike(false)});
 this.renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 document.addEventListener('mousemove',e=>{if(!this.running||this.paused||document.pointerLockElement!==this.renderer.domElement)return;if(this.mode==='combat')this.hero.yaw=(this.hero.yaw+e.movementX*.0024+TAU)%TAU;this.hero.pitch=clamp(this.hero.pitch-e.movementY*.002,-1.08,1.08)});
 document.querySelectorAll('[data-touch]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();const k=b.dataset.touch;if(k==='attack')this.strike(false);else if(k==='spell')this.spell('ember');else if(k==='dodge')this.dodge();else if(k==='f')this.interact();else if(k==='q')this.turn(-1);else if(k==='e')this.turn(1);else{this.keys.add(k);b.setPointerCapture(e.pointerId)}});b.addEventListener('pointerup',()=>this.keys.delete(b.dataset.touch));b.addEventListener('pointercancel',()=>this.keys.delete(b.dataset.touch))});
}
start(){this.hero=this.freshHero();this.flags.clear();this.chests.clear();this.seen.clear();this.time=0;this.bell=0;this.mode='grid';this.room=null;this.running=true;this.paused=false;this.resetActors();this.makeWeapon();$('gameOverlay').classList.add('hide');$('pausePanel').classList.add('hide');$('deathPanel').classList.add('hide');this.checkRoom(true);this.hud();C.notice('NO MAP. FIND THE JOURNAL. TRUST THE TORCHES.')}
pause(value){this.paused=value;this.keys.clear();$('pausePanel').classList.toggle('hide',!value);if(value&&document.pointerLockElement)document.exitPointerLock?.()}
checkRoom(force=false){const r=C.roomAt(this.hero.x,this.hero.z);if(!r||(!force&&r===this.room))return;this.room=r;this.seen.add(r.id);$('roomName').textContent=r.name.toUpperCase();$('roomHint').textContent=r.clue||'Listen to the stones. They are not always silent.';$('depthChip').textContent='DEPTH '+String(r.gz+1).padStart(2,'0');const a=C.project.assets.atmosphere[r.theme]||C.project.assets.atmosphere.crypt;this.scene.fog.color.set(a.fog);this.scene.fog.density=a.density;this.scene.background.set(a.fog).multiplyScalar(.21);this.hemi.intensity=a.ambient;this.lantern.intensity=a.torch*.7;if(!force)C.notice(r.name.toUpperCase())}
can(x,z,r=.29){return !C.isSolid(x-r,z-r)&&!C.isSolid(x+r,z-r)&&!C.isSolid(x-r,z+r)&&!C.isSolid(x+r,z+r)}
move(dx,dz){const p=this.hero;if(this.can(p.x+dx,p.z))p.x+=dx;if(this.can(p.x,p.z+dz))p.z+=dz}
turn(dir){if(!this.running||this.paused||this.mode!=='grid'||this.hero.step)return;this.hero.yaw=Math.round(this.hero.yaw/(Math.PI/2))*Math.PI/2+dir*Math.PI/2}
grid(dt){const p=this.hero;p.wait=Math.max(0,p.wait-dt);if(p.step){p.step.t=Math.min(1,p.step.t+dt/.23);const t=p.step.t*p.step.t*(3-2*p.step.t);p.x=p.step.x+(p.step.tx-p.step.x)*t;p.z=p.step.z+(p.step.tz-p.step.z)*t;if(p.step.t>=1)p.step=null;return}
 if(p.wait>0)return;const fx=Math.round(Math.sin(p.yaw)),fz=-Math.round(Math.cos(p.yaw)),rx=Math.round(Math.cos(p.yaw)),rz=Math.round(Math.sin(p.yaw));let dx=0,dz=0;if(this.keys.has('w')||this.keys.has('arrowup')){dx=fx;dz=fz}else if(this.keys.has('s')||this.keys.has('arrowdown')){dx=-fx;dz=-fz}else if(this.keys.has('a')||this.keys.has('arrowleft')){dx=-rx;dz=-rz}else if(this.keys.has('d')||this.keys.has('arrowright')){dx=rx;dz=rz}
 if(dx||dz){const tx=p.x+dx*1.8,tz=p.z+dz*1.8;if(this.can(tx,tz,.36)){p.step={x:p.x,z:p.z,tx,tz,t:0};p.wait=.23}}
}
alert(){if(this.mode==='combat')return;this.mode='combat';this.hero.step=null;this.hero.safe=0;$('stateChip').textContent='⚔ COMBAT';C.notice('THE DEAD AWAKEN')}
lineOfSight(x,z,tx,tz){const length=Math.hypot(tx-x,tz-z),steps=Math.ceil(length/.3);for(let i=1;i<steps;i++){const k=i/steps;if(C.isSolid(x+(tx-x)*k,z+(tz-z)*k))return false}return true}
danger(){return this.enemies.some(e=>e.alive&&Math.hypot(e.x-this.hero.x,e.z-this.hero.z)<8&&this.lineOfSight(e.x,e.z,this.hero.x,this.hero.z))||this.hero.injured>0}
free(dt){const p=this.hero;let a=0,b=0;if(this.keys.has('w'))a++;if(this.keys.has('s'))a--;if(this.keys.has('d'))b++;if(this.keys.has('a'))b--;const norm=Math.max(1,Math.hypot(a,b)),spd=p.dodge>0?9.7:4.65,fx=Math.sin(p.yaw),fz=-Math.cos(p.yaw),rx=Math.cos(p.yaw),rz=Math.sin(p.yaw),tx=(fx*a+rx*b)*spd/norm,tz=(fz*a+rz*b)*spd/norm,k=1-Math.exp(-dt*13);
 p.vx+=(tx-p.vx)*k;p.vz+=(tz-p.vz)*k;this.move(p.vx*dt,p.vz*dt);
 p.safe=this.danger()?0:p.safe+dt;
 if(p.safe>2.5&&p.dodge<=0){const gx=(Math.floor(p.x/1.8)+.5)*1.8,gz=(Math.floor(p.z/1.8)+.5)*1.8;
  if(Math.hypot(gx-p.x,gz-p.z)<.62&&this.can(gx,gz,.32)){const dx=gx-p.x,dz=gz-p.z;if(this.can(p.x+dx*.25,p.z+dz*.25)){p.x+=dx*Math.min(1,dt*8);p.z+=dz*Math.min(1,dt*8)}if(Math.hypot(gx-p.x,gz-p.z)<.04){p.x=gx;p.z=gz;p.yaw=Math.round(p.yaw/(Math.PI/2))*Math.PI/2;p.vx=0;p.vz=0;p.wait=.14;p.safe=0;this.mode='grid';$('stateChip').textContent='EXPLORING';C.notice('SILENCE RETURNS')}}else p.safe=2.2
 }
}
strike(heavy){if(!this.running||this.paused)return;const p=this.hero,w=C.project.assets.weapons[p.weapon];if(!w||p.attack>0||p.st<w.stamina*(heavy?1.7:1))return;this.alert();p.st-=w.stamina*(heavy?1.7:1);p.regen=.6;p.attack=w.cooldown*(heavy?1.45:1);this.swing=.25;this.weaponView.rotation.z=.7;let hits=0;
 for(const e of this.enemies){if(!e.alive)continue;const d=Math.hypot(e.x-p.x,e.z-p.z),dot=((e.x-p.x)*Math.sin(p.yaw)-(e.z-p.z)*Math.cos(p.yaw))/Math.max(.001,d);
 if(d<w.reach*(heavy?1.15:1)&&dot>(heavy?.1:.38)&&this.lineOfSight(p.x,p.z,e.x,e.z)){e.hp-=w.damage*(heavy?1.85:1);e.stun=heavy?.64:.23;hits++;this.emit(e.x,1,e.z,'blood');if(e.hp<=0)this.kill(e)}}
 if(hits)C.notice('IMPACT ×'+hits);this.hud()}
kill(e){e.alive=false;this.actors.remove(e.mesh);this.hero.kills++;this.hero.souls+=e.def.reward;if(e.kind==='brute'&&this.room?.id==='room-15'){this.flags.add('bell-rung');C.notice('THE BELL KEEPER FALLS — CHAPTER COMPLETE');this.hero.hp=Math.min(100,this.hero.hp+30)}}
spell(type){if(!this.running||this.paused)return;const p=this.hero,cost=type==='ember'?22:30;if(p.mp<cost){C.notice('NOT ENOUGH ARCANA');return}p.mp-=cost;this.alert();this.emit(p.x+Math.sin(p.yaw)*1.5,1.4,p.z-Math.cos(p.yaw)*1.5,'magic');
 if(type==='veil'){p.veil=12;if(this.room?.id==='room-9')this.flags.add('veil-clue');C.notice('VEIL SIGHT — THE INVISIBLE SPEAKS')}else{for(const e of this.enemies){if(!e.alive)continue;const d=Math.hypot(e.x-p.x,e.z-p.z),dot=((e.x-p.x)*Math.sin(p.yaw)-(e.z-p.z)*Math.cos(p.yaw))/Math.max(.001,d);if(d<6&&dot>.65&&this.lineOfSight(p.x,p.z,e.x,e.z)){e.hp-=32;e.stun=.7;this.emit(e.x,1,e.z,'flame');if(e.hp<=0)this.kill(e)}}C.notice('EMBER BURST')}
 this.hud()}
dodge(){if(!this.running||this.paused||this.hero.st<24)return;this.alert();this.hero.st-=24;this.hero.dodge=.24;this.hero.regen=.85;C.notice('DODGE')}
hurt(amount){const p=this.hero;if(p.injured>0||p.dodge>.08)return;this.alert();p.hp=Math.max(0,p.hp-amount);p.injured=.8;this.emit(p.x,1,p.z,'blood');if(p.hp<=0){this.running=false;this.paused=true;$('deathText').textContent='Lost after '+p.kills+' enemies and '+this.seen.size+' discovered rooms.';$('deathPanel').classList.remove('hide');if(document.pointerLockElement)document.exitPointerLock?.()}this.hud()}
updateEnemies(dt){const p=this.hero;for(const e of this.enemies){if(!e.alive)continue;const dist=Math.hypot(e.x-p.x,e.z-p.z);e.mesh.lookAt(this.camera.position.x,e.mesh.position.y,this.camera.position.z);e.attack-=dt;e.stun=Math.max(0,e.stun-dt);e.phase+=dt;if(dist>17||e.stun>0)continue;
 if(dist<e.def.aggro&&this.lineOfSight(e.x,e.z,p.x,p.z)){this.alert();const dx=(p.x-e.x)/Math.max(dist,.01),dz=(p.z-e.z)/Math.max(dist,.01);if(dist>1.3){const speed=e.def.speed*(e.def.ai==='charge'&&e.phase%5<.5?2.4:1);if(this.can(e.x+dx*dt*speed,e.z+dz*dt*speed,.26)){e.x+=dx*dt*speed;e.z+=dz*dt*speed}}
 if(dist<1.35&&e.attack<=0){this.hurt(e.def.damage);e.attack=e.def.ai==='charge'?1.7:1.1}}
 e.mesh.position.set(e.x,1+Math.sin(e.phase*3)*.055,e.z)}}
emit(x,y,z,id){const d=C.project.assets.vfx[id]||C.project.assets.vfx.magic,mat=new T.MeshBasicMaterial({color:d.color,transparent:true,opacity:.8,depthWrite:false}),geo=new T.PlaneGeometry(d.size,d.size);
 for(let i=0;i<Math.min(40,d.count);i++){const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);this.actors.add(mesh);this.effects.push({mesh,vx:(Math.random()-.5)*4,vy:(Math.random()-.2)*4,vz:(Math.random()-.5)*4,life:d.life*(.5+Math.random()*.5),max:d.life,gravity:d.gravity})}}
nearest(){let found=null,dist=2.4;for(const a of this.props){if(!a.active)continue;const d=Math.hypot(a.x-this.hero.x,a.z-this.hero.z);if(d<dist){dist=d;found=a}}return found}
interact(){if(!this.running||this.paused)return;const o=this.nearest(),p=this.hero;
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
 if(this.mode==='grid')this.grid(dt);else this.free(dt);this.checkRoom();this.updateEnemies(dt);
 if(this.bell>(C.project.settings.bellPeriod||100)){this.bell=0;C.notice('THE DISTANT BELL TOLLS');p.mp=Math.min(80,p.mp+12)}
 for(const e of this.effects){e.life-=dt;e.vy-=e.gravity*dt;e.mesh.position.x+=e.vx*dt;e.mesh.position.y+=e.vy*dt;e.mesh.position.z+=e.vz*dt;e.mesh.lookAt(this.camera.position);e.mesh.scale.setScalar(Math.max(.01,e.life/e.max))}
 this.effects=this.effects.filter(e=>{if(e.life>0)return true;this.actors.remove(e.mesh);return false});
 for(const o of this.props)if(o.active&&o.kind!=='torch')o.g.children[0]?.lookAt(this.camera.position.x,.59,this.camera.position.z);
 for(const t of this.torches){const distance=Math.hypot(t.g.position.x-p.x,t.g.position.z-p.z);t.light.intensity=distance<15?1.5+.3*Math.sin(this.time*10+t.phase):0;t.flame.scale.y=1+.14*Math.sin(this.time*11+t.phase)}
 const nearest=this.nearest();$('interaction').textContent=nearest?'F · '+nearest.def.name.toUpperCase():'';
 if(this.frame%10===0)this.hud()}
loop(now){requestAnimationFrame(t=>this.loop(t));const dt=Math.min(.04,Math.max(0,(now-this.last)/1000));this.last=now;this.frame++;this.update(dt);
 const p=this.hero;this.camera.position.set(p.x,1.62+Math.sin(this.time*9)*(p.step?.026:.01),p.z);this.camera.rotation.set(p.pitch,-p.yaw,0,'YXZ');this.lantern.position.copy(this.camera.position);this.lantern.position.y-=.15;
 this.swing=Math.max(0,(this.swing||0)-dt);this.weaponView.rotation.z+=(this.swing>0?-.38:0-this.weaponView.rotation.z)*Math.min(1,dt*13);this.weaponView.position.y=-.33+Math.sin(this.time*8)*.014;
 this.renderer.render(this.scene,this.camera);if(this.frame%40===0)$('fps').textContent=Math.round(1/Math.max(.001,dt))+' FPS / '+(this.mode==='grid'?'GRID':'FREE')}
resize(){const w=$('webgl').clientWidth||window.innerWidth,h=$('webgl').clientHeight||600,scale=(C.project.editor.quality==='low'?.6:C.project.editor.quality==='high'?1:.8);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(Math.max(320,Math.floor(w*scale)),Math.max(220,Math.floor(h*scale)),false)}
refresh(){this.buildWorld();this.resetActors();this.checkRoom(true);this.resize()}
playtest(id){this.start();const r=C.project.rooms[id];if(r){this.hero.x=(r.gx*9+4.5)*1.8;this.hero.z=(r.gz*9+4.5)*1.8;this.checkRoom(true)}}
}
C.game=new CryptGame();
})();
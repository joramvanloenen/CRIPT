/* CRIPT / Ashlar — purpose-built stone architecture.
   Geometry is assembled in this order:
   foundation -> bonded wall courses -> openings and load-bearing piers ->
   vault/ribs -> fittings -> weathering.  All small components are instanced. */
(function(){
'use strict';
const C=window.Cript,T=window.THREE;
if(!C||!T)return;
const S=1.8,TAU=Math.PI*2;
const lim=(n,a,b)=>Math.max(a,Math.min(b,n));
const fract=n=>n-Math.floor(n);
function hash(a,b=0,c=0){return fract(Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453)}
const profiles={
 entrance:{height:5.5,vault:'barrel',decay:.22,role:'gatehouse'},
 combat:{height:4.2,vault:'cross',decay:.37,role:'guard hall'},
 tomb:{height:4.7,vault:'cross',decay:.43,role:'burial chamber'},
 trap:{height:3.35,vault:'flat',decay:.3,role:'defensive passage'},
 shrine:{height:7.2,vault:'ribbed',decay:.27,role:'chapel'},
 treasure:{height:3.4,vault:'flat',decay:.17,role:'secure vault'},
 empty:{height:3.55,vault:'flat',decay:.78,role:'abandoned storeroom'},
 merchant:{height:3.25,vault:'flat',decay:.17,role:'underground market'},
 secret:{height:3.15,vault:'flat',decay:.68,role:'sealed burial'},
 item:{height:3.7,vault:'barrel',decay:.28,role:'armory'},
 sanctuary:{height:4.1,vault:'cross',decay:.15,role:'rest chamber'},
 boss:{height:8.7,vault:'ribbed',decay:.63,role:'fallen cathedral'}
};
function config(room){
 const preset=profiles[room.category]||profiles.combat;
 return{height:lim(Number(room.ceilingHeight)||preset.height,3,10),
  vault:['flat','barrel','cross','ribbed'].includes(room.vaultStyle)?room.vaultStyle:preset.vault,
  decay:lim(Number.isFinite(+room.decay)?+room.decay:preset.decay,0,1),
  role:preset.role,archStyle:room.archStyle==='round'||room.archStyle==='pointed'?room.archStyle:(preset.vault==='ribbed'?'pointed':'round')};
}
function materialSurface(geo){
 // Author world-scale UVs per stone, even when courses use different shapes.
 const uv=geo.getAttribute('uv'),pos=geo.getAttribute('position'),nor=geo.getAttribute('normal');
 if(!uv||!pos||!nor)return geo;
 for(let i=0;i<uv.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  const nx=nor.getX(i),ny=nor.getY(i),nz=nor.getZ(i);
  const u=Math.abs(nx)>.5?z/S:x/S, v=Math.abs(ny)>.5?z/S:y/S;
  uv.setXY(i,u,v);
 }
 uv.needsUpdate=true;return geo;
}
class Masonry{
 constructor(world,project,texture){
  this.world=world;this.project=project;this.texture=texture;this.geom=new Map();
  this.mats=new Map();this.rooms=new Map();this.colliders=[];this.count={blocks:0,arches:0,vaults:0,rubble:0,wallBaseDebris:0,rooms:0,modeled:0,models:new Set()};
  this.unit=new T.Object3D();
  this.surfaceTextures=[];
  for(const [id,asset]of Object.entries(project.assets.textures)){
   const quality=project.editor?.quality||'medium';
   if(!C.StoneMaterials)throw Error('Procedural stone generator not loaded');
   for(const cut of [false,true]){
    const surface=C.StoneMaterials.textures(T,asset,{quality,cut});
    this.surfaceTextures.push(surface.diffuse,surface.normal,surface.roughness);
    this.mats.set(cut?id+':cut':id,new T.MeshStandardMaterial({
     map:surface.diffuse,normalMap:surface.normal,roughnessMap:surface.roughness,
     normalScale:new T.Vector2(cut?.48:.95,cut?.48:.95),
     roughness:1,metalness:0,color:0xffffff,side:T.FrontSide
    }));
   }
  }
  for(const [id,color]of Object.entries({mortar:0x192525,shadow:0x101d1c,trim:0x889187,ivory:0xbeb99f,soot:0x343c38,iron:0x514b42,wood:0x564b38,lichen:0x4b7561,gold:0xb59a70,glass:0x98d6b9,light:0xcddcc0,water:0x2c645d})){
   this.mats.set(id,new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:id==='iron'?.61:id==='glass'?.28:.95,metalness:id==='iron'?.28:0}));
  }
 }
 geometry(w,h,d){
  const key=[w,h,d].map(v=>v.toFixed(2)).join(':');
  if(!this.geom.has(key))this.geom.set(key,materialSurface(new T.BoxGeometry(w,h,d)));
  return{key,geometry:this.geom.get(key)};
 }
 archSegment(index,segments,radius,outer,depth,style='round'){
  const key='forged-arch:'+[index,segments,radius,outer,depth,style].join(':');
  if(!this.geom.has(key)){
   const start=Math.PI*index/segments,end=Math.PI*(index+1)/segments,eps=.010;
   const point=(angle,r)=>[
    Math.cos(angle)*r,
    (Math.sin(angle)+(style==='pointed'?.32*(1-Math.abs(Math.cos(angle))):0))*r
   ];
   const outline=[point(start+eps,radius),point(start+eps,outer),
                  point(end-eps,outer),point(end-eps,radius)];
   const result=C.MeshForge.extrude(outline,{depth,bevel:.011,erosion:.04,seed:index+17});
   this.geom.set(key,C.MeshForge.toThree(T,result));
   this.count.modeled++;this.count.models.add('gothic-voussoir');
  }
  return{key,geometry:this.geom.get(key)};
 }
 collider(room,x,z,w,d,yaw=0){
  const co=Math.abs(Math.cos(yaw)),si=Math.abs(Math.sin(yaw));
  this.colliders.push({room:room.id,x,z,hx:(w*co+d*si)/2,hz:(d*co+w*si)/2});
 }
 blocked(x,z,r=.28){
  for(const c of this.colliders){
   if(Math.abs(x-c.x)<c.hx+r&&Math.abs(z-c.z)<c.hz+r)return true;
  }
  return false;
 }
 roomStore(room){
  if(!this.rooms.has(room.id)){const group=new T.Group();group.name='Masonry / '+room.name;this.world.add(group);this.rooms.set(room.id,{group,buckets:new Map(),room});this.count.rooms++}
  return this.rooms.get(room.id);
 }
 instance(room,matId,geoKey,geometry,x,y,z,rx=0,ry=0,rz=0,color=null,scale=null){
  const store=this.roomStore(room),key=matId+'|'+geoKey;
  if(!store.buckets.has(key))store.buckets.set(key,{geometry,material:this.mats.get(matId)||this.mats.get('trim'),instances:[]});
  store.buckets.get(key).instances.push({x,y,z,rx,ry,rz,color,scale});
 }
 box(room,material,x,y,z,w,h,d,rotationY=0,rotationZ=0,color=null){
  if(w<=0||h<=0||d<=0)return;
  const g=this.geometry(w,h,d);
  this.instance(room,material,g.key,g.geometry,x,y,z,0,rotationY,rotationZ,color);
  this.count.blocks++;
 }
 modeled(room,material,id,x,y,z,w,h,d,yaw=0,color=null,seedOffset=0){
  const recipe=this.project.assets.meshes?.[id]||C.MeshForge.presets[id];
  if(!recipe)return this.box(room,material,x,y,z,w,h,d,yaw,0,color);
  const key='forged:'+id+':'+(recipe.seed||1)+':'+seedOffset+':'+JSON.stringify(recipe);
  if(!this.geom.has(key)){
   const shape=C.MeshForge.build({...recipe,seed:(recipe.seed||1)+seedOffset});
   const report=C.MeshForge.audit(shape);
   if(!report.valid)throw Error('Invalid modeled mesh '+id+': '+report.errors.join('; '));
   this.geom.set(key,C.MeshForge.toThree(T,shape));
  }
  const bounds=this.geom.get(key).getAttribute('position');
  // Compute dimensions once per recipe. Source assets have actual dimensions.
  if(!this._forgedDimensions)this._forgedDimensions=new Map();
  let size=this._forgedDimensions.get(key);
  if(!size){
   const pos=bounds.array||[];
   const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<pos.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],pos[i]);max[axis]=Math.max(max[axis],pos[i]);}
   size=max.map((n,i)=>Math.max(.001,n-min[i]));
   this._forgedDimensions.set(key,size);
  }
  this.instance(room,material,key,this.geom.get(key),x,y,z,0,yaw,0,color,
   [w/size[0],h/size[1],d/size[2]]);
  this.count.modeled++;this.count.models.add(id);
 }
 slab(room,material,x,y,z,w,h,d,rotation=0,tint=null){this.box(room,material,x,y,z,w,h,d,0,rotation,tint)}
 xz(room,x,z){return[(room.gx*9+x+.5)*S,(room.gz*9+z+.5)*S]}
 palette(room){return room.theme==='sand'?'goldstone':room.theme==='void'?'stone':room.category==='tomb'?'moss':'stone'}
 tint(room,x,y,z){
  const n=hash(room.gx*67+x*.91,room.gz*67+z*.71,y*8);
  const warm=room.theme==='sand';
  if(n<.045)return new T.Color(warm?0x72614a:0x3c5148);
  if(n>.95)return new T.Color(warm?0xb8a17c:0x92a79b);
  const grey=Math.round(220+n*33);
  return new T.Color().setRGB(grey/255,grey/255,grey/255);
 }
 tile(room,x,z){return room.tiles[z*9+x]}
 ground(room,x,z,mat){
  const [cx,cz]=this.xz(room,x,z),erosion=Number.isFinite(room.decay)?room.decay:.3;
  // Continual flagstone UVs describe joints while a few chipped pieces break silhouette.
  this.box(room,mat,cx,-.095,cz,S-.018,.19,S-.018,0,0,this.tint(room,x,0,z));
  const n=hash(x*7,z*9,room.gx*9+room.gz);
  if(n<erosion*.22){
   const shift=(n-.5)*.26;
   this.box(room,mat+':cut',cx+shift,.025,cz-.29,.76,.055,.63,n*.1,0,this.tint(room,x,0,z));
  }
 }
 wallBaseDebris(room,x,z,dir,decay){
  const mat=this.palette(room)+':cut',[cx,cz]=this.xz(room,x,z);
  const dx=dir==='E'?1:dir==='W'?-1:0,dz=dir==='S'?1:dir==='N'?-1:0;
  // The debris follows a genuine wall/floor contact line. Blocks are carried
  // outward from the wall, leaving the walkable middle of corridors clear.
  const alongX=dz!==0,amount=2+Math.floor(decay*6);
  for(let i=0;i<amount;i++){
   const n=hash(cx+i*3.9,cz+i*8.7,room.gx*37+room.gz*13);
   if(n>.61+decay*.22)continue;
   const along=(i+.38+n*.34)/amount*1.65-.82;
   const inset=.94+hash(x+i*4,z+i*3,79)*.28;
   const px=cx+dx*inset+(alongX?along:0);
   const pz=cz+dz*inset+(alongX?0:along);
   const size=.12+n*.32;
   const h=.05+hash(i,x,z)*.15;
   const kind=hash(x*15+i,z*7+i,91)>.33?'rock:dodeca':'rock:tetra';
   if(!this.geom.has(kind)){
    const geo=kind==='rock:dodeca'?new T.DodecahedronGeometry(.5,0):new T.TetrahedronGeometry(.5,0);
    this.geom.set(kind,geo);
   }
   this.instance(room,mat,kind,this.geom.get(kind),px,h*.61,pz,
    n*.22,hash(i,z,x)*6.283,n*.33,this.tint(room,px,h,pz),
    [size*2,h*2,size*(1.25+n*.85)]);
   this.count.wallBaseDebris++;
   // Thin fines that collect in the last centimeters of the wall.
   if(i%3===0){
    this.box(room,'soot',px+dx*.08,.014,pz+dz*.08,size*.93,.018,size*.76,0,n*.4);
   }
  }
 }
 courseWall(room,x,z,dir,height,decay){
  const mat=this.palette(room),[cx,cz]=this.xz(room,x,z);
  const dx=dir==='E'?1:dir==='W'?-1:0,dz=dir==='S'?1:dir==='N'?-1:0;
  const eastWest=dx!==0;
  const fx=cx+dx*(S*.5-.10),fz=cz+dz*(S*.5-.10);
  // One tall wall panel with a mathematical ashlar bond; no UV stretching
  // and no costly wall of individually drawn cubes.
  this.box(room,mat,fx,height/2,fz,eastWest?.22:S,height,eastWest?S:.22,0,0);
  const sparse=hash(x*17,z*13,room.gx*19+room.gz*23);
  if(sparse<.26+decay*.20){
   const rows=Math.max(3,Math.floor(height/.66));
   const y=(1+Math.floor(hash(x,z,45)*(rows-1)))*(height/rows);
   const offset=hash(x*13,z*19,13)>.5?-.44:.44;
   const xx=fx+(eastWest?dx*.12:offset),zz=fz+(eastWest?offset:dz*.12);
   this.modeled(room,mat+':cut','chipped-stone',xx,y,zz,eastWest?.11:.64,.39,eastWest?.64:.11,0,this.tint(room,x,y,z),(x+z)%3);
  }
  // Quoins and heavy buttresses remain modeled stone for strong silhouettes.
  if((x+z)%3===0){
   const px=cx+dx*(S*.47),pz=cz+dz*(S*.47);
   this.box(room,mat+':cut',px,.24,pz,eastWest?.38:.53,.48,eastWest?.53:.38,0,0,this.tint(room,x,0,z));
   this.box(room,mat+':cut',px,height*.54,pz,eastWest?.23:.33,height*.67,eastWest?.33:.23);
   this.box(room,'trim',px,height-.18,pz,eastWest?.44:.54,.23,eastWest?.54:.44);
  }
  this.wallBaseDebris(room,x,z,dir,decay);
 }
 pier(room,x,z,height){
  const [cx,cz]=this.xz(room,x,z),mat=this.palette(room)+':cut',n=room.decay;
  for(let y=.3;y<height;y+=.52){
   this.modeled(room,mat,'chipped-stone',cx,y,cz,.82,Math.min(.5,height-y+.2),.82,0,this.tint(room,x,y,z),Math.round(y*2)%3);
  }
  for(const h of [.19,height-1.0,height-.21]){
   this.box(room,'trim',cx,h,cz,h===height-.21?1.12:1.01,.24,h===height-.21?1.12:1.01);
  }
  if(n>.4){this.box(room,'soot',cx+.42,1.1,cz+.14,.017,.45,.065,0,-.22)}
 }
 arch(room,cx,cz,yaw=0,scale=1,base=2.04,material=null,styleOverride=null){
  const mat=(material||this.palette(room))+':cut',r=.87*scale,outer=1.16*scale,segments=11;
  const style=styleOverride||config(room).archStyle;
  // Left and right springers rest on square piers; the key stone locks the arch.
  const side=x=>{const xx=cx+Math.cos(yaw)*x,zz=cz-Math.sin(yaw)*x;
   for(let i=0;i<5;i++){const cy=(i+.5)*base/5;
    this.modeled(room,mat,'chipped-stone',xx,cy,zz,.39*scale,base/5-.018,.52*scale,yaw,this.tint(room,cx+i,cy,cz),i%2)}
  };
  side(-1.13*scale);side(1.13*scale);
  for(let i=0;i<segments;i++){
   const a=this.archSegment(i,segments,r,outer,.49*scale,style);
   const tint=i===Math.floor(segments/2)?new T.Color(0xb2b9aa):this.tint(room,cx+i*.13,base,cz);
   this.instance(room,mat,a.key,a.geometry,cx,base,cz,0,yaw,0,tint);this.count.arches++;
  }
  // A heavy crowned keystone visible from a distance.
  const crown=base+outer*(style==='pointed'?1.32:1)-.025;
  this.modeled(room,'trim','carved-capital',cx,crown,cz,.32*scale,.28*scale,.58*scale,yaw);
 }
 doorway(room,edge,cfg){
  // Two adjacent chambers can share one physical threshold. Decorate each visible side
  // but leave the 1.8-m traversal aperture free of decoration/collision.
  const [x,z]=this.xz(room,4,4);
  let px=x,pz=z,yaw=0;
  if(edge==='E'){px=(room.gx*9+9)*S;yaw=Math.PI/2}
  if(edge==='W'){px=room.gx*9*S;yaw=Math.PI/2}
  if(edge==='S')pz=(room.gz*9+9)*S;
  if(edge==='N')pz=room.gz*9*S;
  this.arch(room,px,pz,yaw,1,2.03);
  this.box(room,'trim',px,.04,pz,edge==='E'||edge==='W'?.5:2.4,.08,edge==='E'||edge==='W'?2.4:.5);
  // Offset buttress stones to visually resolve the load into the flanking wall.
  const xAlong=edge==='E'||edge==='W'?0:1,zAlong=edge==='E'||edge==='W'?1:0;
  for(const dir of [-1,1]){
   this.box(room,this.palette(room),px+dir*xAlong*1.48,1.0,pz+dir*zAlong*1.48,
     edge==='E'||edge==='W'?.51:.67,2.02,edge==='E'||edge==='W'?.67:.51);
  }
 }
 ceiling(room,cfg){
  const mat=this.palette(room),[centerX,centerZ]=this.xz(room,4,4),height=cfg.height;
  if(cfg.vault==='flat'){
   for(let z=1;z<8;z++)for(let x=1;x<8;x++){
    const [cx,cz]=this.xz(room,x,z);
    if(this.tile(room,x,z)==='stone')continue;
    if(room.skylight&&x>=3&&x<=5&&z>=3&&z<=5)continue;
    this.box(room,mat,cx,height+.03,cz,S-.026,.25,S-.026);
   }
   // Low barrel rooms use crossbeams/corbels instead of giant church ribs.
   for(let z=2;z<=6;z+=2)this.box(room,'wood',centerX,height-.36,(room.gz*9+z+.5)*S,12.6,.23,.38);
   return;
  }
  const half=6.1,rise=cfg.vault==='ribbed'?2.65:1.85,spring=height-rise;
  const segments=12,step=half*2/segments;
  // A series of voussoir slabs forms a load-bearing elliptical barrel vault.
  // Slabs follow the tangent of the curve rather than being scaled vertical cubes.
  for(let bay=0;bay<3;bay++){
   const z=centerZ-4.2+bay*4.2;
   for(let i=0;i<segments;i++){
    // A weathered-away crown in the central bay exposes a real skylight.
    if(room.skylight&&bay===1&&(i===5||i===6))continue;
    const xa=-half+i*step,xb=xa+step;
    const ya=spring+rise*Math.sqrt(Math.max(0,1-(xa/half)**2));
    const yb=spring+rise*Math.sqrt(Math.max(0,1-(xb/half)**2));
    const angle=Math.atan2(yb-ya,xb-xa),len=Math.hypot(step,yb-ya);
    this.slab(room,mat,centerX+(xa+xb)/2,(ya+yb)/2,z,len+.025,.19,4.19,angle);
    this.count.vaults++;
   }
  }
  const ribPlaces=[centerZ-6.24,centerZ-2.1,centerZ+2.1,centerZ+6.24];
  for(const z of ribPlaces)for(let i=0;i<segments;i++){
   if(room.skylight&&Math.abs(z-centerZ)<2.2&&(i===5||i===6))continue;
   const xa=-half+i*step,xb=xa+step,ya=spring+rise*Math.sqrt(Math.max(0,1-(xa/half)**2));
   const yb=spring+rise*Math.sqrt(Math.max(0,1-(xb/half)**2));
   const angle=Math.atan2(yb-ya,xb-xa),len=Math.hypot(step,yb-ya);
   this.slab(room,'trim',centerX+(xa+xb)/2,(ya+yb)/2-.14,z,len+.04,.22,.35,angle);
  }
  for(const z of ribPlaces){this.box(room,'ivory',centerX,height-.19,z,.55,.18,.57)}
  // Cross-vaults receive ribs in both directions. Gothic chapels carry higher ribs.
  if(cfg.vault==='cross'||cfg.vault==='ribbed'){
   for(const x of [centerX-2.8,centerX+2.8]){
    for(let j=0;j<8;j++){
     const zz=-6+j*1.5,frac=zz/6,yn=spring+rise*Math.sqrt(Math.max(0,1-frac*frac));
     this.box(room,'trim',x,yn-.2,centerZ+zz,.20,.24,1.55,0,0);
    }
   }
  }
  // Tie rods hidden above spring line; exposed capitals at their bearings.
  for(const xx of [centerX-6.14,centerX+6.14])for(const zz of ribPlaces.slice(1,3)){
   this.box(room,'trim',xx,spring-.2,zz,.62,.37,.59);
   this.box(room,mat,xx,spring*.52,zz,.34,spring,.4);
  }
 }
 purpose(room,cfg){
  const role=room.category,mat=this.palette(room),[x,z]=this.xz(room,4,4);
  // The ceremonial end of a chamber must face a solid structural wall,
  // never the route by which workers, mourners or the player entered.
  const backWall=['N','S','E','W'].find(side=>!room.doors.includes(side))||'N';
  const angle=backWall==='S'?Math.PI:backWall==='E'?Math.PI/2:backWall==='W'?-Math.PI/2:0;
  const cs=Math.cos(angle),sn=Math.sin(angle),yaw=-angle;
  const off=(dx,dz)=>[x+(dx*cs-dz*sn)*S,z+(dx*sn+dz*cs)*S];
  const place=(material,dx,y,dz,w,h,d)=>{const [px,pz]=off(dx,dz);this.box(room,material,px,y,pz,w,h,d,yaw);return[px,pz]};
  const plinth=(dx,dz,w,d,h=.4,finish=mat)=>{const [px,pz]=off(dx,dz);this.box(room,finish,px,h/2,pz,w,h,d,yaw);this.box(room,'trim',px,h+.08,pz,w+.18,.16,d+.18,yaw);return[px,pz]};
  if(role==='entrance'){
   // A gatehouse has a broad axial vestibule, paired plinths and relief plaques.
   for(const dx of [-3,3]){
    plinth(dx,-1.65,1.38,1.1,.5);
    place(mat,dx,1.35,-1.65,.83,1.5,.82);
    place('trim',dx,2.2,-1.65,1.15,.22,1.12);
   }
   const [px,pz]=off(0,-2.5);this.arch(room,px,pz,yaw,1.2,2.2);
  }else if(role==='shrine'||role==='boss'){
   // The stone staircase climbs to a raised sanctuary; landings and steps
   // are separate courses, a practical solution for a high altar floor.
   plinth(0,-2.75,6.2,2.1,.42,'trim');
   for(let i=0;i<5;i++){
    const elevation=(i+1)*.07;
    place('trim',0,elevation/2+.01,-.87-i*.34,4.45,elevation,.4);
    place(mat,0,elevation+.025,-.87-i*.34,4.33,.04,.37);
   }
   place('trim',0,.33,-1.40,6.4,.22,1.15);
   place(mat,0,1.10,-2.75,2.75,1.18,1.3);
   {const [bx,bz]=off(0,-2.75);this.collider(room,bx,bz,2.8,1.32,yaw)}
   place('ivory',0,1.76,-2.75,2.98,.16,1.5);
   // Cathedral bay: actual turned/fluted column shafts, modeled bases and
   // carved capitals. The asset can be remodeled in Mesh Forge and reused.
   for(const dx of [-3.05,3.05])for(const dz of [-1.9,1.3]){
    const [px,pz]=off(dx,dz),height=Math.max(2.6,cfg.height*.66);
    this.modeled(room,mat,'fluted-column',px,0,pz,.73,height,.73,yaw);
    this.modeled(room,'trim','carved-capital',px,height-.12,pz,1.07,.38,1.03,yaw);
    this.collider(room,px,pz,.8,.8,yaw);
   }
   for(const dx of [-2.6,2.6]){
    for(let i=0;i<4;i++){
     const dz=-2.2+i*.85;
     place('trim',dx,.24,dz,.72,.48,.83);
     place('wood',dx,.69,dz,.7,.13,.76);
    }
   }
   // High cinquefoil clerestory: narrow glazed lights with stone mullions,
   // all within a reinforced rectangular surround.
   for(let j=0;j<5;j++){
    const dx=(j-2)*.30;
    place('shadow',dx,cfg.height*.70,-3.40,.36,2.35,.09);
    place('glass',dx,cfg.height*.70,-3.34,.26,2.0,.047);
    place('ivory',dx,cfg.height*.70,-3.30,.047,2.05,.065);
   }
   for(const dx of [-.94,.94]){
    place('ivory',dx,cfg.height*.7,-3.30,.09,2.6,.20);
   }
   place('ivory',0,cfg.height*.7+1.23,-3.29,2.1,.21,.22);
   if(role==='boss'){
    // Monumental engaged piers and a bell-wheel relief over the altar.
    for(const dx of [-1.9,1.9])place('trim',dx,3.5,-2.75,.73,3.5,.75);
    place('gold',0,cfg.height*.56,-3.15,.46,.52,.20);
    // Hanging bell with a profile-modeled flared bronze skirt.
    const [bellX,bellZ]=off(0,-2.65);
    this.modeled(room,'gold','bell',bellX,cfg.height*.64,bellZ,1.3,1.32,1.3,yaw);

   }
  }else if(role==='tomb'||role==='secret'){
   // Burial wall: two side sarcophagi, sunken stone niches, memorial slabs.
   for(const dx of [-2.65,2.65]){
    const [px,pz]=plinth(dx,-1.6,1.3,2.6,.31,mat);
    this.modeled(room,mat,'stone-sarcophagus',px,.64,pz,1.12,.80,2.38,yaw);
    this.collider(room,px,pz,1.18,2.4,yaw);
    this.box(room,'shadow',px,2.1,pz-1.25,.9,1.7,.12);
    this.arch(room,px,pz-1.18,0,.52,2.03,mat);
   }
  }else if(role==='merchant'||role==='item'||role==='treasure'){
   // Goods move on dry raised stone shelves. The aisle stays wide for traffic.
   for(const side of [-1,1])for(let i=0;i<3;i++){
    const [px,pz]=off(side*2.9,-2.25+i*2);
    this.box(room,mat,px,.51,pz,.95,.9,1.58);
    this.collider(room,px,pz,.98,1.6,yaw);
    this.box(room,role==='item'?'iron':'wood',px,1.05,pz,1.07,.15,1.6);
    this.box(room,'trim',px,.17,pz,1.15,.28,1.8);
   }
   if(role==='treasure')plinth(0,-2.65,2.65,1.7,.55,'trim');
  }else if(role==='trap'){
   // Guarded choke with brackets for a falling iron portcullis.
   for(const dx of [-1.7,1.7]){const [px,pz]=off(dx,-1.25);
    this.box(room,'trim',px,1.52,pz,.48,3,.58);
    this.box(room,'iron',px,cfg.height-.62,pz,.55,.23,.6);
   }
   this.box(room,'iron',x,cfg.height-.3,z-1.25*S,3.2,.25,.36);
  }else if(role==='sanctuary'){
   for(const dx of [-2.9,2.9]){
    const [px,pz]=off(dx,-1.3);
    this.box(room,'wood',px,.52,pz,.6,.2,2.6);
    this.box(room,'wood',px,.3,pz,.13,.52,2.4);
   }
   plinth(0,-2.5,1.9,1.3,.29,'trim');
  }else if(role==='combat'){
   // Defensive hall: embedded arrow slits, spear racks, long side benches.
   for(const dx of [-2.95,2.95]){
    const [px,pz]=off(dx,-1.7);this.box(room,'wood',px,.47,pz,.78,.19,2.3);
    this.box(room,'wood',px,.25,pz,.19,.52,2.2);
    this.box(room,'shadow',px,2.2,pz-.73,.5,1.13,.09);
   }
  }else if(role==='empty'){
   // A derelict store stays deliberately bare: only collapsed support beams.
   this.box(room,'wood',x-3.5,1.0,z-1.8,3.9,.18,.2,0,-.25);
  }
 }
 gallery(room,cfg){
  // A substantial new architectural layer, present even in already-saved worlds.
  // Gothic blind arches, load-bearing engaged shafts and stone ribs deliberately
  // break large stretches of planar wall; no primitive tile is treated as a prop.
  const [x,z]=this.xz(room,4,4),mat=this.palette(room),h=cfg.height;
  const monumental=['entrance','shrine','boss','sanctuary'].includes(room.category);
  const scale=monumental?1.16:.91;
  const base=Math.min(monumental?2.58:1.98,h-(monumental?1.85:1.40));
  const cells=[
   {dir:'N',yaw:0,cx:x,cz:(room.gz*9+1.18)*S},
   {dir:'S',yaw:0,cx:x,cz:(room.gz*9+7.82)*S},
   {dir:'W',yaw:Math.PI/2,cx:(room.gx*9+1.18)*S,cz:z},
   {dir:'E',yaw:Math.PI/2,cx:(room.gx*9+7.82)*S,cz:z}
  ];
  const depth=monumental?2:1;
  for(const side of cells){
   // Existing doorways stay unobstructed, including hidden door reveals.
   if((room.doors||[]).includes(side.dir))continue;
   this.arch(room,side.cx,side.cz,side.yaw,scale,base,null,'pointed');
   const transverse=side.yaw===0;
   for(const sign of [-1,1]){
    const offset=sign*scale*1.38;
    const px=side.cx+(transverse?offset:0),pz=side.cz+(transverse?0:offset);
    const shaftHeight=Math.min(h-.25,base+1.35*scale);
    this.modeled(room,mat,'fluted-column',px,0,pz,.38*scale,shaftHeight,.38*scale,side.yaw);
    this.modeled(room,'ivory','carved-capital',px,shaftHeight-.10,pz,.66*scale,.30,.66*scale,side.yaw);
   }
   const head=base+1.2*scale;
   this.modeled(room,'ivory','vault-rib',side.cx,head,side.cz,
    scale*2.35,.38,scale*.27,side.yaw);
   this.count.galleries=(this.count.galleries||0)+1;
  }
  // First room's huge ribbed portal is directly in the initial eastward
  // field of view. This is purpose-built visual architecture, not an editor-only asset.
  if(room.category==='entrance'){
   const portalX=x+3.8,portalZ=z;
   this.arch(room,portalX,portalZ,Math.PI/2,1.42,2.32,null,'pointed');
   for(const dz of [-2.05,2.05]){
    this.modeled(room,mat,'fluted-column',portalX,0,portalZ+dz,.55,3.48,.55,Math.PI/2);
    this.modeled(room,'ivory','carved-capital',portalX,3.44,portalZ+dz,.86,.34,.86,Math.PI/2);
   }
   // A pointed ceremonial lintel and key stone visible before the player moves.
   this.modelledPortalInscription(room,portalX,portalZ,4.18);
   this.count.heroPortals=(this.count.heroPortals||0)+1;
  }
  // Taller rooms also carry cross-vault ribs between the pillars, high overhead.
  if(monumental){
   for(const side of [-1,1]){
    this.modeled(room,'trim','vault-rib',x,h-.69,z+side*3.0,
      9.2,2.3,.29,0);
    this.count.ribbedBays=(this.count.ribbedBays||0)+1;
   }
  }
 }
 modelledPortalInscription(room,x,z,height){
  const mat=this.palette(room);
  this.modeled(room,'ivory','gothic-voussoir',x,height,z,.67,.58,.36,Math.PI/2);
  for(const dz of [-1.1,-.55,0,.55,1.1]){
   this.modeled(room,mat,'chipped-stone',x,height+.55,z+dz,.32,.18,.23,Math.PI/2);
  }
 }
 weather(room,cfg){
  const mat=this.palette(room),decay=cfg.decay;
  for(let z=1;z<8;z++)for(let x=1;x<8;x++){
   if(this.tile(room,x,z)==='stone')continue;
   const roll=hash(room.gx*33+x,room.gz*37+z,84);
   if(roll>decay*.39)continue;
   const [px,pz]=this.xz(room,x,z),side=hash(x,z,55);
   // Leave central travel and encounter space usable; rubble accumulates at walls.
   if(x>2&&x<6&&z>2&&z<6)continue;
   if((x===4&&(z===1||z===7))||(z===4&&(x===1||x===7)))continue;
   for(let k=0;k<2+Math.floor(decay*5);k++){
    const rnd=hash(x*8+k,z*15+k,room.gx*9+room.gz);
    const xx=px+(rnd-.5)*1.15,zz=pz+(hash(x,k,z*3)-.5)*1.1;
    const rubbleSizes=[[.17,.08,.22],[.28,.13,.26],[.38,.18,.35],[.25,.10,.44]];
    const [w,h,d]=rubbleSizes[Math.floor(rnd*rubbleSizes.length)];
    this.modeled(room,rnd>.8?'trim':mat+':cut','chipped-stone',xx,h/2+.03,zz,w,h,d,0,this.tint(room,xx,h,zz),k%3);this.count.rubble++;
   }
  }
  // Soot blooms and moss at the base of exposed masonry are age-dependent.
  if(decay>.22){
   for(let z=1;z<8;z++)for(let x=1;x<8;x++){
    if(!this.project.assets.textures[this.tile(room,x,z)]?.solid)continue;
    const r=hash(x,z,room.gx*9+room.gz*11);
    if(r>decay*.30)continue;
    const [px,pz]=this.xz(room,x,z);
    this.box(room,'lichen',px,.035,pz,.6,.024,.75,0,(r-.5)*.16);
   }
  }
 }
 buildRoom(room){
  const cfg=config(room),mat=this.palette(room);
  room._architectureResolved=cfg;
  // Stacking the ground course precedes erection of the wall and vault.
  for(let z=0;z<9;z++)for(let x=0;x<9;x++){
   const solid=this.project.assets.textures[this.tile(room,x,z)]?.solid;
   if(!solid){this.ground(room,x,z,this.tile(room,x,z));continue}
   const worldX=room.gx*9+x,worldZ=room.gz*9+z;
   const solidAt=(xx,zz)=>{if(xx<0||xx>=36||zz<0||zz>=36)return false;const rr=this.project.rooms['room-'+(Math.floor(zz/9)*4+Math.floor(xx/9))];const tex=rr?.tiles[(zz%9)*9+(xx%9)];return this.project.assets.textures[tex]?.solid===true};
   let sides=0;
   for(const [dx,dz,side]of [[1,0,'E'],[-1,0,'W'],[0,1,'S'],[0,-1,'N']]){
    if(!solidAt(worldX+dx,worldZ+dz)){this.courseWall(room,x,z,side,cfg.height,cfg.decay);sides++}
   }
   // Isolated solid posts are load-bearing towers rather than empty floating cubes.
   if(sides>=3)this.pier(room,x,z,cfg.height);
  }
  for(const dir of room.doors||[])this.doorway(room,dir,cfg);
  this.ceiling(room,cfg);
  this.purpose(room,cfg);
  this.gallery(room,cfg);
  this.weather(room,cfg);
 }
 finish(){
  for(const store of this.rooms.values()){
   for(const bucket of store.buckets.values()){
    const mesh=new T.InstancedMesh(bucket.geometry,bucket.material,bucket.instances.length);
    mesh.frustumCulled=false;
    bucket.instances.forEach((p,i)=>{
     this.unit.position.set(p.x,p.y,p.z);
     this.unit.rotation.set(p.rx,p.ry,p.rz);
     this.unit.scale.set(p.scale?.[0]||1,p.scale?.[1]||1,p.scale?.[2]||1);
     this.unit.updateMatrix();
     mesh.setMatrixAt(i,this.unit.matrix);
     if(p.color&&mesh.setColorAt)mesh.setColorAt(i,p.color);
    });
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.receiveShadow=true;store.group.add(mesh);
   }
   store.group.userData.criptRoom=store.room.id;
  }
  this.count.models=[...this.count.models];
  return this.count;
 }
 dispose(){
  for(const geometry of this.geom.values())geometry.dispose?.();
  for(const mat of this.mats.values())mat.dispose?.();
  for(const tex of this.surfaceTextures)tex.dispose?.();this.surfaceTextures.length=0;
  this.geom.clear();this.mats.clear();this.rooms.clear();this._forgedDimensions?.clear();
 }
 floorHeightAt(x,z){
  const gx=Math.floor(x/(9*S)),gz=Math.floor(z/(9*S));
  if(gx<0||gz<0||gx>3||gz>3)return 0;
  const room=this.project.rooms['room-'+(gz*4+gx)];
  if(!room||!['shrine','boss'].includes(room.category))return 0;
  const wall=['N','S','E','W'].find(side=>!room.doors.includes(side))||'N';
  const angle=wall==='S'?Math.PI:wall==='E'?Math.PI/2:wall==='W'?-Math.PI/2:0;
  const cs=Math.cos(angle),sn=Math.sin(angle);
  const cx=(room.gx*9+4.5)*S,cz=(room.gz*9+4.5)*S;
  const dx=(x-cx)/S,dz=(z-cz)/S;
  const localX=dx*cs+dz*sn,localZ=-dx*sn+dz*cs;
  if(Math.abs(localX)>1.23||localZ>-.65||localZ< -3.5)return 0;
  if(localZ< -2.35)return .42;
  return Math.min(.35,Math.max(0,Math.ceil((-localZ-.65)/.34)*.07));
 }
 build(){
  for(const room of Object.values(this.project.rooms))this.buildRoom(room);
  return this.finish();
 }
}
C.Masonry={build:(world,project,texture)=>{
 const assembly=new Masonry(world,project,texture);
 const stats=assembly.build();
 C.masonryStats=stats;
 return assembly;
},config,profiles,materialSurface};
})();
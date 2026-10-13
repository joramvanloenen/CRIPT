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
  role:preset.role};
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
  this.mats=new Map();this.rooms=new Map();this.count={blocks:0,arches:0,vaults:0,rubble:0,rooms:0};
  this.unit=new T.Object3D();
  this.normalMaps=[];
  for(const [id,asset]of Object.entries(project.assets.textures)){
   const map=texture(asset);
   map.wrapS=map.wrapT=T.RepeatWrapping;
   const normalMap=this.makeNormalMap(asset);
   this.mats.set(id,new T.MeshStandardMaterial({
    map,normalMap,roughness:id==='moss'?.99:.91,metalness:0,color:0xffffff,
    side:T.FrontSide,flatShading:false
   }));
  }
  for(const [id,color]of Object.entries({mortar:0x192525,shadow:0x101d1c,trim:0x889187,ivory:0xbeb99f,soot:0x343c38,iron:0x514b42,wood:0x564b38,lichen:0x4b7561,gold:0xb59a70,glass:0x98d6b9,light:0xcddcc0,water:0x2c645d})){
   this.mats.set(id,new T.MeshLambertMaterial({color,side:T.DoubleSide}));
  }
 }
 makeNormalMap(asset){
  if(!asset?.pixels||typeof document==='undefined'||this.project.editor?.quality==='low')return null;
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext?.('2d');
  if(!ctx?.createImageData||!ctx.putImageData)return null;
  const width=asset.width||32,height=asset.height||width;
  canvas.width=width;canvas.height=height;
  const heights=new Float32Array(width*height);
  for(let i=0;i<heights.length;i++){
   const c=asset.pixels[i]||'#303030',hex=c[0]==='#'?c.slice(1):'303030';
   const v=parseInt(hex,16)||0;
   heights[i]=(.2126*((v>>16)&255)+.7152*((v>>8)&255)+.0722*(v&255))/255;
  }
  const pixels=ctx.createImageData(width,height);
  const sample=(x,y)=>heights[((y+height)%height)*width+((x+width)%width)];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const dx=(sample(x+1,y)-sample(x-1,y))*2.2;
   const dy=(sample(x,y+1)-sample(x,y-1))*2.2;
   const inv=1/Math.hypot(dx,dy,1),i=(y*width+x)*4;
   pixels.data[i]=Math.round(128-dx*inv*127);
   pixels.data[i+1]=Math.round(128+dy*inv*127);
   pixels.data[i+2]=Math.round(128+inv*127);
   pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const tex=new T.CanvasTexture(canvas);
  tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.minFilter=tex.magFilter=T.NearestFilter;
  this.normalMaps.push(tex);return tex;
 }
 geometry(w,h,d){
  const key=[w,h,d].map(v=>v.toFixed(2)).join(':');
  if(!this.geom.has(key))this.geom.set(key,materialSurface(new T.BoxGeometry(w,h,d)));
  return{key,geometry:this.geom.get(key)};
 }
 archSegment(index,segments,radius,outer,depth){
  const key='arch'+[index,segments,radius,outer,depth].join(':');
  if(!this.geom.has(key)){
   // Individual wedge-shaped voussoirs converge radially on the arch.
   const start=Math.PI*index/segments,end=Math.PI*(index+1)/segments,eps=.009;
   const shape=new T.Shape();
   shape.moveTo(Math.cos(start+eps)*radius,Math.sin(start+eps)*radius);
   shape.lineTo(Math.cos(start+eps)*outer,Math.sin(start+eps)*outer);
   shape.lineTo(Math.cos(end-eps)*outer,Math.sin(end-eps)*outer);
   shape.lineTo(Math.cos(end-eps)*radius,Math.sin(end-eps)*radius);
   shape.closePath();
   const geo=new T.ExtrudeGeometry(shape,{depth:depth,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1,curveSegments:1});
   geo.translate(0,0,-depth/2);this.geom.set(key,geo);
  }
  return{key,geometry:this.geom.get(key)};
 }
 roomStore(room){
  if(!this.rooms.has(room.id)){const group=new T.Group();group.name='Masonry / '+room.name;this.world.add(group);this.rooms.set(room.id,{group,buckets:new Map(),room});this.count.rooms++}
  return this.rooms.get(room.id);
 }
 instance(room,matId,geoKey,geometry,x,y,z,rx=0,ry=0,rz=0,color=null){
  const store=this.roomStore(room),key=matId+'|'+geoKey;
  if(!store.buckets.has(key))store.buckets.set(key,{geometry,material:this.mats.get(matId)||this.mats.get('trim'),instances:[]});
  store.buckets.get(key).instances.push({x,y,z,rx,ry,rz,color});
 }
 box(room,material,x,y,z,w,h,d,rotationY=0,rotationZ=0,color=null){
  if(w<=0||h<=0||d<=0)return;
  const g=this.geometry(w,h,d);
  this.instance(room,material,g.key,g.geometry,x,y,z,0,rotationY,rotationZ,color);
  this.count.blocks++;
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
  const [px,pz]=this.xz(room,x,z),split=hash(x,z,room.gx*7+room.gz)> .67?2:1,sz=S/split;
  for(let i=0;i<split;i++)for(let j=0;j<split;j++){
   const left=px-S/2+sz*(i+.5),back=pz-S/2+sz*(j+.5);
   const noise=hash(x*8+i,z*8+j,room.gx+11*room.gz);
   this.box(room,mat,left,-.075+noise*.018,back,sz-.035,.19,sz-.035,0,0,this.tint(room,left,0,back));
   if(noise>.94&&room.decay>.36){
    this.box(room,'mortar',left-.13,.029,back,.025,.008,.52,noise*.36);
   }
  }
 }
 courseWall(room,x,z,dir,height,decay){
  const mat=this.palette(room),[cx,cz]=this.xz(room,x,z);
  const dx=dir==='E'?1:dir==='W'?-1:0,dz=dir==='S'?1:dir==='N'?-1:0;
  const eastWest=dx!==0;
  const normalOffset=S*.5-.115;
  const fx=cx+dx*normalOffset,fz=cz+dz*normalOffset;
  const courses=Math.max(7,Math.round(height/.45)),courseH=height/courses;
  // Recessed continuous rubble core stops missing facing stones opening a hole.
  this.box(room,'mortar',fx-dx*.16,height/2,fz-dz*.16,eastWest?.13:S,height,eastWest?S:.13);
  const patterns=[
   [.9,.9],              // normal bonded blocks
   [.45,.9,.45],         // central long stone / two short springers
   [.6,.6,.6],           // one-third bond
   [.45,.45,.9]          // alternating smaller facing stones
  ];
  for(let row=0;row<courses;row++){
   const y=row*courseH+courseH*.5;
   const pattern=patterns[Math.floor(hash(x*17+row*5,z*9+row*2,room.gz*7+room.gx*3)*patterns.length)];
   let from=-S/2;
   for(let i=0;i<pattern.length;i++){
    const width=pattern[i], n=hash(x*19+row*3,z*11+i*9,room.gx*7+room.gz*17);
    const chip=hash(x*4+row*13,z*7+i*17,room.gz*5);
    const show=chip>decay*.085 || row===0;
    if(show){
     const depth=n>.64?.31:n>.22?.27:.23;
     const c=from+width/2,offset=depth*.08;
     const px=fx+(eastWest?dx*offset:c),pz=fz+(eastWest?c:dz*offset);
     const w=Math.max(.1,width-.028);
     this.box(room,mat,px,y,pz,eastWest?depth:w,courseH-.022,eastWest?w:depth,0,0,this.tint(room,x+row*.3,y,z+from));
     if(chip<decay*.17&&row>1){
      this.box(room,'soot',px,y+courseH*.35,pz,eastWest?.03:.11,.027,eastWest?.11:.03);
     }
    }
    from+=width;
   }
  }
  // Projecting corbel courses and compact buttresses receive the vault thrust.
  if((x+z)%3===0){
   const px=cx+dx*(S*.47),pz=cz+dz*(S*.47);
   this.box(room,mat,px,.25,pz,eastWest?.37:.53,.5,eastWest?.53:.37,0,0,this.tint(room,x,0,z));
   this.box(room,mat,px,height*.54,pz,eastWest?.22:.32,height*.66,eastWest?.32:.22,0,0);
   this.box(room,'trim',px,height-.18,pz,eastWest?.42:.53,.23,eastWest?.53:.42);
  }
 }
 pier(room,x,z,height){
  const [cx,cz]=this.xz(room,x,z),mat=this.palette(room),n=room.decay;
  for(let y=.3;y<height;y+=.52){
   this.box(room,mat,cx,y,cz,.82,Math.min(.5,height-y+.2),.82,0,0,this.tint(room,x,y,z));
  }
  for(const h of [.19,height-1.0,height-.21]){
   this.box(room,'trim',cx,h,cz,h===height-.21?1.12:1.01,.24,h===height-.21?1.12:1.01);
  }
  if(n>.4){this.box(room,'soot',cx+.42,1.1,cz+.14,.017,.45,.065,0,-.22)}
 }
 arch(room,cx,cz,yaw=0,scale=1,base=2.04,material=null){
  const mat=material||this.palette(room),r=.87*scale,outer=1.16*scale,segments=11;
  // Left and right springers rest on square piers; the key stone locks the arch.
  const side=x=>{const xx=cx+Math.cos(yaw)*x,zz=cz-Math.sin(yaw)*x;
   for(let i=0;i<5;i++){const cy=(i+.5)*base/5;
    this.box(room,mat,xx,cy,zz,.39*scale,base/5-.018,.52*scale,yaw,0,this.tint(room,cx+i,cy,cz))}
  };
  side(-1.13*scale);side(1.13*scale);
  for(let i=0;i<segments;i++){
   const a=this.archSegment(i,segments,r,outer,.49*scale);
   const tint=i===Math.floor(segments/2)?new T.Color(0xb2b9aa):this.tint(room,cx+i*.13,base,cz);
   this.instance(room,mat,a.key,a.geometry,cx,base,cz,0,yaw,0,tint);this.count.arches++;
  }
  // A heavy crowned keystone visible from a distance.
  const crown=base+outer-.025;
  this.box(room,'trim',cx,crown,cz,.28*scale,.3*scale,.55*scale,yaw);
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
   place('ivory',0,1.76,-2.75,2.98,.16,1.5);
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
   }
  }else if(role==='tomb'||role==='secret'){
   // Burial wall: two side sarcophagi, sunken stone niches, memorial slabs.
   for(const dx of [-2.65,2.65]){
    const [px,pz]=plinth(dx,-1.6,1.3,2.6,.31,mat);
    this.box(room,'trim',px,.74,pz,1.12,.44,2.38);
    this.box(room,'ivory',px,1.02,pz,.48,.12,1.4);
    this.box(room,'shadow',px,2.1,pz-1.25,.9,1.7,.12);
    this.arch(room,px,pz-1.18,0,.52,2.03,mat);
   }
  }else if(role==='merchant'||role==='item'||role==='treasure'){
   // Goods move on dry raised stone shelves. The aisle stays wide for traffic.
   for(const side of [-1,1])for(let i=0;i<3;i++){
    const [px,pz]=off(side*2.9,-2.25+i*2);
    this.box(room,mat,px,.51,pz,.95,.9,1.58);
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
    this.box(room,rnd>.8?'trim':mat,xx,h/2+.03,zz,w,h,d,0,(rnd-.5)*.56,this.tint(room,xx,h,zz));this.count.rubble++;
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
     this.unit.scale.set(1,1,1);
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
  return this.count;
 }
 dispose(){
  for(const geometry of this.geom.values())geometry.dispose?.();
  for(const mat of this.mats.values())mat.dispose?.();
  for(const tex of this.normalMaps)tex.dispose?.();
  this.geom.clear();this.mats.clear();this.rooms.clear();
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
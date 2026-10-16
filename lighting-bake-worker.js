/* CRIPT static irradiance atlas baker — CPU worker.
  One RGB indirect-light + A occlusion atlas holds horizontal XZ probes at eight heights.
  Light visibility uses solid dungeon cells; weak gather pass approximates one diffuse bounce.
  Deterministic, portable, zero shader-dependent baking. */
(function(scope){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),exp=Math.exp,hypot=Math.hypot;
function bake(input){
 const {rooms,sources=[],nx=72,nz=72,ny=8,step=.9,y0=.27,dy=1.32}=input;
 const floors=new Uint8Array(36*36),ceilings=new Float32Array(36*36);
 for(const room of rooms){
  for(let z=0;z<9;z++)for(let x=0;x<9;x++){
   const ix=room.gx*9+x,iz=room.gz*9+z,k=iz*36+ix;
   floors[k]=room.solid[z*9+x]?1:0;ceilings[k]=room.height;
  }
 }
 const world=36*1.8,index=(x,z,y)=>((y*nz+z)*nx+x);
 function solid(x,z){
  const ax=Math.floor(x/1.8),az=Math.floor(z/1.8);
  if(ax<0||az<0||ax>=36||az>=36)return true;
  return floors[az*36+ax]===1;
 }
 function occluded(x,y,z,l){
  const dx=l.x-x,dz=l.z-z,dist=hypot(dx,dz);
  const n=Math.min(28,Math.floor(dist/.43));
  if(n<2)return false;
  for(let k=1;k<n;k++){
   const t=k/n,sx=x+dx*t,sz=z+dz*t,sy=y+(l.y-y)*t;
   const cx=Math.floor(sx/1.8),cz=Math.floor(sz/1.8);
   if(cx<0||cz<0||cx>35||cz>35)return true;
   if(floors[cz*36+cx] && sy<ceilings[cz*36+cx]-.1)return true;
  }
  return false;
 }
 const sz=nx*nz*ny,raw=new Float32Array(sz*3),ao=new Float32Array(sz),out=new Uint8Array(sz*4);
 const lights=sources.slice(0,160);
 let shadowTests=0;
 for(let yIndex=0;yIndex<ny;yIndex++){
  const y=y0+yIndex*dy;
  for(let zi=0;zi<nz;zi++)for(let xi=0;xi<nx;xi++){
   const x=(xi+.5)*step,z=(zi+.5)*step,at=index(xi,zi,yIndex);
   // Hemispherical contact AO: 8 directions * 3 distances. Unlike the old
   // four near-cell checks, this resolves broad wall-floor contact, corners,
   // recesses and deep arch bases. The bake stays deterministic and cheap.
   const walls=[[1,0],[-1,0],[0,1],[0,-1],
      [.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]];
   let obstruction=0,nearby=0;
   const radii=[.38,.78,1.35],weights=[.13,.085,.045];
   for(const [dx,dz] of walls)for(let k=0;k<radii.length;k++){
    const radius=radii[k];
    if(solid(x+dx*radius,z+dz*radius)){
     obstruction+=weights[k];nearby+=k===0?1:0;
    }
   }
   const cellX=clamp(Math.floor(x/1.8),0,35),cellZ=clamp(Math.floor(z/1.8),0,35);
   const ceil=ceilings[cellZ*36+cellX]||4;
   const floorContact=Math.exp(-Math.max(0,y)*2.25)*(.08+.19*Math.min(1,nearby/3));
   const ceilingContact=Math.exp(-Math.abs(y-ceil)*1.75)*(.08+.15*Math.min(1,obstruction));
   let occlusion=clamp(1-obstruction*.79-floorContact-ceilingContact,.20,1);
   if(solid(x,z))occlusion=clamp(occlusion*.80,.18,.84);
   ao[at]=occlusion;
   // Ambient environmental irradiance is deliberately low: torches define space.
   let lr=.11,lg=.145,lb=.18;
   for(const light of lights){
    const dx=x-light.x,dy2=y-light.y,dz=z-light.z,d2=dx*dx+dy2*dy2+dz*dz;
    if(d2>light.radius*light.radius)continue;
    const d=Math.sqrt(d2),atten=(1-d/light.radius);
    if(atten<=0)continue;
    if(occluded(x,y,z,light)){shadowTests++;continue;}
    let power=atten*atten*light.power*.82;
    if(light.type==='moon'){
     // Directional moonlight only falls below a roof aperture.
     const lateral=hypot(dx,dz),width=Math.max(.8,(light.y-y)*.24);
     power*=1-clamp((lateral-width)/(width*.6),0,1);
    }
    lr+=power*light.color[0];lg+=power*light.color[1];lb+=power*light.color[2];
   }
   const i=at*3;raw[i]=lr;raw[i+1]=lg;raw[i+2]=lb;
  }
 }
 // Controlled indirect pass: local diffusion of illuminated surfaces.
 // Do not blur across solid walls or between separate rooms.
 const bounce=new Float32Array(sz*3);
 for(let layer=0;layer<ny;layer++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
  const idx=index(x,z,layer),i=idx*3,cx=(x+.5)*step,cz=(z+.5)*step;
  let rr=0,gg=0,bb=0,w=0;
  for(const [ox,oz]of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]]){
   const px=x+ox,pz=z+oz;if(px<0||pz<0||px>=nx||pz>=nz)continue;
   const nxw=(px+.5)*step,nzw=(pz+.5)*step;
   // Block bounce across actual masonry instead of smearing light through
   // the wall behind the two adjacent probe cells.
   if(solid((cx+nxw)*.5,(cz+nzw)*.5)||
      solid(cx*.67+nxw*.33,cz*.67+nzw*.33)||
      solid(cx*.33+nxw*.67,cz*.33+nzw*.67))continue;
   const j=index(px,pz,layer)*3;const weight=Math.abs(ox)+Math.abs(oz)===2?.5:1;
   rr+=raw[j]*weight;gg+=raw[j+1]*weight;bb+=raw[j+2]*weight;w+=weight;
  }
  if(w){bounce[i]=rr/w;bounce[i+1]=gg/w;bounce[i+2]=bb/w;}
  // Scale direct irradiance to allow diffuse materials to react visibly.
  const lightR=clamp((raw[i]*.80+bounce[i]*.47)*ao[idx],0,2),
   lightG=clamp((raw[i+1]*.80+bounce[i+1]*.47)*ao[idx],0,2),
   lightB=clamp((raw[i+2]*.80+bounce[i+2]*.47)*ao[idx],0,2);
  const j=idx*4;
  out[j]=Math.round(clamp(lightR*180,0,255));out[j+1]=Math.round(clamp(lightG*180,0,255));out[j+2]=Math.round(clamp(lightB*180,0,255));out[j+3]=Math.round(ao[idx]*255);
 }
 return{width:nx,height:nz*ny,nx,nz,ny,step,dy,y0,buffer:out.buffer,statistics:{lights:lights.length,samples:sz,occlusions:shadowTests}};
}
// Surface-chart bake: six directions per room, a physical texel density and
// two-pixel guard bands. No trilinear mixing between unrelated height slices.
function bakeSurface(input,onProgress=null){
 const U=scope.CriptUV;
 if(!U)throw Error('CRIPT UV charts not loaded');
 const L=input.layout||U.layout(input.quality||'medium');
 const {rooms,sources=[]}=input;
 const out=new Uint8Array(L.width*L.height*4);
 const tiles=new Uint8Array(36*36),roof=new Float32Array(36*36);
 for(const r of rooms)for(let z=0;z<9;z++)for(let x=0;x<9;x++){
  const i=(r.gz*9+z)*36+r.gx*9+x;
  tiles[i]=r.solid[z*9+x]?1:0;roof[i]=r.height;
 }
 const occupied=(x,z,y)=>{
  const gx=Math.floor(x/1.8),gz=Math.floor(z/1.8);
  if(gx<0||gz<0||gx>=36||gz>=36)return true;
  const k=gz*36+gx;
  return tiles[k]&&y<roof[k]-.075;
 };
 const blocked=(p,l)=>{
  const dx=l.x-p[0],dy=l.y-p[1],dz=l.z-p[2],distance=Math.hypot(dx,dy,dz);
  const steps=Math.min(28,Math.max(2,Math.ceil(distance/.56)));
  for(let i=1;i<steps;i++){
   const t=i/steps;
   if(occupied(p[0]+dx*t,p[2]+dz*t,p[1]+dy*t))return true;
  }return false;
 };
 function samplePosition(r,side,slice,tx,ty){
  const x0=r.gx*L.roomMeters,z0=r.gz*L.roomMeters;
  const density=side<2?L.ppm:L.wallPpm;
  const u=Math.min(L.roomMeters,(tx+.5)/density),v=Math.min(L.maxHeight,(ty+.5)/density);
  if(side===0)return[[x0+u,.055,z0+v],[0,1,0]];
  if(side===1){
   if(!r.vault||r.vault==='flat')return[[x0+u,r.height-.12,z0+v],[0,-1,0]];
   // Follow the elliptical barrel vault instead of sampling a flat roof.
   const half=6.1,rise=r.vault==='ribbed'?2.65:1.85;
   const dx=clamp(u-L.roomMeters*.5,-half+.15,half-.15);
   const root=Math.sqrt(Math.max(.002,1-(dx/half)*(dx/half)));
   const y=r.height-rise+rise*root-.11;
   const slope=-rise*dx/(half*half*root);
   const inv=1/Math.hypot(slope,1);
   return[[x0+u,y,z0+v],[slope*inv,-inv,0]];
  }
  // Every chart must bake the SAME physical tile surface that the renderer
  // addresses. No longer project every east-facing wall onto a single
  // guessed wall near the middle of its room.
  if(side===2)return[[x0+(slice+1)*L.tileMeters+.075,v,z0+u],[1,0,0]];
  if(side===3)return[[x0+slice*L.tileMeters-.075,v,z0+u],[-1,0,0]];
  if(side===4)return[[x0+u,v,z0+(slice+1)*L.tileMeters+.075],[0,0,1]];
  return[[x0+u,v,z0+slice*L.tileMeters-.075],[0,0,-1]];
 }
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]];
 const contacts=[.32,.70,1.35],influence=[.14,.09,.045];
 let rays=0,count=0,minAO=1;
 let finishedRooms=0;
 for(const room of rooms){
  const lights=sources.filter(l=>Math.hypot(l.x-(room.gx+.5)*L.roomMeters,l.z-(room.gz+.5)*L.roomMeters)<l.radius+11);
  for(let side=0;side<6;side++){
   for(let slice=0;slice<(side<2?1:L.wallSlices);slice++){
    const chart=U.chart(L,room.gx,room.gz,side,slice),{w,h}=chart;
   const diffuse=new Float32Array(w*h*3),occlusion=new Float32Array(w*h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,[p,n]=samplePosition(room,side,slice,x,y);
    let obstacle=0;
    for(const [dx,dz]of dirs)for(let k=0;k<3;k++){
     if(occupied(p[0]+dx*contacts[k],p[2]+dz*contacts[k],p[1]))
      obstacle+=influence[k];
    }
    const wallSide=side>=2,nearGround=Math.exp(-Math.max(0,p[1])*(wallSide?1.5:2.1));
    const nearRoof=Math.exp(-Math.abs(room.height-p[1])*1.7);
    const ao=clamp(1-obstacle*.66-(wallSide?.25:.11)*nearGround-
      (side===1?.13:.10)*nearRoof,.20,1);
    occlusion[i]=ao;minAO=Math.min(minAO,ao);
    let red=.095,green=.12,blue=.14;
    for(const light of lights){
     const dx=light.x-p[0],dy=light.y-p[1],dz=light.z-p[2];
     const d2=dx*dx+dy*dy+dz*dz;
     if(d2>light.radius*light.radius)continue;
     const distance=Math.sqrt(d2),f=1-distance/light.radius;
     if(f<=0||blocked(p,light)){rays++;continue}
     let power=f*f*light.power*(.55+.45*Math.max(0,(n[0]*dx+n[1]*dy+n[2]*dz)/Math.max(.001,distance)));
     if(light.type==='moon'){
      const spread=Math.max(.9,(light.y-p[1])*.21),rad=Math.hypot(dx,dz);
      power*=1-clamp((rad-spread)/(spread*.55),0,1);
     }
     red+=power*light.color[0];green+=power*light.color[1];blue+=power*light.color[2];
    }
    diffuse[i*3]=red;diffuse[i*3+1]=green;diffuse[i*3+2]=blue;
   }
   // Neighbour gather stays entirely inside a *single surface chart*.
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,j=i*3;
    let r=0,g=0,b=0,weight=0;
    for(const [ox,oy]of [[-1,0],[1,0],[0,-1],[0,1]]){
     const xx=x+ox,yy=y+oy;
     if(xx<0||xx>=w||yy<0||yy>=h)continue;
     const k=(yy*w+xx)*3;
     r+=diffuse[k];g+=diffuse[k+1];b+=diffuse[k+2];weight++;
    }
    const lum=[diffuse[j],diffuse[j+1],diffuse[j+2]];
    const bounce=weight?[r/weight,g/weight,b/weight]:lum;
    const at=((chart.y+y)*L.width+chart.x+x)*4;
    for(let ch=0;ch<3;ch++)
     out[at+ch]=Math.round(clamp((lum[ch]*.75+bounce[ch]*.35)*occlusion[i]*180,0,255));
    out[at+3]=Math.round(occlusion[i]*255);count++;
   }
   // Duplicate the last real texel into two rows/columns of gutter to
   // prevent bilinear leakage from unrelated charts and black empty atlas.
   for(let y=-chart.pad;y<h+chart.pad;y++){
    const yy=clamp(y,0,h-1);
    for(let x=-chart.pad;x<w+chart.pad;x++){
     if(x>=0&&x<w&&y>=0&&y<h)continue;
     const xx=clamp(x,0,w-1);
     const dst=((chart.y+y)*L.width+chart.x+x)*4,src=((chart.y+yy)*L.width+chart.x+xx)*4;
     out[dst]=out[src];out[dst+1]=out[src+1];out[dst+2]=out[src+2];out[dst+3]=out[src+3];
    }
   }
   }
  }
  finishedRooms++;
  // Update the first chamber immediately, then the remainder in small
  // batches. The all-rooms bake can take several seconds on mobile CPUs.
  if(onProgress&&(finishedRooms===1||finishedRooms%4===0)&&finishedRooms<rooms.length){
   const partial=out.slice().buffer;
   onProgress({buffer:partial,completedRooms:finishedRooms,totalRooms:rooms.length});
  }
 }
 return{width:L.width,height:L.height,buffer:out.buffer,
  statistics:{lights:sources.length,samples:count,occlusions:rays,minAO,
   texelsPerMeter:L.ppm,wallTexelsPerMeter:L.wallPpm,atlasWidth:L.width,atlasHeight:L.height,charts:rooms.length*(2+4*L.wallSlices),padding:L.padding}};
}

if(typeof scope.importScripts==='function'&&!scope.CriptUV)scope.importScripts('uv-mapping.js?v=uv07');
scope.CriptGIWorker={bake,bakeSurface};
if(typeof scope.postMessage==='function'&&typeof scope.importScripts==='function'){
 scope.onmessage=event=>{
  try{
   const {token,...args}=event.data;
   const result=args.surfaceAtlas?bakeSurface(args,progress=>{
    scope.postMessage({token,partial:true,...progress},[progress.buffer]);
   }):bake(args);
   scope.postMessage({token,result},[result.buffer]);
  }catch(error){scope.postMessage({token,error:String(error.stack||error)})}
 };
}
})(typeof self!=='undefined'?self:globalThis);

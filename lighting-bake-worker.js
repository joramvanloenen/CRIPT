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
scope.CriptGIWorker={bake};
if(typeof scope.postMessage==='function'&&typeof scope.importScripts==='function'){
 scope.onmessage=event=>{
  try{
   const {token,...args}=event.data;
   const result=bake(args);
   scope.postMessage({token,result},[result.buffer]);
  }catch(error){scope.postMessage({token,error:String(error.stack||error)})}
 };
}
})(typeof self!=='undefined'?self:globalThis);

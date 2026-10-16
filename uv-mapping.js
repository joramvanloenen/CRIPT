/* CRIPT UV6 — metric material UV0 and padded room-surface lightmap charts.
   UV0: world scale / 1.8m per texture repeat, independent of instance scale.
   GI atlas: six nonoverlapping chart families per room (floor, roof, +/-X,
   +/-Z). Every chart reserves two physical guard texels on all sides.
   Optional mesh UV2: nonoverlapping texel-snapped triangle charts for authored
   mesh exports; runtime instanced geometry samples surface charts instead. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const nextPOT=x=>{let n=1;while(n<x)n*=2;return n};
const ROOM=16.2,MAX_H=10,TILE=1.8,WALL_SLICES=9,PAD=2;
const ppmFor=quality=>quality==='low'?3:quality==='high'?8:6;
const wallPpmFor=quality=>quality==='low'?2:quality==='high'?5:4;
function layout(quality='medium'){
 const ppm=ppmFor(quality),wallPpm=wallPpmFor(quality);
 const floorPx=Math.ceil(ROOM*ppm),wallPx=Math.ceil(ROOM*wallPpm),wallHPx=Math.ceil(MAX_H*wallPpm);
 const patchW=floorPx+PAD*2,planeH=patchW;
 const wallPatchW=wallPx+PAD*2,wallPatchH=wallHPx+PAD*2;
 // Each of the 9 wall layers represents a real voxel-column position,
 // not merely a face orientation. Four orientation charts per row.
 const cellW=Math.max(patchW*2,wallPatchW*4),cellH=planeH+wallPatchH*WALL_SLICES;
 return{quality,ppm,wallPpm,padding:PAD,roomMeters:ROOM,maxHeight:MAX_H,
  tileMeters:TILE,wallSlices:WALL_SLICES,floorPx,wallPx,wallHPx,patchW,
  planeH,wallPatchW,wallPatchH,cellW,cellH,
  width:nextPOT(cellW*4),height:nextPOT(cellH*4)};
}
function face(normal){
 const nx=normal[0],ny=normal[1],nz=normal[2];
 if(Math.abs(ny)>=.50&&Math.abs(ny)>=Math.max(Math.abs(nx),Math.abs(nz))*.85)return ny>=0?0:1;
 if(Math.abs(nx)>Math.abs(nz))return nx>=0?2:3;
 return nz>=0?4:5;
}
function sliceAt(layout,p,side){
 if(side<2)return 0;
 const value=side<4?p[0]:p[2];
 // A +normal face belongs to the solid voxel behind it. On a precise
 // 1.8m boundary avoid assigning it to the neighbouring wall chart.
 const epsilon=(side%2===0?-.005:.005);
 const axis=Math.floor((value+epsilon)/layout.tileMeters);
 return clamp(axis,0,layout.wallSlices-1);
}
function chart(layout,roomX,roomZ,side,slice=0){
 const ox=roomX*layout.cellW,oy=roomZ*layout.cellH;
 if(side<2)return{x:ox+(side===0?0:layout.patchW)+layout.padding,
  y:oy+layout.padding,w:layout.floorPx,h:layout.floorPx,pad:layout.padding,
  side,slice:0,roomX,roomZ};
 const depth=clamp(Math.floor(slice),0,layout.wallSlices-1);
 return{x:ox+(side-2)*layout.wallPatchW+layout.padding,
  y:oy+layout.planeH+depth*layout.wallPatchH+layout.padding,
  w:layout.wallPx,h:layout.wallHPx,pad:layout.padding,
  side,slice:depth,roomX,roomZ};
}
function chartCoordinates(layout,position,normal,anchor=position){
 const side=face(normal);
 const roomX=clamp(Math.floor(anchor[0]/ROOM),0,3),
  roomZ=clamp(Math.floor(anchor[2]/ROOM),0,3);
 const local=[clamp(position[0]-roomX*ROOM,0,ROOM),position[1],
  clamp(position[2]-roomZ*ROOM,0,ROOM)];
 const localAnchor=[clamp(anchor[0]-roomX*ROOM,0,ROOM),anchor[1],clamp(anchor[2]-roomZ*ROOM,0,ROOM)];
 const slice=sliceAt(layout,localAnchor,side);
 const tile=chart(layout,roomX,roomZ,side,slice);
 const meters=side<2?[local[0],local[2]]:side<4?[local[2],local[1]]:[local[0],local[1]];
 const density=side<2?layout.ppm:layout.wallPpm;
 const tx=tile.x+clamp(meters[0]*density-.5,0,tile.w-1)+.5;
 const ty=tile.y+clamp(meters[1]*density-.5,0,tile.h-1)+.5;
 return{u:tx/layout.width,v:ty/layout.height,texelX:tx,texelY:ty,
  roomX,roomZ,side,slice};
}
function diffuseUV(position,normal,metersPerRepeat=1.8){
 const p=position,n=normal,s=1/metersPerRepeat;
 if(Math.abs(n[1])>=Math.max(Math.abs(n[0]),Math.abs(n[2])))return[p[0]*s,p[2]*s];
 if(Math.abs(n[0])>Math.abs(n[2]))return[p[2]*s,p[1]*s];
 return[p[0]*s,p[1]*s];
}
// A metric triangle chart unwrap for non-instanced exports. This generates
// genuine unique UV2 islands with texel-aligned margins, no UV overlaps.
// Geometries are converted to non-indexed first to avoid shared chart vertices.
function unwrapMesh(T,geometry,{texelsPerMeter=8,padding=2,maxAtlas=2048}={}){
 if(!geometry?.getAttribute||!T?.Float32BufferAttribute)return geometry;
 const g=geometry.index&&geometry.toNonIndexed?geometry.toNonIndexed():geometry;
 const p=g.getAttribute('position'),n=g.getAttribute('normal');
 if(!p||p.count%3!==0)return g;
 const tris=[],uv0=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  const a=[p.getX(i),p.getY(i),p.getZ(i)];
  const b=n?[n.getX(i),n.getY(i),n.getZ(i)]:[0,1,0];
  const uv=diffuseUV(a,b);
  uv0[i*2]=uv[0];uv0[i*2+1]=uv[1];
 }
 let pixels=0,maxW=0;
 for(let i=0;i<p.count;i+=3){
  const a=[p.getX(i),p.getY(i),p.getZ(i)],b=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)],c=[p.getX(i+2),p.getY(i+2),p.getZ(i+2)];
  const len=u=>Math.hypot(...u),sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const ab=sub(b,a),ac=sub(c,a),u0=len(ab),axis=ab.map(q=>q/(u0||1));
  const dot=ac.reduce((sum,v,k)=>sum+v*axis[k],0),perp=Math.sqrt(Math.max(0,len(ac)**2-dot**2));
  const xcoords=[0,u0,dot],ycoords=[0,0,perp];
  const minX=Math.min(...xcoords),minY=Math.min(...ycoords);
  const w=Math.max(2,Math.ceil((Math.max(...xcoords)-minX)*texelsPerMeter)),h=Math.max(2,Math.ceil((Math.max(...ycoords)-minY)*texelsPerMeter));
  const chartW=w+padding*2,chartH=h+padding*2;
  tris.push({i,uv:xcoords.map((x,j)=>[(x-minX)*texelsPerMeter,(ycoords[j]-minY)*texelsPerMeter]),w,h,chartW,chartH});
  pixels+=chartW*chartH;maxW=Math.max(maxW,chartW);
 }
 // Shelf pack largest islands first for area-based packing efficiency.
 const width=Math.min(maxAtlas,nextPOT(Math.max(maxW,Math.sqrt(pixels)*1.22)));
 let x=0,y=0,rowH=0,packedHeight=0;
 for(const t of [...tris].sort((a,b)=>b.chartH-a.chartH)){
  if(t.chartW>width)throw Error('UV chart exceeds atlas width');
  if(x+t.chartW>width){x=0;y+=rowH;rowH=0}
  t.x=x;t.y=y;x+=t.chartW;rowH=Math.max(rowH,t.chartH);packedHeight=Math.max(packedHeight,y+rowH);
 }
 const height=nextPOT(Math.max(1,packedHeight));
 if(height>maxAtlas)throw Error('UV2 atlas exceeds available texels');
 const uv2=new Float32Array(p.count*2);
 for(const t of tris)for(let j=0;j<3;j++){
  const [u,v]=t.uv[j],i=t.i+j;
  uv2[i*2]=(t.x+padding+Math.min(t.w-.5,u)+.5)/width;
  uv2[i*2+1]=(t.y+padding+Math.min(t.h-.5,v)+.5)/height;
 }
 g.setAttribute('uv',new T.Float32BufferAttribute(uv0,2));
 g.setAttribute('uv2',new T.Float32BufferAttribute(uv2,2));
 g.userData=g.userData||{};
 g.userData.criptUV={texelsPerMeter,padding,atlasWidth:width,atlasHeight:height,charts:tris.length};
 return g;
}
root.CriptUV={layout,face,chart,chartCoordinates,sliceAt,diffuseUV,unwrapMesh,ppmFor,wallPpmFor};
if(root.Cript)root.Cript.UV=root.CriptUV;
})(typeof self!=='undefined'?self:typeof window!=='undefined'?window:globalThis);

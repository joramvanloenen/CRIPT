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
const ROOM=16.2,MAX_H=10,PAD=2;
const ppmFor=quality=>quality==='low'?3:quality==='high'?8:6;
function layout(quality='medium'){
 const ppm=ppmFor(quality),floorPx=Math.ceil(ROOM*ppm),wallPx=Math.ceil(MAX_H*ppm);
 const patchW=floorPx+PAD*2,planeH=floorPx+PAD*2,wallH=wallPx+PAD*2;
 const cellW=patchW*2,cellH=planeH+wallH*2;
 return{quality,ppm,padding:PAD,roomMeters:ROOM,maxHeight:MAX_H,
  floorPx,wallPx,patchW,planeH,wallH,cellW,cellH,
  width:nextPOT(cellW*4),height:nextPOT(cellH*4)};
}
// Face labels are physical outward normals, not camera-facing directions.
// +Y: floor, -Y: roof, +/-X: east-west-facing stone, +/-Z: north-south.
function face(normal){
 const nx=normal[0],ny=normal[1],nz=normal[2];
 if(Math.abs(ny)>=.50&&Math.abs(ny)>=Math.max(Math.abs(nx),Math.abs(nz))*.85)return ny>=0?0:1;
 if(Math.abs(nx)>Math.abs(nz))return nx>=0?2:3;
 return nz>=0?4:5;
}
function chart(layout,roomX,roomZ,side){
 const col=side%2,row=Math.floor(side/2);
 const x=roomX*layout.cellW+col*layout.patchW+layout.padding;
 const y=roomZ*layout.cellH+(row===0?0:row===1?layout.planeH:layout.planeH+layout.wallH)+layout.padding;
 const w=layout.floorPx,h=row===0?layout.floorPx:layout.wallPx;
 return{x,y,w,h,pad:layout.padding,side,roomX,roomZ};
}
function chartCoordinates(layout,position,normal){
 const roomX=clamp(Math.floor(position[0]/ROOM),0,3),roomZ=clamp(Math.floor(position[2]/ROOM),0,3);
 const side=face(normal),tile=chart(layout,roomX,roomZ,side);
 const rx=clamp(position[0]-roomX*ROOM,0,ROOM),rz=clamp(position[2]-roomZ*ROOM,0,ROOM);
 const u=side<=1?rx:side<=3?rz:rx;
 const v=side<=1?rz:clamp(position[1],0,MAX_H);
 const tx=tile.x+clamp(u*layout.ppm-.5,0,tile.w-1)+.5;
 const ty=tile.y+clamp(v*layout.ppm-.5,0,tile.h-1)+.5;
 return{u:tx/layout.width,v:ty/layout.height,texelX:tx,texelY:ty,roomX,roomZ,side};
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
root.CriptUV={layout,face,chart,chartCoordinates,diffuseUV,unwrapMesh,ppmFor};
if(root.Cript)root.Cript.UV=root.CriptUV;
})(typeof self!=='undefined'?self:typeof window!=='undefined'?window:globalThis);

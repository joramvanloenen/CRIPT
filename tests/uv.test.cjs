const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sandbox={Math,Float32Array,Uint8Array,console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('uv-mapping.js','utf8'),sandbox,{filename:'uv-mapping.js'});
vm.runInContext(fs.readFileSync('lighting-bake-worker.js','utf8'),sandbox,{filename:'lighting-bake-worker.js'});
const UV=sandbox.CriptUV;
assert.ok(UV);
const lo=UV.layout('low'),med=UV.layout('medium'),hi=UV.layout('high');
assert.deepEqual([lo.ppm,med.ppm,hi.ppm],[3,6,8]);
assert.ok(lo.width<=med.width&&med.width<=hi.width);
for(const L of [lo,med,hi]){
 assert.equal(L.padding,2);
 assert.equal(L.wallSlices,9);
 assert.ok(L.wallPpm<L.ppm,'Lightmap wall resolution is budgeted separately from floor');
 assert.ok(L.width<=4096&&L.height<=8192,'Atlas dimensions must fit a practical GPU texture');
 let charts=0;const rects=[];
 for(let rz=0;rz<4;rz++)for(let rx=0;rx<4;rx++)for(let side=0;side<6;side++){
  const sliceCount=side<2?1:9;
  for(let slice=0;slice<sliceCount;slice++){
   const tile=UV.chart(L,rx,rz,side,slice);
   assert.ok(tile.x>=2&&tile.y>=2);
   assert.ok(tile.x+tile.w+2<=L.width&&tile.y+tile.h+2<=L.height,'Atlas chart overflow');
   const normal=[[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]][side];
   const pos=[rx*16.2+(side===2?(slice+1)*1.8:side===3?slice*1.8:8.1),
       2.3,rz*16.2+(side===4?(slice+1)*1.8:side===5?slice*1.8:8.1)];
   const uv=UV.chartCoordinates(L,pos,normal);
   assert.equal(uv.side,side);
   assert.equal(uv.slice,slice,'Wall must sample its own physical chart layer');
   assert.ok(uv.texelX>=tile.x+.5&&uv.texelX<=tile.x+tile.w-.5);
   assert.ok(uv.texelY>=tile.y+.5&&uv.texelY<=tile.y+tile.h-.5);
   rects.push(tile);charts++;
  }
 }
 assert.equal(charts,16*38,'Six directions with 9 depth bins on four walls');
 // True atlas non-overlap, including both 2-pixel chart gutters.
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
  const a=rects[i],b=rects[j];
  const separated=a.x+a.w+a.pad<=b.x-b.pad||
    b.x+b.w+b.pad<=a.x-a.pad||
    a.y+a.h+a.pad<=b.y-b.pad||
    b.y+b.h+b.pad<=a.y-a.pad;
  if(!separated)assert.fail('Overlapping atlas chart rectangles: '+i+' / '+j);
 }
 const a=UV.chart(L,0,0,2,0),b=UV.chart(L,0,0,2,8);
 assert.notEqual(a.y,b.y,'Distant same-direction walls cannot share texels');
 const pNear=UV.chartCoordinates(L,[1.8,2.3,8.1],[1,0,0]);
 const pFar=UV.chartCoordinates(L,[14.4,2.3,8.1],[1,0,0]);
 assert.notEqual(pNear.v,pFar.v,'Same-normal distant walls cannot sample identical charts');
 const boundary=UV.chartCoordinates(L,[16.2,2.3,8.1],[1,0,0]);
 assert.equal(boundary.roomX,0,'Shared boundary must remain with solid whose outward face it is');
}
// World-space vertex coordinates can cross the 1.8m wall tile boundary
// while their INSTANCED MESH ORIGIN remains inside the correct solid tile.
// UV8 sampled a different lightmap slice on these near-identical surfaces.
for(const L of [lo,med,hi]){
 const eNormal=[1,0,0], wNormal=[-1,0,0],zNormal=[0,0,1];
 const outside=UV.chartCoordinates(L,[1.81,2.5,3.4],eNormal,[1.70,2.5,3.4]);
 const inside=UV.chartCoordinates(L,[1.79,2.5,3.4],eNormal,[1.70,2.5,3.4]);
 assert.equal(outside.slice,0,'Wall face extending 1cm outside tile must keep own chart');
 assert.equal(inside.slice,outside.slice);
 assert.equal(inside.texelX,outside.texelX,'Adjacent parallel wall texels must not jump when X crosses tile edge');
 const west=UV.chartCoordinates(L,[-.01,2.5,3.4],wNormal,[.1,2.5,3.4]);
 assert.equal(west.slice,0,'Negative-normal wall face must remain with own voxel');
 const next=UV.chartCoordinates(L,[3.61,2.5,3.4],eNormal,[3.5,2.5,3.4]);
 assert.equal(next.slice,1,'Different solid tile must use separate lightmap chart');
 assert.notEqual(next.v,outside.v);
 const crossing=UV.chartCoordinates(L,[1.81,2.5,16.21],zNormal,[1.70,2.5,16.1]);
 assert.equal(crossing.roomZ,0,'Instanced faces may cross room boundary but remain in their original chart');
}
assert.ok(UV.diffuseUV([3.6,4.5,5.4],[0,1,0]).every((v,i)=>Math.abs(v-[2,3][i])<1e-6));
assert.ok(UV.diffuseUV([3.6,4.5,5.4],[1,0,0]).every((v,i)=>Math.abs(v-[3,2.5][i])<1e-6));
class Attr{
 constructor(data,itemSize){this.array=Float32Array.from(data);this.itemSize=itemSize;this.count=this.array.length/itemSize}
 getX(i){return this.array[i*this.itemSize]}
 getY(i){return this.array[i*this.itemSize+1]}
 getZ(i){return this.array[i*this.itemSize+2]}
}
class Geom{
 constructor(){this.userData={};this.attributes={}}
 getAttribute(key){return this.attributes[key]}
 setAttribute(key,value){this.attributes[key]=value}
}
const geo=new Geom();
geo.setAttribute('position',new Attr([0,0,0,1,0,0,0,1,0,1,0,0,1,1,0,0,1,0],3));
geo.setAttribute('normal',new Attr(Array.from({length:6},()=>[0,0,1]).flat(),3));
const unwrapped=UV.unwrapMesh({Float32BufferAttribute:Attr},geo,{texelsPerMeter:12,padding:2});
const uv2=unwrapped.getAttribute('uv2'),uv0=unwrapped.getAttribute('uv');
assert.equal(uv2.count,6);assert.equal(uv0.count,6);
assert.ok(unwrapped.userData.criptUV.charts===2);
const triBounds=i=>{
 const u=[i*3,i*3+1,i*3+2].map(k=>[uv2.getX(k),uv2.getY(k)]);
 return{minX:Math.min(...u.map(x=>x[0])),maxX:Math.max(...u.map(x=>x[0])),
 minY:Math.min(...u.map(x=>x[1])),maxY:Math.max(...u.map(x=>x[1]))};
};
const t0=triBounds(0),t1=triBounds(1);
assert.ok(t0.maxX<t1.minX||t1.maxX<t0.minX||t0.maxY<t1.minY||t1.maxY<t0.minY,'Secondary UV islands must not overlap');
const solid=Array(81).fill(false);
for(let i=0;i<9;i++){solid[i]=true;solid[72+i]=true;solid[i*9]=true;solid[i*9+8]=true}
const room={gx:0,gz:0,height:5.5,solid};
const L=UV.layout('low'),torch={x:8.1,y:1.7,z:8.1,radius:10,power:2,color:[1,.44,.16],type:'torch'};
const result=sandbox.CriptGIWorker.bakeSurface({layout:L,rooms:[room],sources:[torch]});
assert.equal(result.width,L.width);assert.equal(result.height,L.height);
assert.equal(result.buffer.byteLength,L.width*L.height*4);
assert.equal(result.statistics.charts,38);
assert.equal(result.statistics.texelsPerMeter,L.ppm);
assert.equal(result.statistics.padding,2);
const px=new Uint8Array(result.buffer),sample=(x,y)=>
 Array.from(px.slice((y*L.width+x)*4,(y*L.width+x)*4+4));
for(let side=0;side<6;side++)for(let slice=0;slice<(side<2?1:9);slice++){
 const c=UV.chart(L,0,0,side,slice);
 const edge=sample(c.x,c.y);
 assert.deepEqual(sample(c.x-1,c.y-1),edge,'Corner gutter must reproduce nearest chart texel');
 assert.deepEqual(sample(c.x+c.w,c.y+c.h),sample(c.x+c.w-1,c.y+c.h-1),'Far corner gutter must be dilated');
}
const leftWall=UV.chart(L,0,0,2,0),rightWall=UV.chart(L,0,0,2,6);
const diffAt=(c)=>{
 const x=c.x+Math.floor(c.w/2),y=c.y+Math.floor(c.h/3);
 return sample(x,y);
};
const firstWall=diffAt(leftWall),lastWall=diffAt(rightWall);
assert.ok(Math.abs(firstWall[0]-lastWall[0])+Math.abs(firstWall[1]-lastWall[1])+
 Math.abs(firstWall[3]-lastWall[3])>2,'Separate physical wall slices must have distinct lighting');
const floor=UV.chart(L,0,0,0),roof=UV.chart(L,0,0,1);
const floorMiddle=sample(floor.x+Math.floor(floor.w/2),floor.y+Math.floor(floor.h/2));
const roofMiddle=sample(roof.x+Math.floor(roof.w/2),roof.y+Math.floor(roof.h/2));
assert.ok(floorMiddle[0]>floorMiddle[2],'Firelight must tint the floor warm');
assert.ok(Math.abs(floorMiddle[0]-roofMiddle[0])>2,'Floor and roof must bake separate lighting, not share height probes');
const nearEdge=sample(floor.x+2,floor.y+2);
assert.ok(nearEdge[3]<floorMiddle[3],'Floor corners must have stronger baked occlusion');
// The ceiling chart must be baked on the actual vaulted stone, not on an
// imaginary plane above the spring line.
const vaulted=sandbox.CriptGIWorker.bakeSurface({layout:L,
 rooms:[{...room,vault:'ribbed'}],sources:[torch]});
const curved=new Uint8Array(vaulted.buffer);
const roofSide=UV.chart(L,0,0,1);
const leftAt=(roofSide.y+Math.floor(roofSide.h/2))*L.width+roofSide.x+Math.floor(roofSide.w*.23);
const sampleChange=Array.from({length:4},(_,k)=>Math.abs(curved[leftAt*4+k]-px[leftAt*4+k])).reduce((a,b)=>a+b,0);
assert.ok(sampleChange>1,'Vault lightmap must respond to actual curved roof geometry');
// A slow full-world bake must show the starting room before it completes.
const moreRoom={...room,gx:1,gz:0},progress=[];
const streaming=sandbox.CriptGIWorker.bakeSurface({layout:L,
 rooms:[room,moreRoom],sources:[torch]},update=>progress.push(update));
assert.equal(progress.length,1,'Worker must publish the first room before the full atlas');
assert.equal(progress[0].completedRooms,1);
assert.equal(progress[0].totalRooms,2);
assert.equal(progress[0].buffer.byteLength,L.width*L.height*4);
const early=new Uint8Array(progress[0].buffer),done=new Uint8Array(streaming.buffer);
const center=(Math.floor(floor.y+floor.h/2)*L.width+Math.floor(floor.x+floor.w/2))*4;
assert.equal(early[center],done[center],'Early lightmap must match the final first-room bake');
console.log('PASS: texel density, UV2 no overlaps, 2px padded charts, physical diffuse scale, floor/roof lighting and baked AO');

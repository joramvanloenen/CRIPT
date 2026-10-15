/* CRIPT / Quarry Materials v4 — Substance-inspired layered PBR material synthesis.
   Independent procedural node-like stages:
   tile sampling -> flood-fill stone IDs -> per-stone gradient / chipped mask ->
   macro strata / mineral / micro fracture -> photographic microdetail (optional) ->
   albedo + true height + OpenGL normal + roughness.
   Procedural seams represent load-bearing coursed masonry, never black outlines.
   Cut-stone variant deliberately has no fake mortar/painted tile boundaries. */
(function(){
'use strict';
const C=window.Cript=window.Cript||{};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fract=x=>x-Math.floor(x),mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
function hash(x,y,s){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,1442695041);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296}
function noise(x,y,oct,seed){
 const px=x*oct,py=y*oct,ix=Math.floor(px),iy=Math.floor(py),fx=fract(px),fy=fract(py);
 const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),wrap=q=>(q%oct+oct)%oct;
 return mix(mix(hash(wrap(ix),wrap(iy),seed),hash(wrap(ix+1),wrap(iy),seed),sx),
 mix(hash(wrap(ix),wrap(iy+1),seed),hash(wrap(ix+1),wrap(iy+1),seed),sx),sy);
}
const presets={
 stone:{type:'wall',base:[123,123,112],mortar:[84,83,75],courses:4,columns:2,
  relief:.95,depth:.72,erosion:.49,noise:1.05,wetness:.32,polish:.12,seed:17,overlay:.02,
  variation:.85,fractures:.57,photoInfluence:.56},
 goldstone:{type:'wall',base:[159,140,115],mortar:[111,101,81],courses:4,columns:2,
  relief:.86,depth:.67,erosion:.39,noise:.95,wetness:.24,polish:.2,seed:31,overlay:.02,
  variation:.8,fractures:.55,photoInfluence:.51},
 moss:{type:'wall',base:[106,125,106],mortar:[75,88,73],courses:4,columns:2,
  relief:1.04,depth:.76,erosion:.63,noise:1.15,wetness:.69,polish:.05,seed:47,overlay:.02,
  variation:.91,fractures:.63,photoInfluence:.54},
 floor:{type:'floor',base:[127,124,113],mortar:[88,84,77],courses:2,columns:2,
  relief:1.01,depth:.75,erosion:.55,noise:1.10,wetness:.49,polish:.23,seed:61,overlay:.02,
  variation:.87,fractures:.6,photoInfluence:.5}
};
function recipeFor(asset){
 const p=presets[asset?.id]||presets.stone,r=asset?.materialRecipe||{};
 return{...p,...r,type:r.type||p.type,
  base:Array.isArray(r.base)?r.base.slice(0,3):p.base.slice(),
  mortar:Array.isArray(r.mortar)?r.mortar.slice(0,3):p.mortar.slice()};
}
// Staggered courses vary in width by row: 2, 3 and 4 blocks per tile.
// Each world panel uses a seeded variation; the generated tile is self-contained.
function stoneCell(u,v,cols,rows,seed,floor){
 const yy=v*rows,course=Math.floor(yy),cy=fract(yy);
 // Tile Sampler inspired weighted partitions, normalized so the left and
 // right boundaries always end with real mortar rather than cut-off bricks.
 const totalBlocks=floor?2+(hash(course,7,seed)>.55?1:0):
   Math.max(2,cols+1+(hash(course,12,seed)>.55?1:0));
 let total=0;
 const weights=[];
 for(let n=0;n<totalBlocks;n++){
  const w=.64+hash(course*17+n,seed+11,n*13)*.92;
  weights.push(w);total+=w;
 }
 let left=0,block=totalBlocks-1,cx=1,du=0;
 for(let n=0;n<totalBlocks;n++){
  const width=weights[n]/total,right=left+width;
  if(u<right||n===totalBlocks-1){
   block=n;cx=clamp((u-left)/width,0,1);
   du=Math.min(u-left,right-u);break;
  }
  left=right;
 }
 return{course,stone:block,id:course*31+block,colsHere:totalBlocks,cx,cy,
   du:Math.max(0,du),dv:Math.min(cy,1-cy)/rows};
}
function build(asset,{size=128,cut=false,variant=0,photo=null}={}){
 const r=recipeFor(asset),N=clamp(Math.floor(size),32,256),len=N*N;
 const seed=(Number(r.seed)||17)+variant*137,
  cols=clamp(Math.round(r.columns||2),1,8),rows=clamp(Math.round(r.courses||4),1,12);
 const erosion=clamp(+r.erosion,0,1),relief=clamp(+r.relief,0,2),depth=clamp(+r.depth,0,1.5),
  grain=clamp(+r.noise,0,2),wet=clamp(+r.wetness||0,0,1),polish=clamp(+r.polish||0,0,1),
  variation=clamp(+r.variation||.85,0,2),fractures=clamp(+r.fractures||.55,0,2),
  photoInfluence=clamp(+r.photoInfluence||.50,0,1),
  overlay=clamp(+r.overlay||0,0,.5);
 const floor=r.type==='floor',moss=asset?.id==='moss';
 const heights=new Float32Array(len),albedo=new Uint8Array(len*4),
   normals=new Uint8Array(len*4),roughness=new Uint8Array(len*4);
 const photoSize=photo?.width||0,photoData=photo?.data;
 const wraps=i=>(i%N+N)%N;
 function photoDetail(u,v,cell,stSeed){
  if(!photoData||!photoSize)return [0,0,0,0];
  // Stochastic per-block crop, rotation and mirroring. This is deliberately
  // sampled from the center of the photograph to reduce photographed joints.
  const ox=.19+.62*hash(cell.stone,cell.course,stSeed+911);
  const oy=.20+.60*hash(cell.course,cell.stone,stSeed+919);
  const flip=hash(cell.stone,cell.course,stSeed+913)>.5;
  const rot=hash(cell.stone,cell.course,stSeed+929)>.5;
  const tx=flip?1-cell.cx:cell.cx,ty=cell.cy;
  const du=rot?ty:tx,dv=rot?tx:ty;
  const px=Math.floor((ox+(du-.5)*.19)*photoSize+photoSize)%photoSize;
  const py=Math.floor((oy+(dv-.5)*.19)*photoSize+photoSize)%photoSize;
  const idx=(py*photoSize+px)*4;
  const red=photoData[idx],green=photoData[idx+1],blue=photoData[idx+2];
  const luma=(red*.21+green*.71+blue*.08);
  // High-pass filtered photo detail in the source photograph, not whole
  // photographic stone/mortar duplicated over our authored joints.
  const px2=(px+5)%photoSize,py2=(py+7)%photoSize;
  const k=(py2*photoSize+px2)*4;
  const contrast=luma-(photoData[k]*.21+photoData[k+1]*.71+photoData[k+2]*.08);
  return [(red-luma)*.28,(green-luma)*.28,(blue-luma)*.28,contrast];
 }
 // Vertex-like stone IDs are evaluated once per pixel and drive all channels.
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const u=x/N,v=y/N,i=y*N+x,j=i*4;
  const macro=noise(u,v,3,seed+7),cloud=noise(u,v,7,seed+19),
   grit=noise(u,v,29,seed+31),micro=noise(u,v,63,seed+43);
  const seamWarp=(cloud-.5)*.011*erosion+(grit-.5)*.005*erosion;
  const cell=stoneCell(u,v,cols,rows,seed,floor);
  const nearest=Math.min(cell.du,cell.dv);
  const seamWidth=.0033+erosion*.0019,uneven=(grit-.5)*.0031*erosion;
  const joint=cut?0:1-smooth(seamWidth*.42,seamWidth*1.8,nearest+uneven+seamWarp*.14);
  const edge=cut?1:smooth(seamWidth*.44,seamWidth*3.7,nearest+uneven);
  const stoneValue=hash(cell.id,seed+17,3),stoneHue=hash(cell.id,seed+23,8),
    stoneLayers=hash(cell.id,seed+29,9);
  // Substance-style flood-fill to gradient: each block tilts independently.
  const tiltX=(hash(cell.id,13,seed)-.5)*.060;
  const tiltY=(hash(cell.id,27,seed)-.5)*.071;
  const plane=(cell.cx-.5)*tiltX+(cell.cy-.5)*tiltY;
  // Stone-specific frequency, mineral coloring, fracture and bedding planes.
  const bedding=Math.sin(v*(110+stoneLayers*83)+cloud*12+(cell.id%7)*1.1)*.018;
  const sediment=Math.sin((u*.32+v*.95)*180+macro*19+stoneLayers*13)*.014;
  const porous=Math.pow(Math.max(0,grit-.61),2)*.19+Math.pow(Math.max(0,micro-.67),2)*.21;
  const fractureField=noise(u,v,16,seed+131);
  const fissure=Math.pow(Math.max(0,1-Math.abs(fractureField-.48)/.042),3)*
     fractures*erosion*.051;
  const chips=(1-edge)*erosion*(.016+grit*.044);
  const photos=photoDetail(u,v,cell,seed),photoHeight=photos[3]/255*photoInfluence*.087;
  const body=(macro-.5)*.13+(cloud-.5)*.105+(grit-.5)*.08+
      (micro-.5)*.048+bedding+sediment+plane-porous-fissure;
  heights[i]=(.076+grain*body+photoHeight)*relief*edge-
      joint*depth*.147-chips;
  const blockTone=(stoneValue-.5)*76*variation;
  const warm=(stoneHue-.5)*24*variation;
  const mineral=(macro-.5)*42+(cloud-.5)*37+(grit-.5)*30+
        (micro-.5)*15+(stoneLayers-.5)*19+bedding*155-
        porous*78-fissure*87;
  const dirt=smooth(.52,.83,noise(u,v,4,seed+145))*erosion;
  const mossMask=moss?smooth(.57,.79,noise(u,v,7,seed+151))*.58:0;
  const channelTone=[warm*.60,-warm*.18,-warm*.72];
  for(let k=0;k<3;k++){
   let base=r.base[k]+blockTone+channelTone[k]+mineral-dirt*25;
   base+=photos[k]*photoInfluence*.65+photos[3]*photoInfluence*.52;
   let val=mix(base,r.mortar[k]+(grit-.5)*13,joint*.83);
   if(mossMask)val=mix(val,[48,89,55][k],mossMask);
   if(asset?.pixels?.length&&overlay){
    const aw=Math.max(1,asset.width||32),ah=Math.max(1,asset.height||aw);
    const c=asset.pixels[Math.floor(v*ah)%ah*aw+Math.floor(u*aw)%aw];
    if(typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))
      val=mix(val,parseInt(c.slice(1+k*2,3+k*2),16),overlay);
   }
   albedo[j+k]=Math.round(clamp(val*(1-joint*.075),0,255));
  }
  albedo[j+3]=255;
  const damp=smooth(.42,.82,noise(u,v,8,seed+187));
  let rough=.88+(micro-.5)*.16+(grit-.5)*.11+erosion*.046-
      wet*damp*.39-polish*smooth(.56,.81,cloud)*(1-joint)*.23-
      photoInfluence*Math.abs(photos[3])*.0010;
  if(floor)rough-=.05;if(moss)rough+=.06;
  rough=mix(clamp(rough,.25,.99),.97,joint*.94);
  const rb=Math.round(clamp(rough,.23,.99)*255);
  roughness[j]=roughness[j+1]=roughness[j+2]=rb;roughness[j+3]=255;
 }
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const dx=(heights[y*N+wraps(x+1)]-heights[y*N+wraps(x-1)])*.5,
        dy=(heights[wraps(y+1)*N+x]-heights[wraps(y-1)*N+x])*.5;
  const k=(y*N+x)*4,ns=N/128*7.2,nx=-dx*ns,ny=dy*ns,nz=1,
    inv=1/Math.hypot(nx,ny,nz);
  normals[k]=Math.round(clamp((nx*inv*.5+.5)*255,0,255));
  normals[k+1]=Math.round(clamp((ny*inv*.5+.5)*255,0,255));
  normals[k+2]=Math.round(clamp((nz*inv*.5+.5)*255,0,255));normals[k+3]=255;
 }
 return{size:N,width:N,height:N,recipe:r,albedo,normals,roughness,smoothness:roughness,
  heightMap:heights,variant,photographic:!!photoData};
}
function textures(T,asset,{quality='medium',cut=false,variant=0,photo=null}={}){
 const size=quality==='low'?64:quality==='high'?192:128,data=build(asset,{size,cut,variant,photo});
 const make=(pixels,srgb=false)=>{
  const tex=new T.DataTexture(pixels,size,size,T.RGBAFormat,T.UnsignedByteType);
  tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.magFilter=T.LinearFilter||T.NearestFilter;
  tex.minFilter=T.LinearMipmapLinearFilter||T.NearestMipmapNearestFilter||T.NearestFilter;
  tex.generateMipmaps=true;tex.flipY=false;
  if(srgb)tex.colorSpace=T.SRGBColorSpace;
  tex.needsUpdate=true;return tex;
 };
 return{diffuse:make(data.albedo,true),normal:make(data.normals),
  roughness:make(data.roughness),recipe:data.recipe,size,variant};
}
// Photographic CC0 microdetail reference, used with fallback if unavailable.
// The real world image is cropped stochastically into individual *faces*.
// No arbitrary-image cross-domain bypass; a CORS-blocked image is ignored.
const PHOTO_URL='https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/stone_brick_wall_001/stone_brick_wall_001_diff_1k.png';
let photoPromise=null,reference=null;
function loadPhotographicReference(){
 if(reference)return Promise.resolve(reference);
 if(photoPromise)return photoPromise;
 if(typeof Image==='undefined'||typeof document==='undefined')return Promise.resolve(null);
 photoPromise=new Promise(resolve=>{
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0,256,256);
    const frame=ctx.getImageData(0,0,256,256);
    reference={width:256,data:frame.data,source:PHOTO_URL,license:'CC0'};
    resolve(reference);
   }catch(_){resolve(null)}
  };
  img.onerror=()=>resolve(null);
  img.src=PHOTO_URL;
 });
 return photoPromise;
}
C.StoneMaterials={presets,recipeFor,stoneCell,build,textures,loadPhotographicReference,
  photograph:{url:PHOTO_URL,attribution:'Poly Haven / CC0',asset:'stone_brick_wall_001'}};
})();
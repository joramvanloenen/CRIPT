/* CRIPT | procedural stone surface compiler.
   Independent deterministic layers: laid-out masonry, mortar cut, stone body,
   chips and erosion, dampness, and multi-octave microrelief.
   Three outputs share one heightfield: albedo, tangent-space normal, roughness. */
(function(){
'use strict';
const C=window.Cript=window.Cript||{};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fract=v=>v-Math.floor(v);
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const hash=(x,y,seed)=>fract(Math.sin(x*127.17+y*311.71+seed*91.13)*43758.5453123);
function noise(u,v,n,seed){
 const x=u*n,y=v*n,ix=Math.floor(x),iy=Math.floor(y),fx=fract(x),fy=fract(y);
 const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const wrap=q=>(q%n+n)%n;
 const a=hash(wrap(ix),wrap(iy),seed),b=hash(wrap(ix+1),wrap(iy),seed),
       c=hash(wrap(ix),wrap(iy+1),seed),d=hash(wrap(ix+1),wrap(iy+1),seed);
 return mix(mix(a,b,sx),mix(c,d,sx),sy);
}
function layered(u,v,seed){
 return (noise(u,v,2,seed)*.41+noise(u,v,4,seed+19)*.28+
   noise(u,v,8,seed+37)*.18+noise(u,v,16,seed+53)*.09+
   noise(u,v,32,seed+79)*.04);
}
const presets={
 stone:{type:'wall',base:[103,119,111],mortar:[24,35,33],courses:4,columns:2,relief:.68,depth:.77,erosion:.39,noise:.82,seed:17,overlay:.08},
 goldstone:{type:'wall',base:[159,130,91],mortar:[48,39,30],courses:4,columns:2,relief:.62,depth:.69,erosion:.33,noise:.76,seed:31,overlay:.08},
 moss:{type:'wall',base:[80,112,94],mortar:[20,36,32],courses:4,columns:2,relief:.85,depth:.80,erosion:.60,noise:.9,seed:47,overlay:.05},
 floor:{type:'floor',base:[104,116,107],mortar:[24,35,35],courses:2,columns:2,relief:.67,depth:.85,erosion:.48,noise:.8,seed:61,overlay:.08}
};
function recipeFor(asset){
 const preset=presets[asset?.id]||presets.stone;
 const r=asset?.materialRecipe||{};
 return {...preset,...r,type:r.type||preset.type,
  base:Array.isArray(r.base)?r.base.slice(0,3):preset.base.slice(),
  mortar:Array.isArray(r.mortar)?r.mortar.slice(0,3):preset.mortar.slice()};
}
function build(asset,{size=128,cut=false}={}){
 const recipe=recipeFor(asset);
 size=clamp(Math.floor(size),32,256);
 const seed=+recipe.seed||17,cols=clamp(Math.round(recipe.columns||2),1,8),
  rows=clamp(Math.round(recipe.courses||4),1,12),
  erosion=clamp(+recipe.erosion,0,1),strength=clamp(+recipe.relief,0,2),
  mortar=clamp(+recipe.depth,0,1.5),grain=clamp(+recipe.noise,0,2),
  overlay=clamp(+recipe.overlay||0,0,.5);
 const height=new Float32Array(size*size);
 const albedo=new Uint8Array(size*size*4),normals=new Uint8Array(size*size*4),
  roughness=new Uint8Array(size*size*4);
 const isMoss=asset?.id==='moss',floor=recipe.type==='floor';
 const edgeWidth=clamp(.010+erosion*.008,.005,.035);
 const wrap=n=>(n%size+size)%size;
 function pixelHeight(u,v){
  const warpX=(noise(u,v,8,seed+191)-.5)*erosion*.012,
        warpY=(noise(u,v,8,seed+203)-.5)*erosion*.009;
  const yy=(v+warpY+1)%1;
  const rr=yy*rows,row=Math.floor(rr),partY=fract(rr);
  const offset=row%2?.5:0;
  const xx=((u+warpX)*cols+offset);
  const partX=fract(xx);
  const eY=Math.min(partY,1-partY)/rows;
  const eX=Math.min(partX,1-partX)/cols;
  const nearest=Math.min(eX,eY),joint=cut?0:1-smooth(edgeWidth*.25,edgeWidth*1.24,nearest);
  const chipped=noise(u,v,32,seed+307);
  const damage=smooth(.67,.92,chipped)*erosion*.082;
  // Both endpoints of each textured tile share exactly the same mortar and noise.
  const raw=layered(u,v,seed+107);
  const larger=noise(u,v,4,seed+111);
  const stoneId=hash(((Math.floor(xx)%cols)+cols)%cols,row,seed+47);
  const face=(raw-.5)*.115*grain+(larger-.5)*.09*grain+(stoneId-.5)*.037;
  const bevel=cut?1:smooth(edgeWidth*.42,edgeWidth*2.35,nearest);
  const h=(.055+face)*strength*bevel - joint*mortar*.17-damage;
  return{h,joint,bevel,grain:raw,stoneId,damage,nearest};
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const p=pixelHeight(x/size,y/size),i=y*size+x,j=i*4;
  height[i]=p.h;
  const sediment=noise(x/size,y/size,16,seed+401),
        stains=smooth(.58,.86,noise(x/size,y/size,4,seed+451));
  const occlusion=1-p.joint*.35;
  const mineral=(p.grain-.5)*49*grain+(p.stoneId-.5)*31+
     (sediment-.5)*18 + (p.bevel-.5)*16 - stains*erosion*23;
  const mossMask=isMoss?smooth(.55,.78,noise(x/size,y/size,8,seed+611))*.72:0;
  for(let channel=0;channel<3;channel++){
   let value=mix(recipe.base[channel]+mineral,
     recipe.mortar[channel]+(p.grain-.5)*14,p.joint*.95);
   if(isMoss)value=mix(value,[38,87,61][channel],mossMask);
   if(asset?.pixels?.length && overlay>0){
    const aw=Math.max(1,asset.width||32),ah=Math.max(1,asset.height||aw);
    const px=Math.floor(x/size*aw)%aw,py=Math.floor(y/size*ah)%ah;
    const str=asset.pixels[py*aw+px];
    if(typeof str==='string' && /^#[0-9a-f]{6}$/i.test(str)){
     value=mix(value,parseInt(str.slice(1+channel*2,3+channel*2),16),overlay);
    }
   }
   albedo[j+channel]=clamp(Math.round(value*occlusion),0,255);
  }
  albedo[j+3]=255;
  const r=clamp(.81+p.joint*.15 + (sediment-.5)*.1+erosion*.07,0,1);
  const rough=Math.round(r*255);
  roughness[j]=roughness[j+1]=roughness[j+2]=rough;roughness[j+3]=255;
 }
 // True height-derived tangent normals. Not a sharpen filter over diffuse pixels:
 // grout depth, bevels, erosion and chipped stone all participate independently.
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(height[y*size+wrap(x+1)]-height[y*size+wrap(x-1)])*.5;
  const dy=(height[wrap(y+1)*size+x]-height[wrap(y-1)*size+x])*.5;
  const scale=size/128*5.2,nx=-dx*scale,ny=dy*scale,nz=1;
  const inverse=1/Math.hypot(nx,ny,nz),i=(y*size+x)*4;
  normals[i]=Math.round(clamp((nx*inverse*.5+.5)*255,0,255));
  normals[i+1]=Math.round(clamp((ny*inverse*.5+.5)*255,0,255));
  normals[i+2]=Math.round(clamp((nz*inverse*.5+.5)*255,0,255));normals[i+3]=255;
 }
 return{size,width:size,height:size,recipe,albedo,normals,roughness,heightMap:height};
}
function textures(THREE,asset,{quality='medium',cut=false}={}){
 const res=quality==='low'?64:quality==='high'?256:128;
 const data=build(asset,{size:res,cut});
 const make=(pixels,srgb=false)=>{
  const t=new THREE.DataTexture(pixels,data.size,data.size,THREE.RGBAFormat,THREE.UnsignedByteType);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.NearestFilter;
  t.minFilter=THREE.NearestMipmapNearestFilter||THREE.NearestFilter;
  t.generateMipmaps=true;
  t.flipY=false;
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;
  t.needsUpdate=true;
  return t;
 };
 return{diffuse:make(data.albedo,true),normal:make(data.normals),roughness:make(data.roughness),
  recipe:data.recipe,size:data.size};
}
C.StoneMaterials={presets,recipeFor,build,textures};
})();
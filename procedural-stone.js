/* CRIPT / Limestone Surface v3
   Built from separately authored stone courses, mineral strata, eroded rims,
   microscopic pores and lime joints. Shared height field drives PBR normals;
   the cut variant has NO painted joints (used on physically separate stones). */
(function(){
'use strict';
const C=window.Cript=window.Cript||{};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fract=n=>n-Math.floor(n),mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function hash(x,y,s){
 let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(s|0,1442695041);
 h=Math.imul(h^(h>>>13),1274126177);
 return((h^(h>>>16))>>>0)/4294967296;
}
function noise(u,v,n,seed){
 const x=u*n,y=v*n,ix=Math.floor(x),iy=Math.floor(y);
 const fx=fract(x),fy=fract(y),sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const wrap=q=>(q%n+n)%n;
 return mix(mix(hash(wrap(ix),wrap(iy),seed),hash(wrap(ix+1),wrap(iy),seed),sx),
            mix(hash(wrap(ix),wrap(iy+1),seed),hash(wrap(ix+1),wrap(iy+1),seed),sx),sy);
}
const presets={
 stone:{type:'wall',base:[119,119,108],mortar:[78,80,72],courses:4,columns:2,relief:.88,depth:.69,erosion:.48,noise:1,wetness:.31,polish:.13,seed:17,overlay:.04},
 goldstone:{type:'wall',base:[153,136,110],mortar:[104,91,75],courses:4,columns:2,relief:.83,depth:.67,erosion:.35,noise:.91,wetness:.26,polish:.20,seed:31,overlay:.04},
 moss:{type:'wall',base:[99,117,101],mortar:[66,83,66],courses:4,columns:2,relief:.97,depth:.77,erosion:.65,noise:1.12,wetness:.67,polish:.08,seed:47,overlay:.03},
 floor:{type:'floor',base:[122,119,108],mortar:[88,83,76],courses:2,columns:2,relief:.94,depth:.67,erosion:.55,noise:1.06,wetness:.46,polish:.24,seed:61,overlay:.03}
};
function recipeFor(asset){
 const preset=presets[asset?.id]||presets.stone,r=asset?.materialRecipe||{};
 return{...preset,...r,type:r.type||preset.type,
 base:Array.isArray(r.base)?r.base.slice(0,3):preset.base.slice(),
 mortar:Array.isArray(r.mortar)?r.mortar.slice(0,3):preset.mortar.slice()};
}
function build(asset,{size=128,cut=false}={}){
 const r=recipeFor(asset);size=clamp(Math.floor(size),32,256);
 const seed=Number(r.seed)||17,cols=clamp(Math.round(r.columns||2),1,8),
 rows=clamp(Math.round(r.courses||4),1,12),erosion=clamp(+r.erosion,0,1),
 relief=clamp(+r.relief,0,2),depth=clamp(+r.depth,0,1.5),
 grain=clamp(+r.noise,0,2),wet=clamp(+r.wetness||0,0,1),
 polish=clamp(+r.polish||0,0,1),overlay=clamp(+r.overlay||0,0,.5);
 const floor=r.type==='floor',isMoss=asset?.id==='moss',len=size*size;
 const height=new Float32Array(len),albedo=new Uint8Array(len*4),
 normals=new Uint8Array(len*4),roughness=new Uint8Array(len*4);
 const wrap=i=>(i+size)%size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,i=y*size+x,j=i*4;
  // Each course has its own seam phase, stone tone and asymmetric weathering.
  const row=Math.floor(v*rows),courseY=fract(v*rows);
  const long=noise(u,v,3,seed+107),mid=noise(u,v,9,seed+139),
        small=noise(u,v,32,seed+157),micro=noise(u,v,64,seed+183),
        strata=noise(u,v,16,seed+201);
  const seamWarp=(mid-.5)*.014*erosion+(small-.5)*.007*erosion;
  const rowPhase=(row%2)*.45+hash(0,row,seed+91)*.14;
  const brickX=u*cols+rowPhase+seamWarp*cols,block=Math.floor(brickX);
  const localX=fract(brickX),jointX=Math.min(localX,1-localX)/cols;
  const jointY=Math.min(courseY,1-courseY)/rows;
  const nearest=Math.min(jointX,jointY);
  const seamWidth=.0032+erosion*.0022;
  const wobble=(small-.5)*.0027*erosion;
  const joint=cut?0:1-smooth(seamWidth*.42,seamWidth*1.8,nearest+wobble);
  const edge= cut?1:smooth(seamWidth*.5,seamWidth*3.1,nearest+wobble);
  const id=hash((block%cols+cols)%cols,row,seed+33);
  // A limestone-like micro-height field: sediment bands, pits and fractured rims.
  const layers=Math.sin(v*145+long*9+mid*3)*.012;
  const pits=Math.pow(Math.max(0,small-.58),2)*.20+Math.pow(Math.max(0,micro-.68),2)*.21;
  const chip=smooth(.71,.92,small)*erosion*.027*(1-edge);
  const face=(long-.5)*.128+(mid-.5)*.078+(small-.5)*.057+
     (micro-.5)*.034+layers-pits-(id-.5)*.020;
  const h=(.07+grain*face)*relief*edge-joint*depth*.13-chip;
  height[i]=h;
  // Remove the previous charcoal outline; lime mortar is shaded by
  // its recess and shares minerals with the stone instead of being black.
  const iron=smooth(.57,.84,noise(u,v,4,seed+223))*erosion;
  const variation=(long-.5)*28+(mid-.5)*28+(small-.5)*18+(micro-.5)*9+
        (strata-.5)*11+(id-.5)*32+layers*90-pits*65-iron*12;
  const poreShadow=pits*27;
  const moss=isMoss?smooth(.55,.78,noise(u,v,8,seed+269))*.42:0;
  for(let k=0;k<3;k++){
   const base=r.base[k]+variation-poreShadow;
   let value=mix(base,r.mortar[k]+(mid-.5)*11,joint*.79);
   if(moss)value=mix(value,[55,93,60][k],moss);
   if(asset?.pixels?.length&&overlay){
    const aw=Math.max(1,asset.width||32),ah=Math.max(1,asset.height||aw);
    const c=asset.pixels[(Math.floor(v*ah)%ah)*aw+Math.floor(u*aw)%aw];
    if(typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))
      value=mix(value,parseInt(c.slice(1+k*2,3+k*2),16),overlay);
   }
   albedo[j+k]=Math.round(clamp(value*(1-joint*.08),0,255));
  }
  albedo[j+3]=255;
  const damp=smooth(.43,.83,noise(u,v,8,seed+319));
  const polishMask=smooth(.58,.83,strata)*(1-joint);
  let rough=.88+(small-.5)*.13+(micro-.5)*.075- wet*damp*.39-
    polish*polishMask*.24+erosion*.05;
  if(floor)rough-=.05;
  if(isMoss)rough+=.06;
  rough=mix(clamp(rough,.27,.99),.96,joint*.95);
  const rb=Math.round(clamp(rough,.23,.99)*255);
  roughness[j]=roughness[j+1]=roughness[j+2]=rb;roughness[j+3]=255;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(height[y*size+wrap(x+1)]-height[y*size+wrap(x-1)])*.5;
  const dy=(height[wrap(y+1)*size+x]-height[wrap(y-1)*size+x])*.5;
  const strength=size/128*5.2,nx=-dx*strength,ny=dy*strength,nz=1,
        inv=1/Math.hypot(nx,ny,nz),j=(y*size+x)*4;
  normals[j]=Math.round(clamp((nx*inv*.5+.5)*255,0,255));
  normals[j+1]=Math.round(clamp((ny*inv*.5+.5)*255,0,255));
  normals[j+2]=Math.round(clamp((nz*inv*.5+.5)*255,0,255));normals[j+3]=255;
 }
 return{size,width:size,height:size,recipe:r,albedo,normals,roughness,
        smoothness:roughness,heightMap:height};
}
function textures(THREE,asset,{quality='medium',cut=false}={}){
 const size=quality==='low'?64:quality==='high'?256:128;
 const data=build(asset,{size,cut});
 const make=(pixels,srgb=false)=>{
  const t=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.magFilter=THREE.LinearFilter||THREE.NearestFilter;
  t.minFilter=THREE.LinearMipmapLinearFilter||THREE.NearestMipmapNearestFilter||THREE.NearestFilter;
  t.generateMipmaps=true;t.flipY=false;
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;
  t.needsUpdate=true;return t;
 };
 return{diffuse:make(data.albedo,true),normal:make(data.normals),roughness:make(data.roughness),
        recipe:data.recipe,size};
}
C.StoneMaterials={presets,recipeFor,build,textures};
})();
/* CRIPT | CPU-baked world-space irradiance + ambient occlusion atlas.
   Three.js built-in lightMap/aoMap need uv2: instanced blocks have shared UV2,
   so one global XZ/height atlas avoids per-instance lightmap geometry. */
(function(){
'use strict';
const C=window.Cript,T=window.THREE;
if(!C||!T)return;
const R={nx:72,nz:72,ny:8,step:.9,y0:.27,dy:1.32};
const init=new Uint8Array(R.nx*R.nz*R.ny*4);
for(let i=0;i<init.length;i+=4){init[i]=30;init[i+1]=36;init[i+2]=43;init[i+3]=235;}
class BakedLighting{
 constructor(scene,world,project){
  this.scene=scene;this.world=world;this.project=project;
  this.uniform={value:null};this.timeUniform={value:0};this.materials=[];this.moons=[];
  this.worker=null;this.generation=0;this.timer=0;
  this.texture=this.makeTexture(init);this.uniform.value=this.texture;
  this.addMoonlight();
 }
 makeTexture(data){
  const t=new T.DataTexture(data,R.nx,R.nz*R.ny,T.RGBAFormat,T.UnsignedByteType);
  t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.minFilter=t.magFilter=T.LinearFilter;
  t.generateMipmaps=false;t.flipY=false;t.needsUpdate=true;return t;
 }
 attach(material){
  if(!material?.isMeshStandardMaterial)return;
  if(material.userData?.criptBakedGI)return;
  material.userData=material.userData||{};material.userData.criptBakedGI=true;
  const prev=material.onBeforeCompile,gi=this.uniform;
  material.onBeforeCompile=shader=>{
   if(prev)prev(shader);
   shader.uniforms.criptGIAtlas=gi;
   shader.vertexShader='varying vec3 vCriptBakedWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',[
    '#include <project_vertex>',
    'vec4 criptProbePoint=vec4(transformed,1.0);',
    '#ifdef USE_INSTANCING',
    '  criptProbePoint=instanceMatrix*criptProbePoint;',
    '#endif',
    'vCriptBakedWorld=(modelMatrix*criptProbePoint).xyz;'
   ].join('\n'));
   shader.fragmentShader=[
    'varying vec3 vCriptBakedWorld;',
    'uniform sampler2D criptGIAtlas;',
    'vec4 criptSampleBakedLight(vec3 p){',
    '  float x=clamp(p.x/.9,.5,71.5),z=clamp(p.z/.9,.5,71.5);',
    '  float level=clamp((p.y-.27)/1.32,0.0,7.0);',
    '  float a=floor(level),b=min(7.0,a+1.0);',
    '  vec4 l=texture2D(criptGIAtlas,vec2(x/72.0,(a*72.0+z)/576.0));',
    '  vec4 h=texture2D(criptGIAtlas,vec2(x/72.0,(b*72.0+z)/576.0));',
    '  return mix(l,h,fract(level));',
    '}'
   ].join('\n')+'\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',[
    '#include <lights_fragment_maps>',
    'vec4 criptBake=criptSampleBakedLight(vCriptBakedWorld);',
    'reflectedLight.indirectDiffuse*=mix(1.0,criptBake.a,.84);',
    'reflectedLight.indirectDiffuse+=criptBake.rgb*diffuseColor.rgb*1.60;'
   ].join('\n'));
  };
  const oldKey=material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey=()=>String(oldKey?oldKey():'')+'|cript-baked-gi-v2';
  material.needsUpdate=true;this.materials.push(material);
 }
 sources(){
  const result=[];
  for(const room of Object.values(this.project.rooms)){
   const w=(x,z)=>({x:(room.gx*9+x+.5)*1.8,z:(room.gz*9+z+.5)*1.8});
   for(const p of room.props||[]){
    if(p.kind!=='torch'&&p.kind!=='fireplace')continue;
    const center=w(p.x,p.z),fire=p.kind==='fireplace';
    result.push({x:center.x,y:fire?1.0:1.75,z:center.z,radius:fire?10.2:8.3,power:fire?2.15:1.2,
      color:fire?[1,.43,.18]:[1,.61,.3],type:p.kind});
   }
   if(room.skylight){
    const p=w(4,4),h=C.Masonry.config(room).height;
    result.push({x:p.x,y:h+1,z:p.z,radius:14.8,power:3.7,color:[.66,.83,1],type:'moon'});
   }
  }
  return result;
 }
 addMoonlight(){
  for(const room of Object.values(this.project.rooms)){
   if(!room.skylight)continue;
   const h=C.Masonry.config(room).height,x=(room.gx*9+4.5)*1.8,z=(room.gz*9+4.5)*1.8;
   const beamH=Math.max(3.1,h-.5),radius=1.4+beamH*.14;
   const mat=new T.ShaderMaterial({
    uniforms:{uTime:this.timeUniform,uColor:{value:new T.Color(0xc0ddff)}},
    transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:T.AdditiveBlending,
    vertexShader:[
     'varying vec3 vPos;varying vec3 vWorld;',
     'void main(){',
     'vPos=position;vWorld=(modelMatrix*vec4(position,1.0)).xyz;',
     'gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);',
     '}'
    ].join('\n'),
    fragmentShader:[
     'uniform float uTime;uniform vec3 uColor;',
     'varying vec3 vPos;varying vec3 vWorld;',
     'void main(){',
     'float ripples=.88+.12*sin(vWorld.x*2.2+vWorld.z*3.6+uTime*.22);',
     'float fade=clamp((vPos.y+4.0)/8.0,.32,1.0);',
     'float a=(.027+.025*ripples)*fade;',
     'gl_FragColor=vec4(uColor*(.34+.20*ripples),a);',
     '}'
    ].join('\n')
   });
   const shaft=new T.Mesh(new T.ConeGeometry(radius,beamH,16,1,true),mat);
   shaft.position.set(x,beamH/2+.36,z);shaft.renderOrder=2;this.world.add(shaft);
   const spot=new T.SpotLight(0xbdd8ff,2.4,beamH+5,.4,.69,1.7);
   spot.castShadow=false;spot.position.set(x,h+.35,z);
   spot.target.position.set(x-.35,.3,z+.2);
   this.world.add(spot,spot.target);
   this.moons.push({x,z,shaft,spot});
  }
 }
 cacheKey(payload){
  const signature=JSON.stringify({rooms:payload.rooms,sources:payload.sources,
    nx:payload.nx,nz:payload.nz,ny:payload.ny,ver:'baked-gi-ao-v3'});
  let hash=2166136261;
  for(let i=0;i<signature.length;i++){
   hash^=signature.charCodeAt(i);hash=Math.imul(hash,16777619);
  }
  return 'bake-'+(hash>>>0).toString(16);
 }
 openCache(){
  if(this.cacheDB)return this.cacheDB;
  if(typeof indexedDB==='undefined')return Promise.resolve(null);
  this.cacheDB=new Promise(resolve=>{
   try{
    const request=indexedDB.open('CRIPT-GI-Lightmaps',1);
    request.onupgradeneeded=()=>{
     if(!request.result.objectStoreNames.contains('atlases'))request.result.createObjectStore('atlases');
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>resolve(null);
    request.onblocked=()=>resolve(null);
   }catch(e){resolve(null)}
  });
  return this.cacheDB;
 }
 async readCache(key){
  const db=await this.openCache();if(!db)return null;
  return new Promise(resolve=>{
   try{
    const req=db.transaction('atlases','readonly').objectStore('atlases').get(key);
    req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);
   }catch(e){resolve(null)}
  });
 }
 async writeCache(key,buffer){
  const db=await this.openCache();if(!db)return;
  try{
   const store=db.transaction('atlases','readwrite').objectStore('atlases');
   store.put(buffer,key);
  }catch(e){}
 }
 schedule(){
  const token=++this.generation;if(this.timer)clearTimeout(this.timer);
  this.timer=setTimeout(()=>this.bake(token),170);
 }
 bake(token){
  if(token!==this.generation)return;
  const rooms=Object.values(this.project.rooms).map(r=>({
   gx:r.gx,gz:r.gz,height:C.Masonry.config(r).height,
   solid:r.tiles.map(id=>!!this.project.assets.textures[id]?.solid)
  }));
  const payload={...R,token,rooms,sources:this.sources()};
  const key=this.cacheKey(payload);
  const finish=(msg,cached=false)=>{
   if(this.disposed||msg.token!==this.generation||msg.error||!msg.result)return;
   const next=this.makeTexture(new Uint8Array(msg.result.buffer)),prev=this.texture;
   this.uniform.value=next;this.texture=next;prev.dispose?.();
   this.stats=msg.result.statistics;
   this.stats.cached=cached;
   if(!cached)this.writeCache(key,msg.result.buffer);
  };
  const fallback=()=>setTimeout(()=>{
   if(this.disposed||token!==this.generation||!window.CriptGIWorker)return;
   finish({token,result:window.CriptGIWorker.bake(payload)});
  },0);
  const runWorker=()=>{
   if(token!==this.generation||this.disposed)return;
   if(typeof Worker!=='undefined'&&(typeof location==='undefined'||location.protocol!=='file:')){
    try{
     if(this.worker)this.worker.terminate();
     const worker=new Worker('lighting-bake-worker.js');
     this.worker=worker;
     worker.onmessage=e=>{finish(e.data);worker.terminate();if(this.worker===worker)this.worker=null};
     worker.onerror=()=>{worker.terminate();if(this.worker===worker)this.worker=null;fallback()};
     worker.postMessage(payload);return;
    }catch(e){this.worker?.terminate();this.worker=null}
   }
   fallback();
  };
  this.readCache(key).then(buffer=>{
   if(this.disposed||token!==this.generation)return;
   if(buffer&&buffer.byteLength===R.nx*R.nz*R.ny*4)
    finish({token,result:{buffer,statistics:{lights:payload.sources.length,
      samples:R.nx*R.nz*R.ny,occlusions:0}}},true);
   else runWorker();
  }).catch(runWorker);
 }
 update(x,z,time){
  this.timeUniform.value=time;
  for(const m of this.moons){
   const active=Math.hypot(m.x-x,m.z-z)<23;
   m.shaft.visible=active;m.spot.intensity=active?2.2:0;
  }
 }
 dispose(){
  this.disposed=true;this.generation++;clearTimeout(this.timer);this.worker?.terminate();
  for(const m of this.moons){m.shaft.geometry.dispose();m.shaft.material.dispose();this.world.remove(m.shaft,m.spot,m.spot.target)}
  this.moons.length=0;this.texture?.dispose();
 }
}
C.Lighting={BakedLighting,resolution:R};
})();
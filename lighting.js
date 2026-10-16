/* CRIPT | CPU-baked world-space irradiance + ambient occlusion atlas.
   Three.js built-in lightMap/aoMap need uv2: instanced blocks have shared UV2,
   so one global XZ/height atlas avoids per-instance lightmap geometry. */
(function(){
'use strict';
const C=window.Cript,T=window.THREE;
if(!C||!T)return;
const createSurfaceAtlasShader=L=>[
 'vec4 criptSampleBakedLight(vec3 p,vec3 n){',
 'vec2 room=floor(clamp(p.xz / 16.2,vec2(0.0),vec2(3.9999)));',
 'vec2 local=clamp(p.xz-room*16.2,vec2(0.0),vec2(16.2));',
 'vec3 faceAbs=abs(n);',
 'float face=0.0;',
 'if(faceAbs.y>=0.5 && faceAbs.y>=max(faceAbs.x,faceAbs.z)*0.85)face=n.y>=0.0?0.0:1.0;',
 'else if(faceAbs.x>faceAbs.z)face=n.x>=0.0?2.0:3.0;',
 'else face=n.z>=0.0?4.0:5.0;',
 'float row=floor(face/2.0),col=mod(face,2.0);',
 'vec2 chartOrigin=vec2(room.x*'+L.cellW+'.0+col*'+L.patchW+'.0+'+L.padding+'.0,',
 ' room.y*'+L.cellH+'.0+(row<0.5?0.0:(row<1.5?'+L.planeH+'.0:'+ (L.planeH+L.wallH)+'.0))+'+L.padding+'.0);',
 'vec2 metric=face<1.5?local:(face<3.5?vec2(local.y,p.y):vec2(local.x,p.y));',
 'metric=clamp(metric,vec2(0.0),face<1.5?vec2('+L.roomMeters+'):vec2('+L.roomMeters+','+L.maxHeight+'));',
 'vec2 maximum=vec2('+ (L.floorPx-1)+'.0,row<0.5?'+(L.floorPx-1)+'.0:'+(L.wallPx-1)+'.0);',
 'vec2 coord=chartOrigin+clamp(metric*'+L.ppm+'.0-vec2(.5),vec2(0.0),maximum)+vec2(.5);',
 'return texture2D(criptGIAtlas,coord/vec2('+L.width+'.0,'+L.height+'.0));',
 '}'
].join('\n');
class BakedLighting{
 constructor(scene,world,project){
  this.scene=scene;this.world=world;this.project=project;
  this.layout=C.UV.layout(project.editor?.quality||'medium');
  this.uniform={value:null};this.debugUniform={value:0};this.timeUniform={value:0};this.fogColor={value:new T.Color(0x2b504d)};this.fogDensity={value:.36};this.materials=[];this.moons=[];
  this.worker=null;this.generation=0;this.timer=0;
  const init=new Uint8Array(this.layout.width*this.layout.height*4);
  for(let i=0;i<init.length;i+=4){init[i]=30;init[i+1]=36;init[i+2]=43;init[i+3]=235}
  this.texture=this.makeTexture(init);this.uniform.value=this.texture;
  this.addMoonlight();
 }
 makeTexture(data){
  const t=new T.DataTexture(data,this.layout.width,this.layout.height,T.RGBAFormat,T.UnsignedByteType);
  t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.minFilter=t.magFilter=T.NearestFilter;t.anisotropy=1;
  t.generateMipmaps=false;t.flipY=false;t.needsUpdate=true;return t;
 }
 attach(material){
  if(!material?.isMeshStandardMaterial)return;
  if(material.userData?.criptBakedGI)return;
  material.userData=material.userData||{};material.userData.criptBakedGI=true;
  const prev=material.onBeforeCompile,gi=this.uniform,debug=this.debugUniform,fogColor=this.fogColor,fogDensity=this.fogDensity;
  material.onBeforeCompile=shader=>{
   if(prev)prev(shader);
   shader.uniforms.criptGIAtlas=gi;
   shader.uniforms.criptDebugMode=debug;
   shader.uniforms.criptHeightFogColor=fogColor;
   shader.uniforms.criptHeightFogDensity=fogDensity;
   shader.vertexShader='varying vec3 vCriptBakedWorld;\nvarying vec3 vCriptWorldNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',[
    '#include <project_vertex>',
    'vec4 criptProbePoint=vec4(transformed,1.0);',
    '#ifdef USE_INSTANCING',
    '  criptProbePoint=instanceMatrix*criptProbePoint;',
    '#endif',
    'vCriptBakedWorld=(modelMatrix*criptProbePoint).xyz;',
    'vec3 criptFaceNormal=normal;',
    '#ifdef USE_INSTANCING',
    '  criptFaceNormal=mat3(instanceMatrix)*criptFaceNormal;',
    '#endif',
    'vCriptWorldNormal=normalize(mat3(modelMatrix)*criptFaceNormal);',
    // UV0 is measured in world meters, not local model units, so an instanced
    // column and 8-m wall maintain the same albedo/normal texel footprint.
    'vec3 criptAN=abs(vCriptWorldNormal);',
    'vec2 criptUV=criptAN.y>=max(criptAN.x,criptAN.z)?vCriptBakedWorld.xz:',
    ' (criptAN.x>criptAN.z?vCriptBakedWorld.zy:vCriptBakedWorld.xy);',
    'criptUV/=1.8;',
    '#ifdef USE_MAP',
    '  vMapUv=criptUV;',
    '#endif',
    '#ifdef USE_NORMALMAP',
    '  vNormalMapUv=criptUV;',
    '#endif',
    '#ifdef USE_ROUGHNESSMAP',
    '  vRoughnessMapUv=criptUV;',
    '#endif'
   ].join('\n'));
   shader.fragmentShader=[
    'varying vec3 vCriptBakedWorld;',
    'varying vec3 vCriptWorldNormal;',
    'uniform sampler2D criptGIAtlas;',
    'uniform float criptDebugMode;',
    'uniform vec3 criptHeightFogColor;',
    'uniform float criptHeightFogDensity;',
    createSurfaceAtlasShader(this.layout)
   ].join('\n')+'\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',[
    '#include <lights_fragment_maps>',
    'vec4 criptBake=criptSampleBakedLight(vCriptBakedWorld,normalize(vCriptWorldNormal));',
    'reflectedLight.indirectDiffuse*=mix(1.0,criptBake.a,.28);',
    'reflectedLight.indirectDiffuse+=criptBake.rgb*diffuseColor.rgb*1.60;'
   ].join('\n'));
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',[
    '#include <opaque_fragment>',
    'float criptFloorTerm=exp(-max(0.0,vCriptBakedWorld.y)*2.75);',
    'float criptWallFacing=1.0-clamp(abs(normalize(vCriptWorldNormal).y),0.0,1.0);',
    'float criptContactAO=1.0-.51*criptFloorTerm*criptWallFacing;',
    'float criptSurfaceAO=clamp(criptBake.a*criptContactAO,.16,1.0);',
    'gl_FragColor.rgb*=mix(1.0,criptSurfaceAO,.76);',
    'if(criptDebugMode>1.5)gl_FragColor.rgb=criptBake.rgb;',
    'else if(criptDebugMode>.5)gl_FragColor.rgb=vec3(criptSurfaceAO);'
   ].join('\n'));
   // Height fog is part of the world material, not a full-screen blur pass.
   // It pools against low masonry, revealing silhouettes above the mist.
   shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',[
    '#include <fog_fragment>',
    'float criptFogHeight=exp(-max(0.0,vCriptBakedWorld.y-.32)*.93);',
    'float criptFogDistance=1.0-exp(-distance(vCriptBakedWorld,cameraPosition)*.115);',
    'float criptFog=clamp(criptFogHeight*criptFogDistance*criptHeightFogDensity,0.0,.82);',
    'if(criptDebugMode<.5)gl_FragColor.rgb=mix(gl_FragColor.rgb,criptHeightFogColor,criptFog);'
   ].join(String.fromCharCode(10)));


  };
  const oldKey=material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey=()=>String(oldKey?oldKey():'')+'|cript-baked-gi-v6-' + this.layout.ppm;
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
    nx:payload.nx,nz:payload.nz,ny:payload.ny,ver:'surface-charts-uv6',layout:payload.layout});
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
  const payload={surfaceAtlas:true,layout:this.layout,token,rooms,sources:this.sources()};
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
   finish({token,result:window.CriptGIWorker.bakeSurface(payload)});
  },0);
  const runWorker=()=>{
   if(token!==this.generation||this.disposed)return;
   if(typeof Worker!=='undefined'&&(typeof location==='undefined'||location.protocol!=='file:')){
    try{
     if(this.worker)this.worker.terminate();
     const worker=new Worker('lighting-bake-worker.js?v=uv06');
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
   if(buffer&&buffer.byteLength===this.layout.width*this.layout.height*4)
    finish({token,result:{buffer,statistics:{lights:payload.sources.length,
      samples:0,occlusions:0,charts:96,texelsPerMeter:this.layout.ppm,padding:this.layout.padding}}},true);
   else runWorker();
  }).catch(runWorker);
 }
 setDebugMode(mode=0){this.debugUniform.value=Math.max(0,Math.min(2,Math.round(mode)))}
 setFog(atmosphere){
  if(!atmosphere)return;
  this.fogColor.value.set(atmosphere.fog||'#284744');
  this.fogDensity.value=Math.max(0,Math.min(1.35,(Number(atmosphere.heightFog)||.4)*1.68));
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
C.Lighting={BakedLighting,resolution:C.UV.layout};
})();
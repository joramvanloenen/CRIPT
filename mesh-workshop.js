/* CRIPT Mesh Workshop — interactive closed-loop authoring of reusable 3D meshes.
   The AI/repository can provide recipes; the browser generates, audits, refines,
   previews and exports them using the same kernel as the game. */
(function(){
'use strict';
const C=window.Cript,T=window.THREE,editor=C.editor;
if(!C?.MeshForge||!editor||!T)return;
const $=id=>document.getElementById(id);
class ForgePreview{
 constructor(){
  this.host=document.createElement('div');this.host.className='forge-viewport';this.host.hidden=true;
  const bar=document.createElement('div');bar.className='forge-toolbar';
  bar.textContent='MESH FORGE  /  drag to orbit  ·  scroll to zoom';
  this.status=document.createElement('div');this.status.className='forge-status';
  this.host.append(bar,this.status);
  $('editorStage').appendChild(this.host);
  this.scene=new T.Scene();this.scene.background=new T.Color('#131e20');
  this.scene.add(new T.HemisphereLight(0xa4bcb6,0x292a28,1.3));
  const key=new T.DirectionalLight(0xffd3a0,3.3);key.position.set(4,7,5);this.scene.add(key);
  const fill=new T.DirectionalLight(0x83b5d2,1.7);fill.position.set(-4,3,-5);this.scene.add(fill);
  const rim=new T.DirectionalLight(0xc8d8f6,.7);rim.position.set(0,8,-3);this.scene.add(rim);
  this.camera=new T.PerspectiveCamera(48,1,.02,200);
  this.renderer=new T.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  this.renderer.outputColorSpace=T.SRGBColorSpace;
  this.host.insertBefore(this.renderer.domElement,this.status);
  this.renderer.domElement.style.touchAction='none';
  this.yaw=.67;this.pitch=.27;this.distance=4.5;this.center=new T.Vector3(0,.5,0);this.drag=null;
  const canvas=this.renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{
   e.preventDefault();this.drag={x:e.clientX,y:e.clientY,id:e.pointerId};
   canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
   if(!this.drag||this.drag.id!==e.pointerId)return;
   this.yaw+=(e.clientX-this.drag.x)*.008;
   this.pitch=Math.max(-1.3,Math.min(1.3,this.pitch+(e.clientY-this.drag.y)*.006));
   this.drag.x=e.clientX;this.drag.y=e.clientY;this.render();
  });
  canvas.addEventListener('pointerup',()=>this.drag=null);
  canvas.addEventListener('pointercancel',()=>this.drag=null);
  canvas.addEventListener('wheel',e=>{
   e.preventDefault();this.distance=Math.max(.6,Math.min(40,this.distance*Math.exp(e.deltaY*.001)));
   this.render();
  },{passive:false});
  this.mesh=null;this.lastRecipe='';this.report=null;this.lastWidth=0;this.lastHeight=0;
 }
 show(visible){this.host.hidden=!visible;if(visible){this.renderRecipe(editor.asset());this.render()}}
 resize(){
  const width=Math.max(220,this.host.clientWidth),height=Math.max(200,this.host.clientHeight);
  if(this.lastWidth===width&&this.lastHeight===height)return;
  this.lastWidth=width;this.lastHeight=height;
  this.renderer.setSize(width,height,false);
  this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
 }
 renderRecipe(recipe){
  if(!recipe)return;
  const json=JSON.stringify(recipe);
  if(json===this.lastRecipe)return;
  this.lastRecipe=json;
  if(this.mesh){this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh=null}
  try{
   const source=C.MeshForge.build(recipe),result=C.MeshForge.audit(source);
   if(!result.valid)throw Error(result.errors.join(' · '));
   const geometry=C.MeshForge.toThree(T,source);
   const material=new T.MeshStandardMaterial({color:recipe.type==='bell'?0xa68a5c:0x8a9c94,roughness:.68,metalness:recipe.type==='bell'?.63:.08,flatShading:true,side:T.DoubleSide});
   this.mesh=new T.Mesh(geometry,material);
   this.scene.add(this.mesh);this.report=result;
   const min=result.dimensions,maxR=Math.max(.1,...min);
   this.center.set((result.bounds?.min?.[0]||0)+min[0]/2,(result.bounds?.min?.[1]||0)+min[1]/2,(result.bounds?.min?.[2]||0)+min[2]/2);
   this.distance=Math.max(2,maxR*2.4);
   this.status.textContent=result.triangles+' triangles  ·  '+result.vertices+' vertices  ·  MANIFOLD';
  }catch(e){
   this.report={valid:false,errors:[String(e.message||e)]};
   this.status.textContent='BUILD FAILED: '+String(e.message||e);
  }
  this.render();
 }
 render(){
  if(this.host.hidden)return;this.resize();
  const cp=Math.cos(this.pitch);
  this.camera.position.set(this.center.x+Math.sin(this.yaw)*cp*this.distance,
   this.center.y+Math.sin(this.pitch)*this.distance,this.center.z+Math.cos(this.yaw)*cp*this.distance);
  this.camera.lookAt(this.center);
  this.renderer.render(this.scene,this.camera);
 }
}
let forge=null;
const previousInspector=editor.renderInspector.bind(editor);
editor.renderInspector=function(){
 if(this.mode!=='mesh'){previousInspector();forge?.show(false);return}
 if(!forge)forge=new ForgePreview();
 const a=this.asset(),body=$('inspectorBody');body.replaceChildren();
 if(!a){forge.show(false);return}
 $('workTitle').textContent=a.name.toUpperCase();
 $('modeCaption').textContent='3D MESH RECIPE / '+a.id;
 this.field(body,'MODEL NAME',a,'name');
 this.field(body,'MODEL TECHNIQUE',a,'type','select',['ashlar','slab','profile','voussoir','column','capital','rib','sarcophagus','urn','bell']);
 const groups={
  ashlar:['width','height','depth','bevel','erosion','seed'],
  slab:['width','height','depth','bevel','erosion','seed'],
  profile:['depth','bevel','erosion','seed'],
  voussoir:['depth','bevel','erosion','seed'],
  column:['height','radius','segments','flutes','fluteDepth','seed'],
  capital:['width','height','depth','bevel','erosion','seed'],
  rib:['span','rise','thickness','segments','seed'],
  sarcophagus:['width','height','depth','erosion','seed'],
  urn:['width','height','segments','seed'],
  bell:['width','height','segments','seed']
 };
 this.heading(body,'MODELING PARAMETERS','Real profile extrusion, bevel rings, rotational lathing and curved sweep surfaces.');
 for(const key of groups[a.type]||groups.ashlar)this.field(body,key.replace(/([A-Z])/g,' $1').toUpperCase(),a,key,'number');
 if(a.type==='urn'||a.type==='bell'){
  this.heading(body,'LATHE CROSS-SECTION','Edit the actual radius/height curve for the exterior, lip and hollow interior; changes are audited for manifold topology.');
  if(!a.latheProfile){
   this.button(body,'◈ MAKE REVOLVED PROFILE EDITABLE',()=>{
    this.checkpoint();a.latheProfile=C.copy(C.MeshForge.latheProfiles[a.type]);this.change();
   });
  }else{
   body.append(this.formField('LATHE PROFILE [radius, height]',JSON.stringify(a.latheProfile),'textarea',value=>{
    try{
     const profile=JSON.parse(value),candidate={...a,latheProfile:profile};
     const report=C.MeshForge.audit(C.MeshForge.build(candidate));
     if(!report.valid)throw Error(report.errors.join(', '));
     this.checkpoint();a.latheProfile=profile;this.change();
    }catch(error){alert('Profile edit rejected: '+error.message)}
   }));
  }
 }

 if(a.type==='profile'||a.type==='voussoir'){
  body.append(this.formField('2D OUTLINE / VERTICES',JSON.stringify(a.outline||[],null,1),'textarea',v=>{
   try{
    const outline=JSON.parse(v);
    C.MeshForge.build({...a,outline});
    this.checkpoint();a.outline=outline;this.change();
   }catch(error){alert('Invalid outline: '+error.message)}
  }));
 }
 this.heading(body,'CLOSED MODELING LOOP','Generate mesh → audit topology → score variants → adopt strongest valid recipe.');
 const current=forge?.report;
 if(current){const p=document.createElement('p');p.className='forge-report';
  p.textContent=current.valid?'PASS · '+current.triangles+' triangles · '+current.area+' m² · closed manifold':current.errors.join(' / ');
  body.append(p);
 }
 this.button(body,'↻ GENERATE & AUDIT',()=>{
  forge.lastRecipe='';forge.renderRecipe(a);this.renderInspector();
 });
 this.button(body,'◇ AUTO REFINE (12 CANDIDATES)',()=>{
  try{
   const result=C.MeshForge.refine(a,12);
   const changed=JSON.stringify(result.recipe)!==JSON.stringify(a);
   if(changed){this.checkpoint();Object.assign(a,result.recipe);this.change();}
   this.lastForgeHistory=result.history;
   forge.lastRecipe='';forge.renderRecipe(a);this.renderInspector();
  }catch(error){alert('Model refinement failed: '+error.message)}
 });
 if(this.lastForgeHistory){
  const p=document.createElement('p');p.className='forge-report';
  const valid=this.lastForgeHistory.filter(e=>e.report?.valid);
  p.textContent=valid.length+'/'+this.lastForgeHistory.length+' valid candidates tested';
  body.append(p);
 }
 this.heading(body,'AI / RECIPE INTERFACE','Edit this declarative JSON to script a modeling operation. No arbitrary JavaScript is executed.');
 const textArea=document.createElement('textarea');textArea.rows=8;textArea.className='forge-recipe';
 textArea.value=JSON.stringify(a,null,2);body.append(textArea);
 this.button(body,'APPLY JSON RECIPE',()=>{
  try{
   const next=JSON.parse(textArea.value);next.id=a.id;
   const report=C.MeshForge.audit(C.MeshForge.build(next));
   if(!report.valid)throw Error(report.errors.join('; '));
   this.checkpoint();Object.keys(a).forEach(k=>delete a[k]);Object.assign(a,next);
   this.change();
  }catch(error){alert('Model recipe rejected: '+error.message)}
 });
 this.button(body,'↓ EXPORT WAVEFRONT OBJ',()=>{
  try{const blob=new Blob([C.MeshForge.asObj(C.MeshForge.build(a),a.name)],{type:'text/plain'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=(a.id||'forged')+'.obj';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){alert('Export failed: '+error.message)}
 });
 forge.show(true);
};
const previousDraw=editor.draw.bind(editor);
editor.draw=function(){
 if(this.mode==='mesh'){
  const ctx=this.ctx;ctx.fillStyle='#142326';ctx.fillRect(0,0,576,576);
  ctx.fillStyle='#97b3aa';ctx.font='22px Georgia';ctx.textAlign='center';
  ctx.fillText('MESH FORGE',288,270);ctx.font='12px monospace';ctx.fillText('ORBIT AND INSPECT THE MODEL IN 3D',288,312);
  if(!forge)forge=new ForgePreview();
  forge.show(true);return;
 }
 forge?.show(false);return previousDraw();
};
const previousPreview=editor.preview.bind(editor);
editor.preview=function(){if(this.mode==='mesh'){forge?.render();return}return previousPreview()};
const previousChange=editor.change.bind(editor);
editor.change=function(){previousChange();if(this.mode==='mesh'){if(!forge)forge=new ForgePreview();forge.show(true)}};
const prevSetMode=editor.setMode.bind(editor);
editor.setMode=function(mode){prevSetMode(mode);if(mode==='mesh'){if(!forge)forge=new ForgePreview();forge.show(true)}else forge?.show(false)};
})();

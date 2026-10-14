/* CRIPT Mesh Vision Workshop: inspect reference-vs-candidate silhouettes
   (red = extra geometry, cyan = missing, neutral = matched), and approve
   parameter changes only after better multi-view image alignment. */
(function(){
'use strict';
const C=window.Cript,editor=C?.editor,V=C?.MeshVision;
if(!editor||!V)return;
const SIZE=72;
let targetMode='art',targetId=null,reference=null,lastHistory=null,lastAsset='';
function visualTargets(asset){
 if(targetMode==='upload'&&reference)return{front:reference};
 if(targetMode==='model'){
  const match=C.project.assets.meshes?.[targetId];
  if(match)return V.targetFromRecipe(match,{size:SIZE});
 }
 return V.targetFromRecipe(V.artRecipe(asset),{size:SIZE});
}
function imageButton(body,label,action){
 const b=document.createElement('button');
 b.textContent=label;b.onclick=action;body.append(b);return b;
}
function paragraph(body,text,className=''){
 const p=document.createElement('p');p.textContent=text;if(className)p.className=className;body.append(p);return p;
}
function targetChoice(body,a){
 const label=document.createElement('label');label.className='field';label.textContent='VISUAL REFERENCE';
 const select=document.createElement('select');
 const choices=[['art','Gothic art-direction target'],...Object.values(C.project.assets.meshes||{})
   .filter(o=>o.id!==a.id).map(o=>['asset:'+o.id,'Other mesh: '+o.name])];
 if(reference)choices.push(['upload','Imported image silhouette']);
 for(const [key,name]of choices){const opt=document.createElement('option');opt.value=key;opt.textContent=name;select.append(opt)}
 const value=targetMode==='model'?'asset:'+targetId:targetMode;
 select.value=choices.some(c=>c[0]===value)?value:'art';
 select.onchange=()=>{
  if(select.value.startsWith('asset:')){targetMode='model';targetId=select.value.slice(6)}
  else targetMode=select.value;
  editor.renderInspector();
 };
 label.append(select);body.append(label);
 const up=document.createElement('input');up.type='file';up.accept='image/png,image/jpeg,image/webp';up.className='forge-target-file';
 up.setAttribute('aria-label','Import target silhouette image');
 up.onchange=()=>{
  const file=up.files?.[0];if(!file)return;
  if(file.size>8*1024*1024){alert('Reference image must be below 8 MB');return}
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   try{
    const scale=Math.min(1,512/Math.max(img.naturalWidth,img.naturalHeight));
    const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    reference=V.maskFromRGBA(ctx.getImageData(0,0,w,h).data,w,h,{size:SIZE});
    targetMode='upload';lastHistory=null;editor.renderInspector();
   }catch(e){alert('Reference could not be read: '+e.message)}
   URL.revokeObjectURL(url);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);alert('Unsupported reference image')};
  img.src=url;
 };
 body.append(up);
}
const previousInspector=editor.renderInspector.bind(editor);
editor.renderInspector=function(){
 previousInspector();
 if(this.mode!=='mesh')return;
 const asset=this.asset(),body=document.getElementById('inspectorBody');
 if(!asset)return;
 if(asset.id!==lastAsset){lastHistory=null;lastAsset=asset.id}
 const section=document.createElement('section');section.className='forge-vision-panel';
 const heading=document.createElement('h3');heading.textContent='VISUAL EVALUATION';section.append(heading);
 paragraph(section,'Compare rendered geometry against a target. Cyan = missing silhouette, red = excess, stone = matched. Three camera views; no external AI service.', 'forge-vision-description');

 if(C.MeshForge.curated?.[asset.id]&&asset.artPass!=='gothic-01'){
  imageButton(section,'✦ APPLY GOTHIC MODEL PASS',()=>{
   editor.checkpoint();
   const selected=C.MeshForge.curated[asset.id];
   const name=asset.name,id=asset.id;
   Object.assign(asset,C.copy(selected),{id,name,artPass:'gothic-01'});
   editor.change();
  });
 }
  targetChoice(section,asset);
 let targets;
 try{targets=visualTargets(asset)}catch(e){paragraph(section,'Target failed: '+e.message);body.append(section);return}
 let metrics;
 try{metrics=V.evaluate(asset,targets,{size:SIZE,views:Object.keys(targets)})}
 catch(e){paragraph(section,'Visual evaluator failed: '+e.message);body.append(section);return}
 const score=document.createElement('div');score.className='forge-vision-score';
 score.textContent=(metrics.score*100).toFixed(1)+'% visual similarity';
 section.append(score);
 const views=document.createElement('div');views.className='forge-vision-views';
 const current=C.MeshForge.build(asset);
 for(const name of Object.keys(targets)){
  const sampled=V.render(current,name,SIZE),target=targets[name],m=metrics.views[name];
  const cell=document.createElement('div');cell.className='forge-vision-view';
  const canvas=document.createElement('canvas');canvas.width=SIZE;canvas.height=SIZE;
  canvas.title=name+' / '+(100*m.iou).toFixed(1)+'% overlap';
  const ctx=canvas.getContext('2d'),pic=ctx.createImageData(SIZE,SIZE);
  pic.data.set(V.colorPixels(sampled,target));ctx.putImageData(pic,0,0);
  const caption=document.createElement('small');caption.textContent=name.toUpperCase()+' / '+Math.round(m.iou*100)+'%';
  cell.append(canvas,caption);views.append(cell);
 }
 section.append(views);
 paragraph(section,'A higher score means a closer silhouette and value pattern—not a judgment of gothic artistic quality.','forge-vision-description');
 imageButton(section,'◎ MATCH TARGET / ITERATE',()=>{
  const button=section.querySelector('button:last-of-type');
  if(button)button.disabled=true;
  setTimeout(()=>{
   try{
    const before=V.evaluate(asset,targets,{size:SIZE,views:Object.keys(targets)});
    const result=V.refine(asset,targets,{iterations:4,size:SIZE,views:Object.keys(targets)});
    lastHistory={...result,before:before.score,asset:asset.id};
    if(result.improvement>.0004){
     editor.checkpoint();
     // Do not replace identity, links, materials or unrelated metadata.
     for(const [key,value]of Object.entries(result.recipe))
      if(key!=='id'&&key!=='name')asset[key]=value;
     editor.change();
    }else editor.renderInspector();
   }catch(e){alert('Visual matching failed: '+e.message);if(button)button.disabled=false}
  },0);
 });
 if(lastHistory?.asset===asset.id){
  const info=lastHistory;
  const gain=Math.round((info.score-info.before)*10000)/100;
  paragraph(section,'Visual result: '+(info.before*100).toFixed(1)+'% → '+(info.score*100).toFixed(1)+
   '% ('+(gain>=0?'+':'')+gain.toFixed(2)+' points); '+info.accepted+' accepted changes / '+info.evaluated+' tested.', 'forge-report');
  const edits=info.history.filter(e=>e.key);
  if(edits.length)paragraph(section,'Revisions: '+edits.map(e=>e.key+' '+(e.direction>0?'increase':'decrease')).join(' · '),'forge-vision-description');
 }
 imageButton(section,'↓ EXPORT COMPARISON PNG',()=>{
  const canvas=document.createElement('canvas');canvas.width=SIZE*Object.keys(targets).length;canvas.height=SIZE;
  const ctx=canvas.getContext('2d');
  for(const [i,view]of Object.keys(targets).entries()){
   const img=ctx.createImageData(SIZE,SIZE);
   img.data.set(V.colorPixels(V.render(C.MeshForge.build(asset),view,SIZE),targets[view]));
   ctx.putImageData(img,i*SIZE,0);
  }
  const link=document.createElement('a');link.download=asset.id+'-comparison.png';link.href=canvas.toDataURL('image/png');link.click();
 });
 body.append(section);
};
})();

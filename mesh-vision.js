/* CRIPT Mesh Vision — deterministic orthographic image-based model criticism.
   Orthographic silhouette + lighting/value comparison from THREE independent cameras.
   Not an LLM or image-understanding API: geometry-grounded art direction with
   human/AI supplied visual targets. Runs in browser and node without a GPU. */
(function(){
'use strict';
const C=window.Cript=window.Cript||{},F=C.MeshForge;
if(!F)throw Error('Load mesh-forge.js before mesh-vision.js');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
const VIEWS=['front','side','iso'];
function project(p,view){
 const [x,y,z]=p;
 if(view==='side')return[z,y,-x];
 if(view==='top')return[x,z,y];
 if(view==='iso')return[(x+z)*.707107,y*.87+(z-x)*.29,(z-x)*.707107];
 return[x,y,z];
}
function render(mesh,view='front',size=72){
 size=clamp(Math.floor(size),24,192);
 const p=mesh.positions,n=mesh.normals;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<p.length;i++){const k=i%3;min[k]=Math.min(min[k],p[i]);max[k]=Math.max(max[k],p[i]);}
 const center=min.map((x,i)=>(x+max[i])*.5),length=Math.max(.0001,...max.map((x,i)=>x-min[i]));
 const scale=(size*(view==='iso'?.56:.75))/length;
 const mask=new Uint8Array(size*size),values=new Uint8Array(size*size),depth=new Float32Array(size*size);
 depth.fill(-Infinity);
 const pt=(i)=>{const x=p[i*3]-center[0],y=p[i*3+1]-center[1],z=p[i*3+2]-center[2];
  const v=project([x,y,z],view);
  return[(v[0]*scale+size*.5),(-v[1]*scale+size*.5),v[2]];
 };
 function area(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
 for(let i=0;i<p.length/9;i++){
  const a=pt(i*3),b=pt(i*3+1),c=pt(i*3+2),signed=area(a,b,c);
  if(Math.abs(signed)<1e-8)continue;
  const xmin=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));
  const xmax=Math.min(size-1,Math.ceil(Math.max(a[0],b[0],c[0])));
  const ymin=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));
  const ymax=Math.min(size-1,Math.ceil(Math.max(a[1],b[1],c[1])));
  if(xmin>xmax||ymin>ymax)continue;
  const normal=[n[i*9],n[i*9+1],n[i*9+2]];
  const lit=clamp(.48+normal[0]*.17+normal[1]*.32+normal[2]*.23,.18,.98);
  for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
   const q=[x+.5,y+.5],w0=area(b,c,q)/signed,w1=area(c,a,q)/signed,w2=1-w0-w1;
   if(w0<-.0001||w1<-.0001||w2<-.0001)continue;
   const z=w0*a[2]+w1*b[2]+w2*c[2],k=y*size+x;
   if(z<=depth[k])continue;
   depth[k]=z;mask[k]=255;values[k]=Math.round(lit*255);
  }
 }
 return{size,view,mask,values,dimensions:max.map((v,i)=>+(v-min[i]).toFixed(4))};
}
function coverage(a){
 let pixels=0,mx=0,my=0,minX=a.size,minY=a.size,maxX=-1,maxY=-1;
 for(let i=0;i<a.mask.length;i++)if(a.mask[i]){
  const x=i%a.size,y=Math.floor(i/a.size);pixels++;mx+=x;my+=y;
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
 }
 const width=pixels?(maxX-minX+1):0,height=pixels?(maxY-minY+1):0;
 return{pixels,fill:+(pixels/a.mask.length).toFixed(5),width,height,aspect:+(width/Math.max(1,height)).toFixed(5),
   centroid:[mx/Math.max(1,pixels),my/Math.max(1,pixels)]};
}
function compare(a,b){
 if(a.size!==b.size)throw Error('Comparison resolution differs');
 let intersection=0,union=0,shade=0,overlap=0,missing=0,excess=0;
 for(let i=0;i<a.mask.length;i++){
  const c=!!a.mask[i],t=!!b.mask[i];
  if(c||t)union++;
  if(c&&t){intersection++;overlap++;shade+=Math.abs(a.values[i]-b.values[i])/255}
  if(t&&!c)missing++;
  if(c&&!t)excess++;
 }
 const iou=union?intersection/union:1;
 const ac=coverage(a),bc=coverage(b);
 const ratioErr=Math.abs(Math.log(Math.max(.001,ac.aspect)/Math.max(.001,bc.aspect)));
 const centroidErr=Math.hypot(ac.centroid[0]-bc.centroid[0],ac.centroid[1]-bc.centroid[1])/a.size;
 const valueDifference=overlap?shade/overlap:1;
 const score=clamp(iou*.76+(1-Math.min(1,ratioErr))*.10+
  (1-Math.min(1,centroidErr*2))*.06+
  (1-Math.min(1,valueDifference))*.08,0,1);
 return{score:+score.toFixed(6),iou:+iou.toFixed(6),ratioError:+ratioErr.toFixed(6),
  valueDifference:+valueDifference.toFixed(6),missing,excess,candidate:ac,target:bc};
}
function targetFromRecipe(recipe,{size=72,views=VIEWS}={}){
 const model=F.build(recipe);return Object.fromEntries(views.map(v=>[v,render(model,v,size)]));
}
function evaluate(recipe,targets,{size=72,views=VIEWS}={}){
 const model=F.build(recipe),report=F.audit(model);
 if(!report.valid)return{valid:false,score:-1,report};
 let total=0,weights=0;const parts={};
 for(const view of views){
  if(!targets[view])continue;
  const target=targets[view],rendered=render(model,view,target.size||size);
  const cmp=compare(rendered,target),w=view==='front'?1.4:view==='iso'?1.15:1;
  parts[view]=cmp;total+=w*cmp.score;weights+=w;
 }
 if(!weights)throw Error('No visual target views supplied');
 const topologyPenalty=Math.max(0,report.triangles-2400)*.000002;
 const score=clamp(total/weights-topologyPenalty,0,1);
 return{valid:true,score:+score.toFixed(6),views:parts,report};
}
function parameters(recipe){
 const t=recipe.type||'ashlar';
 if(t==='column')return ['height','radius','fluteDepth','segments'];
 if(t==='urn'||t==='bell')return ['width','height','segments'];
 if(t==='rib')return ['span','rise','thickness'];
 if(t==='profile'||t==='voussoir')return ['depth','bevel','outlineX','outlineY'];
 if(t==='sarcophagus')return ['width','height','depth','erosion'];
 return['width','height','depth','bevel','erosion'];
}
const LIMITS={width:[.16,8],height:[.15,12],depth:[.10,8],radius:[.08,2.5],rise:[.2,8],
 span:[.6,12],thickness:[.05,1],bevel:[.002,.19],erosion:[0,.95],segments:[8,56],fluteDepth:[.002,.13],
 outlineX:[.45,2.0],outlineY:[.45,2.0]};
function change(recipe,key,direction,factor){
 const next={...recipe};
 if(key==='outlineX'||key==='outlineY'){
  if(!Array.isArray(next.outline))return null;
  const axis=key==='outlineX'?0:1,pts=next.outline;
  const center=pts.reduce((s,p)=>s+p[axis],0)/pts.length;
  const sc=clamp(1+direction*factor,.7,1.3);
  next.outline=pts.map(p=>p.map((q,i)=>i===axis?+(center+(q-center)*sc).toFixed(5):q));
  return next;
 }
 const defaults={width:1,height:1,depth:.6,radius:.3,rise:1.7,span:4,thickness:.2,bevel:.045,
  erosion:.2,segments:24,fluteDepth:.045};
 const val=Number.isFinite(+next[key])?+next[key]:defaults[key],lo=LIMITS[key][0],hi=LIMITS[key][1];
 let updated=clamp(val*(1+direction*factor),lo,hi);
 if(key==='segments')updated=clamp(Math.round(updated/2)*2,lo,hi);
 next[key]=+updated.toFixed(5);
 if(next[key]===recipe[key])return null;
 return next;
}
function refine(recipe,targets,{iterations=3,size=64,views=VIEWS}={}){
 // Coordinate descent with explicit *image* comparisons, not a topology-only
 // aesthetic guess. Candidate changes are directly attributable to profile
 // width, height, depth, radius, arch rise, flutes, bevel or erosion.
 const loop=clamp(Math.round(iterations),1,6);
 let best={recipe:{...recipe},...evaluate(recipe,targets,{size,views})};
 if(!best.valid)throw Error('Starting geometry invalid');
 const initial=best.score,history=[{step:0,score:best.score,recipe:best.recipe,metrics:best.views}];
 let accepted=0,evaluated=1;
 for(let pass=0;pass<loop;pass++){
  let improved=false;
  const step=.19*Math.pow(.54,pass);
  for(const key of parameters(recipe)){
   let choice=null;
   for(const direction of [-1,1]){
    const next=change(best.recipe,key,direction,step);if(!next)continue;
    evaluated++;
    try{
     const assessment=evaluate(next,targets,{size,views});
     if(assessment.valid&&assessment.score>best.score+.0004&&(!choice||assessment.score>choice.score))
      choice={recipe:next,...assessment,key,direction};
    }catch(_){}
   }
   if(choice){
    const before=best.score;best=choice;accepted++;improved=true;
    history.push({step:accepted,pass,key,direction:choice.direction,delta:+(best.score-before).toFixed(6),
     score:best.score,recipe:best.recipe,metrics:best.views});
   }
  }
  if(!improved&&pass>0)break;
 }
 return{...best,initialScore:initial,improvement:+(best.score-initial).toFixed(6),
  evaluated,accepted,history};
}
function colorPixels(rendered,target){
 const N=rendered.size,pixels=new Uint8ClampedArray(N*N*4);
 for(let i=0;i<N*N;i++){
  const j=i*4,c=!!rendered.mask[i],t=!!target?.mask?.[i];
  const v=rendered.values[i];
  if(c&&t){pixels[j]=Math.min(255,Math.round(60+v*.35));pixels[j+1]=Math.min(255,Math.round(95+v*.65));pixels[j+2]=Math.round(105+v*.22);}
  else if(c){pixels[j]=210;pixels[j+1]=98;pixels[j+2]=85;}
  else if(t){pixels[j]=65;pixels[j+1]=196;pixels[j+2]=204;}
  else{pixels[j]=16;pixels[j+1]=29;pixels[j+2]=31;}
  pixels[j+3]=255;
 }
 return pixels;
}
function maskFromRGBA(pixels,width,height,{size=72,background='auto',alphaThreshold=20}={}){
 // Input image is normalized to square with aspect preserved. Transparency is
 // authoritative, otherwise compare to the four corner pixels (background).
 const corners=[0,(width-1)*4,(width*(height-1))*4,(width*height-1)*4];
 const bg=[0,1,2].map(k=>corners.reduce((s,i)=>s+pixels[i+k],0)/corners.length);
 const useAlpha=background==='alpha'||background==='auto'&&
  corners.some(i=>pixels[i+3]<230);
 const out={size,view:'front',mask:new Uint8Array(size*size),values:new Uint8Array(size*size)};
 // Sample input inside a fitted 84%-size area so comparison shares camera framing.
 const sc=Math.min((size*.78)/width,(size*.78)/height);
 const W=width*sc,H=height*sc,x0=(size-W)/2,y0=(size-H)/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=Math.floor((x-x0)/sc),v=Math.floor((y-y0)/sc),o=y*size+x;
  if(u<0||v<0||u>=width||v>=height)continue;
  const i=(v*width+u)*4,alpha=pixels[i+3];
  const diff=Math.hypot(pixels[i]-bg[0],pixels[i+1]-bg[1],pixels[i+2]-bg[2]);
  const fg=useAlpha?alpha>alphaThreshold:diff>38;
  if(fg){out.mask[o]=255;out.values[o]=Math.round((pixels[i]+pixels[i+1]+pixels[i+2])/3)}
 }
 return out;
}
// Curated art-direction targets. They are intentionally distinct from the
// default modeling recipes, so evaluation cannot self-grade identical images.
// Artists can replace any target with a reference model or a PNG silhouette.
const targetStyles={
 'chipped-stone':{width:1.32,height:.71,depth:.59,bevel:.08,erosion:.34},
 'gothic-voussoir':{depth:.56,bevel:.043,outline:[[-.37,-.25],[.35,-.25],[.57,.25],[-.53,.25]]},
 'fluted-column':{height:4.15,radius:.38,flutes:16,fluteDepth:.065,segments:36},
 'vault-rib':{span:5.6,rise:2.55,thickness:.23,segments:20},
 'carved-capital':{width:1.01,height:.46,depth:.79,bevel:.073},
 'stone-sarcophagus':{width:1.31,height:.89,depth:2.52,erosion:.29},
 'urn':{width:1.31,height:1.61,segments:32},
 'bell':{width:1.18,height:1.65,segments:36}
};
const typeStyles={
 ashlar:{bevel:.066,erosion:.29},
 slab:{erosion:.26},
 column:{fluteDepth:.06,flutes:14},
 sarcophagus:{width:1.2,height:.84},
 urn:{width:1.17},
 bell:{width:1.15},
 rib:{rise:2.1}
};
function artRecipe(recipe){
 const patch=targetStyles[recipe.id]||typeStyles[recipe.type]||{};
 return{...recipe,...patch,name:(recipe.name||recipe.type)+' / ART TARGET'};
}
C.MeshVision={VIEWS,render,coverage,compare,evaluate,targetFromRecipe,refine,change,colorPixels,maskFromRGBA,artRecipe,targetStyles};
})();
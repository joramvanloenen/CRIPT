/* CRIPT Mesh Forge: declarative hard-surface modeling, validation, OBJ export.
   A recipe is safe JSON: no code execution, no external modeling process. */
(function(){
'use strict';
const C=window.Cript=window.Cript||{};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),fract=n=>n-Math.floor(n);
const hash=(a,b=0,c=0)=>fract(Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453);
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len=a=>Math.hypot(...a);
const norm=a=>mul(a,1/(len(a)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function area2(points){return points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1]},0)*.5;}
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function earclip(poly){
 const n=poly.length,reverse=area2(poly)<0,pts=reverse?[...poly].reverse():poly;
 const origin=reverse?pts.map((_,i)=>n-1-i):pts.map((_,i)=>i);
 const ids=pts.map((_,i)=>i),tris=[];let rounds=0;
 while(ids.length>3&&rounds++<n*n){
  let success=false;
  for(let k=0;k<ids.length;k++){
   const a=ids[(k+ids.length-1)%ids.length],b=ids[k],c=ids[(k+1)%ids.length];
   if(orient(pts[a],pts[b],pts[c])<1e-8)continue;
   if(ids.some(j=>j!==a&&j!==b&&j!==c&&orient(pts[a],pts[b],pts[j])>=0&&orient(pts[b],pts[c],pts[j])>=0&&orient(pts[c],pts[a],pts[j])>=0))continue;
   tris.push([origin[a],origin[b],origin[c]]);ids.splice(k,1);success=true;break;
  }
  if(!success)throw Error('Invalid or self-intersecting profile');
 }
 if(ids.length===3)tris.push(ids.map(i=>origin[i]));return tris;
}
class Mesh{
 constructor(){this.positions=[];this.normals=[];this.uvs=[];this.triangles=0;}
 triangle(a,b,c){
  const n=cross(sub(b,a),sub(c,a)),ln=len(n);if(ln<1e-9)return;
  const normal=mul(n,1/ln);
  const axis=[Math.abs(normal[0]),Math.abs(normal[1]),Math.abs(normal[2])].indexOf(Math.max(...normal.map(Math.abs)));
  for(const p of [a,b,c]){this.positions.push(...p);this.normals.push(...normal);
   this.uvs.push(...(axis===0?[p[2]/1.8,p[1]/1.8]:axis===1?[p[0]/1.8,p[2]/1.8]:[p[0]/1.8,p[1]/1.8]))}
  this.triangles++;
 }
 quad(a,b,c,d){this.triangle(a,b,c);this.triangle(a,c,d);}
 append(other){this.positions.push(...other.positions);this.normals.push(...other.normals);this.uvs.push(...other.uvs);this.triangles+=other.triangles;return this}
}
function extrude(outline,opts={}){
 if(!Array.isArray(outline)||outline.length<3||outline.length>128||outline.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n))))throw Error('Invalid profile vertices');
 const pts=outline.map(p=>p.slice());if(area2(pts)<0)pts.reverse();
 const area=area2(pts);if(area<.00001)throw Error('Zero-area profile');
 const depth=clamp(+opts.depth||.5,.03,10),erosion=clamp(+opts.erosion||0,0,1),seed=opts.seed||1;
 const cen=[pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length];
 const extent=Math.max(...pts.map(p=>Math.hypot(p[0]-cen[0],p[1]-cen[1])));
 const b=clamp(+opts.bevel||0,0,Math.min(depth*.30,extent*.14));
 const ringspec=b>0?[[-depth/2,1-b/extent],[-depth/2+b,1],[depth/2-b,1],[depth/2,1-b/extent]]:[[-depth/2,1],[depth/2,1]];
 const rings=ringspec.map(([z,k],layer)=>pts.map((p,i)=>[
   cen[0]+(p[0]-cen[0])*k,cen[1]+(p[1]-cen[1])*k,
   z+(layer===0?-1:layer===ringspec.length-1?1:0)*hash(i,seed,layer)*erosion*.014
 ]));
 const mesh=new Mesh(),tris=earclip(pts);
 for(const [i,j,k] of tris){const back=rings[0],front=rings.at(-1);mesh.triangle(back[k],back[j],back[i]);mesh.triangle(front[i],front[j],front[k]);}
 for(let layer=0;layer<rings.length-1;layer++)for(let i=0;i<pts.length;i++){
  const j=(i+1)%pts.length;mesh.quad(rings[layer][i],rings[layer][j],rings[layer+1][j],rings[layer+1][i]);
 }
 return mesh;
}
function chippedOutline(w=1,h=1,erosion=.2,seed=1){
 const x=w*.5,y=h*.5,e=clamp(.027+erosion*.13,.016,.22),n=i=>hash(seed,i)*erosion*.046;
 return [[-x+e+n(0),-y],[x-e-n(1),-y],[x,-y+e+n(2)],[x,y-e-n(3)],
 [x-e-n(4),y],[-x+e+n(5),y],[-x,y-e-n(6)],[-x,-y+e+n(7)]];
}
function lathe(profile,opts={}){
 if(!Array.isArray(profile)||profile.length<2)throw Error('Lathe profile is missing');
 const n=clamp(Math.round(opts.segments||24),8,64),mesh=new Mesh(),rings=[];
 for(let j=0;j<profile.length;j++){
  const [r,y]=profile[j];if(!Number.isFinite(r)||r<0||!Number.isFinite(y))throw Error('Invalid lathe profile');
  const ring=[];for(let i=0;i<n;i++){
   const theta=2*Math.PI*i/n,flutes=Math.max(0,opts.flutes||0),wave=flutes?1-(opts.fluteDepth||.04)*(.5+.5*Math.cos(theta*flutes)):1;
   const radius=r*wave;ring.push([Math.cos(theta)*radius,y,Math.sin(theta)*radius]);
  }rings.push(ring);
 }
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){
  const next=(i+1)%n;
  mesh.quad(rings[j][i],rings[j+1][i],rings[j+1][next],rings[j][next]);
 }
 // Note: positive theta around +Y is clockwise from above.
 for(const [ring,y,top] of [[rings[0],profile[0][1],false],[rings.at(-1),profile.at(-1)[1],true]]){
  for(let i=0;i<n;i++){const k=(i+1)%n;if(top)mesh.triangle([0,y,0],ring[i],ring[k]);else mesh.triangle([0,y,0],ring[k],ring[i]);}
 }return mesh;
}
function sweep(path,section){
 if(path.length<2||section.length<3)throw Error('Sweep requires path and section');
 const rings=[],mesh=new Mesh();
 for(let i=0;i<path.length;i++){
  const p=path[i],t=norm(sub(path[Math.min(path.length-1,i+1)],path[Math.max(0,i-1)]));
  const ref=Math.abs(dot(t,[0,1,0]))>.94?[0,0,1]:[0,1,0];
  const right=norm(cross(ref,t)),up=norm(cross(t,right));
  rings.push(section.map(q=>add(p,add(mul(right,q[0]),mul(up,q[1])))));
 }
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<section.length;j++){const k=(j+1)%section.length;mesh.quad(rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]);}
 const caps=earclip(section);
 for(const [a,b,c]of caps){mesh.triangle(rings[0][c],rings[0][b],rings[0][a]);mesh.triangle(rings.at(-1)[a],rings.at(-1)[b],rings.at(-1)[c]);}
 return mesh;
}
const presets={
 'chipped-stone':{id:'chipped-stone',name:'Carved Ashlar',type:'ashlar',width:1.3,height:.61,depth:.55,bevel:.05,erosion:.24,seed:19},
 'gothic-voussoir':{id:'gothic-voussoir',name:'Arch Keystone',type:'profile',outline:[[-.33,-.20],[.33,-.20],[.47,.22],[-.47,.22]],depth:.52,bevel:.024,erosion:.09,seed:23},
 'fluted-column':{id:'fluted-column',name:'Fluted Gothic Column',type:'column',height:3.6,radius:.33,segments:32,flutes:12,fluteDepth:.048,seed:37},
 'vault-rib':{id:'vault-rib',name:'Vault Structural Rib',type:'rib',span:5.2,rise:2.1,thickness:.19,segments:18,seed:44},
 'carved-capital':{id:'carved-capital',name:'Carved Column Capital',type:'capital',width:.85,height:.37,depth:.75,bevel:.06,erosion:.07,seed:8},
 'stone-sarcophagus':{id:'stone-sarcophagus',name:'Burial Sarcophagus',type:'sarcophagus',width:1.16,height:.78,depth:2.3,erosion:.20,seed:57},
 'urn':{id:'urn',name:'Funerary Clay Urn',type:'urn',height:1.45,width:1,segments:28,seed:66},
 'bell':{id:'bell',name:'Ancient Bronze Bell',type:'bell',height:1.45,width:1,segments:32,seed:12}
};
function build(recipe){
 if(!recipe||typeof recipe!=='object')throw Error('A declarative mesh recipe is required');
 const type=recipe.type||'ashlar',seed=clamp(+recipe.seed||1,1,999999),erosion=clamp(+recipe.erosion||0,0,1);
 const w=clamp(+recipe.width||1,.08,10),h=clamp(+recipe.height||1,.08,14),d=clamp(+recipe.depth||.6,.05,10);
 const b=clamp(+recipe.bevel||.045,0,.25);
 let result;
 if(['ashlar','slab','capital'].includes(type)){
  result=extrude(chippedOutline(w,h,erosion,seed),{depth:d,bevel:b,erosion,seed});
  // Capital is a compound joined physical mesh, not one expanded cube.
  if(type==='capital')result.append(extrude(chippedOutline(w*1.18,h*.25,erosion,seed+5),{depth:d*1.2,bevel:b,seed:seed+5}));
 }else if(type==='profile'||type==='voussoir'){
  result=extrude(recipe.outline||[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],{depth:d,bevel:b,erosion,seed});
 }else if(type==='column'){
  const r=clamp(+recipe.radius||.31,.06,1.9),profile=[[r*1.35,0],[r*1.30,.10],[r,.22],[r*.90,.37],[r*.89,h-.3],[r,h-.18],[r*1.32,h-.12],[r*1.42,h]];
  result=lathe(profile,{segments:recipe.segments,flutes:recipe.flutes,fluteDepth:recipe.fluteDepth});
 }else if(type==='urn'||type==='bell'){
  const p=type==='urn'?[[.19,0],[.24,.05],[.27,.15],[.39,.38],[.49,.62],[.44,.97],[.29,1.21],[.24,1.38],[.32,1.45]]:
   [[.22,.05],[.39,.12],[.49,.24],[.53,.44],[.49,.63],[.38,.78],[.28,.95],[.13,1.08],[.1,1.24]];
  result=lathe(p.map(q=>[q[0]*w,q[1]*h/1.45]),{segments:recipe.segments||24});
 }else if(type==='rib'){
  const span=clamp(+recipe.span||4,.6,12),rise=clamp(+recipe.rise||1.7,.2,6),steps=clamp(Math.round(+recipe.segments||16),4,48);
  const path=Array.from({length:steps+1},(_,i)=>{
   const x=(i/steps-.5)*span;return [x,rise*Math.sqrt(Math.max(0,1-(x/(span*.5))**2)),0];
  });
  const t=clamp(+recipe.thickness||.19,.05,.8);
  result=sweep(path,[[-t,-t*.45],[t,-t*.45],[t,t*.45],[-t,t*.45]]);
 }else if(type==='sarcophagus'){
  result=extrude(chippedOutline(w,h*.7,erosion,seed),{depth:d,bevel:.04,erosion,seed});
  result.append(extrude([[-w*.55,h*.32],[w*.55,h*.32],[w*.46,h*.61],[0,h*.81],[-w*.46,h*.61]],
   {depth:d*1.04,bevel:.04,erosion,seed:seed+3}));
 }else throw Error('Unsupported mesh operation: '+type);
 if(result.triangles>26000)throw Error('Exceeded 26,000 triangles');
 return result;
}
function audit(mesh){
 const p=mesh.positions,edges=new Map();let degenerates=0,area=0;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const get=i=>p.slice(i*3,i*3+3);
 function edge(a,b){const fmt=n=>n.map(v=>v.toFixed(4)).join(',');
  const x=fmt(a),y=fmt(b),key=x<y?x+'|'+y:y+'|'+x;edges.set(key,(edges.get(key)||0)+1)}
 for(let i=0;i<p.length;i++){min[i%3]=Math.min(min[i%3],p[i]);max[i%3]=Math.max(max[i%3],p[i]);}
 for(let i=0;i<p.length/3;i+=3){const a=get(i),b=get(i+1),c=get(i+2),s=len(cross(sub(b,a),sub(c,a)))*.5;
  area+=s;if(s<1e-8)degenerates++;edge(a,b);edge(b,c);edge(c,a)}
 let boundaries=0,nonmanifold=0;for(const n of edges.values()){if(n===1)boundaries++;if(n>2)nonmanifold++}
 const errors=[];if(!p.length)errors.push('No geometry');if(p.some(n=>!Number.isFinite(n)))errors.push('Non-finite vertices');
 if(degenerates)errors.push('Degenerate faces: '+degenerates);
 if(boundaries)errors.push('Open edges: '+boundaries);
 if(nonmanifold)errors.push('Non-manifold edges: '+nonmanifold);
 return{valid:errors.length===0,errors,triangles:mesh.triangles,vertices:p.length/3,
  boundaryEdges:boundaries,nonmanifoldEdges:nonmanifold,area:+area.toFixed(3),
  bounds:{min,max},dimensions:max.map((n,i)=>+(n-min[i]).toFixed(3)),uvs:mesh.uvs.length/2};
}
function toThree(T,mesh){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(mesh.positions,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(mesh.normals,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(mesh.uvs,2));g.computeBoundingSphere?.();return g;
}
function asObj(mesh,name='CRIPT Mesh'){
 const lines=['# CRIPT Mesh Forge OBJ','o '+name.replace(/[^a-z0-9 _-]/gi,'')];
 const p=mesh.positions,n=mesh.normals,uv=mesh.uvs;
 for(let i=0;i<p.length;i+=3)lines.push('v '+p.slice(i,i+3).join(' '));
 for(let i=0;i<uv.length;i+=2)lines.push('vt '+uv.slice(i,i+2).join(' '));
 for(let i=0;i<n.length;i+=3)lines.push('vn '+n.slice(i,i+3).join(' '));
 for(let i=0;i<mesh.triangles;i++){const a=i*3+1,b=a+1,c=b+1;lines.push('f '+[a,b,c].map(k=>k+'/'+k+'/'+k).join(' '))}
 return lines.join('\n')+'\n';
}
function refine(recipe,iterations=12){
 const history=[];let best=null;
 for(let i=0;i<Math.min(24,Math.max(1,iterations));i++){
  const candidate={...recipe};
  if(i){const n=Math.floor((i-1)/4)+1,sgn=n%2?-1:1;
   if(i%4===0)candidate.bevel=clamp((candidate.bevel||.04)+sgn*.014*n,.002,.15);
   else if(i%4===1)candidate.erosion=clamp((candidate.erosion||.18)+sgn*.09*n,0,.9);
   else if(i%4===2&&candidate.segments)candidate.segments=clamp(Math.round(candidate.segments+sgn*4*n),8,48);
   else if(candidate.flutes)candidate.fluteDepth=clamp((candidate.fluteDepth||.03)+sgn*.012*n,.005,.12);
  }
  try{
   const geometry=build(candidate),report=audit(geometry);
   const score=100-report.errors.length*35-Math.max(0,report.triangles-1800)*.005-
     Math.abs((candidate.bevel||.045)-.045)*6;
   history.push({iteration:i,recipe:candidate,report,score:+score.toFixed(3)});
   if(!best||score>best.score)best={geometry,recipe:candidate,report,score,iteration:i};
  }catch(e){history.push({iteration:i,error:String(e.message||e),score:-999})}
 }
 if(!best)throw Error('All modeling candidates invalid');
 return{...best,history};
}
C.MeshForge={build,audit,toThree,asObj,refine,presets,extrude,lathe,sweep,chippedOutline};
})();
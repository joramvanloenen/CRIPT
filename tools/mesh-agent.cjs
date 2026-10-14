/* CRIPT closed-loop model-agent CLI: JSON recipe -> candidates -> audit ->
   orthographic SVG review -> OBJ + machine-readable quality report.
   Usage: node tools/mesh-agent.cjs --all --out generated-models
   Or:    node tools/mesh-agent.cjs --recipe custom.json --iterations 16 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../mesh-forge.js'),'utf8'),{window,Math});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../mesh-vision.js'),'utf8'),{window,Math,Uint8Array,Uint8ClampedArray,Float32Array},{filename:'mesh-vision.js'});
const Forge=window.Cript.MeshForge,Vision=window.Cript.MeshVision,PNG=require('./png.cjs');
function previewSVG(mesh,title){
 const p=mesh.positions,n=mesh.normals,panels=[];
 const projections=[
  {label:'FRONT',project:v=>[v[0],v[1],v[2]]},
  {label:'SIDE',project:v=>[v[2],v[1],-v[0]]},
  {label:'ISOMETRIC',project:v=>[(v[0]+v[2])*.71,v[1]*.84+(v[2]-v[0])*.31,v[2]-v[0]]}
 ];
 for(const view of projections){
  const faces=[],xs=[],ys=[];
  for(let i=0;i<p.length;i+=9){
   const vs=[0,3,6].map(j=>view.project([p[i+j],p[i+j+1],p[i+j+2]]));
   vs.forEach(v=>{xs.push(v[0]);ys.push(v[1])});
   const light=Math.max(.22,Math.min(.95,.53+n[i]*.24+n[i+1]*.30+n[i+2]*.14));
   const c=Math.round(55+light*155);
   faces.push({vs,depth:vs.reduce((a,v)=>a+v[2],0)/3,
    fill:'rgb('+Math.round(c*.83)+','+c+','+Math.round(c*.91)+')'});
  }
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=310/Math.max(.001,maxX-minX,maxY-minY);
  const mx=(340-(maxX-minX)*scale)/2,my=(326-(maxY-minY)*scale)/2;
  const point=v=>[(mx+(v[0]-minX)*scale).toFixed(1),(350-(my+(v[1]-minY)*scale)).toFixed(1)].join(',');
  faces.sort((a,b)=>a.depth-b.depth);
  const polys=faces.map(f=>'<polygon points="'+f.vs.map(point).join(' ')+'" fill="'+f.fill+'" stroke="#263c3e" stroke-width=".35"/>').join('');
  panels.push('<rect width="368" height="374" rx="4" fill="#162326"/><text x="13" y="22" fill="#d4c6a5" font-size="13">'+view.label+'</text>'+polys);
 }
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1130 425"><rect width="1130" height="425" fill="#0a1315"/>'+
   '<text x="12" y="23" fill="#d5c9a3" font-family="monospace" font-size="16">'+String(title).replace(/[<>&]/g,'')+'</text>'+
   panels.map((s,i)=>'<g transform="translate('+(i*377)+',39)">'+s+'</g>').join('')+'</svg>';
}
function tiledComparison(recipe,targets,size=64){
 const original=Vision.targetFromRecipe(recipe,{size,views:['front','side','iso']});
 const rgba=new Uint8ClampedArray(size*size*4*3);
 for(let n=0;n<3;n++){
  const view=['front','side','iso'][n],a=original[view],t=targets[view];
  const pix=Vision.colorPixels(a,t);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const di=(y*size*3+n*size+x)*4,si=(y*size+x)*4;
   rgba.set(pix.subarray(si,si+4),di);
  }
 }
 return PNG.encode(size*3,size,rgba);
}
function run(recipes,out,iterations=3,options={}){
 fs.mkdirSync(out,{recursive:true});const manifest=[];
 const size=options.size||64;
 for(const recipe of recipes){
  const id=String(recipe.id||recipe.name||recipe.type).replace(/[^a-z0-9_-]/gi,'-');
  const targetRecipe=options.targets?.[id]||options.target||Vision.artRecipe(recipe);
  const targets=options.reference?{front:options.reference}:Vision.targetFromRecipe(targetRecipe,{size});
  const views=Object.keys(targets);
  const original=Vision.evaluate(recipe,targets,{views,size});
  const model=Vision.refine(recipe,targets,{iterations,size,views});
  if(!model.report.valid)throw Error(id+': '+model.report.errors.join('; '));
  const geometry=Forge.build(model.recipe);
  fs.writeFileSync(path.join(out,id+'.obj'),Forge.asObj(geometry,recipe.name||id));
  fs.writeFileSync(path.join(out,id+'.svg'),previewSVG(geometry,recipe.name||id));
  fs.writeFileSync(path.join(out,id+'.recipe.json'),JSON.stringify(model.recipe,null,2));
  fs.writeFileSync(path.join(out,id+'.before.png'),tiledComparison(recipe,targets,size));
  fs.writeFileSync(path.join(out,id+'.after.png'),tiledComparison(model.recipe,targets,size));
  const report={id,method:'orthographic visual comparison; no semantic model',score:model.score,
   before:original.score,improvement:model.improvement,evaluated:model.evaluated,accepted:model.accepted,
   chosenRecipe:model.recipe,stats:model.report,views:model.views,
   reference:options.reference?'input PNG silhouette':targetRecipe,
   candidates:model.history.map(x=>({step:x.step,pass:x.pass,key:x.key,direction:x.direction,
    score:x.score,delta:x.delta}))};
  fs.writeFileSync(path.join(out,id+'.audit.json'),JSON.stringify(report,null,2));
  manifest.push({id,triangles:model.report.triangles,score:model.score,before:original.score,
   improvement:model.improvement,preview:id+'.after.png',report:id+'.audit.json'});
  console.log('PASS '+id+' | silhouette score '+original.score.toFixed(3)+' -> '+model.score.toFixed(3)+
   ' | '+model.accepted+' targeted edits of '+model.evaluated+' evaluated');
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
 return manifest;
}
if(require.main===module){
 try{
  const args=process.argv.slice(2),arg=(name,fallback)=>{const n=args.indexOf(name);return n<0?fallback:args[n+1]};
  const out=path.resolve(arg('--out','generated-models'));
  const n=Math.min(6,Math.max(1,Number(arg('--iterations','3')))),size=Math.max(32,Math.min(128,Number(arg('--size','64'))));
  let recipes;
  if(args.includes('--all'))recipes=Object.values(Forge.presets);
  else if(args.includes('--recipe')){const value=JSON.parse(fs.readFileSync(path.resolve(arg('--recipe','')),'utf8'));recipes=Array.isArray(value)?value:[value]}
  else if(args.includes('--project')){const p=JSON.parse(fs.readFileSync(path.resolve(arg('--project','')),'utf8'));recipes=Object.values(p.assets?.meshes||{})}
  else recipes=[Forge.presets[arg('--id','chipped-stone')]].filter(Boolean);
  if(!recipes.length)throw Error('No modeling recipes supplied');
  const options={size};
  if(args.includes('--target'))options.target=JSON.parse(fs.readFileSync(path.resolve(arg('--target','')),'utf8'));
  if(args.includes('--reference')){
   if(recipes.length!==1)throw Error('PNG reference accepts exactly one model recipe');
   const {rgba,width,height}=PNG.read(path.resolve(arg('--reference','')));
   options.reference=Vision.maskFromRGBA(rgba,width,height,{size});
  }
  console.log('Generated: '+run(recipes,out,n,options).length+' visual-refined models at '+out);
 }catch(e){console.error('VISUAL MODEL AUDIT FAILED: '+e.message);process.exitCode=1;}
}
module.exports={Forge,Vision,PNG,previewSVG,tiledComparison,run};

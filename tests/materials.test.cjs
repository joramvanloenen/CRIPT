const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const window={Cript:{}};
vm.runInNewContext(fs.readFileSync('procedural-stone.js','utf8'),{window,Math,Float32Array,Uint8Array},{filename:'procedural-stone.js'});
const M=window.Cript.StoneMaterials;
const stone={id:'stone',width:32,height:32,pixels:Array(1024).fill('#526e64')};
const opts={size:128};
const a=M.build(stone,opts),b=M.build(stone,opts);
assert.deepEqual([...a.albedo],[...b.albedo],'Procedural material must be deterministic');
assert.equal(a.albedo.length,128*128*4);
assert.equal(a.normals.length,a.albedo.length);
assert.equal(a.roughness.length,a.albedo.length);
assert.equal(a.heightMap.length,128*128);
const heights=[...a.heightMap];
assert.ok(Math.max(...heights)-Math.min(...heights)>.07,'Mortar grooves must have measurable height');
const range=new Set();for(let i=0;i<a.normals.length;i+=4)range.add(a.normals[i]);
assert.ok(range.size>12,'Normal map should contain structured detail beyond a flat normal');
const grey=(arr,x,y)=>{const offset=(y*128+x)*4;return (arr[offset]+arr[offset+1]+arr[offset+2])/3};
const mortar=grey(a.albedo,0,0),face=grey(a.albedo,16,16);
assert.ok(mortar<face,'Recessed mortar must be visibly darker than stone faces');
const jointHeight=a.heightMap[0];
const cut=M.build(stone,{size:128,cut:true});
assert.ok(cut.heightMap[0]>jointHeight+.03,'Modeled stones should not have mortar drawn along their sides');
const floor=M.build({id:'floor',pixels:[]},{size:64});
assert.equal(floor.recipe.type,'floor');
assert.ok(floor.heightMap[0]!==a.heightMap[0],'Floor slabs and wall ashlar should have different patterns');
const modified={...stone,materialRecipe:{...M.recipeFor(stone),depth:1.25,seed:119,erosion:.83}};
const c=M.build(modified,opts);
assert.notDeepEqual([...a.albedo.slice(0,256)],[...c.albedo.slice(0,256)],'Editor controls must change material output');
assert.ok(c.heightMap[0]<jointHeight,'Deeper configured mortar must lower the grooves');

const rough=[];
for(let i=0;i<a.roughness.length;i+=4)rough.push(a.roughness[i]);
const min=Math.min(...rough),max=Math.max(...rough);

const sample=(img,x,y)=>(img[(y*128+x)*4]+img[(y*128+x)*4+1]+img[(y*128+x)*4+2])/3;
const mortarTone=sample(a.albedo,0,0),limestoneTone=sample(a.albedo,18,18);
assert.ok(mortarTone>40,'Old charcoal-like grout must be replaced with believable lighter lime mortar');
assert.ok(limestoneTone-mortarTone<115,'Mortar should no longer look like thick black outlines');
const noGrout=M.build(stone,{size:128,cut:true});
assert.ok(sample(noGrout.albedo,0,0)>mortarTone,'Separately modeled flagstones need no painted mortar');
const flatStoneSamples=[];
for(let i=0;i<noGrout.heightMap.length;i+=67)flatStoneSamples.push(noGrout.heightMap[i]);
assert.ok(Math.max(...flatStoneSamples)-Math.min(...flatStoneSamples)>.012,'Cut stone must retain face micro-relief');

assert.ok(max-min>26,'Stone smoothness map must visibly vary under specular lighting');
const wet={...stone,materialRecipe:{...M.recipeFor(stone),wetness:1,polish:.75}};
const glossy=M.build(wet,{size:128});
const wetRough=Array.from(glossy.roughness).filter((_,i)=>i%4===0);
assert.ok(Math.min(...wetRough)<min,'Wet polished stone must develop lower roughness and sharper reflections');
assert.ok(Math.max(...wetRough)>230,'Mortar remains rough even in a wet stone material');

// Distinct physical-looking block variants must not be one repeated image.
const variants=Array.from({length:5},(_,variant)=>M.build(stone,{size:128,variant}));
const compare=(x,y)=>{let changed=0;for(let i=0;i<x.albedo.length;i+=4)
 if(Math.abs(x.albedo[i]-y.albedo[i])>10)changed++;return changed/(x.size*x.size)};
assert.ok(compare(variants[0],variants[1])>.30,'Different wall panels must have strongly different block patterns');
assert.ok(compare(variants[1],variants[2])>.30,'Variants must alter stones throughout the wall');
const blockAt=(x,y)=>M.stoneCell(x,y,2,4,17,false);
assert.notEqual(blockAt(.16,.10).id,blockAt(.78,.10).id,'Tile sampler should give individual blocks unique IDs');
assert.ok(blockAt(.04,.20).du>0,'Walls should have real interior faces');
// Photo reference is optional and always blended INTO the procedural material,
// keeping the separate mortar and height maps deterministic.
const photoData=new Uint8Array(64*64*4);
for(let y=0;y<64;y++)for(let x=0;x<64;x++){
 const k=(y*64+x)*4,grain=((x*37+y*17)^((x*y)%23))%128;
 photoData[k]=92+grain;photoData[k+1]=92+grain;photoData[k+2]=92+grain;photoData[k+3]=255;
}
const photoStone=M.build(stone,{size:128,photo:{width:64,data:photoData},variant:2});
assert.equal(photoStone.photographic,true);
assert.ok(compare(variants[2],photoStone)>.03,'Photographic image must affect resulting diffuse, not just be a URL label');
assert.ok(photoStone.normals.some((v,i)=>i%4===0&&v!==variants[2].normals[i]),
 'Photographic height detail must influence generated normals');
const muted=M.build({...stone,materialRecipe:{...M.recipeFor(stone),variation:0}},{size:128,variant:2});
assert.ok(compare(muted,variants[2])>.08,'Block color variation needs to be editable');
console.log('PASS: deterministic masonry normals, mortar depth, wet smoothness highlights, and rough joints');

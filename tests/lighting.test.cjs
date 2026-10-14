const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sandbox={Math,Float32Array,Uint8Array,console};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('lighting-bake-worker.js','utf8'),sandbox,{filename:'lighting-bake-worker.js'});
const bake=sandbox.CriptGIWorker.bake;
const wall=Array(81).fill(false);
for(let i=0;i<9;i++){wall[i]=true;wall[72+i]=true;wall[i*9]=true;wall[i*9+8]=true;}
const input={nx:20,nz:20,ny:6,step:.9,y0:.27,dy:1.32,
 rooms:[{gx:0,gz:0,height:5.5,solid:wall}],
 sources:[
  {x:4.05,y:1.5,z:4.05,radius:7,power:2.7,color:[1,.38,.12],type:'fire'},
  {x:11.25,y:7,z:11.25,radius:8,power:3.8,color:[.53,.79,1],type:'moon'}
 ]};
const a=bake(input),b=bake(input),data=new Uint8Array(a.buffer),again=new Uint8Array(b.buffer);
assert.equal(a.width,20);assert.equal(a.height,120);
assert.equal(data.length,20*20*6*4);
assert.deepEqual([...data],[...again],'Baking must be deterministic');
const probe=(x,z,y,channel)=>data[(((y*20+z)*20+x)*4)+channel];
assert.ok(probe(4,4,1,0)>probe(4,4,1,2),'Near hearth warm bounced light should exceed blue');
assert.ok(probe(12,12,3,2)>probe(12,12,3,0),'Below skylight blue moonlight should exceed red');
assert.ok(probe(0,0,1,3)<probe(6,6,1,3),'Solid corners should bake stronger ambient occlusion');
assert.ok(a.statistics.samples===20*20*6);
assert.equal(a.statistics.lights,2);
console.log('PASS: baked light atlas dimensions, deterministic rays, hearth bounce warmth, moonlight blue, contact AO');

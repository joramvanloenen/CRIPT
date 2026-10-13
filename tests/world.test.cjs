const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const values=new Map(),window={};
const sandbox={window,document:{getElementById:()=>null},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},setTimeout,clearTimeout,console,Math};
vm.runInNewContext(fs.readFileSync('data.js','utf8'),sandbox,{filename:'data.js'});
const C=window.Cript,p=C.project;
assert.equal(p.version,2);
assert.equal(Object.keys(p.rooms).length,16);
for(const type of ['textures','characters','props','weapons','vfx','atmosphere'])assert.ok(Object.keys(p.assets[type]).length);
for(const [id,r] of Object.entries(p.rooms)){
 assert.equal(r.tiles.length,81,id);
 assert.ok(p.assets.atmosphere[r.theme],id+' missing theme');
 for(const t of r.tiles)assert.ok(p.assets.textures[t],id+' missing texture '+t);
 for(const enemy of r.enemies)assert.ok(p.assets.characters[enemy.kind],id+' unknown enemy');
 for(const prop of r.props)assert.ok(p.assets.props[prop.kind],id+' unknown prop');
 for(const side of r.doors){
  const target=C.topology(r)[side];
  assert.ok(target,'Door exits world at '+id);
  assert.ok(p.rooms[target].doors.includes({N:'S',S:'N',W:'E',E:'W'}[side]),id+' unpaired '+side);
 }
}
for(const group of ['textures','characters','props'])for(const obj of Object.values(p.assets[group]))assert.equal(obj.pixels.length,obj.width*obj.height,obj.id+' pixel count');
const pending=[[4,4]],seen=new Set();
while(pending.length){const [x,z]=pending.pop(),key=x+':'+z;
 if(x<0||z<0||x>=36||z>=36||seen.has(key)||C.isSolid((x+.5)*1.8,(z+.5)*1.8))continue;
 seen.add(key);pending.push([x+1,z],[x-1,z],[x,z+1],[x,z-1]);
}
for(const [id,r] of Object.entries(p.rooms))assert.ok(seen.has((r.gx*9+4)+':'+(r.gz*9+4)),id+' center unreachable');
C.validate(C.copy(p));
C.save();
assert.equal(values.get(C.SAVE_KEY),JSON.stringify(p));
console.log('OK: 16 rooms / '+seen.size+' reachable tiles / valid asset references and reciprocal doors');

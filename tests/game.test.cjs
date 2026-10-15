const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const store=new Map(),nodes=new Map(),events={};
const el=()=>({
 style:{},textContent:'',innerHTML:'',children:[],clientWidth:800,clientHeight:500,
 classList:{add(){},remove(){},toggle(){},contains(){return false}},
 appendChild(child){this.children.push(child);return child},addEventListener(type,fn){(events[type]??=[]).push(fn)},
 setPointerCapture(){},requestPointerLock(){},getBoundingClientRect(){return{left:0,top:0,width:800,height:500}},
 getContext(){return{clearRect(){},fillRect(){},imageSmoothingEnabled:false}},setAttribute(){},getAttribute(){return null}
});
const document={
 getElementById(id){if(!nodes.has(id))nodes.set(id,el());return nodes.get(id)},
 createElement(){return el()},
 addEventListener(type,fn){(events[type]??=[]).push(fn)},
 querySelectorAll(){return[]},activeElement:{tagName:'BODY'},pointerLockElement:null,exitPointerLock(){}
};
function v3(){return{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z},copy(other){this.x=other.x;this.y=other.y;this.z=other.z}}}
let verticalUVRepeats=0;
class Obj{
 constructor(){this.position=v3();this.rotation={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};this.scale={x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z},setScalar(x){this.x=x;this.y=x;this.z=x}};this.children=[];this.instanceMatrix={needsUpdate:false};this.matrix={};this.userData={};this.color={set(){return this},multiplyScalar(){return this}}}
 add(...children){this.children.push(...children);children.forEach(child=>child.parent=this)}
 remove(child){this.children=this.children.filter(x=>x!==child)}
 clear(){this.children=[]}lookAt(){}updateMatrix(){}setMatrixAt(){}setColorAt(){}updateProjectionMatrix(){}
 dispose(){}clone(){return new this.constructor()}
}
class Attribute{
 constructor(){this.count=24;this.data=Array(24).fill(1)}
 getX(i){return this.data[i]||0}
 getY(i){return this.data[i]||0}
 getZ(i){return this.data[i]||0}
 setXY(i,x,y){if(Math.abs(y)>1)verticalUVRepeats++;this.data[i]=y}
 setY(i,n){if(n>1)verticalUVRepeats++;this.data[i]=n}
}
class Geometry extends Obj{
 setAttribute(name,attr){this.attributes[name]=attr;return this}
 computeBoundingSphere(){}
 constructor(...args){super();this.args=args;this.attributes={uv:new Attribute(),normal:new Attribute(),position:new Attribute()};this.attributes.normal.data=Array(24).fill(0);this.attributes.position.data=Array(24).fill(Math.max(1,typeof args[0]==='number'?args[0]:1,typeof args[1]==='number'?args[1]:1,typeof args[2]==='number'?args[2]:1)/2)}
 getAttribute(k){return this.attributes[k]}
 translate(){return this}
}
class Material extends Obj{constructor(){super();this.isMeshStandardMaterial=true}clone(){return new Material()}}
class Color{set(){return this}setRGB(){return this}multiplyScalar(){return this}}
class Fog extends Obj{constructor(){super();this.color=new Color();this.density=.06}}
class Shape{moveTo(){}lineTo(){}closePath(){}}
class Renderer{constructor(){this.domElement=el();this.outputColorSpace='';}
 setPixelRatio(){}setSize(){}render(){}}
class FloatAttribute {
 constructor(array,itemSize){this.array=Float32Array.from(array);this.itemSize=itemSize;this.count=this.array.length/itemSize;}
 getX(i){return this.array[i*this.itemSize]}getY(i){return this.array[i*this.itemSize+1]}getZ(i){return this.array[i*this.itemSize+2]}
}
class Texture{dispose(){}}
class Spot extends Obj{constructor(){super();this.target=new Obj()}}
const T={Scene:Obj,Group:Obj,PerspectiveCamera:Obj,WebGLRenderer:Renderer,HemisphereLight:Obj,PointLight:Obj,InstancedMesh:Obj,Mesh:Obj,MeshLambertMaterial:Material,MeshBasicMaterial:Material,MeshStandardMaterial:Material,ShaderMaterial:Material,SpotLight:Spot,DataTexture:Texture,Vector2:class{constructor(x,y){this.x=x;this.y=y}},
 BufferGeometry:Geometry,Float32BufferAttribute:FloatAttribute,BoxGeometry:Geometry,PlaneGeometry:Geometry,CylinderGeometry:Geometry,ConeGeometry:Geometry,IcosahedronGeometry:Geometry,DodecahedronGeometry:Geometry,TetrahedronGeometry:Geometry,ExtrudeGeometry:Geometry,Object3D:Obj,CanvasTexture:Texture,
 Shape,FogExp2:Fog,Color,SRGBColorSpace:1,NearestFilter:2,NearestMipmapNearestFilter:2,RepeatWrapping:3,DoubleSide:4,FrontSide:0,RGBAFormat:1023,UnsignedByteType:5121};
const window={THREE:T,addEventListener(){}},localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},performance={now:()=>0};
const sandbox={window,document,localStorage,performance,Math,setTimeout,clearTimeout,requestAnimationFrame(){},console,confirm:()=>true,alert(){}};
for(const file of ['mesh-forge.js','mesh-vision.js','mesh-art-pass.js','data.js','weapons.js','procedural-stone.js','architecture.js','lighting-bake-worker.js','lighting.js','game.js']){
 vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
}
const C=window.Cript,game=C.game;
assert.ok(game,'3D game did not boot');
assert.ok(game.weaponView.children.length,'No first-person weapon geometry');
assert.ok(verticalUVRepeats>0,'UVs on masonry must use world-scale repeat');
assert.equal(C.masonryStats.rooms,16);
assert.ok(C.game.lighting,'Runtime must allocate a baked GI atlas');
assert.ok(C.game.lighting.sources().length>=30,'Static light sources must include extra torches and hearths');
assert.equal(C.game.lighting.moons.length,4,'Exactly four rooms should have moonlit roof openings');
const mat=C.game.architecture.mats.get('stone');
assert.ok(mat.userData.criptBakedGI,'World materials must register baked shader hooks');
const shader={uniforms:{},vertexShader:'void main(){\n#include <project_vertex>\n}',fragmentShader:'void main(){\n#include <lights_fragment_maps>\n#include <fog_fragment>\n}'};
mat.onBeforeCompile(shader);
assert.ok(shader.vertexShader.includes('instanceMatrix'),'Instanced geometry must compute baked sampling from world position');
assert.ok(shader.fragmentShader.includes('criptSampleBakedLight'),'Indirect GI shader sample missing');
assert.ok(shader.fragmentShader.includes('criptHeightFogDensity'),'Height fog shader missing');
assert.ok(!shader.fragmentShader.includes('\\\\n'),'Shader source must contain real GLSL newline characters');
assert.ok(shader.uniforms.criptGIAtlas===C.game.lighting.uniform,'Shared GI atlas must be shader-bound');

assert.ok(C.masonryStats.arches>20,'Masonry voussoirs not built');
assert.ok(C.masonryStats.vaults>40,'Vault ceiling geometry not built');
assert.ok(C.masonryStats.rubble>0,'Aged rubble missing');
assert.ok(C.masonryStats.modeled>40,'Forged meshes must be present in the actual 3D world');
assert.ok(C.masonryStats.galleries>=20,'Room construction should include visible wall-embedded Gothic gallery arches');
assert.equal(C.masonryStats.heroPortals,1,'First room should have a directly visible monumental entry arch');
assert.ok(C.masonryStats.ribbedBays>=4,'Hero chambers need modeled overhead ribs');
const legacyWorld=C.copy(C.project);
legacyWorld.assets.meshes['chipped-stone']=C.copy(C.MeshForge.legacyPresets['chipped-stone']);
legacyWorld.assets.meshes.urn=C.copy(C.MeshForge.legacyPresets.urn);
legacyWorld.assets.meshes.bell={...C.copy(C.MeshForge.legacyPresets.bell),width:1.77};
const migrated=C.validate(legacyWorld);
assert.equal(migrated.assets.meshes['chipped-stone'].artPass,'gothic-01','Older stock masonry must migrate visibly');
assert.equal(migrated.assets.meshes.urn.artPass,'gothic-01','Older stock props must migrate visibly');
assert.equal(migrated.assets.meshes.bell.width,1.77,'User-customized meshes must never be silently overwritten');

assert.ok(C.masonryStats.wallBaseDebris>25,'Wall and floor junctions need substantial stone fragments');
assert.ok(C.Masonry.config(C.project.rooms['room-15']).height>7,'Boss chamber must have tall ceiling');
const boss=C.project.rooms['room-15'],bossX=(boss.gx*9+4.5)*1.8,bossZ=(boss.gz*9+4.5)*1.8;
assert.equal(C.Masonry.config(boss).archStyle,'pointed','Boss arches must have Gothic lancet profiles');
assert.ok(game.architecture.floorHeightAt(bossX,bossZ+2.0*1.8)>0,'Raised cathedral steps must change camera height');
assert.equal(game.architecture.floorHeightAt(bossX,bossZ-3.8*1.8),0,'Entrance route must remain level');
assert.equal(game.architecture.blocked(bossX,bossZ-3.9*1.8),false,'Cathedral entry blocked by altar');
assert.equal(game.architecture.blocked(bossX,bossZ+2.75*1.8),true,'Altar must have collision');
const compact=C.project.rooms['room-9'];
assert.equal(compact.tiles[1*9+1],'stone','Secret burial room should have thick enclosing masonry');
assert.equal(compact.tiles[4*9+4],'floor','Secret room should retain navigable center');

for(const type of ['rust','axe','cleaver','maul'])assert.ok(C.WeaponRig.create(C.project.assets.weapons[type]).children.length>=4,type+' weapon missing geometry');
game.start();
const startYaw=game.hero.yaw;
game.alert();
assert.equal(game.mode,'free','Free movement must never switch to a grid/combat mode');
game.keys.add('e');game.free(.2);game.keys.delete('e');
assert.ok(game.hero.yaw>startYaw+.2,'Q/E continuous combat turning failed');
assert.equal(Object.hasOwn(game.hero,'step'),false,'Grid-step state must no longer exist');
const afterHold=game.hero.yaw;
game.turn(-1);assert.ok(game.hero.yaw<afterHold,'Tap turn during combat failed');
game.strike(false);assert.ok(game.attackAnim&&!game.attackAnim.hit,'Weapon should wind up before impact');
C.WeaponRig.tick(game,.05);assert.equal(game.attackAnim.hit,false,'Immediate hit; windup missing');
C.WeaponRig.tick(game,.14);assert.equal(game.attackAnim.hit,true,'Impact not triggered mid-animation');
C.WeaponRig.tick(game,1);assert.equal(game.attackAnim,null,'Recovery failed to finish');
const pose0=C.WeaponRig.samplePose(.06,false,1);
const pose1=C.WeaponRig.samplePose(.39,false,1);
assert.ok(Math.abs(pose0.rz-pose1.rz)>.4,'Swing arc too small');

const weaponTypes=['rust','axe','cleaver','maul'];
for(let tier=1;tier<=4;tier++){
 const def=C.project.assets.weapons[weaponTypes[tier-1]];
 const right=C.WeaponRig.pathFor(tier,false,1);
 const left=C.WeaponRig.pathFor(tier,false,-1);
 const heavy=C.WeaponRig.pathFor(tier,true,1);
 assert.equal(right.length,5,'Full attack requires windup, strike, follow-through and recovery');
 assert.ok(Math.abs(right[2].px-right[0].px)>.19,'Weapon must translate across the camera, not only spin: '+tier);
 assert.ok(Math.abs(right[2].pz-right[0].pz)>.18,'Blade must travel forwards into 3D space: '+tier);
 assert.ok(Math.abs(right[2].rx-right[0].rx)>.15,'Weapon must pitch during swing: '+tier);
 assert.ok(Math.abs(right[2].ry-right[0].ry)>.03,'Weapon must yaw around grip, not only roll: '+tier);
 assert.notDeepEqual(right.slice(1,4).map(k=>k.rz),left.slice(1,4).map(k=>k.rz),
  'Alternate slashes must have different directions: '+tier);
 assert.ok(heavy[1].py>right[1].py,'Heavy windup must raise weapon: '+tier);
 const impact=C.WeaponRig.impactTime(tier,false,1);
 assert.ok(impact>right[1].t&&impact<right[2].t,'Contact must happen during forward cutting stroke: '+tier);
 const pose=C.WeaponRig.samplePose(impact,false,1,tier);
 assert.ok(Math.cos(pose.rx)*Math.cos(pose.ry)>.53,'Blade face becomes unreadably edge-on at impact: '+tier);
 assert.ok(C.WeaponRig.releaseTime(tier,false,1)<impact,'Whoosh must precede impact: '+tier);
}
const sweepR=C.WeaponRig.samplePose(.46,false,1,1);
const sweepL=C.WeaponRig.samplePose(.46,false,-1,1);
assert.ok(Math.abs(sweepR.px-sweepL.px)>.38,'Alternating sword attacks should travel across different sides of camera');
const sword=game.hero.weapon;
game.hero.weapon='rust';game.makeWeapon();game.strike(false);
const fastDuration=game.attackAnim.duration;
assert.ok(fastDuration<.43,'Sword swing should accelerate relative to original animation');
game.attackAnim.t=game.attackAnim.duration-.06;
game.hero.attack=.06;
game.strike(false);
assert.ok(game.queuedStrike,'Repeated attack during recovery should buffer next slash');
C.WeaponRig.tick(game,.10);
assert.ok(game.attackAnim&&!game.attackAnim.hit,'Buffered strike should flow into next attack');
assert.equal(game.queuedStrike,null,'Buffered input must be consumed exactly once');
game.hero.weapon=sword;


const gates=game.secretGates;
assert.equal(gates.length,2,'Two secret entrances must lead to annexes');
const first=gates[0],second=gates[1];
game.hero.x=first.x-1.32;game.hero.z=first.z;game.hero.yaw=Math.PI/2;
assert.ok(game.gateBlocks(first.x,first.z,.27),'Concealed door must initially block movement');
assert.equal(game.nearest()?.id,first.id,'Hidden masonry should be interactable when approached facing it');
game.interact();
assert.ok(first.opening>0,'Interacting must start the hidden entrance animation');
game.keys.clear();game.hero.vx=game.hero.vz=0;
game.update(.85);
assert.equal(first.open,true,'Secret doorway should open after sliding down');
assert.equal(game.gateBlocks(first.x,first.z,.25),false,'Open gate must be traversable');
assert.ok(game.gateBlocks(second.x,second.z,.25),'Opening one gate must not unlock another gate');
assert.ok(game.can(first.x,first.z,.19),'Main gate opening must have free floor collision');
assert.equal(game.seen.has('room-5'),false,'Treasure room remains undiscovered until entered');
assert.ok(C.project.rooms['room-5'].props.some(o=>o.kind==='chest'),'Hidden annex must contain treasure');
game.hero.x=first.x+1.2;game.hero.z=first.z;game.checkRoom();
assert.equal(game.room.id,'room-5');
assert.ok(game.seen.has('room-5'),'Visiting the hidden room should reveal it');

const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('style.css','utf8');
assert.ok(html.indexOf('src="weapons.js?v=quarry04"')<html.indexOf('src="game.js?v=quarry04"'),'Weapon rig must load before engine');
for(const key of ['q','e','w','a','s','d','f','attack','dodge','spell']){
 const m=html.match(new RegExp('<button[^>]*data-touch="'+key+'"[^>]*>([\\s\\S]*?)<\\/button>'));
 assert.ok(m&&m[1].includes('<svg'),'Touch button '+key+' must use a vector icon');
 assert.equal(m[1].replace(/<[^>]+>/g,'').trim(),'','Touch button '+key+' must not contain selectable text');
}
assert.ok(css.includes('-webkit-user-select:none!important')&&css.includes('touch-action:none!important'),'Touch controls must disable text selection and long press');
assert.ok(html.includes('class="health-top"'),'Health must occupy a separate prominent top container');
assert.ok(html.indexOf('id="hpFill"')<html.indexOf('class="hud-bottom"'),'HP meter must be above bottom bars');
assert.ok(css.includes('#gameView .health-top .track'),'Health meter needs its own large style');
assert.ok(!fs.readFileSync('game.js','utf8').includes("this.mode='grid'"),'Grid locomotion must be removed');

console.log('PASS: 16 masonry rooms, bonded arches and vaults, repeated UVs, combat, weapon rig and touch controls');

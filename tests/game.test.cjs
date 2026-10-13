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
 constructor(...args){super();this.args=args;this.attributes={uv:new Attribute(),normal:new Attribute(),position:new Attribute()};this.attributes.normal.data=Array(24).fill(0);this.attributes.position.data=Array(24).fill(Math.max(1,typeof args[0]==='number'?args[0]:1,typeof args[1]==='number'?args[1]:1,typeof args[2]==='number'?args[2]:1)/2)}
 getAttribute(k){return this.attributes[k]}
 translate(){return this}
}
class Material extends Obj{clone(){return new Material()}}
class Color{set(){return this}setRGB(){return this}multiplyScalar(){return this}}
class Fog extends Obj{constructor(){super();this.color=new Color();this.density=.06}}
class Shape{moveTo(){}lineTo(){}closePath(){}}
class Renderer{constructor(){this.domElement=el();this.outputColorSpace='';}
 setPixelRatio(){}setSize(){}render(){}}
class Texture{dispose(){}}
const T={Scene:Obj,Group:Obj,PerspectiveCamera:Obj,WebGLRenderer:Renderer,HemisphereLight:Obj,PointLight:Obj,InstancedMesh:Obj,Mesh:Obj,MeshLambertMaterial:Material,MeshBasicMaterial:Material,MeshStandardMaterial:Material,
 BoxGeometry:Geometry,PlaneGeometry:Geometry,CylinderGeometry:Geometry,ConeGeometry:Geometry,IcosahedronGeometry:Geometry,ExtrudeGeometry:Geometry,Object3D:Obj,CanvasTexture:Texture,
 Shape,FogExp2:Fog,Color,SRGBColorSpace:1,NearestFilter:2,RepeatWrapping:3,DoubleSide:4,FrontSide:0};
const window={THREE:T,addEventListener(){}},localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},performance={now:()=>0};
const sandbox={window,document,localStorage,performance,Math,setTimeout,clearTimeout,requestAnimationFrame(){},console,confirm:()=>true,alert(){}};
for(const file of ['data.js','weapons.js','architecture.js','game.js']){
 vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
}
const C=window.Cript,game=C.game;
assert.ok(game,'3D game did not boot');
assert.ok(game.weaponView.children.length,'No first-person weapon geometry');
assert.ok(verticalUVRepeats>0,'UVs on masonry must use world-scale repeat');
assert.equal(C.masonryStats.rooms,16);
assert.ok(C.masonryStats.arches>20,'Masonry voussoirs not built');
assert.ok(C.masonryStats.vaults>40,'Vault ceiling geometry not built');
assert.ok(C.masonryStats.rubble>0,'Aged rubble missing');
assert.ok(C.Masonry.config(C.project.rooms['room-15']).height>7,'Boss chamber must have tall ceiling');
for(const type of ['rust','axe','cleaver','maul'])assert.ok(C.WeaponRig.create(C.project.assets.weapons[type]).children.length>=4,type+' weapon missing geometry');
game.start();
const startYaw=game.hero.yaw;
game.alert();
assert.equal(game.mode,'combat');
game.keys.add('e');game.free(.2);game.keys.delete('e');
assert.ok(game.hero.yaw>startYaw+.2,'Q/E continuous combat turning failed');
const afterHold=game.hero.yaw;
game.turn(-1);assert.ok(game.hero.yaw<afterHold,'Tap turn during combat failed');
game.strike(false);assert.ok(game.attackAnim&&!game.attackAnim.hit,'Weapon should wind up before impact');
C.WeaponRig.tick(game,.05);assert.equal(game.attackAnim.hit,false,'Immediate hit; windup missing');
C.WeaponRig.tick(game,.14);assert.equal(game.attackAnim.hit,true,'Impact not triggered mid-animation');
C.WeaponRig.tick(game,1);assert.equal(game.attackAnim,null,'Recovery failed to finish');
const pose0=C.WeaponRig.samplePose(.06,false,1);
const pose1=C.WeaponRig.samplePose(.39,false,1);
assert.ok(Math.abs(pose0.rz-pose1.rz)>.4,'Swing arc too small');
const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('style.css','utf8');
assert.ok(html.indexOf('src="weapons.js"')<html.indexOf('src="game.js"'),'Weapon rig must load before engine');
for(const key of ['q','e','w','a','s','d','f','attack','dodge','spell']){
 const m=html.match(new RegExp('<button[^>]*data-touch="'+key+'"[^>]*>([\\s\\S]*?)<\\/button>'));
 assert.ok(m&&m[1].includes('<svg'),'Touch button '+key+' must use a vector icon');
 assert.equal(m[1].replace(/<[^>]+>/g,'').trim(),'','Touch button '+key+' must not contain selectable text');
}
assert.ok(css.includes('-webkit-user-select:none!important')&&css.includes('touch-action:none!important'),'Touch controls must disable text selection and long press');
console.log('PASS: 16 masonry rooms, bonded arches and vaults, repeated UVs, combat, weapon rig and touch controls');

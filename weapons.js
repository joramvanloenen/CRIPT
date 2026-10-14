/* CRIPT — handcrafted low-poly first-person weapon meshes and timed swing posing */
(function(){
'use strict';
const C=window.Cript,THREE=window.THREE;
if(!C||!THREE)return;
const T=THREE,lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
function metal(hex,rough=.55){return new T.MeshStandardMaterial({color:hex,metalness:.38,roughness:rough,flatShading:true})}
function wood(hex){return new T.MeshStandardMaterial({color:hex,roughness:1,flatShading:true})}
function addBox(g,mat,x,y,z,w,h,d,rotation=0){
 const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.z=rotation;g.add(m);return m;
}
function addCylinder(g,mat,x,y,z,r1,r2,h,sides=7){
 const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,sides),mat);m.position.set(x,y,z);g.add(m);return m;
}
function addBlade(g,outline,mat,thickness=.11){
 const shape=new T.Shape();shape.moveTo(outline[0][0],outline[0][1]);
 for(let i=1;i<outline.length;i++)shape.lineTo(outline[i][0],outline[i][1]);
 shape.closePath();
 const geometry=new T.ExtrudeGeometry(shape,{depth:thickness,steps:1,bevelEnabled:true,bevelSize:.012,bevelThickness:.014,bevelSegments:1,curveSegments:1});
 geometry.translate(0,0,-thickness/2);
 const m=new T.Mesh(geometry,mat);g.add(m);return m;
}
function rivet(g,mat,x,y,z,r=.024){const ball=new T.Mesh(new T.IcosahedronGeometry(r,0),mat);ball.position.set(x,y,z);g.add(ball)}
function wrappings(g,cloth,start,end,count,r=.067){
 for(let i=0;i<count;i++){const y=lerp(start,end,i/Math.max(count-1,1));const band=addBox(g,cloth,0,y,.003,r*2.15,.027,r*2.1);band.rotation.y=i%2?.13:-.14;}
}
function makeWeapon(def){
 const tier=clamp(Math.round(def.weight||def.tier||1),1,4);
 const blade=metal(def.color||'#b4a89a'),edge=metal('#d6d0bc',.42),dark=metal('#343c3d'),aged=metal('#7b7065',.78);
 const brass=metal('#9d7850',.47),oldGold=metal('#d2ad71',.45);
 const timber=wood(tier>=3?'#493425':'#5b4231'),leather=wood('#302a27');
 const root=new T.Group();
 // The pommel, handle wraps and fastening points are built for *every* weapon tier.
 const shaftLength=tier===1?.48:tier===2?1.22:tier===3?.59:1.30;
 const base=tier===2||tier===4?-.39:-.3, shaftCenter=base+shaftLength/2;
 addCylinder(root,timber,0,shaftCenter,0,tier>=2?.053:.047,tier>=2?.058:.052,shaftLength,8);
 wrappings(root,leather,base+.09,base+Math.min(.43,shaftLength-.12),6,tier>=2?.055:.052);
 addCylinder(root,brass,0,base-.035,0,.091,.073,.075,8);
 addBox(root,oldGold,0,base-.08,.01,.09,.055,.09);
 if(tier===1){
  // Nicked straight sword, bright sharpened edge, iron fuller and curved quillons.
  addBlade(root,[[-.09,.05],[.09,.05],[.11,.54],[.085,.72],[.045,.91],[0,1.02],[-.07,.87],[-.105,.62]],blade,.085);
  addBlade(root,[[-.095,.12],[-.073,.2],[-.073,.59],[-.061,.72],[-.027,.84],[-.015,.26]],edge,.021);
  addBox(root,dark,0,.33,.075,.023,.42,.02);
  addBox(root,aged,0,.03,.0,.4,.063,.115,-.07);
  addBox(root,oldGold,-.17,.065,0,.12,.06,.09,-.22);
  addBox(root,oldGold,.17,.056,0,.12,.06,.09,.22);
  rivet(root,brass,0,.03,.077);
 }else if(tier===2){
  // Long grave axe, broad forged crescent and counterweight spike.
  addCylinder(root,brass,0,.75,0,.078,.077,.18,8);
  addBlade(root,[[-.05,.57],[-.22,.56],[-.39,.62],[-.48,.76],[-.47,.92],[-.38,1.08],[-.23,1.12],[-.04,1.06]],blade,.18);
  addBlade(root,[[-.44,.69],[-.49,.79],[-.48,.96],[-.39,1.08],[-.335,1.07],[-.42,.87]],edge,.045);
  addBlade(root,[[.035,.75],[.20,.81],[.40,.88],[.18,.93],[.03,.99]],dark,.12);
  addBox(root,brass,0,.8,.12,.11,.2,.035);
  rivet(root,oldGold,0,.79,.163,.034);
  addCylinder(root,dark,0,-.1,0,.08,.081,.06,7);
 }else if(tier===3){
  // Executioner's slab-cleaver: asymmetric silhouette, relief channel, worn rivets.
  addBlade(root,[[-.16,.05],[.135,.05],[.23,.17],[.24,.83],[.2,1.12],[-.14,1.18],[-.25,1.12],[-.27,.76],[-.21,.29]],blade,.16);
  addBlade(root,[[-.27,.3],[-.27,.76],[-.25,1.08],[-.20,1.13],[-.16,1.1],[-.19,.3]],edge,.03);
  addBox(root,dark,.12,.64,.103,.024,.74,.016);
  addBox(root,brass,0,.07,.005,.50,.095,.19);
  addBox(root,aged,-.15,.21,.095,.075,.05,.028,-.12);
  rivet(root,oldGold,-.1,.06,.116);rivet(root,oldGold,.1,.06,.116);
  addBlade(root,[[.22,1.12],[.08,1.20],[.21,1.23]],dark,.11);
 }else{
  // Massive two-handed stone-crushing maul, banded metal head and hammered studs.
  addCylinder(root,dark,0,.86,0,.097,.10,.33,8);
  addBox(root,aged,0,.88,0,.71,.36,.40);
  addBox(root,blade,0,.91,.0,.80,.29,.45);
  addBox(root,dark,-.41,.9,0,.10,.41,.5);
  addBox(root,dark,.41,.9,0,.10,.41,.5);
  addBox(root,oldGold,0,.9,.239,.34,.10,.035);
  for(const x of [-.25,0,.25])for(const y of [.78,.99])rivet(root,brass,x,y,.236,.034);
  for(const x of [-.43,.43]){const spike=new T.Mesh(new T.ConeGeometry(.12,.22,5),edge);spike.rotation.z=x<0?Math.PI/2:-Math.PI/2;spike.position.set(x+(x<0?-.12:.12),.91,0);root.add(spike);}
  addCylinder(root,brass,0,.46,0,.07,.064,.08);
 }

 // Mesh local Y is the blade/shaft axis. Keep XY as the broad blade face:
 // camera looks down -Z, so the weapon must NOT have its flat turned away.
 root.rotation.set(0,0,0);
 root.userData.bladeAxis='Y';
 root.userData.bladeFace='+Z';
 root.scale.setScalar(tier===4?.83:tier===3?.88:tier===2?.78:.92);
 return root;
}

// Authored 6-DOF poses: grip (x,y,z) and wrist (pitch,yaw,roll).
// Forward is negative Z; weapon's wide face is its local XY plane.
// The blade travels across the camera's view in depth, not merely around Z.
const IDLE={
  1:{px:.44,py:-.56,pz:-.83,rx:-.19,ry:-.15,rz:.43},
  2:{px:.54,py:-.60,pz:-1.02,rx:-.27,ry:-.20,rz:.40},
  3:{px:.49,py:-.60,pz:-.91,rx:-.23,ry:-.13,rz:.42},
  4:{px:.55,py:-.62,pz:-1.05,rx:-.27,ry:-.08,rz:.33}
};
function key(t,px,py,pz,rx,ry,rz){return {t,px,py,pz,rx,ry,rz};}
const attacks={
 sword:{
  slashR:[
   key(0,.44,-.56,-.83,-.19,-.15,.43),
   key(.19,.77,-.36,-.89,-.27,.27,-.40), // blade out to the right, raised
   key(.36,-.20,-.17,-1.14,.12,-.39,1.26), // diagonal edge-through-target
   key(.57,-.50,-.51,-.89,.41,-.28,1.37),
   key(1,.44,-.56,-.83,-.19,-.15,.43)],
  slashL:[
   key(0,.44,-.56,-.83,-.19,-.15,.43),
   key(.19,-.38,-.40,-.95,.30,-.30,1.26),
   key(.36,.37,-.08,-1.13,-.03,.31,-.67),
   key(.57,.67,-.46,-.92,.17,.22,-.72),
   key(1,.44,-.56,-.83,-.19,-.15,.43)],
  heavy:[
   key(0,.44,-.56,-.83,-.19,-.15,.43),
   key(.32,.44,-.07,-1.22,-.76,.04,-.06),
   key(.52,.13,-.14,-1.50,.58,-.15,.24),
   key(.70,.15,-.77,-.91,.98,-.08,.48),
   key(1,.44,-.56,-.83,-.19,-.15,.43)]
 },
 axe:{
  slashR:[
   key(0,.54,-.60,-1.02,-.27,-.20,.40),
   key(.25,.79,-.05,-1.19,-.72,.20,-.54),
   key(.46,.11,-.24,-1.48,.48,-.27,.29),
   key(.63,.05,-.73,-1.02,1.05,-.17,.48),
   key(1,.54,-.60,-1.02,-.27,-.20,.40)],
  slashL:[
   key(0,.54,-.60,-1.02,-.27,-.20,.40),
   key(.25,-.40,-.12,-1.24,.05,-.20,1.13),
   key(.46,.22,-.21,-1.44,.25,.23,-.27),
   key(.63,.61,-.67,-1.04,.80,.12,-.39),
   key(1,.54,-.60,-1.02,-.27,-.20,.40)],
  heavy:[
   key(0,.54,-.60,-1.02,-.27,-.20,.40),
   key(.36,.13,.19,-1.26,-1.08,0,-.03),
   key(.57,.05,-.24,-1.62,.78,-.08,.09),
   key(.76,.14,-.85,-1.08,1.25,-.05,.15),
   key(1,.54,-.60,-1.02,-.27,-.20,.40)]
 },
 cleaver:{
  slashR:[
   key(0,.49,-.60,-.91,-.23,-.13,.42),
   key(.27,.80,-.21,-1.08,-.31,.26,-.42),
   key(.47,-.17,-.18,-1.46,.26,-.36,1.16),
   key(.66,-.58,-.57,-1.03,.51,-.20,1.38),
   key(1,.49,-.60,-.91,-.23,-.13,.42)],
  slashL:[
   key(0,.49,-.60,-.91,-.23,-.13,.42),
   key(.27,-.43,-.26,-1.10,.24,-.25,1.30),
   key(.47,.28,-.19,-1.45,.20,.32,-.56),
   key(.66,.73,-.61,-1.0,.39,.19,-.68),
   key(1,.49,-.60,-.91,-.23,-.13,.42)],
  heavy:[
   key(0,.49,-.60,-.91,-.23,-.13,.42),
   key(.34,.40,.11,-1.17,-1.02,.04,-.24),
   key(.55,-.09,-.25,-1.60,.77,-.18,.39),
   key(.74,-.14,-.80,-1.00,1.23,-.06,.52),
   key(1,.49,-.60,-.91,-.23,-.13,.42)]
 },
 maul:{
  slashR:[
   key(0,.55,-.62,-1.05,-.27,-.08,.33),
   key(.33,.44,.16,-1.28,-.96,.07,-.25),
   key(.55,.06,-.23,-1.70,.73,-.12,.11),
   key(.76,.02,-.87,-1.11,1.30,-.05,.24),
   key(1,.55,-.62,-1.05,-.27,-.08,.33)],
  slashL:[
   key(0,.55,-.62,-1.05,-.27,-.08,.33),
   key(.33,-.19,.10,-1.22,-.75,-.13,.61),
   key(.55,.13,-.24,-1.72,.82,.08,-.12),
   key(.76,.21,-.90,-1.14,1.27,.08,-.21),
   key(1,.55,-.62,-1.05,-.27,-.08,.33)],
  heavy:[
   key(0,.55,-.62,-1.05,-.27,-.08,.33),
   key(.40,.08,.27,-1.40,-1.21,0,-.08),
   key(.62,.04,-.35,-1.78,.95,-.07,.10),
   key(.80,.09,-.96,-1.12,1.39,0,.16),
   key(1,.55,-.62,-1.05,-.27,-.08,.33)]
 }
};
const fields=['px','py','pz','rx','ry','rz'];
const phaseEase=(t,strike)=>{
 const f=clamp(t,0,1);
 // The release phase is fast and decisive, wind-up loaded, recovery soft.
 return strike?f*f*(3-2*f):f*f*(3-2*f);
};
function weaponClass(tier){return ['sword','axe','cleaver','maul'][clamp(tier||1,1,4)-1];}
function pathFor(tier,heavy,side=1){
 const group=attacks[weaponClass(tier)];
 return heavy?group.heavy:side>0?group.slashR:group.slashL;
}
function impactTime(tier,heavy,side=1){
 const keys=pathFor(tier,heavy,side);
 // The cutting edge traverses the aim point slightly before the third key.
 return keys[2].t-(heavy?.032:.045);
}
function releaseTime(tier,heavy,side=1){return pathFor(tier,heavy,side)[1].t-.027;}
function samplePose(u,heavy=false,side=1,tier=1){
 const keys=pathFor(tier,heavy,side);
 const t=clamp(u,0,1);
 let a=keys[0],b=keys[1],segment=0;
 for(let i=0;i<keys.length-1;i++){
  if(t<=keys[i+1].t||i===keys.length-2){a=keys[i];b=keys[i+1];segment=i;break;}
 }
 const v=phaseEase((t-a.t)/Math.max(.00001,b.t-a.t),segment===1);
 const pose={};
 for(const f of fields)pose[f]=lerp(a[f],b[f],v);
 return pose;
}
function tick(game,dt){
 if(!game.weaponView)return;
 const p=game.hero,anim=game.attackAnim,time=game.time||0;
 const tier=clamp(Math.round(C.project.assets.weapons[p.weapon]?.weight||1),1,4);
 const idle=IDLE[tier];
 const movement=Math.min(1,Math.hypot(p.vx||0,p.vz||0)/5);
 let pose={...idle};
 if(anim){
  // A 40-70 ms hit-stop freezes only the weapon animation, not player movement.
  const frozen=Math.min(dt,Math.max(0,anim.hitStop||0));
  anim.hitStop=Math.max(0,(anim.hitStop||0)-dt);
  const next=Math.min(anim.duration,anim.t+Math.max(0,dt-frozen));
  const previous=anim.t/anim.duration,u=next/anim.duration;
  anim.t=next;
  pose=samplePose(u,anim.heavy,anim.side,anim.tier||tier);
  const release=releaseTime(anim.tier||tier,anim.heavy,anim.side);
  if(!anim.released&&previous<release&&u>=release){
   anim.released=true;
   if(C.audio)C.audio.effect(anim.heavy?'heavy':'swing');
  }
  const impact=impactTime(anim.tier||tier,anim.heavy,anim.side);
  if(!anim.hit&&previous<impact&&u>=impact){
   anim.hit=true;
   const hits=game.resolveStrike(anim.heavy);
   if(hits>0)anim.hitStop=anim.heavy?.065:.040;
  }
  if(u>=1){
   const nextAttack=game.queuedStrike;
   game.queuedStrike=null;
   game.attackAnim=null;
   game.hero.attack=0;
   if(nextAttack&&game.running&&!game.paused)game.strike(nextAttack.heavy);
  }
 }else{
  // Idle is a controlled hand grip, not a clockwork spinning blade.
  const sway=Math.sin(time*1.65),breath=Math.sin(time*2.25);
  pose={...idle,px:idle.px+breath*.007,py:idle.py+sway*.008,
   rx:idle.rx+breath*.006,ry:idle.ry+sway*.006,rz:idle.rz+breath*.008};
 }
 const motion=Math.sin(time*10)*movement;
 game.weaponView.position.set(pose.px+motion*.012,pose.py+Math.cos(time*9)*movement*.013,pose.pz);
 game.weaponView.rotation.set(pose.rx,pose.ry,pose.rz,'XYZ');
 // Expose pose for diagnostics and animation tests without rendering internals.
 game.weaponView.userData.pose=pose;
 game.weaponView.userData.bladeFacingCamera=Math.cos(pose.rx)*Math.cos(pose.ry);
}
C.WeaponRig={create:makeWeapon,tick,samplePose,impactTime,releaseTime,pathFor,weaponClass};
})();

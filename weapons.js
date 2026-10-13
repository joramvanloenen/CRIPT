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
 root.rotation.set(-.1,.15,-.11);
 // Leave weapon comfortably low/right when idle; strike positioning is all controlled by tick().
 root.scale.setScalar(tier===4?.84:tier===3?.89:.96);
 return root;
}
function samplePose(u,heavy,side){
 const wind=heavy?.35:.22,follow=heavy?.57:.49;
 const prep=smooth(u/wind),cut=smooth((u-wind)/(follow-wind)),recovery=smooth((u-follow)/(1-follow));
 let z=0,x=0,y=0,px=0,py=0,pz=0;
 if(heavy){
  if(u<wind){z=lerp(-.3,.12,prep);x=lerp(-.14,.94,prep);y=.13*prep;py=.08*prep;pz=.11*prep;}
  else if(u<follow){z=lerp(.12,-.65,cut);x=lerp(.94,-.95,cut);y=-.11*cut;py=.08-.23*cut;pz=.11-.36*cut;}
  else{z=lerp(-.65,-.3,recovery);x=lerp(-.95,-.14,recovery);y=lerp(-.11,0,recovery);py=lerp(-.15,0,recovery);pz=lerp(-.25,0,recovery);}
 }else{
  const start=-.31,ready=start+side*1.02,end=start-side*.94;
  if(u<wind){z=lerp(start,ready,prep);x=-.1+.17*prep;px=.13*side*prep;pz=.12*prep;}
  else if(u<follow){z=lerp(ready,end,cut);x=lerp(.07,-.48,cut);px=lerp(.13*side,-.20*side,cut);pz=lerp(.12,-.30,cut);}
  else{z=lerp(end,start,recovery);x=lerp(-.48,-.1,recovery);px=lerp(-.20*side,0,recovery);pz=lerp(-.3,0,recovery);}
 }
 return {rx:x,ry:y,rz:z,px,py,pz};
}
function tick(game,dt){
 if(!game.weaponView)return;
 const p=game.hero,anim=game.attackAnim,baseX=.37,baseY=-.34,baseZ=-.72;
 const movement=Math.min(1,Math.hypot(p.vx||0,p.vz||0)/5),time=game.time||0;
 let pose;
 if(anim){anim.t=Math.min(anim.duration,anim.t+dt);const u=anim.t/anim.duration;pose=samplePose(u,anim.heavy,anim.side);
  const impactAt=anim.heavy?.49:.36;
  if(!anim.hit && u>=impactAt){anim.hit=true;game.resolveStrike(anim.heavy);}
  if(u>=1)game.attackAnim=null;
 }else{pose={rx:-.10+Math.sin(time*1.45)*.008,ry:.04,rz:-.31+Math.sin(time*1.1)*.01,px:0,py:0,pz:0}}
 const sway=Math.sin(time*10)*(.007+.018*movement);
 game.weaponView.rotation.set(pose.rx,pose.ry,pose.rz);
 game.weaponView.position.set(baseX+pose.px+sway,baseY+pose.py+Math.sin(time*8)*.009,baseZ+pose.pz+movement*.024);
}
C.WeaponRig={create:makeWeapon,tick,samplePose};
})();
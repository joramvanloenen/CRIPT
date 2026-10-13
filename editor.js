/* CRIPT shared in-browser world workshop */
(function(){'use strict';const C=window.Cript,$=id=>document.getElementById(id);
const modes={dungeon:'rooms',room:'rooms',texture:'textures',character:'characters',prop:'props',weapon:'weapons',vfx:'vfx',encounter:'encounters',logic:'logic',atmosphere:'atmosphere'};
const defaultInk='#75978e';
class Editor{
constructor(){this.mode='dungeon';this.selected={};this.tool='tile';this.tile='stone';this.actor='skeleton';this.prop='urn';this.color=defaultInk;this.painting=false;this.mirror=false;this.erase=false;this.fill=false;this.brush=1;this.undoStack=[];this.redoStack=[];this.canvas=$('editCanvas');this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});this.ctx.imageSmoothingEnabled=false;this.bind();this.selectDefault();this.makePreview();this.refresh();this.animate();}
selectDefault(){for(const [mode,collection]of Object.entries(modes)){const id=Object.keys(this.collection(mode))[0];if(!this.selected[mode]||!this.collection(mode)[this.selected[mode]])this.selected[mode]=id;}}
collection(mode=this.mode){return mode==='dungeon'||mode==='room'?C.project.rooms:mode==='logic'?C.project.logic:mode==='encounter'?C.project.encounters:C.project.assets[modes[mode]]||{}}
asset(){return this.collection()[this.selected[this.mode]]||Object.values(this.collection())[0]}
change(){C.save();if(['room','texture','character','prop','atmosphere'].includes(this.mode)){C.game.refresh()}if(this.mode==='weapon')C.game.makeWeapon();this.draw();this.renderInspector();this.assetList()}
checkpoint(){this.undoStack.push(C.copy(C.project));if(this.undoStack.length>35)this.undoStack.shift();this.redoStack.length=0}
undo(){if(!this.undoStack.length)return;this.redoStack.push(C.copy(C.project));C.project=this.undoStack.pop();C.save();this.selectDefault();this.refresh()}
redo(){if(!this.redoStack.length)return;this.undoStack.push(C.copy(C.project));C.project=this.redoStack.pop();C.save();this.selectDefault();this.refresh()}
update(obj,key,value){this.checkpoint();obj[key]=value;this.change()}
bind(){
$('playTab').onclick=()=>this.view('game');$('editTab').onclick=()=>this.view('editor');
$('testBtn').onclick=()=>{this.view('game');C.game.refresh();C.game.playtest(this.selected.room)};
$('undoBtn').onclick=()=>this.undo();$('redoBtn').onclick=()=>this.redo();
$('exportBtn').onclick=C.export;$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{this.checkpoint();await C.import(file);this.selectDefault();this.refresh();C.notice('PROJECT IMPORTED')}catch(err){alert('Could not import: '+err.message)}};
$('resetBtn').onclick=()=>{if(!confirm('Restore the entire starter dungeon? This replaces your locally saved project. Export a backup first.'))return;this.checkpoint();C.project=C.defaults();C.save();this.selectDefault();this.refresh()};
$('newAsset').onclick=()=>this.add();$('duplicateAsset').onclick=()=>this.duplicate();$('removeAsset').onclick=()=>this.remove();
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>this.setMode(button.dataset.mode));
$('colorPicker').oninput=e=>{this.color=e.target.value;this.palette()};$('brushSize').oninput=e=>this.brush=+e.target.value;
$('mirrorBtn').onclick=()=>{this.mirror=!this.mirror;$('mirrorBtn').style.color=this.mirror?'#eac489':''};
$('fillBtn').onclick=()=>{this.fill=!this.fill;$('fillBtn').style.color=this.fill?'#eac489':''};
$('eraseBtn').onclick=()=>{this.erase=!this.erase;$('eraseBtn').style.color=this.erase?'#eac489':''};
this.canvas.addEventListener('pointerdown',e=>{this.canvas.setPointerCapture(e.pointerId);this.painting=true;this.checkpoint();this.paint(e)});
this.canvas.addEventListener('pointermove',e=>{this.coords(e);if(this.painting)this.paint(e)});
const finish=()=>{if(!this.painting)return;this.painting=false;this.change()};
this.canvas.addEventListener('pointerup',finish);this.canvas.addEventListener('pointercancel',finish);
this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{if(!document.getElementById('editorView').classList.contains('active'))return;if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?this.redo():this.undo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();this.redo()}});
}
view(which){const edit=which==='editor';$('gameView').classList.toggle('active',!edit);$('editorView').classList.toggle('active',edit);$('playTab').classList.toggle('selected',!edit);$('editTab').classList.toggle('selected',edit);if(edit){C.game.pause(C.game.running);this.refresh()}else{if(C.game.running)C.game.pause(false);C.game.resize()}}
setMode(m){this.mode=m;if(m==='room')this.selected.room=this.selected.room||'room-0';this.selectDefault();this.refresh()}
refresh(){document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===this.mode));this.assetList();this.palette();this.renderInspector();this.draw()}
assetList(){const col=this.collection(),list=$('assetList');list.replaceChildren();$('assetHeading').textContent=(this.mode==='dungeon'?'DUNGEON ROOMS':this.mode.toUpperCase()+' ASSETS');
 for(const a of Object.values(col)){const btn=document.createElement('button');btn.className=a.id===this.selected[this.mode]?'active':'';btn.textContent=a.name;const small=document.createElement('small');small.textContent=a.category||a.ai||a.type||a.id;btn.appendChild(small);btn.onclick=()=>{this.selected[this.mode]=a.id;if(this.mode==='dungeon')this.selected.room=a.id;this.renderInspector();this.draw();this.assetList()};list.appendChild(btn)}}
palette(){const panel=$('palette');panel.replaceChildren();for(const c of C.palette){const b=document.createElement('button');b.style.backgroundColor=c;b.title=c;if(c===this.color)b.className='on';b.onclick=()=>{this.color=c;$('colorPicker').value=c;this.palette()};panel.appendChild(b)}}
formField(label,value,type='text',handler,values){const wrap=document.createElement('label');wrap.className='field';wrap.append(document.createTextNode(label));let el;
 if(type==='select'){el=document.createElement('select');for(const v of values||[]){const o=document.createElement('option');o.value=Array.isArray(v)?v[0]:v;o.textContent=Array.isArray(v)?v[1]:v;el.append(o)}el.value=value}
 else if(type==='textarea'){el=document.createElement('textarea');el.value=value||'';el.rows=3}
 else{el=document.createElement('input');el.type=type;el.value=type==='checkbox'?'on':value;el.checked=type==='checkbox'?!!value:undefined;if(type==='number')el.step='any';if(type==='color')el.value=value||'#ffffff'}
 el.onchange=()=>handler(type==='checkbox'?el.checked:type==='number'?Number(el.value):el.value);wrap.append(el);return wrap}
field(body,label,obj,key,type='text',values){body.append(this.formField(label,obj[key],type,v=>this.update(obj,key,v),values))}
heading(body,title,info){const h=document.createElement('h3');h.textContent=title;body.append(h);if(info){const p=document.createElement('p');p.textContent=info;body.append(p)}}
button(body,label,click){const b=document.createElement('button');b.textContent=label;b.onclick=click;body.append(b);return b}
renderInspector(){const a=this.asset(),body=$('inspectorBody');body.replaceChildren();if(!a)return;
 $('workTitle').textContent=a.name.toUpperCase();$('modeCaption').textContent=(this.mode==='dungeon'?'ROOM GRAPH':this.mode.toUpperCase())+' / '+a.id;
 this.field(body,'ASSET NAME',a,'name');
 if(this.mode==='dungeon'){this.heading(body,'DUNGEON GRAPH','16 interconnected chambers in a four-by-four floor plan. Select a chamber to edit.');this.field(body,'ROOM TYPE',a,'category','select',['entrance','combat','tomb','trap','treasure','shrine','merchant','item','sanctuary','empty','secret','boss']);this.button(body,'✎ EDIT SELECTED CHAMBER',()=>{this.selected.room=a.id;this.setMode('room')});this.field(body,'THEME',a,'theme','select',Object.keys(C.project.assets.atmosphere));}
 if(this.mode==='room'){this.heading(body,'ROOM CONSTRUCTION','Build like masons: floor slabs, bonded stone courses, proper door arches, piers, vaulting, then age damage. Change category to alter the chamber’s original purpose.');
 this.field(body,'ROOM CATEGORY',a,'category','select',['entrance','combat','tomb','trap','treasure','shrine','merchant','item','sanctuary','empty','secret','boss']);
 this.heading(body,'STRUCTURAL MASONRY','Stone courses, load-bearing piers, voussoir arches, vault ribs and historic erosion are assembled automatically.');
 this.field(body,'CEILING HEIGHT (METRES)',a,'ceilingHeight','number');
 this.field(body,'VAULT CONSTRUCTION',a,'vaultStyle','select',['flat','barrel','cross','ribbed']);
 this.field(body,'STONE DECAY 0–1',a,'decay','number');
 this.button(body,'⛏ BUILD FOR ROOM PURPOSE',()=>{
   const preset=C.Masonry.profiles[a.category]||C.Masonry.profiles.combat;
   this.checkpoint();a.ceilingHeight=preset.height;a.vaultStyle=preset.vault;a.decay=preset.decay;this.change();
 });
 this.field(body,'ATMOSPHERE',a,'theme','select',Object.keys(C.project.assets.atmosphere));
 this.field(body,'HINT / INSCRIPTION',a,'clue','textarea');
 body.append(this.formField('PAINT MODE',this.tool,'select',v=>{this.tool=v;this.draw()},[['tile','Stone & floors'],['enemy','Place enemy'],['prop','Place prop'],['delete','Remove instance']]));
 if(this.tool==='tile')body.append(this.formField('MATERIAL',this.tile,'select',v=>{this.tile=v},Object.keys(C.project.assets.textures)));
 if(this.tool==='enemy')body.append(this.formField('ENEMY',this.actor,'select',v=>{this.actor=v},Object.keys(C.project.assets.characters)));
 if(this.tool==='prop')body.append(this.formField('PROP',this.prop,'select',v=>{this.prop=v},Object.keys(C.project.assets.props)));
 this.heading(body,'CONNECTED PASSAGES','Toggle a cardinal door to change room access. Neighboring passages update automatically.');
 for(const dir of ['N','E','S','W'])this.button(body,(a.doors.includes(dir)?'◉ ':'○ ')+dir+' PASSAGE',()=>this.toggleDoor(a,dir));
 this.button(body,'▶ TEST THIS ROOM',()=>{this.view('game');C.game.refresh();C.game.playtest(a.id)})}
 if(['texture','character','prop'].includes(this.mode)){this.heading(body,'PIXEL ART','Paint directly on the canvas. Right-click erases; brushes, flood fill and mirroring use one undo history.');
 this.field(body,'WIDTH',a,'width','number');this.field(body,'HEIGHT',a,'height','number');this.button(body,'RESIZE PIXELS TO DIMENSIONS',()=>{this.checkpoint();this.resizePixels(a);this.change()});
 if(this.mode==='texture'){this.field(body,'SOLID COLLISION',a,'solid','checkbox')}
 if(this.mode==='character'){this.field(body,'HEALTH',a,'hp','number');this.field(body,'DAMAGE',a,'damage','number');this.field(body,'MOVEMENT SPEED',a,'speed','number');this.field(body,'AGGRO RANGE',a,'aggro','number');this.field(body,'AI STYLE',a,'ai','select',['chase','wander','charge']);this.field(body,'SOUL REWARD',a,'reward','number')}
 if(this.mode==='prop'){this.field(body,'SOLID',a,'solid','checkbox');this.field(body,'BREAKABLE',a,'breakable','checkbox');this.field(body,'DURABILITY',a,'hp','number');this.field(body,'LOOT',a,'loot','select',['','weapon','journal','magic'])}
 this.button(body,'↓ EXPORT PIXEL PNG',()=>{const png=C.spriteCanvas(a).toDataURL('image/png'),link=document.createElement('a');link.href=png;link.download=a.id+'.png';link.click()})}
 if(this.mode==='weapon'){this.heading(body,'WEAPON BUILDER','Stats change reach, mass, geometry and the timing of real attacks. Weapon visuals update on playtest.');for(const k of ['tier','damage','stamina','reach','cooldown','weight'])this.field(body,k.toUpperCase(),a,k,'number');this.field(body,'BLADE COLOR',a,'color','color');this.button(body,'EQUIP FOR PLAYTEST',()=>{C.game.hero.weapon=a.id;C.game.makeWeapon();this.view('game')})}
 if(this.mode==='vfx'){this.heading(body,'PARTICLE EFFECT DESIGNER','Color, count, lifespan, size and gravity are used by the runtime particle emitter.');this.field(body,'COLOR',a,'color','color');for(const k of ['count','life','size','gravity'])this.field(body,k.toUpperCase(),a,k,'number');this.button(body,'✧ PREVIEW BURST IN GAME',()=>{this.view('game');C.game.emit(C.game.hero.x,1.4,C.game.hero.z,a.id)})}
 if(this.mode==='encounter'){this.heading(body,'ENCOUNTER RULES','Choose how rooms manage waves and door locks.');this.field(body,'SEAL DOORS DURING FIGHT',a,'sealDoors','checkbox');this.field(body,'WAVES',a,'waves','number');this.field(body,'ENEMY POWER MULTIPLIER',a,'multiplier','number')}
 if(this.mode==='logic'){this.heading(body,'SECRET / TRIGGER GRAPH','Typed event-to-reward rule. Define conditions without executing user-provided JavaScript.');this.field(body,'ROOM',a,'room','select',Object.keys(C.project.rooms));this.field(body,'GRID X',a,'x','number');this.field(body,'GRID Z',a,'z','number');this.field(body,'TRIGGER',a,'type','select',['interact','boss','enter','spell']);this.field(body,'REQUIRES',a,'requires','select',['veil','clear','key','none']);this.field(body,'REWARD',a,'reward','select',['maul','cleaver','axe','victory','magic']);this.field(body,'DISCOVERY HINT',a,'hint','textarea');this.heading(body,'EXECUTION','Built-in starter secret and bell events are wired in the runtime. Additional authored graphs require runtime handler support.')}
 if(this.mode==='atmosphere'){this.heading(body,'FOG & LIGHT','A room references an atmosphere preset. Lighting and distance fog are immediately applied during playtest.');this.field(body,'FOG COLOR',a,'fog','color');for(const k of ['density','heightFog','ambient','torch'])this.field(body,k.toUpperCase(),a,k,'number');this.button(body,'APPLY TO SELECTED ROOM',()=>{this.checkpoint();C.project.rooms[this.selected.room||'room-0'].theme=a.id;this.change()})}
 }
toggleDoor(a,dir){const other=C.topology(a)[dir];if(!other){alert('This passage leads beyond the current dungeon bounds.');return}this.checkpoint();const isOpen=a.doors.includes(dir);a.doors=isOpen?a.doors.filter(d=>d!==dir):[...a.doors,dir];const counterpart={N:'S',S:'N',W:'E',E:'W'}[dir],r=C.project.rooms[other];if(isOpen)r.doors=r.doors.filter(d=>d!==counterpart);else if(!r.doors.includes(counterpart))r.doors.push(counterpart);
 const positions={N:[[4,0],[4,8]],S:[[4,8],[4,0]],W:[[0,4],[8,4]],E:[[8,4],[0,4]]},pair=positions[dir];a.tiles[pair[0][1]*9+pair[0][0]]=isOpen?'stone':'floor';r.tiles[pair[1][1]*9+pair[1][0]]=isOpen?'stone':'floor';this.change()}
coords(e){const box=this.canvas.getBoundingClientRect(),x=Math.floor((e.clientX-box.left)/box.width*576),y=Math.floor((e.clientY-box.top)/box.height*576);$('editHint').textContent='X '+x+' · Y '+y+' / '+this.mode}
resizePixels(a){const w=clamp(Math.round(a.width)||16,4,128),h=clamp(Math.round(a.height)||16,4,128),old=a.pixels.slice(),oldW=Math.max(1,Math.round(Math.sqrt(old.length))),next=Array(w*h).fill(null);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(y<Math.ceil(old.length/oldW)&&x<oldW)next[y*w+x]=old[y*oldW+x]||null;a.width=w;a.height=h;a.pixels=next}
paint(e){const a=this.asset();if(!a)return;const box=this.canvas.getBoundingClientRect(),cx=Math.floor((e.clientX-box.left)/box.width*576),cy=Math.floor((e.clientY-box.top)/box.height*576),right=e.button===2||e.buttons===2;
 if(this.mode==='dungeon'){const gx=Math.floor((cx-50)/120),gz=Math.floor((cy-50)/120);const id='room-'+(gz*4+gx);if(C.project.rooms[id]){this.selected.dungeon=id;this.selected.room=id;this.renderInspector();this.assetList();this.draw()}return}
 if(this.mode==='room'){const x=Math.floor(cx/64),z=Math.floor(cy/64);if(x<0||z<0||x>=9||z>=9)return;const idx=z*9+x;if(this.tool==='tile'){if(x===0||z===0||x===8||z===8){$('editHint').textContent='Border tiles are controlled by door sockets';return}a.tiles[idx]=right?'floor':this.tile}
 else{const collection=this.tool==='enemy'?'enemies':'props';if(this.tool==='delete'||right){a.enemies=a.enemies.filter(o=>o.x!==x||o.z!==z);a.props=a.props.filter(o=>o.x!==x||o.z!==z)}
 else{if(!a[collection])a[collection]=[];a[collection]=a[collection].filter(o=>o.x!==x||o.z!==z);a[collection].push({id:C.uid('instance'),kind:this.tool==='enemy'?this.actor:this.prop,x,z})}}this.draw();return}
 if(['texture','character','prop'].includes(this.mode)){const w=a.width||16,h=a.height||16,x=Math.floor(cx/576*w),y=Math.floor(cy/576*h);if(x<0||y<0||x>=w||y>=h)return;const color=this.erase||right?null:this.color;
 const apply=(x,y)=>{for(let iy=0;iy<this.brush;iy++)for(let ix=0;ix<this.brush;ix++){const xx=x+ix,yy=y+iy;if(xx<w&&yy<h)a.pixels[yy*w+xx]=color}};
 if(this.fill){const old=a.pixels[y*w+x];if(old===color)return;const queue=[y*w+x],seen=new Set();while(queue.length){const i=queue.pop();if(i<0||i>=w*h||seen.has(i)||a.pixels[i]!==old)continue;seen.add(i);a.pixels[i]=color;const xx=i%w,yy=Math.floor(i/w);if(xx>0)queue.push(i-1);if(xx<w-1)queue.push(i+1);if(yy>0)queue.push(i-w);if(yy<h-1)queue.push(i+w)}}else{apply(x,y);if(this.mirror)apply(w-1-x,y)}this.draw()}
 }
draw(){const ctx=this.ctx,a=this.asset();ctx.clearRect(0,0,576,576);ctx.fillStyle='#152326';ctx.fillRect(0,0,576,576);if(!a)return;
 if(this.mode==='dungeon'){ctx.font='12px monospace';ctx.textAlign='center';for(const r of Object.values(C.project.rooms)){const x=50+r.gx*120,y=50+r.gz*120;ctx.fillStyle=r.id===this.selected.dungeon?'#806a49':'#283e3d';ctx.fillRect(x,y,105,105);ctx.strokeStyle='#83988a';ctx.strokeRect(x+.5,y+.5,104,104);ctx.fillStyle='#ead2a5';ctx.fillText(r.name.slice(0,14),x+52,y+50);ctx.fillStyle='#9bc6bd';ctx.fillText(r.category.toUpperCase(),x+52,y+69);ctx.strokeStyle='#c3a66a';ctx.lineWidth=6;ctx.beginPath();if(r.doors.includes('E')){ctx.moveTo(x+105,y+52);ctx.lineTo(x+120,y+52)}if(r.doors.includes('S')){ctx.moveTo(x+52,y+105);ctx.lineTo(x+52,y+120)}ctx.stroke()}return}
 if(this.mode==='room'){for(let z=0;z<9;z++)for(let x=0;x<9;x++){const id=a.tiles[z*9+x],tex=C.project.assets.textures[id];ctx.fillStyle=id==='stone'?'#314c49':id==='moss'?'#35594b':id==='goldstone'?'#95704b':'#53655a';ctx.fillRect(x*64,z*64,64,64);if(tex){const img=C.spriteCanvas(tex);ctx.imageSmoothingEnabled=false;ctx.globalAlpha=.57;ctx.drawImage(img,x*64,z*64,64,64);ctx.globalAlpha=1}ctx.strokeStyle='#09171b66';ctx.strokeRect(x*64+.5,z*64+.5,64,64)}
 for(const o of a.props||[]){const p=C.project.assets.props[o.kind];if(p)ctx.drawImage(C.spriteCanvas(p),o.x*64+12,o.z*64+12,40,40)}for(const o of a.enemies||[]){const p=C.project.assets.characters[o.kind];if(p)ctx.drawImage(C.spriteCanvas(p),o.x*64+12,o.z*64+12,40,40)}ctx.strokeStyle='#e4bb76';ctx.strokeRect(4*64+2,4*64+2,60,60);return}
 if(['texture','character','prop'].includes(this.mode)){const w=a.width||16,h=a.height||16,sz=Math.min(576/w,576/h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){ctx.fillStyle=(x+y)%2?'#203137':'#263b3b';ctx.fillRect(x*sz,y*sz,sz,sz);if(a.pixels[y*w+x]){ctx.fillStyle=a.pixels[y*w+x];ctx.fillRect(x*sz,y*sz,sz,sz)}if(w<=32){ctx.strokeStyle='#121f214d';ctx.strokeRect(x*sz+.5,y*sz+.5,sz,sz)}}return}
 ctx.fillStyle='#8caa99';ctx.textAlign='center';ctx.font='22px Georgia';ctx.fillText(a.name.toUpperCase(),288,90);
 if(this.mode==='weapon'){ctx.fillStyle=a.color;ctx.save();ctx.translate(288,340);ctx.rotate(-.45);ctx.fillRect(-16,-160,32,210);ctx.fillStyle='#9a7758';ctx.fillRect(-8,45,16,100);ctx.fillRect(-80,28,160,14);ctx.restore();ctx.font='14px monospace';ctx.fillText('TIER '+a.tier+' · '+a.damage+' DAMAGE · '+a.stamina+' STAMINA',288,505)}
 if(this.mode==='vfx'){for(let i=0;i<a.count;i++){const t=i/a.count*6.28,rad=(60+i%9*9),x=288+Math.cos(t)*rad,y=300+Math.sin(t)*rad;ctx.fillStyle=a.color;ctx.fillRect(x,y,Math.max(3,a.size*48),Math.max(3,a.size*48))}}
 if(this.mode==='atmosphere'){ctx.fillStyle=a.fog;ctx.fillRect(130,155,316,290);ctx.fillStyle='#fff4c7';ctx.fillRect(280,240,16,70);ctx.fillStyle='#e8a868';ctx.beginPath();ctx.ellipse(288,225,25,52,0,0,Math.PI*2);ctx.fill()}
 if(this.mode==='logic'||this.mode==='encounter'){ctx.font='14px monospace';ctx.fillStyle='#d8c393';ctx.fillText(this.mode==='logic'?'EVENT → CONDITION → REWARD':'TRIGGER → SPAWN → REWARD',288,300)}}
add(){const col=this.collection();if(['dungeon','room'].includes(this.mode)){alert('The first playable chapter currently uses 16 fixed room slots. Duplicate a room into an existing slot by painting or importing a world pack.');return}this.checkpoint();let asset;
 const prefix=this.mode==='texture'?'texture':this.mode;const id=C.uid(prefix);
 if(['texture','character','prop'].includes(this.mode)){asset={id,name:'New '+this.mode,width:16,height:16,pixels:Array(256).fill(null)};if(this.mode==='texture')asset.solid=false;if(this.mode==='character')Object.assign(asset,{hp:30,damage:8,speed:2,aggro:6,ai:'chase',reward:10});if(this.mode==='prop')Object.assign(asset,{solid:false,breakable:true,hp:15,loot:''})}
 else if(this.mode==='weapon')asset={id,name:'New Weapon',tier:1,damage:18,stamina:12,reach:1.9,cooldown:.55,weight:1,color:'#a0aaa4'};
 else if(this.mode==='vfx')asset={id,name:'New Effect',color:'#79ccc0',count:20,life:.8,size:.14,gravity:1};
 else if(this.mode==='atmosphere')asset={id,name:'New Atmosphere',fog:'#183733',density:.06,heightFog:.4,ambient:.5,torch:1.7};
 else if(this.mode==='logic')asset={id,name:'New Secret',room:'room-0',x:4,z:4,type:'interact',requires:'veil',reward:'magic',hint:'A hidden inscription.'};
 else asset={id,name:'New Encounter',sealDoors:false,waves:1,multiplier:1};
 col[id]=asset;this.selected[this.mode]=id;this.change();this.refresh()}
duplicate(){const a=this.asset();if(!a||['room','dungeon'].includes(this.mode)){C.notice('ROOM SLOT DUPLICATION IS NOT ENABLED YET');return}this.checkpoint();const copy=C.copy(a);copy.id=C.uid(this.mode);copy.name=a.name+' COPY';this.collection()[copy.id]=copy;this.selected[this.mode]=copy.id;this.change();this.refresh()}
remove(){const a=this.asset();if(!a||['room','dungeon'].includes(this.mode)){alert('Core dungeon rooms cannot be deleted in this build.');return}const col=this.collection();if(Object.keys(col).length<=1){alert('Keep at least one asset in each editor.');return}
 const id=a.id,referenced=Object.values(C.project.rooms).some(r=>r.theme===id||r.tiles.includes(id)||(r.props||[]).some(p=>p.kind===id)||(r.enemies||[]).some(p=>p.kind===id));
 if(referenced){alert('This asset is used in the dungeon. Replace its references before deleting.');return}
 if(!confirm('Delete '+a.name+'?'))return;this.checkpoint();delete col[id];this.selected[this.mode]=Object.keys(col)[0];this.change();this.refresh()}
makePreview(){if(!window.THREE)return;const t=document.createElement('div');t.className='live-preview';t.setAttribute('aria-label','Live 3D room preview');const title=document.createElement('div');title.textContent='◈ LIVE 3D VIEW';title.className='preview-title';t.appendChild(title);$('editorStage').appendChild(t);
 const THREE=window.THREE;this.previewCamera=new THREE.PerspectiveCamera(74,240/150,.1,90);this.previewRender=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});this.previewRender.setPixelRatio(1);this.previewRender.setSize(240,150,false);t.appendChild(this.previewRender.domElement);this.previewFrame=0}
preview(){if(!this.previewRender||!$('editorView').classList.contains('active'))return;const room=C.project.rooms[this.mode==='dungeon'?this.selected.dungeon:(this.selected.room||'room-0')];if(!room)return;const x=(room.gx*9+4.5)*1.8,z=(room.gz*9+4.5)*1.8;this.previewCamera.position.set(x,1.65,z);this.previewCamera.lookAt(x+4,1.65,z-4);this.previewRender.render(C.game.scene,this.previewCamera)}
animate(){requestAnimationFrame(()=>this.animate());this.previewFrame=(this.previewFrame||0)+1;if(this.previewFrame%14===0)this.preview();if(this.mode==='vfx'&&$('editorView').classList.contains('active')&&!this.painting)this.draw()}
}
C.editor=new Editor();
})();
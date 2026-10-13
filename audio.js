/* CRIPT — procedural Web Audio ambience and feedback, no bundled samples */
(function(){'use strict';
const C=window.Cript;if(!C||!C.game)return;
class Audio{
 constructor(){this.enabled=localStorage.getItem('cript.muted')!=='true';this.ctx=null;this.master=null;this.low=null;this.motion=0;this.lastX=0;this.lastZ=0;this.drip=0;this.updateButton()}
 initialize(){if(!this.enabled)return;if(!this.ctx){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
  this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=.48;this.master.connect(this.ctx.destination);
  const osc=this.ctx.createOscillator(),g=this.ctx.createGain();osc.type='sine';osc.frequency.value=49;g.gain.value=.021;osc.connect(g);g.connect(this.master);osc.start();this.low=osc;
 }if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{})}
 updateButton(){const btn=document.getElementById('soundBtn');if(btn){btn.textContent=this.enabled?'♫':'♪̸';btn.title=this.enabled?'Sound on — click to mute':'Sound muted — click to enable'}}
 toggle(){this.enabled=!this.enabled;localStorage.setItem('cript.muted',String(!this.enabled));if(this.enabled)this.initialize();if(this.master)this.master.gain.setTargetAtTime(this.enabled?.48:0,this.ctx.currentTime,.02);this.updateButton()}
 tone(freq=150,seconds=.15,type='sine',volume=.08,slide=.6){
  if(!this.enabled)return;this.initialize();if(!this.ctx)return;const now=this.ctx.currentTime,osc=this.ctx.createOscillator(),g=this.ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(Math.max(25,freq),now);osc.frequency.exponentialRampToValueAtTime(Math.max(25,freq*slide),now+seconds);
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+seconds);
  osc.connect(g);g.connect(this.master);osc.start(now);osc.stop(now+seconds+.02);
 }
 noise(seconds=.12,volume=.04,filterHz=700){if(!this.enabled)return;this.initialize();if(!this.ctx)return;const length=Math.floor(this.ctx.sampleRate*seconds),buf=this.ctx.createBuffer(1,length,this.ctx.sampleRate),arr=buf.getChannelData(0);
  for(let i=0;i<length;i++)arr[i]=(Math.random()*2-1)*Math.pow(1-i/length,1.6);
  const src=this.ctx.createBufferSource(),fil=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=buf;fil.type='lowpass';fil.frequency.value=filterHz;g.gain.value=volume;src.connect(fil);fil.connect(g);g.connect(this.master);src.start();}
 effect(name){switch(name){
  case 'step':this.noise(.078,.045,420);break;
  case 'swing':this.noise(.18,.13,800);this.tone(155,.13,'triangle',.045,.35);break;
  case 'heavy':this.noise(.27,.15,580);this.tone(110,.27,'sawtooth',.085,.23);break;
  case 'hit':this.noise(.12,.12,900);this.tone(95,.13,'square',.048,.5);break;
  case 'spell':this.tone(480,.55,'sine',.075,1.7);this.tone(770,.25,'triangle',.03,.54);break;
  case 'bell':this.tone(165,1.9,'sine',.08,.92);this.tone(248,1.4,'sine',.04,.87);this.tone(330,1,'sine',.022,.84);break;
  case 'drip':this.tone(380,.11,'sine',.025,1.5);break;
  case 'interact':this.tone(290,.13,'triangle',.045,.79);break;
  case 'hurt':this.tone(85,.26,'sawtooth',.08,.5);break;
 }}
 tick(dt,game){if(!this.enabled||!game.running||game.paused)return;const p=game.hero;this.motion+=dt;this.drip+=dt;
  if(this.drip>5+Math.random()*1.5){this.drip=0;this.effect('drip')}
  const delta=Math.hypot(p.x-this.lastX,p.z-this.lastZ);if(delta>.65&&this.motion>.27){this.motion=0;this.lastX=p.x;this.lastZ=p.z;this.effect('step')}
 }
}
const audio=new Audio();C.audio=audio;
const game=C.game;
function wrap(method,after){const original=game[method].bind(game);game[method]=function(...args){const result=original(...args);after(...args);return result}}
wrap('start',()=>{audio.initialize();audio.lastX=game.hero.x;audio.lastZ=game.hero.z;audio.effect('bell')});
wrap('strike',heavy=>{if(game.running)audio.effect(heavy?'heavy':'swing')});
wrap('spell',()=>{if(game.running)audio.effect('spell')});
wrap('hurt',()=>audio.effect('hurt'));
wrap('interact',()=>audio.effect('interact'));
wrap('turn',()=>{if(game.mode==='grid')audio.effect('step')});
const update=game.update.bind(game);game.update=function(dt){update(dt);audio.tick(dt,game)};
})();

import * as THREE from 'three';
import { destinations, roomAt, floorAt } from './world/house.js';
import { EYE_HEIGHT, resolveMove } from './world/movement.js';

export function createNavigation({camera,controls,canvas,colliders,initialCamera,initialTarget}) {
  const $=id=>document.getElementById(id);
  const orbitFov=camera.fov;
  const keys=new Set();const joystick={x:0,y:0};
  let mode='orbit',yaw=0,pitch=0,foot=0,lookPointer=null,stickPointer=null,lastX=0,lastY=0;
  let lastRoom='',lastFloor='';
  const stick=$('joystick'),knob=$('joystick-knob');
  const locations=$('destination');
  for(const [key,point] of Object.entries(destinations)){const option=document.createElement('option');option.value=key;option.textContent=point.label;locations.append(option);}
  function clearInput(){keys.clear();joystick.x=joystick.y=0;knob.style.transform='translate(0px, 0px)';lookPointer=null;stickPointer=null;}
  function view(){camera.rotation.set(pitch,yaw,0,'YXZ');}
  function start(key='garden') {
    const p=destinations[key]||destinations.garden;mode='walk';controls.enabled=false;camera.fov=68;camera.updateProjectionMatrix();
    controls.enabled=false;camera.rotation.order='YXZ';camera.position.set(p.position[0],p.position[1]+EYE_HEIGHT,p.position[2]);foot=p.position[1];yaw=p.yaw;pitch=0;view();
    $('walk-help').hidden=true;document.body.classList.add('walking');$('walk-controls').hidden=false;$('walk-hud').hidden=false;
    $('walk').classList.add('active');$('orbit').classList.remove('active');locations.value=key;clearInput();
    $('hint').textContent='WASD 이동 · 화면 드래그로 시선 · Esc 종료';canvas.focus({preventScroll:true});updateRoom();
  }
  function stop(){
    mode='orbit';camera.fov=orbitFov;camera.updateProjectionMatrix();clearInput();controls.enabled=true;document.body.classList.remove('walking');$('walk-controls').hidden=true;$('walk-hud').hidden=true;$('walk-help').hidden=true;
    $('orbit').classList.add('active');$('walk').classList.remove('active');camera.position.copy(initialCamera);controls.target.copy(initialTarget);controls.update();
    $('hint').innerHTML='드래그하여 회전 <b>·</b> 스크롤하여 확대';
  }
  function updateRoom(){const room=roomAt(camera.position.x,camera.position.z,foot),level=room==='정원'?'OUTDOOR':room==='계단'?'STAIRCASE':foot>2.5?'SECOND FLOOR':'FIRST FLOOR';
    if(room!==lastRoom){$('room-name').textContent=room;lastRoom=room;}
    if(level!==lastFloor){$('floor-name').textContent=level;lastFloor=level;}
  }
  $('walk').addEventListener('click',()=>{$('walk-help').hidden=false;});
  $('enter-walk').addEventListener('click',()=>start());
  $('close-help').addEventListener('click',()=>{$('walk-help').hidden=true;});
  $('orbit').addEventListener('click',stop);$('reset').addEventListener('click',stop);$('exit-walk').addEventListener('click',stop);
  $('visit-inside').addEventListener('click',()=>start('living'));
  locations.addEventListener('change',()=>start(locations.value));
  $('settings-toggle').addEventListener('click',()=>{const open=document.body.classList.toggle('settings-open');$('settings-toggle').setAttribute('aria-expanded',String(open));$('settings-toggle').setAttribute('aria-label',open?'환경 설정 닫기':'환경 설정 열기');});
  // Neither mouse lock nor motion sensors are required. Camera drag uses
  // Pointer Events, so simultaneous joystick + look also works on touch screens.
  canvas.style.touchAction='none';
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='walk'||lookPointer!==null||e.button>0)return;
    lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(mode!=='walk'||e.pointerId!==lookPointer)return;
    yaw-=(e.clientX-lastX)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-lastY)*.003,-1.35,1.35);
    lastX=e.clientX;lastY=e.clientY;view();
  });
  const endLook=e=>{if(e.pointerId===lookPointer)lookPointer=null;};
  canvas.addEventListener('pointerup',endLook);canvas.addEventListener('pointercancel',endLook);canvas.addEventListener('lostpointercapture',endLook);
  function updateStick(e){
    const rect=stick.getBoundingClientRect(),dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2;
    const max=rect.width*.31,len=Math.hypot(dx,dy),scale=len>max?max/len:1;
    const x=dx*scale,y=dy*scale;joystick.x=Math.abs(x/max)<.07?0:x/max;joystick.y=Math.abs(y/max)<.07?0:y/max;
    knob.style.transform=`translate(${x}px, ${y}px)`;
  }
  stick.addEventListener('pointerdown',e=>{if(mode!=='walk'||stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer){e.preventDefault();updateStick(e);}});
  function endStick(e){if(e.pointerId!==stickPointer)return;stickPointer=null;joystick.x=joystick.y=0;knob.style.transform='translate(0px, 0px)';}
  stick.addEventListener('pointerup',endStick);stick.addEventListener('pointercancel',endStick);stick.addEventListener('lostpointercapture',endStick);
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'){if(document.body.classList.contains('settings-open')){document.body.classList.remove('settings-open');$('settings-toggle').setAttribute('aria-expanded','false');$('settings-toggle').setAttribute('aria-label','환경 설정 열기');}else if(mode==='walk')stop();$('walk-help').hidden=true;return;}
    if(mode!=='walk'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
  window.addEventListener('resize',clearInput);
  function update(dt){
    if(mode!=='walk')return;
    const f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))-joystick.y;
    const r=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+joystick.x;
    const len=Math.hypot(f,r),scale=len>1?1/len:1;
    const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?4.5:2.7)*dt;
    if(len>.02){const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)*scale*speed,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)*scale*speed;
      const next=resolveMove({x:camera.position.x,z:camera.position.z,foot},dx,dz,colliders);camera.position.set(next.x,next.foot+EYE_HEIGHT,next.z);foot=next.foot;}
    updateRoom();
  }
  return {update,stop,get mode(){return mode;},get foot(){return foot;},diagnostics:()=>({mode,foot,yaw,pitch,joystick:{...joystick},room:roomAt(camera.position.x,camera.position.z,foot),pointerLocked:document.pointerLockElement!==null})};
}

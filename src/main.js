import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import '@fontsource/noto-sans-kr/korean-400.css';
import '@fontsource/noto-sans-kr/korean-500.css';
import '@fontsource/noto-serif-kr/korean-400.css';
import './style.css';

const canvas = document.querySelector('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  document.querySelector('#loading').hidden = true;
  const error = document.querySelector('#error');
  error.hidden = false;
  error.textContent = '이 맵은 WebGL을 지원하는 브라우저가 필요합니다. 브라우저의 하드웨어 가속을 켜고 다시 접속해 주세요.';
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#b7c9c1', 0.008);
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 450);
const initialCamera = new THREE.Vector3(19, 9.5, 36);
const initialTarget = new THREE.Vector3(0, 3.3, 0);
camera.position.copy(initialCamera);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(initialTarget);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.025;
controls.minDistance = 14;
controls.maxDistance = 65;
controls.enablePan = false;

// Deterministic textures: albedo and relief share the exact same mortar pattern.
let seed = 71;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function texture(type, base, scale) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const ctx = c.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
  if (type === 'brick' || type === 'tile' || type === 'stone') {
    const h = type === 'tile' ? 16 : type === 'brick' ? 32 : 64;
    const w = type === 'stone' ? 110 : 84;
    ctx.fillStyle = type === 'tile' ? '#92958c' : '#64645d'; ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 512 / h; row++) {
      for (let col = -1; col < 8; col++) {
        const offset = row % 2 ? w / 2 : 0;
        const variation = Math.floor(random() * 24 - 12);
        const rgb = new THREE.Color(base);
        // Canvas color is sRGB, not Three's linear internal color.
        const hex = rgb.getHexString(); const n = parseInt(hex,16);
        const r = Math.min(255, Math.max(0, (n >> 16) + variation));
        const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + variation));
        const b = Math.min(255, Math.max(0, (n & 255) + variation));
        ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(col * w + offset + 1, row * h + 1, w - 2, h - 2);
      }
    }
  }
  const data = ctx.getImageData(0,0,512,512);
  for(let i = 0; i < data.data.length; i += 4) {
    const n = (random() - .5) * (type === 'grass' ? 48 : 15);
    for(let j = 0; j < 3; j++) data.data[i+j] += n;
  }
  ctx.putImageData(data,0,0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(scale,scale);
  t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  return t;
}
function surface(type, color, scale, roughness=.85, bump=.025) {
  const map = texture(type,color,scale);
  const relief = map.clone(); relief.colorSpace = THREE.NoColorSpace;
  return new THREE.MeshStandardMaterial({map, bumpMap:relief, bumpScale:bump, roughness});
}
const materials = {
  brick:surface('brick','#34373b',3,.9,.035),
  tile:surface('tile','#c7ccc6',3,.75,.025),
  stone:surface('stone','#85877d',2,.96,.055),
  concrete:surface('noise','#a2a598',2,.95,.025),
  wood:surface('tile','#a08059',1,.7,.012),
  grass:surface('grass','#546f31',24,.98,.04),
  metal:new THREE.MeshStandardMaterial({color:'#20282a',metalness:.65,roughness:.36}),
  roof:new THREE.MeshStandardMaterial({color:'#292e2d',roughness:.88}),
  soil:surface('noise','#4c4434',2,.97,.04),
};
const solidColliders = [];
function box(w,h,d,x,y,z,mat,collision=false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  if(collision) solidColliders.push({minX:x-w/2-.35,maxX:x+w/2+.35,minZ:z-d/2-.35,maxZ:z+d/2+.35});
  return mesh;
}
function cylinder(rt,rb,h,x,y,z,mat,segments=10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; scene.add(m); return m;
}
// The architecture follows the reference: dark left wing, tall pale front volume,
// recessed right wing, stone ground floor, terrace and central approach.
box(150,.25,150,0,-.22,0,materials.grass);
box(22,.65,12,0,.3,0,materials.concrete);
box(10,3.35,8,-5,2.28,-1,materials.stone,true);
box(10,3.2,8,-5,5.55,-1,materials.brick,true);
box(6.7,7.7,8.5,3.35,4.18,-.75,materials.tile,true);
box(3,6.55,7,8.2,3.93,-2,materials.brick,true);
box(10.15,.15,8.15,-5,7.2,-1,materials.roof);
box(6.85,.15,8.65,3.35,8.1,-.75,materials.concrete);
box(3.1,.15,7.1,8.2,7.23,-2,materials.roof);
box(10,1.55,.12,-5,5.4,3.05,materials.tile);
box(2.4,3.45,4.3,-10.5,2.33,.8,materials.tile);
box(.3,3.2,3,-11.65,2.2,1.4,materials.wood);
box(2.8,.2,4.5,-10.5,3.95,1,materials.concrete);
// Windows are inset dark glazing, with a furnished warm interior behind them.
const glazing = new THREE.MeshPhysicalMaterial({color:'#b3d6d3',metalness:.1,roughness:.1,transparent:true,opacity:.23,side:THREE.DoubleSide,depthWrite:false});
// A layered room texture adds depth cues behind reflective glazing.
const roomCanvas=document.createElement('canvas');roomCanvas.width=512;roomCanvas.height=512;
const room=roomCanvas.getContext('2d');
const wallGradient=room.createLinearGradient(0,0,0,512);wallGradient.addColorStop(0,'#ddd1b4');wallGradient.addColorStop(.65,'#a69a7d');wallGradient.addColorStop(1,'#675c49');
room.fillStyle=wallGradient;room.fillRect(0,0,512,512);
room.fillStyle='#736850';room.beginPath();room.moveTo(0,0);room.lineTo(90,70);room.lineTo(90,375);room.lineTo(0,512);room.fill();
room.fillStyle='#a99c81';room.beginPath();room.moveTo(512,0);room.lineTo(425,70);room.lineTo(425,375);room.lineTo(512,512);room.fill();
room.fillStyle='#ebe1c7';room.beginPath();room.moveTo(0,0);room.lineTo(512,0);room.lineTo(425,70);room.lineTo(90,70);room.fill();
room.fillStyle='#75614b';room.beginPath();room.moveTo(90,375);room.lineTo(425,375);room.lineTo(512,512);room.lineTo(0,512);room.fill();
room.strokeStyle='#5b4c3c';room.lineWidth=2;
for(let i=0;i<10;i++){room.beginPath();room.moveTo(90+i*34,375);room.lineTo(-140+i*85,512);room.stroke();}
room.fillStyle='#5c584b';room.fillRect(135,288,245,77);room.fillStyle='#85816e';room.fillRect(146,265,224,63);
room.fillStyle='#aaa18a';room.fillRect(157,272,57,49);room.fillRect(218,272,69,49);room.fillRect(291,272,67,49);
room.fillStyle='#493e31';room.fillRect(177,358,174,15);room.fillRect(190,373,9,31);room.fillRect(329,373,9,31);
room.fillStyle='#5d584b';room.fillRect(211,120,106,84);room.fillStyle='#a5ae96';room.fillRect(218,127,92,70);
room.fillStyle='#6f8469';room.beginPath();room.moveTo(218,189);room.lineTo(246,145);room.lineTo(283,177);room.lineTo(310,153);room.lineTo(310,197);room.lineTo(218,197);room.fill();
room.fillStyle='#404337';room.fillRect(390,316,22,37);
for(let i=0;i<9;i++){room.fillStyle=i%2?'#4b6041':'#657551';room.beginPath();room.ellipse(399+Math.sin(i)*17,299-i*5,7,16,Math.sin(i),0,Math.PI*2);room.fill();}
const glow=room.createRadialGradient(256,65,3,256,65,130);glow.addColorStop(0,'#fff3ce');glow.addColorStop(.25,'#fff0c590');glow.addColorStop(1,'#fff0c500');room.fillStyle=glow;room.fillRect(110,0,300,200);
const roomTexture=new THREE.CanvasTexture(roomCanvas);roomTexture.colorSpace=THREE.SRGBColorSpace;
const inside = new THREE.MeshStandardMaterial({map:roomTexture,emissiveMap:roomTexture,emissive:'#ffe0a1',emissiveIntensity:.25,roughness:.88});
const interiorLights = [];
const luminous = new THREE.MeshStandardMaterial({color:'#fff0ca',emissive:'#ffc779',emissiveIntensity:2.8});
const interiorSurfaces=[];
function windowFront(x,y,z,w,h,mullions=1) {
  box(w+.17,h+.17,.18,x,y,z,materials.metal);
  box(w-.1,h-.1,.17,x,y,z+.02,inside);
  box(w-.12,.06,.13,x,y-h/2+.15,z+.16,materials.wood);
  box(w-.12,h-.12,.025,x,y,z+.16,glazing);
  for(let i=1;i<=mullions;i++) box(.055,h,.09,x-w/2+w*i/(mullions+1),y,z+.2,materials.metal);
  // Visible ceiling strip, interior curtains and sill create depth without an open building.
  const light = box(w*.66,.035,.05,x,y+h*.38,z+.18,luminous); interiorSurfaces.push(light);
  const curtainMat = new THREE.MeshStandardMaterial({color:'#bbb9a7',roughness:1});
  for(const side of [-1,1]) for(let i=0;i<4;i++) box(.05,h*.88,.045,x+side*(w*.41+i*.022),y,z+.18,curtainMat);
  box(w*.48,.16,.07,x,y-h*.31,z+.19,materials.wood);
  for(let i=0;i<3;i++) box(.16,.25,.025,x-w*.14+i*.22,y-h*.2,z+.24,materials.tile);
}
windowFront(-7.5,5.57,3.15,3,1.75,3);
windowFront(-3.75,5.65,3.16,2.6,1.3,0);
windowFront(-5.6,2.3,3.15,2.4,1.85,1);
for(const x of [1.5,3.35,5.2]) windowFront(x,5.85,3.57,1.25,2.85,0);
windowFront(3.35,2.2,3.58,5.2,2.8,3);
windowFront(8.25,5.5,1.55,1.85,1.95,1);
windowFront(8.3,2.2,1.55,1.5,2.25,0);
box(1.5,2.65,.15,-1.4,1.98,3.17,materials.metal);
box(.065,.4,.045,-.92,1.85,3.29,materials.concrete);
box(6.5,.17,1.4,3.35,3.8,4,materials.metal);
box(6.6,.10,1.45,3.35,3.89,4,materials.wood);
box(6.7,.08,2.4,3.35,.67,4.6,materials.wood);
for(let i=0;i<4;i++) box(3.7,.16,1.0,0,.57-i*.16,6.25+i*.65,materials.concrete);
// Thin black railings.
for(let x=-11; x<=10; x+=1.2) {
  if(x>-2 && x<2) continue;
  box(.05,1.15,.05,x,1.22,5.85,materials.metal);
}
for(const [x,w] of [[-6.6,8.6],[6.1,8.2]]) {
  box(w,.045,.05,x,1.79,5.85,materials.metal);
  box(w,.027,.027,x,1.24,5.85,materials.metal);
  box(w,.027,.027,x,.95,5.85,materials.metal);
}
for(const x of [-11,10.2]) {
  box(.04,.04,10,x,1.79,.85,materials.metal);
  for(let z=-4;z<6;z+=1.25) box(.045,1.15,.045,x,1.22,z,materials.metal);
}
const sun = new THREE.DirectionalLight('#ffe5bf',3.4); sun.position.set(-20,26,14);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-32,right:32,top:30,bottom:-30,near:1,far:110});
sun.shadow.bias=-.00025; sun.shadow.normalBias=.035; scene.add(sun);
const hemi = new THREE.HemisphereLight('#d4e5ef','#465230',2.1); scene.add(hemi);
const sky = new Sky(); sky.scale.setScalar(400); scene.add(sky);
const skyUniforms = sky.material.uniforms;
skyUniforms.turbidity.value=2.5; skyUniforms.rayleigh.value=2;
skyUniforms.mieCoefficient.value=.005; skyUniforms.mieDirectionalG.value=.82;
const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileCubemapShader();
let environment;
function wallLight(x,y,z) {
  box(.12,.22,.11,x,y,z,materials.metal);
  const bulb=box(.11,.13,.12,x,y-.07,z+.04,luminous); interiorSurfaces.push(bulb);
  const light = new THREE.SpotLight('#ffd296',22,7,Math.PI/3,.75,1.4);
  light.position.set(x,y-.12,z+.15); light.target.position.set(x,.65,z+.7);
  scene.add(light,light.target); interiorLights.push(light);
}
for(const x of [-8,-.1,6.5]) wallLight(x,3.08,3.65);
wallLight(-10.8,3.25,3.1); wallLight(8.9,6.5,1.7);
for(const x of [1.5,4.8]) {
  const light=new THREE.PointLight('#ffd6a0',6,6,2);light.position.set(x,2.6,4);scene.add(light);interiorLights.push(light);
}
// Landscape: winding stone approach, planting beds, trees and layered ridgelines.
for(let i=0;i<12;i++) box(2.6,.065,1.1,.35+Math.sin(i*.4)*.8,-.03,9+i*1.6,materials.concrete);
box(5,.09,12,14,0,0,materials.concrete);
for(let i=0;i<14;i++) box(1.5,.065,.8,10.8+i*.4,0,5.7+i*.4,materials.stone);
const leafMats=['#4c6334','#63783b','#83934e','#344d2d'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
const leafGeo = new THREE.SphereGeometry(1,12,9);
const leafPos=leafGeo.attributes.position;
for(let i=0;i<leafPos.count;i++){const x=leafPos.getX(i),y=leafPos.getY(i),z=leafPos.getZ(i);const v=1+.08*Math.sin(x*18)*Math.sin(y*15)*Math.cos(z*14);leafPos.setXYZ(i,x*v,y*v,z*v);}
leafGeo.computeVertexNormals();
function shrub(x,z,size=.6) {
  for(let i=0;i<3;i++) {
    const leaf=new THREE.Mesh(leafGeo,leafMats[i%4]);leaf.position.set(x+(random()-.5)*size,.2+size*.6+i*.16,z+(random()-.5)*size);
    leaf.scale.set(size*.65,size*(.6+random()*.3),size*.65);leaf.castShadow=true;leaf.receiveShadow=true;scene.add(leaf);
  }
}
for(const x of [-3.2,3.2,-9]) {box(1.2,.17,1.2,x,.04,6.65,materials.soil);shrub(x,6.65,.75);}
for(let i=0;i<20;i++) shrub(12+random()*6,-6+i*.85,.5+random()*.65);
function tree(x,z,size=1) {
  cylinder(.10*size,.18*size,3.3*size,x,1.6*size,z,materials.wood);
  for(let i=0;i<7;i++) {
    const mesh=new THREE.Mesh(leafGeo,leafMats[i%4]);mesh.position.set(x+(random()-.5)*2.7*size,(3+random()*1.3)*size,z+(random()-.5)*2.7*size);
    mesh.scale.set(1.3*size,1.3*size,1.25*size); mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  }
}
for(const [x,z,s] of [[-18,-3,1.5],[-23,-11,1.7],[19,-13,1.9],[24,2,1.3],[-22,13,1.1],[18,-23,2],[-9,-20,1.6],[28,18,1.5]]) tree(x,z,s);
for(let i=0;i<50;i++) shrub((random()-.5)*85,-17-random()*26,1+random());
for(let i=0;i<26;i++) {
  const rock=new THREE.Mesh(leafGeo,materials.stone);rock.position.set(10+random()*9,.12,-8+random()*18);rock.scale.set(.18+random()*.4,.12+random()*.3,.2+random()*.3);rock.rotation.set(random(),random(),random());scene.add(rock);
}
for(let layer=0;layer<3;layer++) {
  const geo=new THREE.PlaneGeometry(240,25,70,6); const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i), y=pos.getY(i); const ratio=(y+12.5)/25;
    const peak=12+Math.sin(x*.046+layer)*7+Math.sin(x*.12+layer*2)*3+Math.sin(x*.29)*1.2;
    pos.setXYZ(i,x,-2+ratio*peak,Math.sin(x*.11)*2);
  }
  geo.computeVertexNormals(); const mountain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:['#526d60','#6d8880','#8da4a0'][layer],roughness:1,side:THREE.DoubleSide}));
  mountain.position.set(0,0,-55-layer*25);scene.add(mountain);
}
// Instanced grass keeps thousands of blades to a single draw call.
const grassCount=55000;
const bladeGeo=new THREE.BufferGeometry();
bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.018,0,0,.018,0,0,.008,.18,0,-.008,.18,0,.016,.31,0],3));
bladeGeo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,.6,0,.6,.5,1],2));
bladeGeo.setIndex([0,1,2,0,2,3,3,2,4]);bladeGeo.computeVertexNormals();
const grassMat=new THREE.MeshStandardMaterial({color:'#7b9147',side:THREE.DoubleSide,roughness:1});
const windUniform={value:0};
grassMat.onBeforeCompile=shader=>{
  shader.uniforms.uWind=windUniform;
  shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uWind + instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.4) * pow(position.y, 2.0) * 0.65;');
};
const grass=new THREE.InstancedMesh(bladeGeo,grassMat,grassCount);const dummy=new THREE.Object3D();const color=new THREE.Color();
let count=0;
while(count<grassCount) {
  const x=(random()-.5)*65,z=(random()-.5)*65;
  if(Math.abs(x)<12 && z<6.5 && z>-6) continue;
  if(z>7 && z<28 && Math.abs(x-(.35+Math.sin((z-9)/1.6*.4)*.8))<1.5) continue;
  if(x>10 && x<17 && z>-8 && z<10) continue;
  dummy.position.set(x,-.08,z);dummy.rotation.set(0,random()*Math.PI,0);dummy.scale.setScalar(.55+random()*.9);dummy.updateMatrix();grass.setMatrixAt(count,dummy.matrix);
  color.setHSL(.20+random()*.04,.28+random()*.15,.19+random()*.12);grass.setColorAt(count,color);count++;
}
grass.receiveShadow=true;scene.add(grass);
// Patio bench and a small outdoor seating area.
box(2.5,.12,.7,14.5,.65,2,materials.wood);
for(const x of [13.5,15.5]) box(.08,.6,.5,x,.32,2,materials.metal);
cylinder(.65,.65,.08,15,.87,-1,materials.wood,24);cylinder(.04,.04,.85,15,.43,-1,materials.metal);
for(const x of [13.7,16.3]) {box(.65,.09,.65,x,.5,-1,materials.wood);box(.65,.75,.07,x,.82,-1.3,materials.wood);for(const dx of [-.25,.25]) for(const dz of [-.25,.25]) box(.035,.5,.035,x+dx,.25,-1+dz,materials.metal);}

// Share draw calls across the fixed architecture and vegetation.
const batches=new Map();
for(const mesh of [...scene.children]) {
  if(!mesh.isMesh || mesh.isInstancedMesh || mesh===sky || Array.isArray(mesh.material))continue;
  const key=mesh.material.uuid+':'+mesh.castShadow+':'+mesh.receiveShadow;
  if(!batches.has(key))batches.set(key,{material:mesh.material,cast:mesh.castShadow,receive:mesh.receiveShadow,items:[]});
  mesh.updateMatrixWorld();const g=mesh.geometry.clone();g.applyMatrix4(mesh.matrixWorld);
  batches.get(key).items.push(g);scene.remove(mesh);
}
for(const batch of batches.values()) {
  const merged=mergeGeometries(batch.items,false);
  const mesh=new THREE.Mesh(merged,batch.material);mesh.castShadow=batch.cast;mesh.receiveShadow=batch.receive;scene.add(mesh);
  batch.items.forEach(g=>g.dispose());
}

let time='golden', lightsEnabled=true, windEnabled=true;
const timeSettings={
  day:{sun:[-18,40,18],sunColor:'#fff5df',intensity:3.4,hemi:2.5,fog:'#c1d3d7',elevation:44,azimuth:225,label:'맑은 낮'},
  golden:{sun:[-25,18,18],sunColor:'#ffe0ad',intensity:3.2,hemi:1.25,fog:'#b8c4b4',elevation:19,azimuth:235,label:'늦은 오후'},
  night:{sun:[-15,25,-20],sunColor:'#91b6ec',intensity:.32,hemi:.28,fog:'#172938',elevation:-9,azimuth:235,label:'푸른 밤'},
};
function updateLights(){
  interiorLights.forEach(l=>l.visible=lightsEnabled);
  luminous.emissiveIntensity=lightsEnabled?(time==='night'?4:2.8):0;
  inside.emissiveIntensity=lightsEnabled?(time==='night'?.85:.22):0;
  luminous.color.set(lightsEnabled?'#fff0ca':'#aaa99d');
}
function setTime(value){
  time=value;const s=timeSettings[value];sun.position.set(...s.sun);sun.color.set(s.sunColor);sun.intensity=s.intensity;hemi.intensity=s.hemi;scene.fog.color.set(s.fog);
  const direction=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-s.elevation),THREE.MathUtils.degToRad(s.azimuth));
  skyUniforms.sunPosition.value.copy(direction);
  sky.visible=value!=='night';scene.background=value==='night'?new THREE.Color('#132535'):null;
  if(environment) environment.dispose();
  environment=pmrem.fromScene(sky);scene.environment=environment.texture;
  scene.environmentIntensity=value==='night'?.16:.48;
  document.querySelector('#time-label').textContent=s.label;
  document.querySelectorAll('[data-time]').forEach(b=>b.classList.toggle('active',b.dataset.time===value));updateLights();
}
setTime('golden');
document.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>setTime(b.dataset.time)));
document.querySelector('#exposure').addEventListener('input',e=>{renderer.toneMappingExposure=Number(e.target.value);document.querySelector('#exposure-value').value=Number(e.target.value).toFixed(2);});
document.querySelector('#lights').addEventListener('change',e=>{lightsEnabled=e.target.checked;updateLights();});
document.querySelector('#wind').addEventListener('change',e=>{windEnabled=e.target.checked;});

// Walking is restricted to the garden; swept small steps prevent wall tunnelling.
let mode='orbit',yaw=0,pitch=0;const keys=new Set();
const help=document.querySelector('#walk-help');
function exitWalk(){
  if(document.pointerLockElement===canvas) document.exitPointerLock();
  mode='orbit';controls.enabled=true;help.hidden=true;document.body.classList.remove('walking');
  document.querySelector('#orbit').classList.add('active');document.querySelector('#walk').classList.remove('active');
  camera.position.copy(initialCamera);controls.target.copy(initialTarget);controls.update();keys.clear();
  document.querySelector('#hint').innerHTML='드래그하여 회전 <b>·</b> 스크롤하여 확대';
}
document.querySelector('#reset').addEventListener('click',exitWalk);
document.querySelector('#orbit').addEventListener('click',exitWalk);
document.querySelector('#walk').addEventListener('click',()=>{help.hidden=false;});
document.querySelector('#enter-walk').addEventListener('click',async()=>{
  try {await canvas.requestPointerLock();} catch {help.querySelector('p').textContent='마우스 제어를 허용한 뒤 다시 시도해 주세요. W A S D 이동 · Esc 종료';}
});
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===canvas){
    mode='walk';controls.enabled=false;help.hidden=true;document.body.classList.add('walking');
    camera.position.set(0,1.7,20);yaw=0;pitch=0;camera.rotation.order='YXZ';camera.rotation.set(0,0,0);
    document.querySelector('#walk').classList.add('active');document.querySelector('#orbit').classList.remove('active');
    document.querySelector('#hint').textContent='W A S D 이동 · Shift 빠르게 · Esc 종료';
  }else if(mode==='walk')exitWalk();
});
document.addEventListener('mousemove',e=>{if(mode==='walk'){yaw-=e.movementX*.002;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.002,-1.3,1.3);camera.rotation.set(pitch,yaw,0,'YXZ');}});
document.addEventListener('keydown',e=>{if(mode==='walk' && ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}if(e.code==='Escape'){help.hidden=true;if(mode==='walk')exitWalk();}});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>keys.clear());
function blocked(x,z){return x < -32 || x > 32 || z < -30 || z > 32 || solidColliders.some(c=>x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ);}
function move(dt){
  let f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  let r=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const len=Math.hypot(f,r);if(!len)return;f/=len;r/=len;
  const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?6:3)*dt;
  const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed;
  if(!blocked(camera.position.x+dx,camera.position.z))camera.position.x+=dx;
  if(!blocked(camera.position.x,camera.position.z+dz))camera.position.z+=dz;
  // Terrace and steps follow their visible geometry.
  const z=camera.position.z,x=camera.position.x;
  let floor=0;
  if(Math.abs(x)<11 && z>-6&&z<6)floor=.625;
  if(Math.abs(x)<1.85&&z>=6&&z<8.7)floor=Math.max(0,.65-Math.floor((z-6)/.65)*.16);
  camera.position.y=1.7+floor;
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const clock=new THREE.Clock();let elapsed=0,frames=0,lastFps=0;
function animate(){
  const dt=Math.min(clock.getDelta(),.05);elapsed+=dt;
  if(windEnabled&&!matchMedia('(prefers-reduced-motion: reduce)').matches)windUniform.value+=dt*1.7;
  if(mode==='walk')move(dt);else controls.update();
  renderer.render(scene,camera);frames++;
  if(elapsed-lastFps>1){document.querySelector('#fps').textContent=`${Math.round(frames/(elapsed-lastFps))} FPS`;frames=0;lastFps=elapsed;}
}
renderer.setAnimationLoop(animate);
document.querySelector('#loading').hidden=true;
// Read-only diagnostics for smoke tests and future development.
window.mapDiagnostics=()=>({mode,time,lightsEnabled,windEnabled,grassInstances:grass.count,meshCount:scene.children.filter(x=>x.isMesh).length,camera:camera.position.toArray(),renderer:renderer.info.render});

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const GROUND = .68;
export const UPPER = 4.03;
export const PLAYER_RADIUS = .23;
export const STAIR = { minX: -2.25, maxX: -.45, minZ: -4.1, maxZ: 1.35 };
export const destinations = {
  garden: { label: '정원', position: [0, 0, 11], yaw: 0 },
  living: { label: '1F · 거실', position: [3.35, GROUND, 2], yaw: .25 },
  dining: { label: '1F · 다이닝', position: [-5.1, GROUND, 1.5], yaw: 0 },
  kitchen: { label: '1F · 주방', position: [1.4, GROUND, -2.2], yaw: -.7 },
  bathroom: { label: '1F · 욕실', position: [7.35, GROUND, -3], yaw: -.9 },
  bedroom: { label: '2F · 침실', position: [2, UPPER, 1.5], yaw: -.3 },
  office: { label: '2F · 서재', position: [-6.1, UPPER, .9], yaw: 0 },
  guest: { label: '2F · 게스트룸', position: [7.6, UPPER, -.1], yaw: .3 },
};

// The traversable shell is built from thin wall segments around actual openings.
export function createHouse(scene, exterior, surface, mobile) {
  const colliders = [], doors = [], lightSources = [], counts = {};
  let zone = 'shell';
  const mat = {
    plaster: surface('noise', '#e5dfd1', 2, .92, .009),
    oak: surface('wood', '#b49368', 3, .61, .016),
    walnut: surface('wood', '#67503d', 2, .55, .012),
    linen: surface('fabric', '#c5bdab', 4, .98, .013),
    cream: surface('fabric', '#e6ddc9', 3, .94, .014),
    olive: surface('fabric', '#6e7859', 3, .98, .016),
    terracotta: surface('fabric', '#a67556', 3, .96, .013),
    marble: surface('marble', '#ddd7c8', 2, .27, .004),
    bathTile: surface('tile', '#c5c8bb', 1, .48, .008),
    ceramic: new THREE.MeshStandardMaterial({color:'#ece7dc',roughness:.24}),
    brass: new THREE.MeshStandardMaterial({color:'#af9153',metalness:.8,roughness:.3}),
    black: exterior.metal,
    leaves: new THREE.MeshStandardMaterial({color:'#3e6340',roughness:.82}),
    paper: new THREE.MeshStandardMaterial({color:'#e1dccb',roughness:.95}),
    glass: new THREE.MeshPhysicalMaterial({color:'#cedfdc',transparent:true,opacity:.12,roughness:.07,metalness:.15,depthWrite:false,side:THREE.DoubleSide}),
    mirror: new THREE.MeshStandardMaterial({color:'#e0e5e2',metalness:1,roughness:.055}),
    light: new THREE.MeshStandardMaterial({color:'#fff4d6',emissive:'#ffd69a',emissiveIntensity:2.4}),
    screen: new THREE.MeshStandardMaterial({color:'#171f22',emissive:'#3c5760',emissiveIntensity:.18,roughness:.18}),
  };
  const books = ['#888f70','#cbbd9e','#ad735b','#52636a','#ddd1b5'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.8}));
  function add(geometry, material, x,y,z, rotation=0) {
    const mesh = new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.y=rotation;
    mesh.castShadow = !material.transparent;mesh.receiveShadow=true;mesh.userData.batchZone=zone;scene.add(mesh);return mesh;
  }
  function collision(x,y,z,w,h,d, enabled=()=>true) {
    colliders.push({minX:x-w/2,maxX:x+w/2,minY:y-h/2,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2,enabled});
  }
  function box(w,h,d,x,y,z,m=mat.oak,solid=false) {
    const mesh=add(new THREE.BoxGeometry(w,h,d),m,x,y,z);if(solid)collision(x,y,z,w,h,d);return mesh;
  }
  function round(w,h,d,x,y,z,m=mat.linen,r=.05,solid=false,rotation=0) {
    const mesh=add(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),m,x,y,z,rotation);
    if(solid)collision(x,y,z,w,h,d);return mesh;
  }
  function cyl(rt,rb,h,x,y,z,m=mat.brass,segments=20) {return add(new THREE.CylinderGeometry(rt,rb,h,segments),m,x,y,z);}
  function sphere(x,y,z,sx,sy,sz,m) {const mesh=add(new THREE.SphereGeometry(1,12,9),m,x,y,z);mesh.scale.set(sx,sy,sz);return mesh;}
  function torus(radius,tube,x,y,z,m=mat.brass,rx=0,ry=0) {const mesh=add(new THREE.TorusGeometry(radius,tube,8,24),m,x,y,z);mesh.rotation.set(rx,ry,0);return mesh;}
  function tube(points,r,m=mat.brass) {const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return add(new THREE.TubeGeometry(curve,18,r,6,false),m,0,0,0);}
  function lathe(points,x,y,z,m=mat.ceramic) {return add(new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),24),m,x,y,z);}
  function furnishing(name) { counts[name]=(counts[name]||0)+1; }
  function legs(x,y,z,w,d,h,m=mat.walnut) {for(const dx of [-w/2+.08,w/2-.08])for(const dz of [-d/2+.08,d/2-.08])cyl(.025,.032,h,x+dx,y+h/2,z+dz,m,10);}
  function handle(x,y,z,w=.18) {box(w,.018,.032,x,y,z,mat.brass);for(const dx of [-w*.4,w*.4])box(.012,.02,.03,x+dx,y,z-.02,mat.brass);}
  function seam(x,y,z,w,d) {
    tube([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2],[x-w/2,y,z-d/2]],.003,mat.cream);
  }
  function rug(x,y,z,w,d) {
    round(w,.018,d,x,y,z,mat.cream,.007);
    for(let i=0;i<7;i++)box(w-.12,.005,.013,x,y+.012,z-d/2+.1+i*.045,mat.olive);
    for(let i=0;i<Math.floor(w/.07);i++)for(const end of [-1,1])box(.009,.007,.09,x-w/2+.03+i*.07,y,z+end*(d/2+.04),mat.cream);
    furnishing('직조 러그');
  }
  function book(x,y,z,w=.18,h=.25,d=.065,index=0,flat=false) {
    const m=books[index%books.length];
    if(flat){box(w,.024,h,x,y,z,m);box(w-.008,.016,h-.015,x,y+.015,z,mat.paper);box(w,.005,h,x,y+.026,z,m);}
    else {box(d,h,w,x,y+h/2,z,m);box(d-.013,h-.022,w-.018,x,y+h/2,z+.007,mat.paper);box(d,.014,.012,x,y+h*.7,z+w/2+.006,mat.brass);}
  }
  function plant(x,y,z,size=.55) {
    lathe([[.08,0],[.10,.025],[.13,.2],[.14,.22],[.12,.22],[.10,.19]],x,y,z,mat.ceramic);
    cyl(.11,.11,.007,x,y+.2,z,exterior.soil);
    for(let i=0;i<9;i++) {const a=i*2.399,h=size*(.45+i/20);tube([[x,y+.18,z],[x+Math.cos(a)*.11,y+.2+h*.6,z+Math.sin(a)*.11],[x+Math.cos(a)*.21,y+.2+h,z+Math.sin(a)*.21]],.007,mat.leaves);
      const leaf=sphere(x+Math.cos(a)*.2,y+.2+h,z+Math.sin(a)*.2,.065,.14,.024,mat.leaves);leaf.rotation.set(.4,a,Math.cos(a)*.5);}
    furnishing('화분');
  }
  function vase(x,y,z,scale=.8) {
    const v=lathe([[0,0],[.1,0],[.14,.06],[.13,.19],[.06,.26],[.05,.34],[.038,.34],[.043,.29]],x,y,z,mat.ceramic);v.scale.setScalar(scale);
    for(let i=0;i<5;i++) {tube([[x,y+.22*scale,z],[x+(i-2)*.035,y+.5*scale,z+.04],[x+(i-2)*.055,y+.7*scale,z-.02]],.003,mat.walnut);sphere(x+(i-2)*.055,y+.7*scale,z-.02,.032,.065,.015,mat.olive);}
    furnishing('꽃병');
  }
  function mug(x,y,z) {
    lathe([[.042,0],[.05,.005],[.047,.10],[.039,.10],[.039,.015]],x,y,z,mat.ceramic);
    torus(.028,.006,x+.054,y+.056,z,mat.ceramic,0,Math.PI/2);
    cyl(.037,.037,.003,x,y+.089,z,mat.walnut);
  }
  function picture(x,y,z,w,h,side=false) {
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#e6dcc5';ctx.fillRect(0,0,256,256);
    ctx.fillStyle='#c1b294';ctx.beginPath();ctx.arc(180,80,39,0,Math.PI*2);ctx.fill();
    for(let i=0;i<3;i++){ctx.fillStyle=['#819084','#66776a','#425d53'][i];ctx.beginPath();ctx.moveTo(0,256);for(let j=0;j<=256;j+=8)ctx.lineTo(j,145+i*26+Math.sin(j*.026+i)*24);ctx.lineTo(256,256);ctx.fill();}
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
    const imageMat=new THREE.MeshStandardMaterial({map,roughness:.9});
    if(side){box(.055,h,w,x,y,z,mat.walnut);box(.013,h-.07,w-.07,x+.04,y,z,imageMat);}else{box(w,h,.055,x,y,z,mat.walnut);box(w-.07,h-.07,.012,x,y,z+.036,imageMat);}
    furnishing('액자');
  }
  function downLight(x,y,z,power=16,radius=8,shadow=false) {
    lightSources.push({position:new THREE.Vector3(x,y,z),power,radius,floor:y>4?UPPER:GROUND,shadow});
  }
  function pendant(x,y,z,style='dome') {
    const ceiling=y>4?(x>=0&&x<=6.7?7.915:7.105):3.817;
    cyl(.09,.09,.035,x,ceiling,z,mat.black);cyl(.008,.008,ceiling-y,x,(ceiling+y)/2,z,mat.black,8);
    if(style==='dome')lathe([[.30,0],[.30,.035],[.23,.14],[.12,.25],[.04,.27]],x,y,z,mat.brass);
    else cyl(.15,.19,.3,x,y+.15,z,mat.cream);
    cyl(.25,.25,.008,x,y-.004,z,mat.light);downLight(x,y-.07,z,22,9);furnishing('펜던트 조명');
  }
  function lamp(x,y,z) {
    cyl(.13,.13,.025,x,y+.014,z,mat.brass);cyl(.025,.025,.3,x,y+.17,z,mat.brass);
    cyl(.13,.19,.25,x,y+.41,z,mat.cream);sphere(x,y+.4,z,.08,.08,.08,mat.light);downLight(x,y+.39,z,4,3);furnishing('테이블 조명');
  }
  function downlights(x,z,floor,w,d) {
    const ceil=floor===GROUND?3.817:(x>=0&&x<=6.7?7.915:7.105);
    for(const dx of [-w/3,w/3])for(const dz of [-d/3,d/3]){cyl(.066,.066,.018,x+dx,ceil,z+dz,mat.brass);cyl(.046,.046,.012,x+dx,ceil-.015,z+dz,mat.light);}
    downLight(x,ceil-.08,z,18,9,true);
  }
  function chair(x,floor,z,angle=0) {
    // Build in a temporary local frame, then transform all its meshes together.
    const before=scene.children.length;
    legs(0,floor,0,.55,.55,.43);round(.57,.09,.57,0,floor+.47,0,mat.olive,.035);
    round(.56,.52,.08,0,floor+.75,-.24,mat.walnut,.04);round(.5,.35,.04,0,floor+.76,-.185,mat.olive,.02);
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
    for(const m of scene.children.slice(before)){m.position.applyQuaternion(q).add(new THREE.Vector3(x,0,z));m.quaternion.premultiply(q);}
    collision(x,floor+.45,z,.6,.9,.6);furnishing('의자');
  }
  function cabinet(x,floor,z,w,h,d,material=mat.oak,drawers=3) {
    box(w,h,d,x,floor+h/2,z,material,true);
    for(let i=0;i<drawers;i++){round(w-.06,h/drawers-.025,.04,x,floor+(i+.5)*h/drawers,z+d/2+.012,material,.007);handle(x,floor+(i+.5)*h/drawers,z+d/2+.047);}
    furnishing('서랍장');
  }
  function wallSegment(x,y,z,w,h,d,m) {
    box(w,h,d,x,y,z,m,true);
    if(m===mat.plaster)return;
    if(d===.24){const inward=z<0?1:-1;box(w,h,.012,x,y,z+inward*.129,mat.plaster);}
    else if(w===.24){const inward=x<0?1:-1;box(.012,h,d,x+inward*.129,y,z,mat.plaster);}
    // Baseboards stop at each opening, instead of crossing a doorway.
    const base=y-h/2;
    if(Math.abs(base-GROUND)<.02||Math.abs(base-UPPER)<.02){
      if(d===.24)box(w,.085,.025,x,base+.042,z+(z<0?1:-1)*.14,mat.walnut);
      else if(w===.24)box(.025,.085,d,x+(x<0?1:-1)*.14,base+.042,z,mat.walnut);
    }
  }
  function frontWall(x0,x1,z,base,height,holes,m) {
    let x=x0;
    const sorted=[...holes].sort((a,b)=>a.x-b.x);
    for(const h of sorted){const left=h.x-h.w/2,right=h.x+h.w/2;
      if(left>x)wallSegment((x+left)/2,base+height/2,z,left-x,height,.24,m);
      if(h.bottom>0)wallSegment(h.x,base+h.bottom/2,z,h.w,h.bottom,.24,m);
      const top=h.bottom+h.h;if(top<height)wallSegment(h.x,base+(height+top)/2,z,h.w,height-top,.24,m);
      x=right;
    }
    if(x<x1)wallSegment((x+x1)/2,base+height/2,z,x1-x,height,.24,m);
  }
  function sideWall(x,z0,z1,base,height,holes=[],m=exterior.tile) {
    let z=z0;
    for(const h of [...holes].sort((a,b)=>a.z-b.z)){const a=h.z-h.w/2,b=h.z+h.w/2;
      if(a>z)wallSegment(x,base+height/2,(a+z)/2,.24,height,a-z,m);
      if(h.bottom>0)wallSegment(x,base+h.bottom/2,h.z,.24,h.bottom,h.w,m);
      const top=h.bottom+h.h;if(top<height)wallSegment(x,base+(height+top)/2,h.z,.24,height-top,h.w,m);
      z=b;
    }
    if(z<z1)wallSegment(x,base+height/2,(z+z1)/2,.24,height,z1-z,m);
  }
  function frame(x,y,z,w,h,mullions=0) {
    for(const side of [-1,1]){box(.065,h+.1,.15,x+side*w/2,y,z,mat.black);box(w+.07,.065,.15,x,y+side*h/2,z,mat.black);}
    for(let i=1;i<=mullions;i++)box(.035,h,.10,x-w/2+w*i/(mullions+1),y,z,mat.black);
    box(w-.07,h-.08,.015,x,y,z,mat.glass);
    collision(x,y,z,w,h,.10);
    box(w+.15,.04,.33,x,y-h/2-.03,z,mat.marble);
    for(const side of [-1,1]) {
      const curtain=new THREE.Mesh(new THREE.PlaneGeometry(w*.16,h,12,1),mat.cream);const pos=curtain.geometry.attributes.position;
      for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)*80)*.023);curtain.geometry.computeVertexNormals();
      curtain.material.side=THREE.DoubleSide;curtain.position.set(x+side*w*.42,y,z-.20);curtain.userData.batchZone=zone;scene.add(curtain);
    }
  }
  // Ground and upper shells match the original stepped facade.
  const wings=[{x0:-10,x1:0,z:3,back:-5,upperH:3.13},{x0:0,x1:6.7,z:3.5,back:-5,upperH:3.94},{x0:6.7,x1:9.7,z:1.5,back:-5,upperH:3.13}];
  const lowerH=3.15;
  const lowerWindows=[[{x:-6.4,w:3.9,bottom:.68,h:1.9},{x:-1.35,w:1.5,bottom:0,h:2.65}],[{x:3.35,w:5.2,bottom:0,h:2.75}],[{x:8.2,w:1.65,bottom:.6,h:1.85}]];
  const upperWindows=[[{x:-7.5,w:3,bottom:.55,h:1.8},{x:-3.75,w:2.6,bottom:.7,h:1.5}],[{x:1.5,w:1.25,bottom:.45,h:2.85},{x:3.35,w:1.25,bottom:.45,h:2.85},{x:5.2,w:1.25,bottom:.45,h:2.85}],[{x:8.2,w:1.65,bottom:.65,h:1.85}]];
  for(let i=0;i<wings.length;i++) {
    const w=wings[i],cx=(w.x0+w.x1)/2,width=w.x1-w.x0,depth=w.z-w.back;
    box(width,.10,depth,cx,GROUND-.05,(w.z+w.back)/2,mat.oak);
    frontWall(w.x0,w.x1,w.z,GROUND,lowerH,lowerWindows[i],i===0?exterior.stone:i===1?exterior.tile:exterior.brick);
    frontWall(w.x0,w.x1,w.z,UPPER,w.upperH,upperWindows[i],i===1?exterior.tile:exterior.brick);
    frontWall(w.x0,w.x1,w.back,GROUND,lowerH,[{x:cx,w:width*.44,bottom:1,h:1.5}],exterior.tile);
    frontWall(w.x0,w.x1,w.back,UPPER,w.upperH,[{x:cx,w:width*.42,bottom:.8,h:1.6}],exterior.tile);
    frame(cx,GROUND+1.75,w.back,width*.44,1.5,2);frame(cx,UPPER+1.6,w.back,width*.42,1.6,2);
    const roof=UPPER+w.upperH;
    box(width+.18,.16,depth+.18,cx,roof+.08,(w.z+w.back)/2,i===1?exterior.concrete:exterior.roof);
    box(width-.2,.05,depth-.2,cx,roof-.025,(w.z+w.back)/2,mat.plaster);
    for(const h of upperWindows[i])frame(h.x,UPPER+h.bottom+h.h/2,w.z,h.w,h.h,i===0?2:0);
    for(const h of lowerWindows[i])if(h.bottom>0)frame(h.x,GROUND+h.bottom+h.h/2,w.z,h.w,h.h,1);
    // Upper floor and lower ceiling around the stair void.
    if(i===0){for(const [a,b] of [[-10,STAIR.minX-.12],[STAIR.maxX+.12,0]])box(b-a,.20,depth,(a+b)/2,UPPER-.10,(w.z+w.back)/2,mat.oak);
      for(const [a,b] of [[w.back,STAIR.minZ-.1],[STAIR.maxZ+.1,w.z]])box(STAIR.maxX-STAIR.minX+.24,.20,b-a,-1.35,UPPER-.10,(a+b)/2,mat.oak);
    }else box(width,.2,depth,cx,UPPER-.1,(w.z+w.back)/2,mat.oak);
  }
  sideWall(-10,-5,3,GROUND,lowerH,[],exterior.stone);sideWall(-10,-5,3,UPPER,3.13,[],exterior.brick);
  sideWall(9.7,-5,1.5,GROUND,lowerH,[],exterior.brick);sideWall(9.7,-5,1.5,UPPER,3.13,[],exterior.brick);
  // Taller central volume side and its stepped return walls.
  sideWall(6.7,1.5,3.5,GROUND,lowerH,[],exterior.tile);sideWall(6.7,1.5,3.5,UPPER,3.94,[],exterior.tile);
  sideWall(0,3,3.5,GROUND,lowerH,[],exterior.tile);sideWall(0,3,3.5,UPPER,3.94,[],exterior.tile);
  sideWall(0,-5,3.5,7.16,.81,[],exterior.tile);sideWall(6.7,-5,3.5,7.16,.81,[],exterior.tile);
  // Partitions include real doorways, on both floors, leading to the staircase landing.
  sideWall(-2.6,-5,3,GROUND,lowerH,[{z:1.8,w:1.5,bottom:0,h:2.55}],mat.plaster);
  sideWall(0,-5,3,GROUND,lowerH,[{z:1.4,w:1.65,bottom:0,h:2.55},{z:-3.75,w:1.8,bottom:0,h:2.55}],mat.plaster);
  sideWall(-2.6,-5,3,UPPER,3.13,[{z:-3.85,w:1.65,bottom:0,h:2.6},{z:2,w:1.4,bottom:0,h:2.6}],mat.plaster);
  sideWall(0,-5,3,UPPER,3.94,[{z:-3.85,w:1.65,bottom:0,h:2.6},{z:2,w:1.4,bottom:0,h:2.6}],mat.plaster);
  sideWall(6.7,-5,1.5,GROUND,lowerH,[{z:-3.1,w:1.15,bottom:0,h:2.5},{z:.15,w:1.15,bottom:0,h:2.5}],mat.plaster);
  sideWall(6.7,-5,1.5,UPPER,3.13,[{z:-3.85,w:1.35,bottom:0,h:2.55}],mat.plaster);
  frontWall(6.7,9.7,-1.9,GROUND,lowerH,[],mat.plaster);
  // Skirting runs along the back walls without crossing the doorways.
  for(const f of [GROUND,UPPER])for(const w of wings)box(w.x1-w.x0-.2,.10,.035,(w.x0+w.x1)/2,f+.05,-4.85,mat.walnut);
  // Entry door, modeled as a moving hinge with panel grooves, handle and hinges.
  const hinge=new THREE.Group();hinge.position.set(-2.10,GROUND,3.03);scene.add(hinge);
  const doorMaterial=mat.walnut;
  const panel=round(1.43,2.6,.08,.715,1.3,0,doorMaterial,.015);scene.remove(panel);hinge.add(panel);panel.userData.dynamic=true;
  for(let i=0;i<6;i++){const groove=box(.008,2.45,.005,.16+i*.18,1.3,.043,mat.black);scene.remove(groove);hinge.add(groove);groove.userData.dynamic=true;}
  const pull=box(.025,.34,.06,1.27,1.13,.075,mat.brass);scene.remove(pull);hinge.add(pull);pull.userData.dynamic=true;
  for(const y of [.25,1.25,2.35]){const pin=cyl(.018,.018,.13,0,y,0,mat.brass,10);scene.remove(pin);hinge.add(pin);pin.userData.dynamic=true;}
  for(const x of [-2.12,-.58])box(.075,2.7,.18,x,GROUND+1.35,3.03,mat.walnut);
  box(1.62,.075,.18,-1.35,GROUND+2.69,3.03,mat.walnut);
  const entry={type:'hinge',group:hinge,x:-1.35,z:3.03,amount:0};doors.push(entry);
  collision(-1.35,GROUND+1.3,3.03,1.5,2.6,.13,()=>entry.amount<.8);
  // Patio glazing: fixed side panels and a genuine sliding central opening.
  for(const x of [1.25,5.45])frame(x,GROUND+1.36,3.5,1.0,2.72,0);
  box(5.2,.07,.16,3.35,GROUND+2.75,3.5,mat.black);box(5.2,.045,.17,3.35,GROUND+.02,3.5,mat.black);
  const slider={type:'slide',x:3.35,z:3.5,amount:0,panels:[]};
  for(const sign of [-1,1]) {
    const g=new THREE.Group();g.position.set(3.35+sign*.79,GROUND+1.36,3.5);scene.add(g);
    const items=[box(1.6,2.68,.014,0,0,0,mat.glass),box(.045,2.72,.08,sign*.78,0,0,mat.black),box(1.6,.045,.08,0,1.34,0,mat.black),box(1.6,.045,.08,0,-1.34,0,mat.black),box(.025,.28,.05,-sign*.66,-.15,.07,mat.brass)];
    for(const m of items){scene.remove(m);g.add(m);m.userData.dynamic=true;}
    slider.panels.push({group:g,sign,initialX:g.position.x});
  }
  doors.push(slider);collision(3.35,GROUND+1.36,3.5,3.2,2.72,.12,()=>slider.amount<.8);
  // A continuous, navigable eighteen-step oak stair, with treads and safety rails.
  zone='stairs';const steps=18,run=(STAIR.maxZ-STAIR.minZ)/steps,rise=(UPPER-GROUND)/steps;
  for(let i=0;i<steps;i++){const z=STAIR.maxZ-(i+.5)*run,top=GROUND+(i+1)*rise;box(1.8,.075,run+.015,-1.35,top-.037,z,mat.oak);box(1.8,rise,.035,-1.35,top-rise/2,z-run/2+.018,mat.plaster);}
  for(const x of [STAIR.minX-.07,STAIR.maxX+.07]) {
    tube([[x,GROUND+.98,STAIR.maxZ],[x,UPPER+.98,STAIR.minZ]],.024,mat.walnut);
    for(let i=0;i<=9;i++){const z=STAIR.maxZ-i*(STAIR.maxZ-STAIR.minZ)/9,y=GROUND+i*(UPPER-GROUND)/9;cyl(.012,.012,.92,x,y+.49,z,mat.black,8);}
    collision(x,UPPER+.48,(STAIR.minZ+STAIR.maxZ)/2,.06,.95,STAIR.maxZ-STAIR.minZ-.2);
  }
  // Furnished entry.
  zone='entry';cabinet(-.45,GROUND,2.15,.48,.72,.48,mat.walnut,2);mug(-.45,GROUND+.74,2.15);
  picture(-2.42,GROUND+1.6,2.5,.5,.8,true);rug(-1.35,GROUND+.025,2.1,1.1,.6);

  // Living room: upholstered sectional, pillows, coffee table, media wall and floor lamp.
  zone='living';const f=GROUND;
  rug(3.15,f+.025,.6,3.9,2.5);
  legs(5.7,f,1.0,1.28,3.1,.18);round(1.45,.32,3.2,5.65,f+.35,1.0,mat.linen,.09,true);
  round(.24,.75,3.2,6.28,f+.67,1,mat.linen,.09);for(const z of [-.46,2.46])round(1.4,.46,.23,5.6,f+.65,z,mat.linen,.07);
  for(let i=0;i<3;i++){const z=-.05+i*.95;round(1.18,.19,.90,5.51,f+.60,z,mat.cream,.065);seam(5.51,f+.70,z,1.05,.8);const cushion=round(.19,.6,.82,6.1,f+.99,z,mat.linen,.09);cushion.rotation.z=-.12;}
  for(const [z,m] of [[-.05,mat.olive],[1.05,mat.terracotta]]){const pillow=round(.20,.44,.47,5.9,f+.95,z,m,.09);pillow.rotation.z=-.20;}
  furnishing('3인 소파');
  round(1.5,.26,1.05,4.83,f+.37,2.25,mat.linen,.07,true);round(1.5,.18,1.04,4.83,f+.6,2.25,mat.cream,.06);furnishing('소파 셰즈');
  round(1.5,.065,.95,3.3,f+.46,.65,mat.walnut,.04,true);legs(3.3,f,.65,1.3,.75,.43);furnishing('커피 테이블');
  book(3.55,f+.51,.75,.22,.3,.06,2,true);book(3.53,f+.54,.74,.2,.28,.06,0,true);vase(3,f+.5,.45,.7);mug(3.1,f+.5,1.0);
  round(.12,.017,.035,3.8,f+.5,.55,mat.black,.003);for(let i=0;i<5;i++)box(.008,.003,.01,3.76+i*.018,f+.511,.55,mat.paper);
  cabinet(.6,f,-.05,.64,.48,2.0,mat.walnut,2);
  // TV is oriented along the interior side wall.
  box(.09,1.05,1.85,.20,f+1.45,.20,mat.black);box(.012,.97,1.77,.255,f+1.45,.20,mat.screen);furnishing('TV');
  for(const z of [-.6,.8]){box(.16,.32,.17,.64,f+.65,z,mat.black);torus(.055,.008,.733,f+.62,z,mat.black,0,Math.PI/2);}
  picture(6.54,f+1.85,.65,1.6,.75,true);
  cyl(.22,.22,.04,5.65,f+.02,-1.05,mat.black);cyl(.018,.018,1.65,5.65,f+.85,-1.05,mat.brass);
  tube([[5.65,f+1.65,-1.05],[5.65,f+1.85,-1.05],[5.1,f+1.9,-1.05]],.018,mat.brass);
  lathe([[.22,0],[.22,.035],[.12,.17],[.04,.19]],5.1,f+1.65,-1.05,mat.cream);cyl(.18,.18,.012,5.1,f+1.65,-1.05,mat.light);downLight(5.1,f+1.64,-1.05,5,4);furnishing('플로어 램프');
  plant(6.1,f,-.5,.9);pendant(3.6,3.25,.3);downlights(3.3,.1,f,5,4);

  // Kitchen: paneled oak joinery, stone counters, appliances and a working-size island.
  zone='kitchen';
  for(let i=0;i<5;i++)cabinet(.8+i*1.12,f,-4.4,1.08,.88,.82,mat.oak,3);
  box(5.65,.055,.91,3.04,f+.92,-4.4,mat.marble);box(5.65,.64,.035,3.04,f+1.26,-4.84,mat.bathTile);
  for(let i=0;i<4;i++){box(1.2,.75,.38,1.0+i*1.28,f+2.22,-4.66,mat.oak);box(1.16,.71,.025,1.0+i*1.28,f+2.22,-4.455,mat.oak);handle(1+i*1.28,f+1.99,-4.42,.22);}
  // Sink recess, rim, basin, tall curved faucet and dish soap.
  round(.66,.018,.44,2.4,f+.958,-4.3,mat.black,.06);round(.54,.01,.33,2.4,f+.968,-4.3,mat.mirror,.04);
  tube([[2.45,f+.96,-4.63],[2.45,f+1.34,-4.63],[2.45,f+1.41,-4.43],[2.45,f+1.29,-4.34]],.014,mat.mirror);
  cyl(.028,.032,.1,2.72,f+1,-4.61,mat.ceramic);box(.025,.013,.05,2.72,f+1.06,-4.61,mat.black);furnishing('싱크대·수전');
  // Cooktop, burner rings, oven window and tactile knobs.
  round(.77,.022,.52,4.62,f+.966,-4.3,mat.black,.02);
  for(const dx of [-.2,.2])for(const dz of [-.13,.13])torus(.09,.009,4.62+dx,f+.983,-4.3+dz,mat.mirror,Math.PI/2);
  box(.78,.6,.04,4.62,f+.49,-3.958,mat.black);box(.65,.38,.012,4.62,f+.44,-3.93,mat.screen);handle(4.62,f+.71,-3.91,.5);
  for(let i=0;i<4;i++){const knob=cyl(.025,.025,.023,4.36+i*.17,f+.73,-3.92,mat.brass,12);knob.rotation.x=Math.PI/2;}
  box(.86,.11,.6,4.62,f+1.95,-4.45,mat.mirror);box(.32,.66,.30,4.62,f+2.30,-4.60,mat.mirror);furnishing('오븐·인덕션·후드');
  cabinet(5.97,f,-3.28,.94,2.32,.88,mat.ceramic,2);box(.04,.64,.035,6.28,f+1.6,-2.80,mat.mirror);box(.04,.37,.035,6.28,f+.63,-2.80,mat.mirror);furnishing('냉장고');
  cabinet(4,f,-2.05,2.15,.86,.85,mat.olive,2);box(2.25,.08,.97,4,f+.93,-2.05,mat.marble);furnishing('키친 아일랜드');
  for(const x of [3.25,4,4.75]) {cyl(.21,.21,.07,x,f+.66,-.95,mat.walnut);for(const a of [0,Math.PI*.66,Math.PI*1.33]){const leg=cyl(.018,.021,.62,x+Math.cos(a)*.14,f+.31,-.95+Math.sin(a)*.14,mat.black,8);leg.rotation.z=Math.cos(a)*.09;}torus(.16,.012,x,f+.22,-.95,mat.brass,Math.PI/2);collision(x,f+.35,-.95,.44,.7,.44);furnishing('바 스툴');}
  for(const x of [3.4,4.6])pendant(x,3.14,-2.05,'linen');
  lathe([[.1,0],[.16,.06],[.19,.1],[.18,.12],[.16,.11],[.10,.025]],4.2,f+.98,-2.1,mat.ceramic);
  for(let i=0;i<4;i++)sphere(4.14+(i%2)*.10,f+1.05+Math.floor(i/2)*.025,-2.1+(i%3)*.05,.047,.052,.047,books[2]);
  box(.34,.025,.24,1,f+.966,-4.27,mat.walnut);tube([[.88,f+.99,-4.27],[1.15,f+.99,-4.27]],.005,mat.mirror);mug(3.1,f+.96,-4.25);plant(.7,f+.95,-4.36,.25);downlights(3.4,-3.2,f,5,3);

  // Dining room and reading corner.
  zone='dining';rug(-6.35,f+.026,-1.1,4.1,3.3);
  round(2.55,.085,1.24,-6.4,f+.77,-1.1,mat.oak,.06,true);legs(-6.4,f,-1.1,2.3,1.04,.72);furnishing('6인 식탁');
  for(const x of [-7.22,-6.4,-5.58])for(const side of [-1,1])chair(x,f,-1.1+side*1.01,side<0?0:Math.PI);
  for(const x of [-7.2,-6.4,-5.6])for(const side of [-1,1]){
    const z=-1.1+side*.40;lathe([[0,0],[.13,.005],[.14,.014],[.12,.023],[0,.02]],x,f+.82,z,mat.ceramic);
    box(.07,.005,.15,x+.21,f+.826,z,mat.cream);box(.012,.007,.14,x-.19,f+.831,z,mat.mirror);
    for(let i=0;i<4;i++)box(.004,.005,.035,x-.2+i*.006,f+.831,z-.08,mat.mirror);
    cyl(.038,.038,.12,x+.19,f+.885,z-.16,mat.glass);torus(.039,.003,x+.19,f+.947,z-.16,mat.mirror,Math.PI/2);
  }
  vase(-6.4,f+.825,-1.1,1);pendant(-6.4,3.12,-1.1);downlights(-6.1,-.9,f,6,5);
  cabinet(-8.1,f,-4.42,2.1,.82,.66,mat.walnut,3);vase(-8.5,f+.84,-4.4,.8);lamp(-7.6,f+.84,-4.4);
  picture(-7.9,f+1.75,-4.81,1.5,.74);plant(-9.4,f,2.4,.95);
  round(.85,.20,.90,-8.8,f+.45,1.55,mat.olive,.10,true);round(.85,.75,.19,-8.8,f+.80,1.18,mat.olive,.08);legs(-8.8,f,1.55,.7,.7,.34);
  cyl(.36,.36,.04,-7.8,f+.56,1.4,mat.oak);cyl(.035,.06,.55,-7.8,f+.275,1.4,mat.brass);book(-7.8,f+.595,1.4,.2,.27,.04,0,true);furnishing('리딩 체어');

  // Ground-floor bath: bath, shower hardware, toilet, vanity and textiles.
  zone='bathroom';box(2.8,.025,2.8,8.2,f+.013,-3.45,mat.bathTile);
  round(.75,.84,.54,7.22,f+.43,-4.44,mat.oak,.025,true);round(.82,.045,.60,7.22,f+.88,-4.44,mat.marble,.022);
  lathe([[.06,0],[.20,.03],[.23,.15],[.22,.19],[.20,.185],[.12,.035]],7.22,f+.9,-4.43,mat.ceramic);
  tube([[7.22,f+.9,-4.7],[7.22,f+1.23,-4.7],[7.22,f+1.25,-4.48]],.012,mat.mirror);
  box(.75,1.05,.025,7.22,f+1.83,-4.81,mat.brass);box(.68,.97,.016,7.22,f+1.83,-4.787,mat.mirror);furnishing('세면대·거울');
  round(.64,.62,.23,8.2,f+.37,-4.5,mat.ceramic,.07);sphere(8.2,f+.21,-4.1,.21,.25,.28,mat.ceramic);
  const seat=torus(.20,.04,8.2,f+.45,-4.03,mat.ceramic,Math.PI/2);seat.scale.y=1.25;round(.48,.05,.07,8.2,f+.67,-4.47,mat.mirror,.01);collision(8.2,f+.3,-4.15,.55,.65,.75);furnishing('양변기');
  round(.87,.57,2.0,9.10,f+.285,-3.6,mat.ceramic,.16,true);round(.71,.03,1.78,9.1,f+.58,-3.6,mat.glass,.12);
  for(const side of [-1,1])box(.08,.05,1.92,9.1+side*.39,f+.57,-3.6,mat.ceramic);
  box(.83,.035,.07,9.1,f+.58,-4.57,mat.ceramic);box(.83,.035,.07,9.1,f+.58,-2.63,mat.ceramic);
  tube([[9.5,f+.6,-4.3],[9.5,f+2.1,-4.3],[9.2,f+2.15,-4.3]],.014,mat.mirror);cyl(.12,.12,.022,9.2,f+2.13,-4.3,mat.mirror);
  for(let i=0;i<7;i++)cyl(.012,.012,.002,9.2+Math.sin(i)*.07,f+2.115,-4.3+Math.cos(i)*.07,mat.black,6);
  box(.012,1.55,1.0,8.64,f+1.37,-4.03,mat.glass);furnishing('욕조·샤워 수전');
  tube([[7.3,f+1.1,-2.04],[8.0,f+1.1,-2.04]],.013,mat.brass);round(.39,.62,.025,7.64,f+.85,-2.015,mat.cream,.009);
  for(let i=0;i<3;i++)round(.27,.08,.2,7.25,f+.96+i*.08,-4.15,mat.cream,.02);downlights(8.1,-3.4,f,2.5,2.5);
  zone='guest-ground';cabinet(8.95,f,-.8,.65,.7,.75,mat.walnut,2);plant(8.95,f+.72,-.8,.4);picture(8.1,f+1.7,-1.74,.8,.7);

  // Upstairs bedroom: upholstered bed, quilt panels, piping, pillows and wardrobes.
  zone='bedroom';const u=UPPER;
  rug(3.6,u+.025,-.6,4.0,4.0);
  round(2.2,.34,2.8,3.65,u+.32,-1.8,mat.walnut,.08,true);legs(3.65,u,-1.8,2.0,2.6,.15);
  round(2.18,.26,2.7,3.65,u+.59,-1.8,mat.cream,.11);round(2.30,1.24,.22,3.65,u+.80,-3.18,mat.linen,.09);
  for(let i=0;i<5;i++)box(.007,1.0,.008,2.77+i*.44,u+.81,-3.06,mat.cream);
  round(2.13,.07,1.92,3.65,u+.76,-1.4,mat.olive,.04);
  for(let i=0;i<8;i++)tube([[2.6+i*.3,u+.797,-2.3],[2.6+i*.3,u+.80,-.5]],.003,mat.linen);
  for(const x of [3.09,4.2]){round(.91,.13,.52,x,u+.8,-2.72,mat.cream,.06);seam(x,u+.875,-2.72,.79,.40);round(.71,.15,.36,x,u+.84,-2.3,mat.terracotta,.06);}
  round(2.12,.035,.32,3.65,u+.81,-.56,mat.cream,.02);furnishing('킹 침대·침구');
  for(const x of [2.15,5.18]){cabinet(x,u,-2.75,.54,.54,.52,mat.walnut,2);lamp(x,u+.56,-2.75);}
  book(2.16,u+.57,-2.5,.14,.21,.04,2,true);mug(5.15,u+.56,-2.52);
  // Separate wardrobe door leaves, handles, plinth and crown.
  for(let i=0;i<3;i++){const x=1.02+i*.81;box(.79,2.62,.58,x,u+1.31,-4.47,mat.oak,true);round(.74,2.52,.04,x,u+1.31,-4.16,mat.oak,.009);handle(x+.23,u+1.22,-4.12,.05);}
  furnishing('붙박이장');cabinet(5.9,u,-4.2,1.15,.82,.60,mat.oak,3);vase(5.9,u+.84,-4.2,.8);
  picture(3.6,u+1.9,-4.81,1.3,.6);plant(6.15,u,2.95,.85);
  round(.72,.15,.78,5.55,u+.48,.5,mat.terracotta,.07,true);round(.72,.60,.12,5.55,u+.8,.18,mat.terracotta,.06);legs(5.55,u,.5,.60,.64,.40);furnishing('침실 라운지 체어');
  pendant(3.5,7.45,-.4,'linen');downlights(3.5,-.7,u,5,5);

  // Study: desk, computer, mechanical keys, task light, shelves and daybed.
  zone='office';rug(-6.1,u+.025,-.4,3.5,2.7);
  round(2.6,.07,.86,-6.4,u+.78,-3.9,mat.walnut,.025,true);legs(-6.4,u,-3.9,2.4,.7,.74);furnishing('서재 책상');
  box(.32,.025,.18,-6.4,u+.83,-4.05,mat.black);box(.065,.23,.04,-6.4,u+.94,-4.08,mat.black);round(1.0,.64,.045,-6.4,u+1.38,-4.08,mat.black,.015);box(.95,.57,.01,-6.4,u+1.39,-4.05,mat.screen);furnishing('모니터');
  box(.58,.024,.21,-6.4,u+.831,-3.72,mat.black);for(let r=0;r<4;r++)for(let c=0;c<13;c++)round(.032,.013,.032,-6.66+c*.043,u+.85,-3.79+r*.044,mat.paper,.003);
  round(.052,.028,.09,-5.93,u+.836,-3.69,mat.black,.02);mug(-7.3,u+.82,-3.77);book(-5.48,u+.825,-3.88,.24,.3,.06,1,true);
  cyl(.12,.12,.018,-5.35,u+.83,-4.1,mat.black);tube([[-5.35,u+.84,-4.1],[-5.35,u+1.3,-4.1],[-5.65,u+1.55,-4.1]],.012,mat.brass);
  cyl(.07,.15,.12,-5.65,u+1.49,-4.1,mat.black);cyl(.13,.13,.008,-5.65,u+1.425,-4.1,mat.light);downLight(-5.65,u+1.4,-4.1,3,3);furnishing('작업 조명');
  chair(-6.4,u,-2.76,Math.PI);
  // Bookcase with individual spines, horizontal stacks and decorative ceramics.
  box(.36,2.4,3.9,-9.62,u+1.2,-1.3,mat.walnut,true);
  for(let row=0;row<5;row++){const y=u+.12+row*.46;box(.48,.045,3.96,-9.42,y,-1.3,mat.oak);
    for(let b=0;b<13;b++){const h=.19+(b%4)*.04;book(-9.40,y+.027,-3.08+b*.27,.16,h,.06,b+row);}
  }
  furnishing('책장');vase(-9.36,u+2.43,-1.2,.75);
  round(1.2,.25,2.8,-4.12,u+.38,.2,mat.linen,.08,true);round(.19,.72,2.8,-3.58,u+.7,.2,mat.linen,.07);
  for(let i=0;i<3;i++)round(.95,.18,.84,-4.12,u+.58,-.66+i*.9,mat.cream,.06);
  round(.30,.33,.46,-3.95,u+.8,-.75,mat.olive,.07);furnishing('서재 데이베드');
  picture(-6.6,u+1.5,2.84,1.5,.9);plant(-9.2,u,2.6,.8);pendant(-6.0,6.85,-.4);downlights(-6,-1,u,6,5);

  // Guest suite: compact bed, luggage bench, linen cabinet and desk.
  zone='guest';round(1.30,.34,2.0,8.5,u+.3,-2.2,mat.oak,.06,true);round(1.28,.22,1.97,8.5,u+.57,-2.2,mat.cream,.07);
  round(1.32,.075,1.30,8.5,u+.73,-1.90,mat.terracotta,.035);round(.86,.13,.45,8.5,u+.76,-2.85,mat.cream,.065);round(1.35,.83,.14,8.5,u+.62,-3.2,mat.oak,.04);furnishing('게스트 침대');
  cabinet(9.12,u,-4.47,.73,2.2,.65,mat.oak,2);cabinet(7.25,u,-2.65,.5,.6,.5,mat.walnut,2);lamp(7.25,u+.62,-2.65);
  box(1.6,.07,.49,8.15,u+.78,.92,mat.oak);legs(8.15,u,.92,1.45,.37,.74);chair(8.15,u,.0,Math.PI);vase(8.6,u+.82,.90,.6);rug(8.2,u+.025,-.7,2.1,2.0);downlights(8.1,-1.4,u,2.3,4);
  zone='stairs';downlights(-1.35,2.15,GROUND,1,1);downlights(-1.35,-4.7,UPPER,1,1);

  // Small wall fittings: face plates, sockets and light switches.
  for(const [x,z,floor] of [[1.1,-4.70,GROUND],[-8.9,-4.70,GROUND],[4.9,-4.70,UPPER],[-5.4,-4.70,UPPER]]){
    round(.11,.16,.012,x,floor+.30,z,mat.ceramic,.006);
    for(const y of [.275,.325]){cyl(.021,.021,.007,x,floor+y,z+.011,mat.black,12).rotation.x=Math.PI/2;
      for(const dx of [-.006,.006])box(.003,.008,.003,x+dx,floor+y,z+.017,mat.brass);}
  }
  for(const [x,z,floor] of [[-.15,2.7,GROUND],[-2.38,2.65,GROUND],[.25,-4.72,UPPER]]){round(.085,.14,.014,x,floor+1.2,z,mat.ceramic,.008);round(.055,.08,.016,x,floor+1.2,z+.011,mat.paper,.005);}

  // Four nearby fixtures light the occupied floor. One shadowed spotlight keeps
  // furniture grounded without allocating a cube shadow map to every small lamp.
  const pool=Array.from({length:mobile?3:4},(_,i)=>{
    const light=new THREE.SpotLight('#ffe4bc',0,10,Math.PI*.46,.5,1.7);light.castShadow=i===0;
    if(light.castShadow){light.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);light.shadow.bias=-.0002;light.shadow.normalBias=.025;light.shadow.camera.near=.05;}
    scene.add(light,light.target);return light;
  });
  let enabled=true;
  function update(dt, cameraPosition, walking, foot) {
    for(const d of doors){const near=Math.hypot(cameraPosition.x-d.x,cameraPosition.z-d.z)<2.25&&cameraPosition.y<4.5&&walking;
      d.amount=THREE.MathUtils.damp(d.amount,near?1:0,6,dt);
      if(d.type==='hinge')d.group.rotation.y=d.amount*Math.PI*.49;
      else for(const p of d.panels)p.group.position.x=p.initialX+p.sign*d.amount*1.52;
    }
    const sameFloor=foot>2.5?UPPER:GROUND;
    const sorted=[...lightSources].sort((a,b)=>{
      const score=s=>s.position.distanceToSquared(cameraPosition)+(walking&&s.floor!==sameFloor?1000:0)-(s.shadow?2:0);return score(a)-score(b);
    });
    pool.forEach((l,i)=>{const s=sorted[i];l.position.copy(s.position);l.target.position.set(s.position.x,s.position.y-1,s.position.z);l.intensity=enabled?s.power:0;l.distance=s.radius;});
  }
  function setLights(value){enabled=value;mat.light.emissiveIntensity=value?2.4:0;mat.light.color.set(value?'#fff4d6':'#a6a095');}
  return {colliders,doors,counts,lightSources,update,setLights,materials:mat};
}

export function floorAt(x,z,current=GROUND) {
  if(x>=STAIR.minX&&x<=STAIR.maxX&&z>=STAIR.minZ&&z<=STAIR.maxZ)return GROUND+(STAIR.maxZ-z)/(STAIR.maxZ-STAIR.minZ)*(UPPER-GROUND);
  const inside=(x>=-10&&x<=6.7&&z>=-5&&z<=(x<0?3:3.5))||(x>6.7&&x<=9.7&&z>=-5&&z<=1.5);
  if(inside)return current>2.5?UPPER:GROUND;
  if(current>2.5)return null; // No walking through an upstairs window into midair.
  if(Math.abs(x)<11&&z>-6&&z<6)return .625;
  if(Math.abs(x)<1.85&&z>=6&&z<8.7)return Math.max(0,.65-Math.floor((z-6)/.65)*.16);
  return 0;
}
export function roomAt(x,z,foot) {
  if(x>=STAIR.minX-.12&&x<=STAIR.maxX+.12&&z>=STAIR.minZ&&z<=STAIR.maxZ)return '계단';
  if(x<-10||x>9.7||z<-5||z>(x<0?3:x>6.7?1.5:3.5))return '정원';
  if(x<-2.6)return foot>2.5?'서재':'다이닝';
  if(x<0)return foot>2.5?'2층 홀':'현관';
  if(x>6.7)return foot>2.5?'게스트룸':z<-1.9?'욕실':'작은 라운지';
  return foot>2.5?'침실':z<-1?'주방':'거실';
}

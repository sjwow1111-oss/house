import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHouse, floorAt, roomAt, GROUND, UPPER, STAIR, STAIR_STEPS, destinations } from '../src/world/house.js';
import { resolveMove, obstructed, createCharacter, stepCharacter } from '../src/world/movement.js';
// Only the decorative picture canvases need a DOM during model construction;
// physics tests use the actual house wall, door and furniture collider layout.
globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>({fillRect(){},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){}})})};
const scene=new THREE.Scene();
const material=new THREE.MeshStandardMaterial();
const exterior=Object.fromEntries(['tile','brick','stone','roof','concrete','wood','metal','soil'].map(k=>[k,material]));
const house=createHouse(scene,exterior,()=>material,true);
function advance(p,dx,dz,times=1){for(let i=0;i<times;i++)p=resolveMove(p,dx,dz,house.colliders);return p;}
function openAt(p){for(let i=0;i<25;i++)house.update(.05,new THREE.Vector3(p.x,p.foot+1.58,p.z),true,p.foot);}
function closeAll(){for(let i=0;i<30;i++)house.update(.05,new THREE.Vector3(25,1.58,25),true,0);}

test('every room shortcut lands on a free floor, including upstairs rooms',()=>{
 for(const [name,d] of Object.entries(destinations)){
   const [x,foot,z]=d.position;
   assert.equal(obstructed(x,z,foot,house.colliders),false,name+' must be free of furniture and walls');
   assert.ok(Math.abs(floorAt(x,z,foot)-foot)<.02,name+' floor');
 }
});
test('a closed door blocks entry and proximity opens a real passage',()=>{
 closeAll();let p={x:-1.35,z:3.9,foot:.625};p=advance(p,0,-2);
 assert.ok(p.z>3.2,'cannot pass through a closed front door');
 openAt(p);p=advance(p,0,-1.3);assert.ok(p.z<2.4,'can enter the hallway after opening');
});
test('garden approach, terrace and sliding door lead into the living room',()=>{
 let p={x:0,z:11,foot:0};p=advance(p,0,-.1,60);assert.ok(p.z<5.1);assert.ok(Math.abs(p.foot-.625)<.01);
 p=advance(p,.1,0,33);openAt({...p,z:4.7});p=advance(p,0,-.1,30);
 assert.ok(p.z<3,'the front facade has an actual door opening');assert.equal(p.foot,GROUND);
});
test('the actual eighteen-step stair reaches both upper rooms and descends again',()=>{
 let p={x:-1.35,z:1.6,foot:GROUND};
 p=advance(p,0,-.06,102);assert.ok(Math.abs(p.foot-UPPER)<.02);assert.ok(p.z<-4.3,'upper landing accessible');
 p=advance(p,0,.055,4); // Turn on the landing, clear of the doorway corner and railing.
 const bedroom=advance(p,.08,0,23);assert.ok(bedroom.x>.2,'upper right doorway reachable');assert.equal(bedroom.foot,UPPER);
 const office=advance(p,-.08,0,24);assert.ok(office.x<-2.9,'upper left doorway reachable');assert.equal(office.foot,UPPER);
 p=advance(p,0,.06,104);assert.ok(Math.abs(p.foot-GROUND)<.02,'descending returns to first floor');
});
test('height-aware furniture collision prevents tunnelling and permits the floor below',()=>{
 let p={x:4.2,z:1.6,foot:GROUND};p=advance(p,0,-8);assert.ok(p.z>1.26,'coffee table remains solid during a large move');
 const upperOnly=[{minX:-1,maxX:1,minZ:-1,maxZ:1,minY:UPPER+.1,maxY:UPPER+1}];
 assert.equal(obstructed(0,0,GROUND,upperOnly),false);assert.equal(obstructed(0,0,UPPER,upperOnly),true);
});
test('upstairs exterior does not allow stepping into midair',()=>{
 const p=resolveMove({x:5.5,z:3.2,foot:UPPER},0,3,[]);assert.ok(p.z<=3.5);assert.equal(p.foot,UPPER);
});

test('the central walking corridor and bathroom entrance stay clear',()=>{
 for(let z=2;z>=-3.15;z-=.1)assert.equal(obstructed(3.35,z,GROUND,house.colliders),false,'central corridor at '+z);
 let p={x:3.35,z:-3.1,foot:GROUND};p=advance(p,.08,0,50);assert.ok(p.x>7.1,'fridge no longer blocks bathroom doorway');
});
test('room connectivity is continuous, not just a free shortcut spawn',()=>{
 // Flood-fill the actual wall/furniture layout on each floor, including door corners.
 for(const doorAmount of [0,1])for(const level of [GROUND,UPPER]){
  for(const door of house.doors)door.apply(doorAmount);
  const spacing=.10,x0=-9.6,z0=-4.6,width=190,height=79;
  const free=new Uint8Array(width*height),visited=new Uint8Array(free.length);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){const x=x0+i*spacing,z=z0+j*spacing;
   const floor=floorAt(x,z,level);free[j*width+i]=floor!==null&&Math.abs(floor-level)<.01&&!obstructed(x,z,level,house.colliders)?1:0;}
  const index=(x,z)=>Math.round((z-z0)/spacing)*width+Math.round((x-x0)/spacing);
  const start=level===GROUND?index(3.35,2):index(-1.35,-4.3);assert.equal(free[start],1);
  const queue=[start];visited[start]=1;
  for(let k=0;k<queue.length;k++){const id=queue[k],i=id%width,j=Math.floor(id/width);
   for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+di,nj=j+dj,nid=nj*width+ni;if(ni>=0&&ni<width&&nj>=0&&nj<height&&free[nid]&&!visited[nid]){visited[nid]=1;queue.push(nid);}}}
  for(const [name,d] of Object.entries(destinations))if(d.position[1]===level)assert.equal(visited[index(d.position[0],d.position[2])],1,name+' must connect to the floor hallway');
  // Reject a substantial inaccessible floor pocket, even if it has no shortcut.
  for(let id=0;id<free.length;id++)if(free[id]&&!visited[id]){
   const pocket=[id];visited[id]=1;
   for(let k=0;k<pocket.length;k++){const n=pocket[k],i=n%width,j=Math.floor(n/width);
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+di,nj=j+dj,nid=nj*width+ni;if(ni>=0&&ni<width&&nj>=0&&nj<height&&free[nid]&&!visited[nid]){visited[nid]=1;pocket.push(nid);}}}
   assert.ok(pocket.length*spacing*spacing<.5,'no hidden floor pocket larger than half a square metre');
  }
 }
});
test('fixed lights and shadow positions do not jump when the camera moves away',()=>{
 house.setLights(true);house.update(.1,new THREE.Vector3(3,2.26,1),true,GROUND);
 const positions=house.roomLights.map(({light})=>light.position.toArray());
 house.update(.1,new THREE.Vector3(25,2.26,20),true,GROUND);
 assert.deepEqual(house.roomLights.map(({light})=>light.position.toArray()),positions);
 assert.ok(house.roomLights.filter(({light})=>light.castShadow).length>=2);
});
test('jump rises, cannot jump again midair, and returns to the floor at different frame rates',()=>{
 for(const dt of [1/60,1/20,.12]){
  let s=createCharacter(0,11);s=stepCharacter(s,0,0,dt,[],true);assert.equal(s.grounded,false);
  let maximum=s.feet;
  for(let t=0;t<2;t+=dt){s=stepCharacter(s,0,0,dt,[],!s.grounded);maximum=Math.max(maximum,s.feet);}
  assert.ok(maximum>.85&&maximum<1.10);assert.ok(s.grounded);assert.equal(s.feet,0);
 }
});
test('jump respects a low ceiling and can land on a low table',()=>{
 const ceiling=[{minX:-1,maxX:1,minZ:10,maxZ:12,minY:2.1,maxY:2.3}];let s=createCharacter(0,11);
 for(let i=0;i<120;i++){s=stepCharacter(s,0,0,1/60,ceiling,i===0);assert.ok(s.feet+1.73<=2.1001);}
 assert.ok(s.grounded);
 const table=[{minX:-.5,maxX:.5,minZ:10,maxZ:12,minY:.45,maxY:.55}];s=createCharacter(0,12.5);
 for(let i=0;i<100;i++)s=stepCharacter(s,0,i<40?-1.1:0,1/60,table,i===0);
 assert.ok(s.grounded);assert.equal(s.feet,.55);
});
test('fast running still cannot tunnel through walls',()=>{
 const wall=[{minX:-2,maxX:2,minZ:8,maxZ:8.10,minY:0,maxY:3}];let s=createCharacter(0,11);
 for(let i=0;i<20;i++)s=stepCharacter(s,0,-10,.12,wall,false);
 assert.ok(s.z>8.3);assert.ok(s.grounded);
});

test('sliding leaves stay within the opening and remain solid throughout their travel',()=>{
 const slider=house.doors.find(d=>d.type==='slide');
 for(const amount of [0,.25,.5,.75,1]){
  slider.apply(amount);
  for(const c of house.colliders.filter(c=>c.name==='patio-leaf')){
   assert.ok(c.minX>=.749&&c.maxX<=5.951,'leaf must not enter the side wall');
   assert.equal(obstructed((c.minX+c.maxX)/2,(c.minZ+c.maxZ)/2,GROUND,house.colliders),true,'moving leaf remains solid');
  }
 }
 assert.equal(obstructed(3.35,3.56,GROUND,house.colliders),false,'open central passage');
 assert.equal(obstructed(1.4,3.435,GROUND,house.colliders),true,'fixed pane stays solid');
 slider.apply(0);assert.equal(obstructed(3.35,3.565,GROUND,house.colliders),true,'closed meeting stile');
 const panes=[];scene.traverse(o=>{if(o.name==='fixed-glass'||o.name==='sliding-glass')panes.push(o);});
 assert.equal(panes.length,4);assert.ok(panes.every(p=>p.geometry.type==='PlaneGeometry'),'one surface per pane, no overlapping box faces');
 assert.ok(Math.abs(panes[0].parent.position.z-panes[2].parent.position.z)>.1,'separate glazing tracks');
});
test('hinged leaf keeps an accurate obstacle in its open position',()=>{
 const entry=house.doors.find(d=>d.type==='hinge');entry.apply(1);
 assert.equal(obstructed(-1.35,3,GROUND,house.colliders),false);
 assert.equal(obstructed(-2.035,3.7,GROUND,house.colliders),true,'open panel is still physically present outside');
 let p={x:3.35,z:1.8,foot:GROUND};p=advance(p,-.08,0,107);assert.ok(p.x<-5,'open entry leaf must not block the dining-room turn');
});
test('wall furniture is aligned to its supporting wall and faces the room',()=>{
 const item=name=>{const a=house.assemblies.find(a=>a.name===name);assert.ok(a,name);return a;};
 for(const [name,axis,sign] of [['media-console','x',1],['master-wardrobe','x',1],['master-dresser','x',-1],['study-bookcase','x',1],['guest-nightstand','x',-1],['guest-chair','z',-1],['study-chair','z',-1],['kitchen-island','z',-1]])assert.ok(item(name).front[axis]*sign>.99,name+' faces its usable side');
 for(const [name,edge,axis,wall] of [['media-console','min','x',.12],['master-wardrobe','min','x',.12],['master-bed','min','z',-4.88],['guest-bed','max','x',9.58],['study-bookcase','min','x',-9.88],['study-daybed','max','x',-2.72],['study-desk','min','z',-4.88]]){
  const gap=Math.abs(item(name).bounds[edge][axis]-wall);assert.ok(gap<.07,name+' wall gap is '+gap);
 }
 for(const name of ['master-bed','guest-bed','study-daybed'])assert.ok(Math.abs(item(name).bounds.min.y-UPPER)<.005,name+' has support down to the floor');
 assert.ok(Math.abs(item('range-hood').bounds.max.y-3.817)<.005,'range hood duct reaches the ceiling');
});
test('curtains stay indoors and every artwork faces an interior surface',()=>{
 for(const curtain of scene.children.filter(o=>o.name==='window-curtain'))assert.ok(curtain.position.z>-5&&curtain.position.z<3.5,'curtain is inside the facade');
 for(const art of house.assemblies.filter(a=>a.name==='artwork')){
  if(art.position.z<-4)assert.ok(art.front.z>.99);
  else if(art.position.z>2.8)assert.ok(art.front.z<-.99);
  else if(Math.abs(art.position.z+1.74)<.01)assert.ok(art.front.z>.99);
  else if(art.position.x>6.5)assert.ok(art.front.x<-.99);
 }
});
test('stair physics matches every modeled tread and the rear ground-floor pocket is sealed',()=>{
 for(let i=0;i<STAIR_STEPS;i++){
  const z=STAIR.maxZ-(i+.5)*(STAIR.maxZ-STAIR.minZ)/STAIR_STEPS;
  assert.ok(Math.abs(floorAt(-1.35,z,GROUND)-(GROUND+(i+1)*(UPPER-GROUND)/STAIR_STEPS))<1e-9);
 }
 assert.equal(obstructed(-1.35,-4.4,GROUND,house.colliders),true);
 assert.equal(obstructed(-1.35,-4.4,UPPER,house.colliders),false);
 assert.equal(roomAt(8,.3,GROUND),'창가 라운지');
 let p={x:6,z:-.65,foot:GROUND};p=advance(p,.07,0,22);assert.ok(p.x>7.4,'lounge opens directly onto living space');
});
test('stepped facade and upper partitions never duplicate a wall surface',()=>{
 const walls=house.colliders.filter(c=>c.wallAxis);
 for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
  const a=walls[i],b=walls[j];if(a.wallAxis!==b.wallAxis)continue;
  const axis=a.wallAxis==='x'?'X':'Z';if(Math.abs(a['min'+axis]-b['min'+axis])>.001)continue;
  const overlaps=['X','Y','Z'].every(k=>Math.min(a['max'+k],b['max'+k])-Math.max(a['min'+k],b['min'+k])>.001);
  assert.equal(overlaps,false,'coplanar walls overlap: '+JSON.stringify([a,b]));
 }
});
test('continuous wall meshes leave the real window and doorway openings clear',()=>{
 scene.updateMatrixWorld(true);
 const front=scene.children.find(o=>o.userData.wall?.axis==='z'&&o.userData.wall.coordinate===3.5&&o.userData.wall.base===GROUND);
 const upper=scene.children.find(o=>o.userData.wall?.axis==='z'&&o.userData.wall.coordinate===3.5&&o.userData.wall.base===UPPER);
 const partition=scene.children.find(o=>o.userData.wall?.axis==='x'&&o.userData.wall.coordinate===0&&o.userData.wall.base===GROUND&&o.userData.wall.start===-5);
 const hits=(mesh,origin,direction)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,2).intersectObject(mesh).length;
 assert.equal(hits(front,[3.35,GROUND+1.3,4.3],[0,0,-1]),0,'patio doorway is not filled by triangulation');
 assert.ok(hits(front,[.3,GROUND+1.3,4.3],[0,0,-1])>0,'adjacent wall is solid');
 assert.equal(hits(upper,[3.35,UPPER+1.5,4.3],[0,0,-1]),0,'upstairs window is a genuine hole');
 assert.equal(hits(partition,[.7,GROUND+1.3,1.4],[-1,0,0]),0,'interior doorway stays open');
 assert.ok(hits(partition,[.7,GROUND+1.3,-.3],[-1,0,0])>0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHouse, floorAt, GROUND, UPPER, destinations } from '../src/world/house.js';
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
 for(const level of [GROUND,UPPER]){
  const spacing=.12,x0=-9.6,z0=-4.6,width=158,height=65;
  const free=new Uint8Array(width*height),visited=new Uint8Array(free.length);
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){const x=x0+i*spacing,z=z0+j*spacing;
   const floor=floorAt(x,z,level);free[j*width+i]=floor!==null&&Math.abs(floor-level)<.1&&!obstructed(x,z,level,house.colliders)?1:0;}
  const index=(x,z)=>Math.round((z-z0)/spacing)*width+Math.round((x-x0)/spacing);
  const start=level===GROUND?index(3.35,2):index(-1.35,-4.3);assert.equal(free[start],1);
  const queue=[start];visited[start]=1;
  for(let k=0;k<queue.length;k++){const id=queue[k],i=id%width,j=Math.floor(id/width);
   for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+di,nj=j+dj,nid=nj*width+ni;if(ni>=0&&ni<width&&nj>=0&&nj<height&&free[nid]&&!visited[nid]){visited[nid]=1;queue.push(nid);}}}
  for(const [name,d] of Object.entries(destinations))if(d.position[1]===level)assert.equal(visited[index(d.position[0],d.position[2])],1,name+' must connect to the floor hallway');
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

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHouse, floorAt, GROUND, UPPER, destinations } from '../src/world/house.js';
import { resolveMove, obstructed } from '../src/world/movement.js';
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
 let p={x:3.35,z:2,foot:GROUND};p=advance(p,0,-8);assert.ok(p.z>1.30,'coffee table remains solid during a large move');
 const upperOnly=[{minX:-1,maxX:1,minZ:-1,maxZ:1,minY:UPPER+.1,maxY:UPPER+1}];
 assert.equal(obstructed(0,0,GROUND,upperOnly),false);assert.equal(obstructed(0,0,UPPER,upperOnly),true);
});
test('upstairs exterior does not allow stepping into midair',()=>{
 const p=resolveMove({x:5.5,z:3.2,foot:UPPER},0,3,[]);assert.ok(p.z<=3.5);assert.equal(p.foot,UPPER);
});

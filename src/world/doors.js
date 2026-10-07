import * as THREE from 'three';

// Independent, non-coplanar glazing tracks. Every leaf keeps a physical collider
// throughout its animation; an open door never becomes an invisible obstacle.
export function createDoors(scene,materials,floor) {
  const doors=[],colliders=[];
  function box(parent,w,h,d,x,y,z,material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=Math.min(w,h,d)>.025;mesh.receiveShadow=true;
    parent.add(mesh);return mesh;
  }
  function collider(mesh,name){
    const bounds=new THREE.Box3();const c={zone:'doors',name};colliders.push(c);
    function update(){mesh.updateWorldMatrix(true,false);bounds.setFromObject(mesh);Object.assign(c,{minX:bounds.min.x,maxX:bounds.max.x,minY:bounds.min.y,maxY:bounds.max.y,minZ:bounds.min.z,maxZ:bounds.max.z});}
    update();return update;
  }
  const hinge=new THREE.Group();hinge.position.set(-2.035,floor+.025,3);scene.add(hinge);
  const leaf=box(hinge,1.37,2.59,.085,.685,1.295,0,materials.walnut);
  for(const side of [-1,1]){
    for(let i=1;i<7;i++)box(hinge,.006,2.42,.003,i*1.37/7,1.295,side*.045,materials.black);
    for(const y of [.96,1.22])box(hinge,.025,.025,.045,1.20,y,side*.064,materials.brass);
    box(hinge,.026,.31,.026,1.20,1.09,side*.088,materials.brass);
  }
  for(const y of [.22,1.3,2.36]){
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.12,12),materials.brass);pin.position.set(0,y,0);hinge.add(pin);
  }
  for(const x of [-2.105,-.595])box(scene,.075,2.70,.20,x,floor+1.35,3,materials.walnut);
  box(scene,1.585,.075,.20,-1.35,floor+2.67,3,materials.walnut);
  box(scene,1.45,.018,.20,-1.35,floor+.009,3,materials.black);
  const updateHinge=collider(leaf,'entry-leaf');
  // Outward swing keeps the narrow hall and the dining-room turn unobstructed.
  const entry={type:'hinge',x:-1.35,z:3,amount:0,group:hinge,apply(amount){this.amount=amount;hinge.rotation.y=-amount*Math.PI*.5;updateHinge();}};
  doors.push(entry);

  const slider={type:'slide',x:3.35,z:3.5,amount:0,panels:[],apply(amount){this.amount=amount;for(const p of this.panels){p.group.position.x=p.initialX+p.sign*amount*1.28;p.update();}}};
  // Perimeter jambs and two parallel tracks have no overlapping glass surfaces.
  for(const x of [.75,5.95])box(scene,.06,2.77,.22,x,floor+1.385,3.50,materials.black);
  for(const y of [floor+.023,floor+2.74])box(scene,5.2,.045,.22,3.35,y,3.50,materials.black);
  for(const z of [3.435,3.565])box(scene,5.05,.012,.016,3.35,floor+.048,z,materials.brass);
  function glazing(x,z,width,moving=false,sign=0){
    const group=new THREE.Group();group.position.set(x,floor+1.385,z);scene.add(group);
    for(const side of [-1,1]){
      box(group,.042,2.65,.055,side*(width/2-.021),0,0,materials.black);
      box(group,width-.084,.042,.055,0,side*(2.65/2-.021),0,materials.black);
    }
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(width-.084,2.65-.084),materials.glass);
    group.add(glass);glass.name=moving?'sliding-glass':'fixed-glass';
    // The collision envelope is separate from the transparent plane.
    const envelope=new THREE.Mesh(new THREE.BoxGeometry(width,2.65,.06),new THREE.MeshBasicMaterial({visible:false}));group.add(envelope);
    const update=collider(envelope,moving?'patio-leaf':'patio-fixed');
    if(moving){
      for(const side of [-1,1]){
        for(const y of [-.24,.04])box(group,.024,.024,.045,-sign*(width/2-.13),y,side*.043,materials.brass);
        box(group,.025,.32,.025,-sign*(width/2-.13),-.10,side*.067,materials.brass);
      }
      slider.panels.push({group,sign,initialX:x,update,width});
    }
  }
  glazing(1.4,3.435,1.28);glazing(5.3,3.435,1.28);
  glazing(2.70,3.565,1.30,true,-1);glazing(4.0,3.565,1.30,true,1);
  doors.push(slider);
  return {doors,colliders};
}

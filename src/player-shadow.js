import * as THREE from 'three';
export function createPlayerShadow(scene) {
  const body=new THREE.Group();body.name='player-shadow-caster';scene.add(body);
  // The first-person body writes neither color nor depth, but uses an explicit
  // depth material for real sun and room-light shadow passes.
  const invisible=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  function part(geometry,x,y,z){const mesh=new THREE.Mesh(geometry,invisible);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.customDepthMaterial=depth;body.add(mesh);return mesh;}
  part(new THREE.CapsuleGeometry(.18,.46,4,8),0,1.03,0);
  part(new THREE.SphereGeometry(.145,12,8),0,1.55,0);
  const legs=[-.12,.12].map(x=>part(new THREE.CapsuleGeometry(.075,.46,3,8),x,.37,0));
  const arms=[-.26,.26].map(x=>part(new THREE.CapsuleGeometry(.055,.46,3,8),x,1.05,0));
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');const gradient=ctx.createRadialGradient(32,32,4,32,32,31);gradient.addColorStop(0,'rgba(0,0,0,.35)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(.72,.55),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
  contact.rotation.x=-Math.PI/2;contact.renderOrder=3;scene.add(contact);
  let phase=0,previous=new THREE.Vector3();
  function update(dt,camera,nav,visible){
    body.visible=contact.visible=visible;
    if(!visible){previous.copy(camera);return;}
    const height=Math.max(0,nav.feet-nav.foot),distance=Math.hypot(camera.x-previous.x,camera.z-previous.z);
    phase+=Math.min(distance,.7)*7;previous.copy(camera);
    body.position.set(camera.x,nav.feet,camera.z);body.rotation.y=nav.yaw;
    legs.forEach((m,i)=>m.rotation.x=nav.grounded?Math.sin(phase+i*Math.PI)*Math.min(distance/Math.max(dt,.001),4)*.09:-.2);
    arms.forEach((m,i)=>m.rotation.x=-legs[i].rotation.x*.7);
    contact.position.set(camera.x,nav.foot+(nav.foot===0?-.08:.012),camera.z);contact.material.opacity=.8/(1+height*1.7);contact.scale.setScalar(1+height*.35);
  }
  return {update,diagnostics:()=>({visible:body.visible,casters:body.children.length,position:body.position.toArray(),contactOpacity:contact.material.opacity})};
}

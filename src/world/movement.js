import { floorAt, PLAYER_RADIUS } from './house.js';
export const EYE_HEIGHT = 1.58;
export const BODY_HEIGHT = 1.73;
export const GRAVITY = 14;
export const JUMP_SPEED = 5.4;
export function overlaps(x,z,c) {
  const dx=x-Math.max(c.minX,Math.min(c.maxX,x));
  const dz=z-Math.max(c.minZ,Math.min(c.maxZ,z));
  return dx*dx+dz*dz<PLAYER_RADIUS*PLAYER_RADIUS;
}
export function obstructed(x,z,foot,colliders) {
  if(x < -32 || x > 32 || z < -30 || z > 32)return true;
  return colliders.some(c=>(!c.enabled||c.enabled())&&foot+BODY_HEIGHT>c.minY&&foot+.07<c.maxY&&overlaps(x,z,c));
}
export function resolveMove(position,dx,dz,colliders,{bodyFoot=null,airborne=false}={}) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
  let {x,z,foot}=position;
  function accept(nx,nz) {
    const next=floorAt(nx,nz,foot);
    if(next===null)return;
    const height=bodyFoot===null?next:airborne?bodyFoot:Math.max(bodyFoot,next);
    if(airborne?next>height+.2:Math.abs(next-foot)>.25)return;
    if(obstructed(nx,nz,height,colliders))return;
    x=nx;z=nz;foot=next;
  }
  for(let i=0;i<steps;i++){accept(x+dx/steps,z);accept(x,z+dz/steps);}
  return {x,z,foot};
}
export function createCharacter(x,z,floor=0){return {x,z,floor,feet:floor,velocity:0,grounded:true};}
function supportAt(x,z,floor,feet,colliders) {
  let support=floor;
  for(const c of colliders)if((!c.enabled||c.enabled())&&c.maxY<=feet+.21&&c.maxY>support&&overlaps(x,z,c))support=c.maxY;
  return support;
}
// Small physics steps keep jump height, ceiling collision and landing independent
// of frame rate, including fast sprinting across thin walls and furniture.
export function stepCharacter(initial,vx,vz,dt,colliders,jump=false) {
  const state={...initial};const steps=Math.max(1,Math.ceil(Math.min(dt,.25)/(1/60))),h=Math.min(dt,.25)/steps;
  if(jump&&state.grounded){state.velocity=JUMP_SPEED;state.grounded=false;}
  for(let i=0;i<steps;i++){
    const move=resolveMove({x:state.x,z:state.z,foot:state.floor},vx*h,vz*h,colliders,{bodyFoot:state.feet,airborne:!state.grounded});
    state.x=move.x;state.z=move.z;state.floor=move.foot;
    const support=supportAt(state.x,state.z,state.floor,state.feet,colliders);
    if(state.grounded){if(Math.abs(support-state.feet)<=.25){state.feet=support;continue;}state.grounded=false;}
    const previous=state.feet;state.velocity-=GRAVITY*h;let next=previous+state.velocity*h;
    if(state.velocity>0){
      for(const c of colliders){if((c.enabled&&!c.enabled())||!overlaps(state.x,state.z,c))continue;
        if(previous+BODY_HEIGHT<=c.minY+.001&&next+BODY_HEIGHT>c.minY){next=c.minY-BODY_HEIGHT;state.velocity=0;}}
    }else{
      let landing=state.floor;
      for(const c of colliders)if((!c.enabled||c.enabled())&&overlaps(state.x,state.z,c)&&c.maxY<=previous+.005&&c.maxY>=next&&c.maxY>landing)landing=c.maxY;
      if(next<=landing){next=landing;state.velocity=0;state.grounded=true;}
    }
    state.feet=next;
  }
  return state;
}

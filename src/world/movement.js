import { floorAt, PLAYER_RADIUS } from './house.js';
export const EYE_HEIGHT = 1.58;
export function obstructed(x,z,foot,colliders) {
  if(x < -32 || x > 32 || z < -30 || z > 32)return true;
  return colliders.some(c=>{
    if(c.enabled && !c.enabled())return false;
    if(foot+1.73<=c.minY || foot+.07>=c.maxY)return false;
    const dx=x-Math.max(c.minX,Math.min(c.maxX,x));
    const dz=z-Math.max(c.minZ,Math.min(c.maxZ,z));
    return dx*dx+dz*dz<PLAYER_RADIUS*PLAYER_RADIUS;
  });
}
// Substeps and circle-vs-AABB collision prevent crossing a thin wall during a
// slow frame. Height-aware tests allow walking under the upper-floor furniture.
export function resolveMove(position,dx,dz,colliders) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
  let {x,z,foot}=position;
  function accept(nx,nz) {
    const next=floorAt(nx,nz,foot);
    if(next===null || Math.abs(next-foot)>.25 || obstructed(nx,nz,next,colliders))return;
    x=nx;z=nz;foot=next;
  }
  for(let i=0;i<steps;i++){accept(x+dx/steps,z);accept(x,z+dz/steps);}
  return {x,z,foot};
}

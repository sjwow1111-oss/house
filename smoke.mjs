import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('/workspace/artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
function observe(page){page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
async function ready(page){await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173');await page.waitForFunction(()=>window.mapDiagnostics && window.mapDiagnostics().renderer.frame>2);}
async function diagnostic(page){return page.evaluate(()=>window.mapDiagnostics());}
async function frames(page,n=3){const start=(await diagnostic(page)).renderer.frame;await page.waitForFunction(v=>window.mapDiagnostics().renderer.frame>=v,start+n);}
try {
  const page=await browser.newPage({viewport:{width:960,height:640}});observe(page);await ready(page);
  const initial=await diagnostic(page);assert.ok(initial.furnishings['킹 침대·침구']);assert.ok(initial.furnishings['싱크대·수전']);assert.ok(initial.colliderCount>100);
  await page.screenshot({path:'/workspace/artifacts/house-exterior.png'});
  await page.locator('#walk').click();await page.locator('#enter-walk').click();
  assert.equal((await diagnostic(page)).mode,'walk');assert.equal((await diagnostic(page)).pointerLocked,false);
  await page.keyboard.down('KeyW');await page.waitForFunction(()=>window.mapDiagnostics().camera[2]<10.8);await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');assert.equal((await diagnostic(page)).mode,'orbit');
  await page.locator('#visit-inside').click();await frames(page,4);
  assert.equal((await diagnostic(page)).room,'거실');assert.ok((await diagnostic(page)).doors.find(d=>d.type==='slide').amount>.8);
  await page.mouse.move(700,360);await page.mouse.down();await page.mouse.move(730,380);await page.mouse.up();assert.ok(Math.abs((await diagnostic(page)).yaw-.25)>.05);
  await page.locator('#destination').selectOption('living');
  await page.screenshot({path:'/workspace/artifacts/house-living.png'});console.log('PASS desktop movement, unlocked look and entry');
  await page.locator('#settings-toggle').click();await page.locator('[data-time="night"]').click();await frames(page);
  assert.equal((await diagnostic(page)).time,'night');
  await page.locator('#lights').uncheck();assert.equal((await diagnostic(page)).lampEmission,0);await page.locator('#lights').check();
  await page.locator('#wind').uncheck();assert.equal((await diagnostic(page)).windEnabled,false);
  await page.locator('#exposure').fill('1.1');assert.equal((await diagnostic(page)).exposure,1.1);
  await page.locator('#settings-toggle').click();await page.screenshot({path:'/workspace/artifacts/house-living-night.png'});console.log('PASS lighting, exposure and wind');
  for(const [key,room] of [['kitchen','주방'],['dining','다이닝'],['bathroom','욕실'],['bedroom','침실'],['office','서재'],['guest','게스트룸']]){
    await page.locator('#destination').selectOption(key);assert.equal((await diagnostic(page)).room,room);
    if(key==='bedroom'||key==='office')assert.ok((await diagnostic(page)).foot>4);
  }
  await page.locator('#destination').selectOption('bedroom');await page.screenshot({path:'/workspace/artifacts/house-bedroom.png'});
  await page.locator('#exit-walk').click();assert.equal((await diagnostic(page)).mode,'orbit');await page.close();
  console.log('PASS desktop: model, keyboard movement, unlocked drag, automatic door, seven spaces, lighting and exit');

  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const mobile=await context.newPage();observe(mobile);
  await mobile.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>{throw Error('Exploration must never request pointer lock');};});
  await ready(mobile);assert.equal(await mobile.locator('#settings').isVisible(),false);
  await mobile.locator('#walk').tap();await mobile.locator('#enter-walk').tap();
  const initialMobile=await diagnostic(mobile);assert.equal(initialMobile.mode,'walk');assert.equal(initialMobile.pointerLocked,false);assert.equal(initialMobile.grassInstances,26000);
  const cdp=await context.newCDPSession(mobile);const bounds=await mobile.locator('#joystick').boundingBox();
  const stick={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,id:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick]});
  const forward={...stick,y:stick.y-35};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[forward]});
  await mobile.waitForFunction(()=>window.mapDiagnostics().camera[2]<10.8);
  const look={x:290,y:410,id:2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[forward,look]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[forward,{...look,x:325,y:430}]});
  await mobile.waitForFunction(()=>Math.abs(window.mapDiagnostics().yaw)>.08);
  const multi=await diagnostic(mobile);assert.ok(Math.abs(multi.yaw)>.08);assert.ok(multi.joystick.y<-.5,'movement and look active simultaneously');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.waitForFunction(()=>window.mapDiagnostics().joystick.x===0&&window.mapDiagnostics().joystick.y===0);assert.deepEqual((await diagnostic(mobile)).joystick,{x:0,y:0});
  const stopped=(await diagnostic(mobile)).camera;await frames(mobile);assert.deepEqual((await diagnostic(mobile)).camera,stopped,'release stops movement');
  // Browser cancellation must release the virtual stick too.
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stick]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[forward]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await mobile.waitForFunction(()=>window.mapDiagnostics().joystick.x===0&&window.mapDiagnostics().joystick.y===0);assert.deepEqual((await diagnostic(mobile)).joystick,{x:0,y:0});
  await mobile.locator('#destination').selectOption('living');await frames(mobile);
  await mobile.screenshot({path:'/workspace/artifacts/house-mobile-interior.png'});
  await mobile.locator('#destination').selectOption('bedroom');assert.equal((await diagnostic(mobile)).room,'침실');
  await mobile.setViewportSize({width:844,height:390});await frames(mobile);await mobile.screenshot({path:'/workspace/artifacts/house-mobile-landscape.png'});
  await mobile.locator('#exit-walk').tap();assert.equal((await diagnostic(mobile)).mode,'orbit');
  await context.close();
  assert.deepEqual(errors,[]);console.log('PASS mobile: no pointer lock, simultaneous touch movement/look, release/cancel, indoor spaces, orientation and exit');
} finally {await browser.close();}

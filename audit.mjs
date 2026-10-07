import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const phase=process.argv[2] || 'after';
const only=process.argv[3]?.split(',');
const output=`/workspace/artifacts/audit/${phase}`;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const views=[
 ['entry-outside',[-1.4,2.2,5.3],[-1.35,1.9,2],.68,false],
 ['entry-open',[-.6,2.25,4.2],[-1.9,1.9,2],.68,true],
 ['entry-inside',[-1.35,2.26,1.7],[-1.35,2,4],.68,true],
 ['patio-closed',[4.2,2.3,6.1],[3.35,2,3.5],.68,false],
 ['patio-open',[3.4,2.26,4.8],[3.35,2,3],.68,true],
 ['patio-inside',[3.4,2.26,2.4],[3.35,2,4.5],.68,true],
 ['patio-far-closed',[8,3,14],[3.35,2,3.5],.68,false],
 ['living',[2.5,2.26,2.65],[5.2,1.5,.1],.68,true],
 ['media-wall',[3.4,2.26,-.1],[.2,1.7,.1],.68,true],
 ['kitchen',[2.3,2.26,-1.4],[4,1.9,-4.6],.68,true],
 ['dining',[-3.5,2.26,1.6],[-7.2,1.6,-2],.68,true],
 ['bathroom',[7.35,2.26,-2.6],[8.7,1.5,-4.1],.68,true],
 ['lounge',[7.2,2.26,.5],[8.8,1.5,-.4],.68,true],
 ['stairs-up',[-1.35,2.26,1.9],[-1.35,4,-2.2],.68,true],
 ['landing',[-1.35,5.61,-4.4],[-1.35,4.6,.8],4.03,true],
 ['bedroom',[1.1,5.61,1.6],[3.6,4.9,-2.4],4.03,true],
 ['bedroom-return',[5.3,5.61,-2],[.3,5.1,.5],4.03,true],
 ['office',[-3.2,5.61,1.8],[-6.9,5.1,-2.1],4.03,true],
 ['office-return',[-6.8,5.61,-2.4],[-5.7,5.1,2.6],4.03,true],
 ['guest',[7.15,5.61,-3.4],[8.6,4.9,-.9],4.03,true],
 ['guest-return',[7.1,5.61,.5],[8.3,5.1,-4.1],4.03,true],
 ['exterior-back',[16,8,-15],[0,3,-4],.68,false],
 ['exterior-front',[18,8,24],[0,3,0],.68,false],
];
try{
 const page=await browser.newPage({viewport:{width:800,height:500}});page.setDefaultTimeout(60000);
 await page.routeWebSocket('**',socket=>socket.close());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173');
 await page.waitForFunction(()=>window.mapInspection&&window.mapDiagnostics().renderer.frame>2);
 await page.addStyleTag({content:'body > :not(canvas) { display:none !important; }'});
 for(const [name,position,target,floor,walking] of views){
   if(only&&!only.includes(name))continue;
   if(phase==='before'&&!['patio-closed','patio-open','bedroom','guest','lounge','office-return'].includes(name))continue;
   await page.evaluate(({position,target,floor,walking})=>window.mapInspection.view(position,target,{floor,walking}),{position,target,floor,walking});
   const frame=await page.evaluate(()=>window.mapDiagnostics().renderer.frame);
   await page.waitForFunction(n=>window.mapDiagnostics().renderer.frame>=n,frame+3);
   if(name.includes('open'))await page.waitForFunction(type=>window.mapDiagnostics().doors.find(d=>d.type===type).amount>.98,name.startsWith('patio')?'slide':'hinge');
   if(name.includes('closed'))await page.waitForFunction(()=>window.mapDiagnostics().doors.every(d=>d.amount<.02));
   await page.screenshot({path:`${output}/${name}.png`});console.log(`VIEW ${name}`);
 }
 assert.deepEqual(errors,[]);console.log(`PASS visual audit capture: ${output}`);
}finally{await browser.close();}

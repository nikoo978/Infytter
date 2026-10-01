import test from "node:test";
import assert from "node:assert/strict";
import { registerBackLayer, closeBackLayer, installBackGuard } from "../src/services/appBack.js";
test("Back closes only the top layer, including nested GIF and workout", () => {
  const seen = [];
  const cleanup = [registerBackLayer(() => seen.push("workout"),200),registerBackLayer(() => seen.push("dialog"),300)];
  const gif = registerBackLayer(() => seen.push("gif"),1000);
  closeBackLayer(); assert.deepEqual(seen,["gif"]); gif(); closeBackLayer(); assert.deepEqual(seen,["gif","dialog"]);
  cleanup.reverse().forEach((fn)=>fn()); assert.equal(closeBackLayer(),false);
});
test("Back preserves router state, returns home, requires a rapid second tap", () => {
  let listener; let time = 10000; const pushed=[]; const exits=[]; const messages=[];
  let current={path:"/rutinas",url:"/rutinas?alumno=1",state:{idx:2,key:"route",usr:{test:true}}};
  const win={history:{state:current.state,pushState:(...args)=>pushed.push(args),go:(value)=>exits.push(value)},location:{href:"https://app.test/rutinas"},addEventListener:(name,fn)=>{listener=fn;},removeEventListener:()=>{}};
  const stop=installBackGuard(win,{getCurrent:()=>current,goHome:()=>{current={...current,path:"/",url:"/"};},notify:(message)=>messages.push(message),now:()=>time});
  const press=()=>listener({stopImmediatePropagation(){}});
  press(); assert.equal(current.path,"/"); assert.equal(exits.length,0); assert.deepEqual(pushed.at(-1)[0].usr,{test:true});
  press(); assert.match(messages.at(-1),/otra vez/); time+=2000; press(); assert.equal(exits.length,0);
  time+=500; press(); assert.deepEqual(exits,[-3]); stop();
});
test("closing an overlay resets the exit gesture",()=>{
  let listener; let time=100; const exits=[];
  const win={history:{state:{idx:0},pushState(){},go:(value)=>exits.push(value)},location:{href:"https://app.test/"},addEventListener:(_,fn)=>listener=fn,removeEventListener(){}};
  const stop=installBackGuard(win,{getCurrent:()=>({path:"/",url:"/",state:{idx:0}}),goHome(){},notify(){},now:()=>time});
  const press=()=>listener({stopImmediatePropagation(){}});press(); const unregister=registerBackLayer(()=>{},100);time+=100;press();unregister();time+=100;press();assert.equal(exits.length,0);stop();
});

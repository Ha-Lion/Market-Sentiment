#!/usr/bin/env node
/* PSD Calendar Lab browser smoke test v2.4.1.
   Runs against checked-out Lab HTML/JS. All external requests intercepted.
   No Supabase, Kaggle, production, or Beeks network mutations. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const week = {monday:"2026-11-16",sunday:"2026-11-22"};
function makeEvents() {
  return Array.from({length:24},(_,i)=>({
    event_id:"lab-fixture-"+i,
    country:["US","UK","AU","CA","JP"][i%5],
    indicator:"Synthetic Forecast Indicator "+(i+1),
    release_at_utc:"2026-11-"+(17+Math.floor(i/8))+"T13:"+String(i%8).padStart(2,"0")+":00Z",
    status:i<18?"RESEARCH_ONLY":"WITHHELD",
    psd_forecast:i<18?{
      status:"EXPERIMENTAL",value:i===0?0:i===1?-1250.5:i+.125,
      unit:i===1?"thousand":"percent MoM",method:"Synthetic test method"
    }:null
  }));
}
function makePayload(events=makeEvents()) {
  return {schema:"psd-calendar-lab-research/1",version:"V2.3",
    production:false,certified_28_day_accuracy:false,
    forecast_week:week,events};
}
const batch={feed_version:"V2.3",week_start:week.monday,
  week_end:week.sunday,event_count:24,forecast_count:18,withheld_count:6,research_only:true,events:makeEvents(),
  published_at:"2026-10-27T00:07:45Z"};
const beeks={schema_version:1,source:"BEEKS_LAB",lab_isolated:true,
  beeks_connected:true,updated_at:"2026-10-26T22:09:36Z",registry_counts:{US:1},
  events:[{event_key:"historical-check-1",indicator_id:"test-historical",
    indicator_name:"Historical Beeks check",country:"US",
    beeks_received_at:"2026-10-26T20:00:00Z",actual:"1.2",
    status:"Historical observation",synthetic:false,unit:"%"}]};
const mime={".html":"text/html",".js":"application/javascript",
  ".css":"text/css",".json":"application/json",".png":"image/png"};
const server = http.createServer((req,res)=>{
  let name;
  try{name=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname).slice(1);}
  catch{res.writeHead(400).end();return;}
  const file=path.resolve(root,name||"economic_calendar-lab.html");
  if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{"content-type":mime[path.extname(file)]||"text/plain",
      "cache-control":"no-store"}).end(data);
  });
});
const json = x => JSON.stringify(x);
const nap = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url="http://127.0.0.1:"+server.address().port+"/economic_calendar-lab.html";
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  let passes=0;
  async function setup(slowSupabase=false,beeksDown=false){
    const context=await browser.newContext({timezoneId:"America/New_York"});
    const page=await context.newPage();
    const errors=[];
    const writes=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/*",async route=>{
      const request=route.request(),url=new URL(request.url());
      if(!["GET","HEAD"].includes(request.method())) {
        writes.push(request.method()+" "+url.pathname);
        return route.fulfill({status:405,body:"Test blocks writes"});
      }
      if(url.pathname.includes("psd_calendar_lab_forecast_batches")){
        if(slowSupabase)await nap(800);
        return route.fulfill({status:200,contentType:"application/json",
          headers:{"access-control-allow-origin":"*"},body:json([batch])});
      }
      if(url.pathname.endsWith("beeks-lab-feed.json")){
        if(beeksDown)return route.fulfill({status:503,body:"Beeks test outage"});
        return route.fulfill({status:200,contentType:"application/json",body:json(beeks)});
      }
      if(["127.0.0.1","localhost"].includes(url.hostname))return route.continue();
      return route.fulfill({status:200,contentType:"text/plain",
        headers:{"access-control-allow-origin":"*"},body:""});
    });
    await page.goto(url,{waitUntil:"domcontentloaded"});
    return {page,context,errors,writes};
  }
  function checkNoErrors(test){
    assert.deepEqual(test.writes,[],"Unexpected network write");
    assert.deepEqual(test.errors,[],"Uncaught browser errors");
  }
  async function testCase(label,fn){
    const t=await setup(label.includes("race"),label.includes("Beeks unavailable"));
    try{await fn(t);checkNoErrors(t);console.log("PASS "+label);passes++;}
    finally{await t.context.close();}
  }
  try{
    await testCase("auto feed + 24 rows + all 3 forecast columns",async ({page})=>{
      await page.waitForFunction(()=>document.getElementById("psd-kaggle-feed-status")?.
        textContent.includes("Supabase Lab forecast feed connected"),null,{timeout:25000});
      await page.locator("#psd-kaggle-view-week").click();
      await page.waitForFunction(()=>document.querySelectorAll(
        '#calendar-body tr[data-ec-row-key^="event:"]').length===24,null,{timeout:25000});
      const data=await page.evaluate(()=>{
        const rows=[...document.querySelectorAll('#calendar-body tr[data-ec-row-key^="event:"]')];
        return {count:rows.length,psd:rows.map(r=>r.cells[6].textContent.trim()),
          ai:rows.map(r=>r.cells[7].textContent.trim()),
          other:rows.map(r=>r.cells[8].textContent.trim()),
          dates:[document.getElementById("custom-from").value,
            document.getElementById("custom-to").value],
          status:document.getElementById("psd-kaggle-feed-status").textContent};
      });
      assert.equal(data.count,24);
      assert.equal(data.psd.filter(x=>x!=="—").length,18);
      assert.equal(data.psd.filter(x=>x==="—").length,6);
      assert.ok(data.ai.every(x=>x==="—"),"AI forecasts must remain blank");
      assert.ok(data.other.every(x=>x==="—"),"Other forecasts must remain untouched");
      assert.deepEqual(data.dates,[week.monday,week.sunday]);
      assert.match(data.status,/NOT validated 28 days ahead/i);
      assert.ok(data.psd.some(x=>/0/.test(x)),"A zero PSD forecast should render");
    });
    await testCase("manual import wins an in-flight auto-read race",async ({page})=>{
      const events=makeEvents();
      events[0].psd_forecast.value=987.75;
      const payload=makePayload(events);
      await page.locator("#psd-kaggle-feed-file").setInputFiles({
        name:"private-research-preview.json",mimeType:"application/json",
        buffer:Buffer.from(json(payload))
      });
      await page.waitForFunction(()=>document.getElementById("psd-kaggle-feed-status")?.
        textContent.includes("Private Kaggle file loaded locally"),null,{timeout:12000});
      await nap(1100);
      assert.match(await page.locator("#psd-kaggle-feed-status").textContent(),
        /Private Kaggle file loaded locally/);
      await page.locator("#psd-kaggle-view-week").click();
      await page.waitForFunction(()=>document.querySelectorAll(
        '#calendar-body tr[data-ec-row-key^="event:"]').length===24,null,{timeout:25000});
      const tableText=await page.locator("#calendar-body").innerText();
      assert.match(tableText,/987\.75/);
    });
    await testCase("reject invalid source/withheld/duplicate research values",async ({page})=>{
      const invalid=[
        {events:makeEvents().map((e,i)=>i===1?{...e,event_id:"lab-fixture-0"}:e)},
        {events:makeEvents().map((e,i)=>i===20?{...e,psd_forecast:{
          status:"EXPERIMENTAL",value:5,unit:"%",method:"fake"}}:e)},
        {events:makeEvents().map((e,i)=>i===0?{...e,release_at_utc:"bad"}:e)}
      ];
      for(let i=0;i<invalid.length;i++){
        await page.locator("#psd-kaggle-feed-file").setInputFiles({
          name:"invalid-"+i+".json",mimeType:"application/json",
          buffer:Buffer.from(json(makePayload(invalid[i].events)))
        });
        await page.waitForFunction(()=>document.getElementById("psd-kaggle-feed-status")?.
          textContent.includes("Import blocked"),null,{timeout:12000});
      }
    });
    await testCase("Beeks unavailable still displays research-only PSD forecasts",async ({page})=>{
      await page.waitForFunction(()=>document.getElementById("psd-kaggle-feed-status")?.
        textContent.includes("Supabase Lab forecast feed connected"),null,{timeout:25000});
      await page.locator("#psd-kaggle-view-week").click();
      await page.waitForFunction(()=>document.querySelectorAll(
        '#calendar-body tr[data-ec-row-key^="event:"]').length===24,null,{timeout:25000});
      const rows=await page.locator('#calendar-body tr[data-ec-row-key^="event:"]').count();
      assert.equal(rows,24);
      assert.match(await page.locator("#provider-warning").innerText(),/Beeks Lab unavailable/i);
      assert.match(await page.locator("#provider-name").innerText(),/Supabase PSD Lab/i);
    });
    console.log("BROWSER SMOKE PASS: "+passes+" scenarios; external writes blocked");
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error("BROWSER SMOKE FAIL:",e);server.close();process.exitCode=1;});

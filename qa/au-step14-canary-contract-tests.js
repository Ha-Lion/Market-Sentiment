'use strict';
const assert=require('node:assert/strict');
const ids=['au_onboard_001','au_onboard_003','au_onboard_037'];
function check(x){assert.equal(x.schema,'au-optin-canary-v1');assert.equal(x.production_feed,false);assert.equal(x.record_count,x.events.length);if(!x.enabled)assert.equal(x.events.length,0);else{assert.equal(x.events.length,3);assert.deepEqual(x.events.map(e=>e.indicator_id).sort(),ids);assert.ok(x.events.every(e=>e.production===false&&e.publisher_vintage_verified===false));}}
const off={schema:'au-optin-canary-v1',production_feed:false,enabled:false,record_count:0,events:[]};
const on={...off,enabled:true,record_count:3,events:ids.map(indicator_id=>({indicator_id,production:false,publisher_vintage_verified:false}))};
check(off);check(on);assert.throws(()=>check({...off,record_count:1,events:[on.events[0]]}));assert.throws(()=>check({...on,events:[on.events[0],on.events[1],{...on.events[2],indicator_id:'au_onboard_012'}]}));assert.throws(()=>check({...on,production_feed:true}));assert.throws(()=>check({...on,events:[on.events[0],on.events[1],{...on.events[2],publisher_vintage_verified:true}]}));console.log('6/6 PASS: offline contract fixtures, not live canary');

import assert from 'node:assert/strict';
const base='http://127.0.0.1:'+(process.env.PORT||8787);
const h=await fetch(base+'/api/health');assert.equal(h.status,200);const health=await h.json();assert.equal(health.ok,true);assert.equal(health.mode,'test');
const d=await fetch(base+'/api/dialogue',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(d.status,200);const x=await d.json();assert.equal(x.transcript.length,2);assert.equal(x.transcript[0].speaker,'OpenAI');assert.equal(x.transcript[1].speaker,'Cloude');assert.ok(x.transcript.every(m=>m.text.length>0));
console.log('backend test passed');

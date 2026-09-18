import assert from 'node:assert/strict';
const base='http://127.0.0.1:'+(process.env.PORT||8787);

const h=await fetch(base+'/api/health');
assert.equal(h.status,200);
const health=await h.json();
assert.equal(health.ok,true);
assert.equal(health.mode,'test');

const d=await fetch(base+'/api/dialogue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
  sessionId:'test-session',
  scene:{distance:5.2,daylight:.8}
})});
assert.equal(d.status,200);
const first=await d.json();
assert.equal(first.speaker,'OpenAI');
assert.equal(first.decision.speak,true);
assert.ok(first.decision.text.length>0);

const t=await fetch(base+'/api/dialogue/turn',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
  sessionId:'test-session',
  speaker:'Cloude',
  scene:{distance:5.2,daylight:.8}
})});
assert.equal(t.status,200);
const second=await t.json();
assert.equal(second.speaker,'Cloude');
assert.ok(second.decision.text.length>0);
assert.equal(second.transcript.length,2);

const donation=await fetch(base+'/api/donations/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
  amount:50,currency:'RUB',name:'Tester',agent:'OpenAI'
})});
assert.equal(donation.status,200);
const donationBody=await donation.json();
assert.equal(donationBody.event.type,'ability');
assert.equal(donationBody.event.agent,'OpenAI');

const events=await fetch(base+'/api/donations/events?after=0');
assert.equal(events.status,200);
const eventBody=await events.json();
assert.ok(eventBody.events.some(x=>x.id===donationBody.event.id));

console.log('backend test passed');

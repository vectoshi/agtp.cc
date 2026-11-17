import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixtures=JSON.parse(fs.readFileSync('test-fixtures/http-envelope.json','utf8'));
test('pre-canonicalization examples preserve the original error inside a consistent duplicate problem',()=>{
 const [first,retry]=fixtures.cases;
 assert.equal(first.request.sender,retry.request.sender);
 assert.equal(first.request.idempotencyKey,retry.request.idempotencyKey);
 assert.equal(first.response.status,400);assert.equal(retry.response.status,409);
 assert.deepEqual(retry.response.body.originalProblem,first.response.body);
 assert.equal(retry.bodyProcessed,false);
 assert.notEqual(first.response.headers['Replay-Nonce'],retry.response.headers['Replay-Nonce']);
 for(const row of fixtures.cases){
  assert.equal(row.nonceConsumed,true);assert.equal(row.canonicalSignalExists,false);
  assert.equal(row.response.contentType,'application/problem+json');
  assert.equal(row.response.body.status,row.response.status);
  assert(!JSON.stringify(row.response.body).includes('signalHash'));
  assert(!JSON.stringify(row.response.body).includes('receipt'));
  assert(row.response.headers['Replay-Nonce']);
 }
 assert.equal(retry.response.body.type,'https://schema.agtp.org/problems/duplicate-delivery');
});
test('both already published snapshots remain immutable',()=>{
 assert.equal(sha(fs.readFileSync('2026/ED-agtp-2.1-20260903/index.html')),'90d897aa73e0ceaeae6c3133c9c5a629f5ee2cec7bd249489df03c153ecb7f12');
 assert.equal(sha(fs.readFileSync('2026/ED-agtp-2.1-20261117/index.html')),'109113c5e5cfcee158f97af15230b74ad3d84c6be071cd99bbcdf9d3f4979181');
});
test('the editorial note leaves all existing HTTP, crypto and aggregation source bytes intact',()=>{
 const source=fs.readFileSync('src/part10-http-crypto-agg.html','utf8');
 const original=source.replace(/<div class="note" id="http-envelope-errors">[\s\S]*?<\/div>\n/,'');
 assert.equal(sha(original),'399e9c8f6318db0bd4b0a32de241a77a6602252cca059e675dcafd837918761a');
});

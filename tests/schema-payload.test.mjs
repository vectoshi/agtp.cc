import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {encodeSchemaPayload,schemaHash,verifySchemaPayload} from './schema-payload.mjs';
const independent=bytes=>{
 const result=spawnSync('.test-venv/bin/python',['tests/independent.py'],{input:JSON.stringify({mode:'schema-payload',base64:bytes.toString('base64')}),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
};
test('isolated schema-payload JCS encoding agrees independently for Unicode, fractions, exponents and key order',()=>{
 const a={inputSchema:{type:'object',properties:{'😀':{default:0.125},'\ufffd':{default:1e30},'€':{default:1e-27},'e\u0301':{default:'é'},'é':{default:'e\u0301'}}},outputSchema:{type:'number',minimum:0.5,maximum:100}};
 const bytes=encodeSchemaPayload(a),python=independent(bytes);
 assert.equal(python.canonical,bytes.toString('utf8'));assert.equal(python.multihash,schemaHash(bytes));
 const reordered={outputSchema:a.outputSchema,inputSchema:{properties:Object.fromEntries(Object.entries(a.inputSchema.properties).reverse()),type:'object'}};
 assert.deepEqual(encodeSchemaPayload(reordered),bytes);
 assert.deepEqual(verifySchemaPayload(bytes,schemaHash(bytes)),a);
 assert(bytes.toString('utf8').indexOf('"😀"')<bytes.toString('utf8').indexOf('"\ufffd"'));
 const zero=encodeSchemaPayload({inputSchema:{const:-0}});assert.equal(zero.toString('utf8'),'{"inputSchema":{"const":0}}');assert.equal(independent(zero).canonical,zero.toString('utf8'));
});
test('raw schema verification rejects duplicate keys, noncanonical serialization and unbound byte substitutions',()=>{
 const bytes=encodeSchemaPayload({inputSchema:{type:'number',minimum:0.25}}),hash=schemaHash(bytes);
 for(const raw of [Buffer.concat([bytes,Buffer.from('\n')]),Buffer.from('{"inputSchema":{"type":"number","minimum":0.25,"minimum":0.25}}'),Buffer.from('{"inputSchema":{"minimum":0.5,"type":"number"}}'),Buffer.from([0xef,0xbb,0xbf,...bytes])])assert.throws(()=>verifySchemaPayload(raw,hash));
});
test('non-JSON values and invalid Unicode refuse before an executable conversion runs',()=>{
 let called=0;const get=Object.defineProperty({},'type',{enumerable:true,get(){called++;return 'string';}});
 for(const inputSchema of [get,new Date(),{default:NaN},{default:Infinity},{default:undefined},{default:'\ud800'},true])assert.throws(()=>encodeSchemaPayload({inputSchema}));
 assert.equal(called,0);
});

test('independent Python refuses raw duplicate keys, BOM/LF, invalid Unicode and overflow exponent',()=>{
 const bytes=encodeSchemaPayload({inputSchema:{type:'number',minimum:0.25}});
 const invalid=[Buffer.concat([bytes,Buffer.from('\n')]),Buffer.from('{"inputSchema":{"type":"number","minimum":0.25,"minimum":0.25}}'),Buffer.from([0xef,0xbb,0xbf,...bytes]),Buffer.from('{"inputSchema":{"const":"\\ud800"}}'),Buffer.from('{"inputSchema":{"maximum":1e999}}')];
 for(const raw of invalid){
  const result=spawnSync('.test-venv/bin/python',['tests/independent.py'],{input:JSON.stringify({mode:'schema-payload',base64:raw.toString('base64')}),encoding:'utf8'});
  assert.notEqual(result.status,0);assert.throws(()=>verifySchemaPayload(raw,schemaHash(raw)));
 }
});

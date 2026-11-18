import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const directory='test-fixtures/mcp-2025-03-26/';
const independent=(kind,document)=>{const result=spawnSync('.test-venv/bin/python',['tests/independent.py'],{input:JSON.stringify({mode:'mcp-march',kind,document}),encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
test('official March revision schema/prose/license are content-pinned and new registration is explicit',()=>{
 const provenance=JSON.parse(fs.readFileSync(directory+'provenance.json'));
 assert.equal(provenance.source_commit,'9236eb1cbfa02c17ab45c83a7bdbe55c450070be');
 for(const [path,pin]of Object.entries(provenance.files)){const raw=fs.readFileSync(directory+path);assert.equal(raw.length,pin.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),pin.sha256);}
 const source=fs.readFileSync('src/part11-profiles.html','utf8'),registry=fs.readFileSync('src/part14-appendices.html','utf8');
 assert(source.includes('id="profile-mcp-march"'));assert(registry.includes('<code>mcp/2025-03-26</code>'));
 assert(source.includes('March does not define'));assert(source.includes('MUST NOT advertise these as March-standard'));assert(source.includes('A legacy <code>url</code> field does not replace the required <code>server</code>'));
});
test('actual March tool and content results validate independently without later-only fields',()=>{
 const tool={name:'synthetic_march_tool',description:'Synthetic qualification only',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']},annotations:{title:'Synthetic',readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
 assert.deepEqual(independent('Tool',tool).extension_fields,[]);
 assert(independent('CallToolRequest',{method:'tools/call',params:{name:tool.name,arguments:{query:'retained synthetic data'}}}).standard_core_valid);
 assert.deepEqual(independent('CallToolResult',{content:[{type:'text',text:'first'},{type:'text',text:'second'}],isError:false}).extension_fields,[]);
 assert.throws(()=>independent('CallToolRequest',{method:'elicitation/create',params:{}}));
 assert.throws(()=>independent('CallToolRequest',{method:'tasks/get',params:{}}));
});
test('later output schemas and structured data remain explicit extension evidence rather than March-standard',()=>{
 const tool={name:'synthetic_march_tool',inputSchema:{type:'object'},outputSchema:{type:'object'}};
 assert.deepEqual(independent('Tool',tool).extension_fields,['outputSchema']);
 const result={content:[{type:'text',text:'retained result'}],structuredContent:{value:0.5},isError:false};
 assert.deepEqual(independent('CallToolResult',result).extension_fields,['structuredContent']);
 const schema=JSON.parse(fs.readFileSync(directory+'schema.json'));
 for(const field of ['outputSchema','structuredContent'])assert(!Object.hasOwn(schema.definitions[field==='outputSchema'?'Tool':'CallToolResult'].properties,field));
 for(const name of Object.keys(schema.definitions))assert(!/Elicitation|Task/.test(name));
});

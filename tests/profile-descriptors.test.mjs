import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import jsonld from 'jsonld';
import {encodeSchemaPayload,schemaHash,verifySchemaPayload} from './schema-payload.mjs';
const vc='https://www.w3.org/ns/credentials/v2',agtp='https://agtp.cc/context/v2.jsonld';
const contexts=new Map([[vc,JSON.parse(fs.readFileSync('test-fixtures/contexts/credentials-v2.jsonld'))],[agtp,JSON.parse(fs.readFileSync('context/v2.jsonld'))]]);
const documentLoader=async url=>{assert(contexts.has(url));return {contextUrl:null,documentUrl:url,document:contexts.get(url)};};
const canon=document=>jsonld.canonize(document,{algorithm:'RDFC-1.0',safe:true,format:'application/n-quads',documentLoader});
const sha=value=>createHash('sha256').update(value).digest();
const independent=request=>{const result=spawnSync('.test-venv/bin/python',['tests/independent.py'],{input:JSON.stringify(request),encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
const pair={inputSchema:{type:'object',properties:{request:{type:'object',properties:{value:{type:'number',minimum:0.125}}}},required:['request'],additionalProperties:false},outputSchema:{type:'object',properties:{output:{type:'object'}},required:['output'],additionalProperties:false}};
const payload=encodeSchemaPayload(pair),hash=schemaHash(payload),schemaPayload={encoding:'jcs-schema-payload/1',uri:'https://example.test/agtp/schema-payloads/v1/'+hash};
const definitions=[
 {name:'native-source-example',type:'api-tool',binding:{protocol:'gos-atom',version:'1.0.0',atom_id:'atom.compute.synthetic-profile-example',entry:'compute.synthetic-profile-example',carrier:'compute'}},
 {name:'https-source-example',type:'api-tool',binding:{protocol:'https',version:'synthetic-api.v1',url:'https://example.test/v1/profile-example',method:'POST',correlation:{responseUri:'/interaction_uri'}}},
 {name:'mcp-march-source-example',type:'mcp-tool',binding:{protocol:'mcp',version:'2025-03-26',profile:'mcp/2025-03-26',server:'https://example.test/v1/registry/mcp',tool:'synthetic_march_tool'}},
 {name:'mcp-source-example',type:'mcp-tool',binding:{protocol:'mcp',version:'2025-06-18',server:'https://example.test/v1/registry/mcp',tool:'synthetic_profile_example'}}
];
for(const item of definitions)test('complete '+item.name+' schema/proof fields remain independently hash-bound',async()=>{
 // Synthetic profile examples. No production identity/status/admission claim.
 const binding={...item.binding,schemaHash:hash,schemaPayload};
 const document={'@context':[vc,agtp],id:'urn:example:'+item.name,type:['VerifiableCredential','CapabilityDescriptor'],issuer:'did:example:evaluator',validFrom:'2026-11-18T00:00:00Z',validUntil:'2026-12-18T00:00:00Z',credentialSubject:{id:'urn:example:capability:'+item.name,owner:'did:example:evaluator',name:item.name,interfaceType:item.type,interface:{...binding,bindings:[binding]},...pair,space:'did:example:space',spaces:['did:example:space'],constraints:{exampleOnly:true,runtime_admission:'not-inferred'}}};
 const unsigned=await canon(document);assert.equal(independent({document}).canonical,unsigned);document.credentialSubject.contentHash=schemaHash(Buffer.from(unsigned));
 const canonical=await canon(document);assert.equal(independent({document}).canonical,canonical);assert.deepEqual(verifySchemaPayload(payload,document.credentialSubject.interface.schemaHash),pair);
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const proof={type:'DataIntegrityProof',cryptosuite:'eddsa-rdfc-2022',created:'2026-11-18T00:00:00Z',verificationMethod:'did:example:evaluator#key',proofPurpose:'assertionMethod'};
 const bytes=Buffer.concat([sha(await canon({...proof,'@context':document['@context']})),sha(canonical)]),signature=sign(null,bytes,privateKey);
 const request={document,proof,publicKeyHex:publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex'),signatureHex:signature.toString('hex')};
 assert(independent(request).verified);
 for(const field of ['schemaHash','schemaPayload','protocol','version']){
  const changed=structuredClone(document);changed.credentialSubject.interface[field]=field==='schemaPayload'?{...schemaPayload,encoding:'substituted'}:String(changed.credentialSubject.interface[field])+'-changed';
  assert.notEqual(await canon(changed),canonical);assert.throws(()=>independent({...request,document:changed}));
 }
 const changed=structuredClone(document);changed.credentialSubject.inputSchema.properties.request.properties.value.minimum=0.5;
 assert.notEqual(await canon(changed),canonical);assert.throws(()=>independent({...request,document:changed}));
});
test('new profiles are registered and explicitly separate source, observation, identity and feedback',()=>{
 const source=fs.readFileSync('src/part11-profiles.html','utf8'),registry=fs.readFileSync('src/part14-appendices.html','utf8');
 for(const name of ['gos-atom/1','https-api/1'])assert(registry.includes('<code>'+name+'</code>'));
 for(const anchor of ['profile-gos-atom','profile-https-api','profile-gos-schema-payload'])assert(source.includes('id="'+anchor+'"'));
 assert(source.includes('This initial invocation profile is Registry-only'));
 assert(source.includes('distinct from <code>http/1.1</code>'));
});

test('previous editorial snapshot is immutable alongside earlier frozen versions',()=>{
 assert.equal(sha(fs.readFileSync('2026/ED-agtp-2.1-20261117-editorial1/index.html')).toString('hex'),'fbda15ecfa7e63ea004e16f1af19dd13c2ba7b1e8b122f3284156368633c1680');
});

test('the previously published November18 binding snapshot is immutable',()=>{
 assert.equal(sha(fs.readFileSync('2026/ED-agtp-2.1-20261118/index.html')).toString('hex'),'4dcd5fcbc288d2a780153c3b5bd35ede04e30617899f5ca221d63f8dc36907f1');
});

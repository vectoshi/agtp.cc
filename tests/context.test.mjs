import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,createPublicKey,generateKeyPairSync,sign,verify} from 'node:crypto';
import jsonld from 'jsonld';
import {fixtures,observation,ns,vc,agtp} from './fixtures.mjs';
const load=p=>JSON.parse(fs.readFileSync(new URL(`../${p}`,import.meta.url)));
const contexts=new Map([[vc,load('test-fixtures/contexts/credentials-v2.jsonld')],[agtp,load('context/v2.jsonld')],['https://www.w3.org/ns/credentials/examples/v2',load('test-fixtures/contexts/credentials-examples-v2.jsonld')]]);
const documentLoader=async url=>{assert(contexts.has(url),`Unpinned context: ${url}`);return {contextUrl:null,documentUrl:url,document:contexts.get(url)};};
const canon=doc=>jsonld.canonize(doc,{algorithm:'RDFC-1.0',safe:true,format:'application/n-quads',documentLoader});
const independent=req=>{const p=spawnSync('.test-venv/bin/python',['tests/independent.py'],{input:JSON.stringify(req),encoding:'utf8'});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
const sha=s=>createHash('sha256').update(s).digest();
const decode58=s=>{const a='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(const c of s)n=n*58n+BigInt(a.indexOf(c));let hex=n.toString(16);if(hex.length%2)hex='0'+hex;return Buffer.concat([Buffer.alloc([...s].findIndex(c=>c!=='1')),Buffer.from(hex,'hex')]);};
for(const doc of [...fixtures,observation])test(`safe full composition: ${doc.type.at(-1)}`,async()=>{
 const canonical=await canon(doc); assert.equal(independent({document:doc}).canonical,canonical);
 // Every primitive leaf of every declared subject property changes signed RDF.
 const subject=doc.credentialSubject??doc;
 function* leaves(value,path=[]){if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value))yield*leaves(v,[...path,k]);}else yield [path,value];}
 for(const [path,value] of leaves(subject)){
  if(path.includes('@context')||path[0]==='type')continue;
  const changed=structuredClone(doc);let owner=changed.credentialSubject??changed;for(const p of path.slice(0,-1))owner=owner[p];
  owner[path.at(-1)]=typeof value==='number'?value+0.125:typeof value==='boolean'?!value:value+'-changed';
  assert.notEqual(await canon(changed),canonical,`Unbound field: ${path.join('.')}`);
 }
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const proof={type:'DataIntegrityProof',cryptosuite:'eddsa-rdfc-2022',created:'2026-11-17T00:00:00Z',verificationMethod:'did:example:synthetic#key',proofPurpose:'assertionMethod'};
 const data=Buffer.concat([sha(await canon({...proof,'@context':doc['@context']})),sha(canonical)]);
 const signature=sign(null,data,privateKey);assert(verify(null,data,publicKey,signature));
 const publicKeyHex=publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('hex');
 assert(independent({document:doc,proof,publicKeyHex,signatureHex:signature.toString('hex')}).verified);
 const tampered=structuredClone(doc);tampered.id+='-tampered';assert.throws(()=>independent({document:tampered,proof,publicKeyHex,signatureHex:signature.toString('hex')}));
});
test('ordered dimensions/value and scalar shape remain hash-bound',async()=>{
 const doc=fixtures[0], before=await canon(doc);
 for(const key of ['dimensions','value']){const changed=structuredClone(doc);changed.credentialSubject[key].reverse();assert.notEqual(await canon(changed),before);}
 const scalar=structuredClone(doc);scalar.credentialSubject.dimensions=['accuracy'];scalar.credentialSubject.value=0.9;
 const array=structuredClone(scalar);array.credentialSubject.value=[0.9];assert.notEqual(await canon(scalar),await canon(array));
 const expanded=await jsonld.expand(doc,{safe:true,documentLoader});const subject=expanded[0]['https://www.w3.org/2018/credentials#credentialSubject'][0];
 assert.deepEqual(subject[ns+'value'][0],{'@type':'@json','@value':[0.9,4.2]});
 assert(before.includes('<did:example:space>'));assert(!before.includes('<https://agtp.cc/accuracy>'));
});
test('protected core and VC terms cannot be redefined; uncontexted extensions fail closed',async()=>{
 for(const terms of [{space:'https://evil.test/space'},{agtp:'https://evil.test/'}]){const changed=structuredClone(fixtures[0]);changed['@context'].push(terms);await assert.rejects(canon(changed));}
 const vcScoped=structuredClone(fixtures[0]);vcScoped['@context'].push({issuer:'https://evil.test/issuer'});assert((await canon(vcScoped)).includes('<https://www.w3.org/2018/credentials#issuer>'));assert(!(await canon(vcScoped)).includes('<https://evil.test/issuer>'));
 const changed=structuredClone(fixtures[0]);changed.credentialSubject.undefinedExtension={arbitrary:4};await assert.rejects(canon(changed));
 const extended=structuredClone(fixtures[0]);extended['@context'].push({extra:{'@id':'https://example.test/extra','@type':'@json'}});extended.credentialSubject.extra={arbitrary:[2,1]};assert.notEqual(await canon(extended),await canon(fixtures[0]));
});
test('official W3C EdDSA-RDFC-2022 canonical bytes, hashes and signature verify independently',async()=>{
 const root='test-fixtures/w3c-eddsa-rdfc-2022/';const text=n=>fs.readFileSync(root+n,'utf8');
 const signed=JSON.parse(text('signedDataInt.json'));const doc=structuredClone(signed);delete doc.proof;
 const proof=JSON.parse(text('proofConfigDataInt.json'));const canonical=await canon(doc), proofCanonical=await canon(proof);
 assert.equal(canonical,text('canonDocDataInt.txt'));assert.equal(proofCanonical,text('proofCanonDataInt.txt'));
 assert.equal(sha(canonical).toString('hex'),text('docHashDataInt.txt').trim());assert.equal(sha(proofCanonical).toString('hex'),text('proofHashDataInt.txt').trim());
 const data=Buffer.concat([sha(proofCanonical),sha(canonical)]);assert.equal(data.toString('hex'),text('combinedHashDataInt.txt').trim());
 const publicBytes=decode58(load(root+'keyPair.json').publicKeyMultibase.slice(1)).subarray(2);const signature=decode58(signed.proof.proofValue.slice(1));
 assert.equal(signature.toString('hex'),text('sigHexDataInt.txt').trim());
 const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),publicBytes]),type:'spki',format:'der'});assert(verify(null,data,key,signature));
 assert.equal(independent({document:doc,proof:signed.proof,publicKeyHex:publicBytes.toString('hex'),signatureHex:signature.toString('hex')}).canonical,canonical);
});
test('aliases are graph-equivalent and plain receipt fields stay bound',async()=>{
 for(const doc of fixtures.slice(0,5)){const alias=structuredClone(doc);alias.type[1]+='Credential';assert.equal(await canon(alias),await canon(doc));}
 const receipt={'@context':[vc,agtp],...fixtures[2].credentialSubject};const canonical=await canon(receipt);assert.equal(independent({document:receipt}).canonical,canonical);assert(canonical.includes('<https://w3id.org/security#nonce>'));
});
test('published schemas, download links and digests match owning sources',()=>{
 const manifest=load('context/artifacts.json');assert.equal(manifest.canonical_context,agtp);
 for(const [path,digest]of Object.entries(manifest.sha256))assert.equal(sha(fs.readFileSync(path)).toString('hex'),digest,path);
 assert.equal(fs.readFileSync('context/v2','utf8'),fs.readFileSync('context/v2.jsonld','utf8'));
 const source=fs.readFileSync('src/part13-examples-schemas.html','utf8');
 for(const file of fs.readdirSync('json')){const schema=load('json/'+file);assert.equal(schema.$id,'https://agtp.cc/json/'+file);assert(source.includes(`href="${schema.$id}"`));}
 const sources=load('test-fixtures/sources.json');for(const [path,digest]of Object.entries(sources.sha256))assert.equal(sha(fs.readFileSync('test-fixtures/'+path)).toString('hex'),digest,path);
});

test("historical September draft bytes remain immutable",()=>{assert.equal(sha(fs.readFileSync('2026/ED-agtp-2.1-20260903/index.html')).toString("hex"),'90d897aa73e0ceaeae6c3133c9c5a629f5ee2cec7bd249489df03c153ecb7f12');});

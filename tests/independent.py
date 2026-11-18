"""Independent PyLD expansion/URDNA2015 and cryptography Ed25519 verification.
For the datasets used here RDFC-1.0 and URDNA2015 yield identical canonical bytes;
Node's RDFC-1.0 processor is separately checked against official W3C vectors.
"""
import sys,json,pathlib,hashlib,base64
from pyld import jsonld
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
root=pathlib.Path(__file__).resolve().parents[1]
contexts={
 'https://www.w3.org/ns/credentials/v2':'test-fixtures/contexts/credentials-v2.jsonld',
 'https://www.w3.org/ns/credentials/examples/v2':'test-fixtures/contexts/credentials-examples-v2.jsonld',
 'https://agtp.cc/context/v2.jsonld':'context/v2.jsonld',
}
def loader(url,options=None):
 if url not in contexts: raise ValueError('Unpinned context '+url)
 return {'contextUrl':None,'documentUrl':url,'document':json.loads((root/contexts[url]).read_text())}
request=json.load(sys.stdin)
def canon(doc):return jsonld.normalize(doc,{'algorithm':'URDNA2015','format':'application/n-quads','documentLoader':loader})
if request.get('mode') == 'mcp-march':
 from jsonschema import Draft7Validator
 official=json.loads((root/'test-fixtures/mcp-2025-03-26/schema.json').read_text())
 kind=request['kind']
 if kind not in {'Tool','CallToolRequest','CallToolResult','InitializeResult'}:raise ValueError('Unsupported March qualification kind')
 schema={'$schema':'http://json-schema.org/draft-07/schema#','$ref':'#/definitions/'+kind,'definitions':official['definitions']}
 Draft7Validator.check_schema(schema)
 Draft7Validator(schema).validate(request['document'])
 known=set(official['definitions'][kind].get('properties',{}))
 extensions=sorted(key for key in request['document'] if key not in known)
 print(json.dumps({'standard_core_valid':True,'extension_fields':extensions,'revision':'2025-03-26'}))
 sys.exit(0)
if request.get('mode') == 'schema-payload':
 # Isolated RFC8785 schema metadata path. Existing credential/money/evidence
 # parsing below remains unchanged. JCS numbers have IEEE754 semantics.
 from c14n.Canonicalize import canonicalize as jcs
 raw=base64.b64decode(request['base64'],validate=True)
 if len(raw)>8*1024*1024:raise ValueError('Schema payload byte limit')
 def no_constant(value):raise ValueError('Nonfinite JSON constant')
 payload=json.loads(raw.decode('utf-8'),parse_int=float,parse_float=float,parse_constant=no_constant)
 if type(payload) is not dict or 'inputSchema' not in payload or set(payload)-{'inputSchema','outputSchema'} or any(type(value) is not dict for value in payload.values()):raise ValueError('Exact materialized schema pair required')
 encoded=jcs(payload)
 if encoded!=raw:raise ValueError('Noncanonical schema payload bytes')
 digest=hashlib.sha256(encoded).digest()
 multihash='u'+base64.urlsafe_b64encode(bytes([0x12,0x20])+digest).decode().rstrip('=')
 print(json.dumps({'canonical':encoded.decode('utf-8'),'multihash':multihash},ensure_ascii=False))
 sys.exit(0)
doc=request['document']; canonical=canon(doc)
if 'proof' in request:
 proof=dict(request['proof']); proof['@context']=doc['@context']; proof.pop('proofValue',None)
 data=hashlib.sha256(canon(proof).encode()).digest()+hashlib.sha256(canonical.encode()).digest()
 Ed25519PublicKey.from_public_bytes(bytes.fromhex(request['publicKeyHex'])).verify(bytes.fromhex(request['signatureHex']),data)
print(json.dumps({'canonical':canonical,'verified':'proof' in request}))

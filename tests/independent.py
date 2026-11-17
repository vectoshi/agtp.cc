"""Independent PyLD expansion/URDNA2015 and cryptography Ed25519 verification.
For the datasets used here RDFC-1.0 and URDNA2015 yield identical canonical bytes;
Node's RDFC-1.0 processor is separately checked against official W3C vectors.
"""
import sys,json,pathlib,hashlib
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
doc=request['document']; canonical=canon(doc)
if 'proof' in request:
 proof=dict(request['proof']); proof['@context']=doc['@context']; proof.pop('proofValue',None)
 data=hashlib.sha256(canon(proof).encode()).digest()+hashlib.sha256(canonical.encode()).digest()
 Ed25519PublicKey.from_public_bytes(bytes.fromhex(request['publicKeyHex'])).verify(bytes.fromhex(request['signatureHex']),data)
print(json.dumps({'canonical':canonical,'verified':'proof' in request}))

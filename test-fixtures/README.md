# Independent verification sources

All identities and keys here are synthetic public W3C test vectors. No
production credential or private key is used. `keyPair.json` contains only the
public field from the upstream vector (the private field is omitted).

EdDSA-RDFC-2022 fixture source, pinned commit:
https://github.com/w3c/vc-di-eddsa/tree/13e7070534d1ba1c2987cb26bfb1535e0f15bb72/TestVectors/eddsa-rdfc-2022

The unsigned document and public-key field come from the parent TestVectors
directory at that same commit. W3C source licensing/notices:
https://github.com/w3c/vc-di-eddsa/blob/13e7070534d1ba1c2987cb26bfb1535e0f15bb72/LICENSE.md

Official contexts retrieved 17 November 2026, pinned locally and in
`sources.json` by SHA256:

- https://www.w3.org/ns/credentials/v2
- https://www.w3.org/ns/credentials/examples/v2

The tests reject unpinned network context resolution. Node jsonld.js with
rdf-canonize RDFC-1.0 must exactly reproduce W3C canonical N-Quads, hashes and
signature verification; Python PyLD independently expands and canonicalizes
our complete AGTP credentials and cryptography verifies their Node-created
Ed25519 proofs. Every primitive subject-field mutation must change signed RDF.
PyLD's URDNA2015 output is byte-equivalent to RDFC-1.0 on these fixtures; no
claim is made that PyLD implements every RDFC-1.0 denial-of-service limit.

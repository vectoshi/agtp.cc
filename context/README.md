# AGTP 2.1 context publication, 17 November 2026

This is a **newly authored** JSON-LD context for the current Editor's Draft,
published by the existing specification owner at
<https://agtp.cc/context/v2.jsonld>. It is not a recovered artifact from
`schema.agtp.org`, and it must not be substituted into historical proofs.
The September draft and its old URLs remain immutable historical records.

The former `schema.agtp.org` publication did not supply the v2 context. At repair
time its DNS resolved to `expired.namebright.com`; the parent domain used
expired Namebright nameservers. This repository's existing GitHub Pages host is
`agtp.cc`. The current draft therefore changes the **fetch URLs** of the context
and JSON Schemas to this owned publication origin. The stable ontology IRIs
`https://schema.agtp.org/ontology#…` continue to identify the vocabulary; an IRI
need not be a network fetch URL.

## Encoding decisions

Every context term is protected. Core classes and their specified aliases map
to the same ontology IRIs (§4.2); defined scalar predicates map to the named
AGTP vocabulary terms (§4.4 and §5). `persistence_policy` retains the established
`…#persistencePolicy` vocabulary spelling. Subject, Space, actor, owner,
receiver, interaction, provenance, receipt/signal IDs and status URLs are IRI
relationships. AGTP timestamps use XML Schema dateTime. VC-owned issuer,
credentialSubject, validity, status, proof, name and description definitions
are supplied unchanged by the required W3C VC2 context.

`nonce` maps to `https://w3id.org/security#nonce`, the VC2 Data Integrity
context's existing protected nonce term. It denotes the same nonce token; a
second global AGTP mapping would conflict when canonicalizing the proof.

`dimensions` and `value` use RDF JSON literals (`@type: @json`). The normative
values have different shapes (manifest dimension objects versus ordered signal
dimension IDs, scalar versus ordered numeric vector). RDF JSON preserves the
shapes and positional correspondence required by §5.2/§5.3 and prevents local
IDs such as `accuracy` from becoming unintended document-relative IRIs.
`covered` similarly preserves ordered leaf hashes or the batch-reference
object (§5.6). Open nested payloads use JSON literals: aggregation and
persistence policies, capabilities, knowledge, discovery, admission, interface,
input/output schemas, constraints, source artifacts, anchor references,
sourceRefs, artifacts, capabilityRefs, policyRefs and observation claims. Their
unknown nested keys remain part of the signed RDF literal; unknown top-level
extension properties require their own context. The context declares no default
`@vocab` that would silently assign meaning to unknown fields.

The optional DelegationCredential and PolicyAssertion class names are defined
by §4.2; their payload schemas are not defined in this draft. Tests use a
separate explicit synthetic extension namespace for those payloads. This
publication does not invent or claim qualification of a core delegation or
policy payload profile.

## Migration and verification

New producers follow the current draft's `.jsonld` URL. The extensionless
`context/v2` file is an identical convenience copy, not the canonical URL:
static GitHub Pages media typing is extension-dependent. JSON Schema downloads
are generated directly from current Appendix B; their new `$id` and context
constraint reflect this publication. No historical schema is rewritten.

Consumers must keep context URL, immutable owner commit and SHA256 bound
together. Do not load these new mappings under the old canonical URL for an
existing signature unless the original signer demonstrably used these exact
bytes. The earlier v1 extract is incompatible with full VC composition and is
not repaired or relabelled here. Context availability and proof interoperability
do not establish DID resolution, assertionMethod authority, status freshness,
Space admission or any AGTP conformance class.

`artifacts.json` records current artifact SHA256 values and copyright facts.
The repository previously supplied no LICENSE file or separate artifact grant;
this repair adds none. Existing Newfoundation copyright terms remain. Pinned
W3C fixtures remain governed by their source's license and document/software
notices; see `test-fixtures/README.md`.

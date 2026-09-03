#!/usr/bin/env python3
"""Assemble the AGTP specification page for agtp.cc.

index.html is a GENERATED artifact - edit the part files in this directory
and rebuild. The dated directories under 2026/ are frozen snapshots: to cut a
new draft, add a new dated path rather than rewriting an existing one.

Usage:
  python3 src/build.py                                    rebuild https://agtp.cc/
  python3 src/build.py --snapshot 2026/ED-agtp-2.1-20260903   also write that snapshot
  python3 src/build.py --artifact PATH                    also write a body-only copy

Steps: concatenate parts, inline figure SVGs, number sections and build the
table of contents, number examples and figures, add non-normative notices,
wrap BCP 14 keywords, validate anchors, and emit the pages."""
import os, re, sys

BUILD = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BUILD, ".."))
SITE = "https://agtp.cc/"

def _flag(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None

SNAPSHOT = _flag("--snapshot")
OUT_ARTIFACT = _flag("--artifact")

parts = sorted(p for p in os.listdir(BUILD) if re.match(r"part\d\d-.*\.html$", p))
body = "".join(open(os.path.join(BUILD, p), encoding="utf-8").read() for p in parts)
css = open(os.path.join(BUILD, "style.css"), encoding="utf-8").read()

# ---- 1. inline figures -------------------------------------------------------
body = re.sub(r"<!--FIG:([\w.-]+)-->",
              lambda m: open(os.path.join(BUILD, m.group(1)), encoding="utf-8").read(), body)

# ---- 2. section numbering and TOC data ---------------------------------------
tok = re.compile(r"(<section\b[^>]*>|</section>|<h([2-4])>(.*?)</h\2>)", re.S)
stack, out, pos, toc = [], [], 0, []
top_num = top_app = 0
for m in tok.finditer(body):
    out.append(body[pos:m.start()]); pos = m.end()
    t = m.group(1)
    if t.startswith("<section"):
        sid = re.search(r'id="([^"]+)"', t); sid = sid.group(1) if sid else ""
        cls = re.search(r'class="([^"]*)"', t); cls = cls.group(1).split() if cls else []
        if not stack:
            if sid in ("abstract", "sotd"):
                frame = dict(kind="plain", label="")
            elif "appendix" in cls:
                top_app += 1
                frame = dict(kind="app", label=chr(ord("A") + top_app - 1))
            else:
                top_num += 1
                frame = dict(kind="num", label=str(top_num))
        else:
            parent = stack[-1]
            if parent["kind"] == "plain":
                frame = dict(kind="plain", label="")
            else:
                parent["children"] += 1
                frame = dict(kind=parent["kind"], label=f'{parent["label"]}.{parent["children"]}')
        frame.update(id=sid, cls=cls, children=0, awaiting=True)
        stack.append(frame); out.append(t); continue
    if t == "</section>":
        if not stack: sys.exit("unbalanced </section> near: " + body[m.start()-80:m.start()])
        stack.pop(); out.append(t); continue
    level, title = int(m.group(2)), m.group(3)
    frame = stack[-1] if stack else None
    if frame is None or frame["kind"] == "plain" or not frame["awaiting"]:
        out.append(t); continue
    frame["awaiting"] = False
    label, anchor = frame["label"], frame["id"]
    notice = '\n<p class="informative-notice">This section is non-normative.</p>' if "informative" in frame["cls"] else ""
    out.append(f'<h{level}><bdi class="secno">{label}.</bdi> {title}'
               f'<a class="self-link" href="#{anchor}" aria-label="Permalink for section {label}">§</a></h{level}>{notice}')
    toc.append((len(stack), anchor, label, re.sub(r"<[^>]+>", "", title)))
out.append(body[pos:])
if stack: sys.exit("unclosed sections: " + ", ".join(f["id"] for f in stack))
body = "".join(out)

# ---- 3. examples and figures -------------------------------------------------
ex_n = [0]
def ex_sub(m):
    ex_n[0] += 1
    title = m.group(1)
    return (f'<div class="example" id="example-{ex_n[0]}"><span class="marker">Example {ex_n[0]}'
            f'<span class="marker-title">: {title}</span></span>')
body = re.sub(r'<div class="example" data-title="([^"]*)">', ex_sub, body)
fig_n = [0]
def fig_sub(m):
    fig_n[0] += 1
    return f'<figcaption><span class="figno">Figure {fig_n[0]}.</span> '
body = re.sub(r"<figcaption>", fig_sub, body)

# ---- 4. BCP 14 keywords ------------------------------------------------------
protected = re.compile(r"<pre\b.*?</pre>|<code\b.*?</code>|<svg\b.*?</svg>|<[^>]+>", re.S)
kw = re.compile(r"\b(MUST NOT|MUST|SHALL NOT|SHALL|SHOULD NOT|SHOULD|NOT RECOMMENDED|RECOMMENDED|REQUIRED|MAY|OPTIONAL)\b")
def wrap_keywords(s):
    res, last = [], 0
    for m in protected.finditer(s):
        res.append(kw.sub(r'<em class="rfc2119">\1</em>', s[last:m.start()]))
        res.append(m.group(0)); last = m.end()
    res.append(kw.sub(r'<em class="rfc2119">\1</em>', s[last:]))
    return "".join(res)
head_end = body.index("</div>\n\n<section id=\"abstract\">")  # keep head matter untouched
body = body[:head_end] + wrap_keywords(body[head_end:])

# ---- 5. table of contents ----------------------------------------------------
def build_toc(entries):
    html, depth = [], 0
    for d, anchor, label, title in entries:
        while depth < d:
            html.append('<ol class="toc">'); depth += 1
        while depth > d:
            html.append('</li></ol>'); depth -= 1
        if html and html[-1] not in ('<ol class="toc">',):
            html.append('</li>')
        html.append(f'<li><a href="#{anchor}"><bdi class="secno">{label}.</bdi> {title}</a>')
    while depth > 0:
        html.append('</li></ol>'); depth -= 1
    return "\n".join(html)
body = body.replace("<!--TOC-->", build_toc(toc))

# ---- 6. validation -----------------------------------------------------------
ids = set(re.findall(r'\bid="([^"]+)"', body))
hrefs = re.findall(r'href="#([^"]+)"', body)
missing = sorted({h for h in hrefs if h not in ids})
dupes = sorted({i for i in re.findall(r'\bid="([^"]+)"', body) if re.findall(r'\bid="%s"' % re.escape(i), body).__len__() > 1})
print(f"parts: {len(parts)}  sections: {len(toc)}  examples: {ex_n[0]}  figures: {fig_n[0]}  keywords wrapped: {body.count('class=\"rfc2119\"')}")
print("missing anchors:", missing or "none")
print("duplicate ids:", dupes or "none")

# ---- 7. emit -----------------------------------------------------------------
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=IBM+Plex+Sans:ital,wght@0,400;0,500;1,400&amp;display=swap" rel="stylesheet">')
description = ("AGTP 2.1 Editor's Draft: identity, provenance and learning signals for the agent graph, "
               "built on W3C DIDs and Verifiable Credentials, the Model Context Protocol, Agentic Resource Discovery "
               "and the Open Knowledge Format.")
FONTS_CSS = '''
@font-face { font-family: "Newfoundation Whyte"; src: url("PREFIXassets/fonts/NewfoundationWhyte-Regular.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: "Newfoundation Whyte"; src: url("PREFIXassets/fonts/NewfoundationWhyte-Medium.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
.head h1, .head .wordmark, .band span, .band-mobile { font-family: "Newfoundation Whyte", "IBM Plex Sans", "Helvetica Neue", Helvetica, Arial, sans-serif; }
'''

def page(canonical, prefix):
    """Render the full document. `prefix` is the relative path back to the site root."""
    fonts_css = FONTS_CSS.replace("PREFIX", prefix)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Graph Trust Protocol (AGTP) 2.1</title>
<meta name="description" content="{description}">
<meta name="author" content="Newfoundation">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
<meta property="og:title" content="Agent Graph Trust Protocol (AGTP) 2.1">
<meta property="og:description" content="{description}">
<meta property="og:site_name" content="AGTP">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Agent Graph Trust Protocol (AGTP) 2.1">
<meta name="twitter:description" content="{description}">
<link rel="icon" type="image/png" href="{prefix}assets/favicon.png">
{fonts}
<style>
{css}
{fonts_css}
</style>
</head>
<body>
{body}
</body>
</html>
"""

written = []
root_html = page(SITE, "")
open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(root_html)
written.append(("index.html", len(root_html)))

if SNAPSHOT:
    depth = len([p for p in SNAPSHOT.strip("/").split("/") if p])
    snap_dir = os.path.join(ROOT, *SNAPSHOT.strip("/").split("/"))
    os.makedirs(snap_dir, exist_ok=True)
    snap_html = page(SITE + SNAPSHOT.strip("/") + "/", "../" * depth)
    open(os.path.join(snap_dir, "index.html"), "w", encoding="utf-8").write(snap_html)
    written.append((SNAPSHOT.strip("/") + "/index.html", len(snap_html)))

if OUT_ARTIFACT:
    artifact_html = f"""<title>Agent Graph Trust Protocol</title>
{fonts}
<style>
{css}
</style>
{body}
"""
    open(OUT_ARTIFACT, "w", encoding="utf-8").write(artifact_html)
    written.append((os.path.abspath(OUT_ARTIFACT), len(artifact_html)))

for path, size in written:
    print(f"wrote {path} ({size // 1024} KiB)")

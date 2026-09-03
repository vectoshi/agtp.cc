# agtp.cc

The Agent Graph Trust Protocol (AGTP) specification, served at <https://agtp.cc/> by
GitHub Pages from the `main` branch.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Latest published version. **Generated — do not edit by hand.** |
| `2026/ED-agtp-2.1-20260903/` | Frozen dated snapshot of that draft. |
| `src/` | Document sources and the build script. |
| `assets/` | Favicon and the two web font files. |
| `CNAME` | GitHub Pages custom domain. |

## Building

```bash
python3 src/build.py                                       # rebuild index.html
python3 src/build.py --snapshot 2026/ED-agtp-2.1-20260903  # also write a dated snapshot
```

The script concatenates `src/part01-*.html` through `part14-*.html` in order, inlines the
figure SVG, numbers sections and builds the table of contents, numbers examples and
figures, adds the non-normative notices, wraps BCP 14 keywords outside code and diagrams,
and checks that every internal link resolves before writing anything.

## Editing

- A section is `<section id="…">` whose first child is a bare `<h2>`, `<h3>` or `<h4>`.
  `class="appendix"` makes it a lettered appendix; `class="informative"` adds the
  non-normative notice.
- Examples are `<div class="example" data-title="…">` and are numbered at build time.
  Figures take their number from their `<figcaption>`.
- Headings are set at regular weight. Nothing on the page is bold.

## Cutting a new draft

Add a new dated directory with `--snapshot` rather than rewriting an existing one, update
the head matter in `src/part01-head.html`, and add the new URL to `sitemap.xml`.

## Status

Editor's Draft, 3 September 2026, published by Newfoundation. This document is not a
product of the W3C, the IETF, or the ARD, OKF, MCP or A2A projects; it references their
specifications and does not modify them.

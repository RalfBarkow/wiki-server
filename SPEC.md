# SPEC.md

## Problem

`search.coffee` used `url.parse(...)` on text fragments that can’t be valid URLs (e.g. `http://localhost:...`, backtick-tainted links). On Node.js this triggers DEP0170 warnings now and will throw in future versions.

## Goal

Make the search indexer’s text extraction robust:

* Never throw (or warn) when encountering malformed links.
* Preserve current indexing semantics for all non-URL text.
* Keep Minisearch schema and public API unchanged.

## Scope

* **In**: `extractItemText` normalization pipeline; URL parsing; sanitation; Unicode safety.
* **Out**: Changing index fields, ranking, storage format, or search UI.

## Design

* Add a defensive `safeHostnamePath(u)`:

  * Trim, strip trailing punctuation, ignore placeholders (`…` or `...`).
  * Prefer WHATWG `URL` with a safe base; fall back to legacy `url.parse`.
  * Return `"hostname pathname"` or `""` if invalid.
* Update `extractItemText` pipeline:

  * Collapse markdown/HTML noise to plain text.
  * Replace bare `http(s)://…` with `"hostname pathname"` via `safeHostnamePath`.
  * Unicode-aware whitespace and punctuation cleanup.

## Non-Goals

* No attempt to “fix” invalid content in pages; we just avoid breaking on it.

## Requirements

* **Correctness**: Invalid links produce no warnings or exceptions.
* **Performance**: No measurable slowdown on typical sites (O(text) single pass + cheap URL tries).
* **Compatibility**: CoffeeScript source; Node 18+; no external deps added.
* **i18n**: Unicode regex classes for whitespace/punctuation.

## Acceptance Criteria

* Given `http://localhost:...` → extracted contains **no** hostname/path (and no warning).
* Given `https://example.org/a/b?x#y` → `"example.org /a/b"` present.
* Given `[label](https://host/x)` → includes `label` and `"host /x"`.
* Given code-fence/backtick-tainted URLs → no warning/throw.
* Running full reindex completes without DEP0170 warnings.

## Risks & Mitigations

* **Regex brittleness** → Unit tests for typical markdown/HTML shapes.
* **Node URL behavior** → Fallback to `url.parse` and final empty string on error.

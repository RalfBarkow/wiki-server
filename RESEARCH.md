# RESEARCH.md

## Background

* Legacy `url.parse` tolerated many malformed inputs. Current Node warns when the host/port section is invalid (e.g., `:...`) and indicates future versions will throw.
* WHATWG `URL` is stricter and **throws** on invalid inputs; it’s the recommended parser.
* Indexers must treat page content as hostile: HTML, markdown, code fences, Unicode punctuation, copy-paste artifacts.

## Notes that informed the patch

* Real pages frequently end URLs with punctuation/backticks from prose and code examples.
* Ellipses `…` or `...` often appear as placeholders; treating them as part of a port makes the URL invalid.
* Some content uses protocol-relative URLs (`//host/path`); if needed we can extend to accept them with a base (current patch focuses on explicit `http(s)`).

## Future work (optional)

* Recognize `//host/path` with `new URL(s, 'http:')`.
* Add a tiny “content linter” that flags malformed URLs during editing.
* Perf micro-benchmarks if sites exceed tens of thousands of pages.

# PLAN.md

## Milestones

1. **Patch extraction** (DONE)
   Implement `safeHostnamePath` + pipeline hardening in `search.coffee`.
2. **Tests**
   Add unit tests for extractor with valid/invalid/mixed inputs.
3. **Packaging**
   If modified inside `node_modules`, add `patch-package` + `postinstall`.
4. **Housekeeping**
   Optional content scan to find and clean obviously broken local links.
5. **Release**
   Document change; consider reverting `searchTimeoutMs` to original 20 min.

## Tasks

* [x] Replace `url.parse` call inside `extractItemText` with defensive path.
* [ ] Add tests: `test/search-extract.spec.mjs`
* [ ] Wire `patch-package` if needed:

  * `pnpm add -D patch-package`
  * `"postinstall": "patch-package"`
  * `npx patch-package wiki-server`
* [ ] Reindex locally; confirm no DEP0170 lines in logs.
* [ ] Optional: content scan:

  * `rg -n "http://localhost:…|http://localhost:\\.\\.\\." pages/ assets/`
  * `rg -n "http[s]?://[^\\s`'")\]]+[)`'\"\\]]" pages/ assets/`
* [ ] Ship notes in CHANGELOG.

## Rollback

* Revert to `search.coffee.orig`.
* Remove applied patch (`patches/wiki-server+*.patch` if using patch-package).

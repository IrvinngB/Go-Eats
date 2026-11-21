# Archive Report: Public Landing Page (add-landing-page)
- Verdict: PASS WITH WARNINGS (0 CRITICAL)
- Tasks: 29/29 complete (WU1-WU5; WU5 marked by verify with evidence)
- Capabilities synced (both new, saved as full specs):
  - landing-page: 9 requirements added, 0 modified, 0 removed -> keel/specs/landing-page/spec.md
  - frontend-testing: 7 requirements added, 0 modified, 0 removed -> keel/specs/frontend-testing/spec.md
- Artifacts: proposal, clarifications, specs/landing-page, specs/frontend-testing, design, blast-radius, tasks, apply-progress, verify-report, archive-report
- Completed: 2026-11-20

## Delivery
- Delivered as 4 chained PRs (#3-#6): WU1 test tooling, WU2 and WU3 foundations and tokens, WU4 hero and bento components.
- Fix PR #7: heading color leak. The global `h1-h4` color rule in `src/style.css` overrode landing tokens, so headings rendered in dark indigo in dark mode. It was found by the user in a real browser, not by the test suite. The fix scoped `.landing :is(h1, h2, h3, h4)` in landing.css. Its regression test is static (CSS text), because jsdom cannot compute the Tailwind cascade.

## Warnings that stayed open
- 360px no-horizontal-overflow: unproven in a browser (jsdom has no layout).
- Dark mode, contrast, 44px targets and focus ring: static proof only (CSS text and token math), never rendered in a browser. The PR #7 leak shows the limit of this kind of proof.
- `.lp-link` 44px target is not asserted by tests; `lang="es"` and the "Failing suite" scenario have no dedicated spec.
- Task 5.4 (no toast or TopBar with the backend down) was proven by component tests, not a real browser visit.
- These are superseded by the `redesign-landing-page` change and are not being fixed here.

## Out of scope (pre-existing, flagged by verify)
Default JWT/DB/MinIO secrets, CORS wildcard with credentials, Google Fonts without CSP/SRI. Recommend a separate hardening change.

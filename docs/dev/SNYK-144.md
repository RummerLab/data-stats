# Snyk dependency review — 4 November 2026

For #144, scanned the locked application and development dependencies with:

```sh
npx --yes snyk@1.1308.3 test --all-projects --dev
```

Use this CLI version or newer: 1.1304.0 cannot parse pnpm 12's multi-document
lockfile. The workspace configuration requires `--all-projects`.

The baseline reported 7 advisories / 37 vulnerable paths across 338 dependencies.
After fixes, Snyk reported 5 advisories / 19 paths across 289 dependencies.
These are dependency-graph findings, not proof that an attack is reachable.
No ignore policy was added. Snyk also printed an account monthly-test-limit warning
at the end of both scans; the figures above came from the returned project results.

## Fixed

- [esbuild insecure download](https://security.snyk.io/vuln/SNYK-JS-ESBUILD-17750822):
  override vulnerable transitive versions to 0.28.1, including Drizzle Kit's old
  loader chain. The reported attack involves the Deno installer and registry
  configuration; the app builds with Node/pnpm.
- [minimatch resource consumption](https://security.snyk.io/vuln/SNYK-JS-MINIMATCH-22111072):
  override versions below 11.0.1. This crosses a major version for some tooling
  consumers, so lint, build and tests must pass before retaining the override.
- [Leaflet HTML injection](https://security.snyk.io/vuln/SNYK-JS-LEAFLET-16427276):
  map tooltips now receive a DOM element populated with `textContent`. Popups
  already construct DOM elements with `textContent`. Layer-control names are
  application-authored constants; keep them trusted or escape them before reuse.

## Remaining upstream advisories

| Package         | Snyk advisory                                                                                                                                                                                        | Exposure and follow-up                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| deepmerge 4.3.1 | [19964053](https://security.snyk.io/vuln/SNYK-JS-DEEPMERGE-19964053)                                                                                                                                 | Build-tool configuration through the Svelte plugin; no published fixed release. Do not merge untrusted configuration. Upgrade when upstream supplies a fix. |
| leaflet 1.9.4   | [16427276](https://security.snyk.io/vuln/SNYK-JS-LEAFLET-16427276)                                                                                                                                   | Browser runtime; no fixed release. Text-node mitigation above does not remove the dependency advisory.                                                      |
| uri-js 4.4.1    | [19963961](https://security.snyk.io/vuln/SNYK-JS-URIJS-19963961), [19963963](https://security.snyk.io/vuln/SNYK-JS-URIJS-19963963), [20341609](https://security.snyk.io/vuln/SNYK-JS-URIJS-20341609) | ESLint/Ajv development tooling; no fixed release. No direct application import. Upgrade the consuming tools when a compatible fix is available.             |

The remaining findings are retained visibly rather than suppressed. This review
covers open-source dependencies, not a Snyk Code or container-image scan.
